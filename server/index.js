const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const { getRandomPrompts } = require("./prompts");
const { isProfane, cleanText } = require("./moderation");

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend in production
const clientBuildPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuildPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Port configuration
const PORT = process.env.PORT || 5000;

/**
 * In-Memory Rooms State
 * Map<roomCode, RoomObject>
 */
const rooms = new Map();

// Helper to generate 4-character uppercase alphanumeric room code
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing letters like I, O, 0, 1
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

/**
 * Game Phases:
 * - 'LOBBY'
 * - 'ANSWERING' (Players submit answers)
 * - 'HOST_REVIEW' (Host reviews submitted answers, can remove/skip before voting)
 * - 'VOTING' (Players vote on pairs of answers)
 * - 'ROUND_RESULT' (Shows vote breakdown and point awards for current matchup/round)
 * - 'LEADERBOARD' (Intermediary or Final leaderboard)
 * - 'GAME_OVER'
 */

class Room {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.players = new Map(); // socketId -> { id, name, score, connected, answers: [] }
    this.phase = "LOBBY";
    this.totalRounds = 3;
    this.currentRound = 0;
    this.prompts = [];
    this.timer = null;
    this.timeLeft = 0;
    this.timerInterval = null;
    
    // Per round data
    this.roundPrompt = "";
    this.submissions = []; // array of { id, playerId, text, reported, approved, votes: [] }
    this.matchups = []; // array of pairs to vote on [[ansA, ansB], ...]
    this.currentMatchupIndex = 0;
    this.matchupVotes = {}; // answerId -> count
    this.playerVoted = new Set(); // set of playerIds who voted in current matchup
  }

  getPublicState() {
    return {
      code: this.code,
      phase: this.phase,
      totalRounds: this.totalRounds,
      currentRound: this.currentRound,
      timeLeft: this.timeLeft,
      roundPrompt: this.roundPrompt,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        connected: p.connected,
        hasAnswered: p.answers && p.answers.length >= 2
      })),
      // For answering phase: counts only
      submissionCount: this.submissions.length,
      expectedSubmissions: this.players.size * 2,
      // Current matchup for voting/results (anonymous during voting)
      currentMatchup: this.getCurrentMatchupPublic(),
      currentMatchupIndex: this.currentMatchupIndex,
      totalMatchups: this.matchups.length
    };
  }

  getHostState() {
    return {
      ...this.getPublicState(),
      // Host gets full review view of submissions
      allSubmissions: this.submissions.map(s => ({
        id: s.id,
        playerId: s.playerId,
        playerName: this.players.get(s.playerId)?.name || "Unknown",
        text: s.text,
        reported: s.reported,
        approved: s.approved
      }))
    };
  }

  getCurrentMatchupPublic() {
    if (this.phase !== "VOTING" && this.phase !== "ROUND_RESULT") {
      return null;
    }
    const current = this.matchups[this.currentMatchupIndex];
    if (!current) return null;

    const [ansA, ansB] = current;
    if (this.phase === "VOTING") {
      // Completely anonymous during voting
      return {
        prompt: this.roundPrompt,
        answerA: { id: ansA.id, text: ansA.text },
        answerB: { id: ansB.id, text: ansB.text }
      };
    } else {
      // Results reveal author and votes
      const votesA = ansA.votes || [];
      const votesB = ansB.votes || [];
      return {
        prompt: this.roundPrompt,
        answerA: {
          id: ansA.id,
          text: ansA.text,
          authorName: this.players.get(ansA.playerId)?.name || "Player",
          votes: votesA.length,
          voters: votesA.map(vid => this.players.get(vid)?.name || "Someone")
        },
        answerB: {
          id: ansB.id,
          text: ansB.text,
          authorName: this.players.get(ansB.playerId)?.name || "Player",
          votes: votesB.length,
          voters: votesB.map(vid => this.players.get(vid)?.name || "Someone")
        }
      };
    }
  }

  startTimer(seconds, onTick, onComplete) {
    this.stopTimer();
    this.timeLeft = seconds;
    if (onTick) onTick(this.timeLeft);

    this.timerInterval = setInterval(() => {
      this.timeLeft -= 1;
      if (this.timeLeft >= 0) {
        if (onTick) onTick(this.timeLeft);
      }
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (onComplete) onComplete();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

// REST health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", activeRooms: rooms.size });
});

// Fallback to index.html for Single-Page Application
app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"), (err) => {
    if (err) res.status(200).send("Prompt Drop Server Online");
  });
});

io.on("connection", (socket) => {
  let currentRoomCode = null;
  let isHost = false;

  // Broadcast helper
  function syncRoom(code) {
    const room = rooms.get(code);
    if (!room) return;
    io.to(code).emit("room_state", room.getPublicState());
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit("host_state", room.getHostState());
    }
  }

  // 1. Host creates room
  socket.on("create_room", (callback) => {
    const code = generateRoomCode();
    const room = new Room(code, socket.id);
    rooms.set(code, room);
    socket.join(code);
    currentRoomCode = code;
    isHost = true;

    if (typeof callback === "function") {
      callback({ success: true, roomCode: code });
    }
    syncRoom(code);
  });

  // 2. Player joins room
  socket.on("join_room", ({ roomCode, playerName }, callback) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === "function") {
        callback({ success: false, message: "Room not found. Check the 4-letter code!" });
      }
      return;
    }

    const cleanName = (playerName || "").trim();
    if (!cleanName) {
      if (typeof callback === "function") {
        callback({ success: false, message: "Please enter a valid display name." });
      }
      return;
    }

    if (isProfane(cleanName)) {
      if (typeof callback === "function") {
        callback({ success: false, message: "Please choose a professional, SFW name." });
      }
      return;
    }

    // Check duplicate name
    for (const player of room.players.values()) {
      if (player.name.toLowerCase() === cleanName.toLowerCase() && player.connected && player.id !== socket.id) {
        if (typeof callback === "function") {
          callback({ success: false, message: "Name already taken in this room. Please pick another." });
        }
        return;
      }
    }

    // Add or reconnect player
    room.players.set(socket.id, {
      id: socket.id,
      name: cleanName,
      score: 0,
      connected: true,
      answers: []
    });

    socket.join(code);
    currentRoomCode = code;
    isHost = false;

    if (typeof callback === "function") {
      callback({
        success: true,
        roomCode: code,
        playerId: socket.id,
        playerName: cleanName
      });
    }

    syncRoom(code);
  });

  // 3. Host updates settings (e.g. total rounds)
  socket.on("update_settings", ({ totalRounds }) => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "LOBBY") return;

    if (totalRounds >= 1 && totalRounds <= 10) {
      room.totalRounds = parseInt(totalRounds, 10);
      syncRoom(currentRoomCode);
    }
  });

  // 4. Host starts the game
  socket.on("start_game", () => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "LOBBY") return;

    if (room.players.size < 2) {
      socket.emit("error_msg", "Need at least 2 players to start!");
      return;
    }

    room.prompts = getRandomPrompts(room.totalRounds);
    room.currentRound = 0;
    startNextRound(room);
  });

  function startNextRound(room) {
    room.currentRound += 1;
    if (room.currentRound > room.totalRounds) {
      // Game Over
      room.phase = "GAME_OVER";
      room.stopTimer();
      syncRoom(room.code);
      return;
    }

    room.phase = "ANSWERING";
    room.roundPrompt = room.prompts[room.currentRound - 1] || "What is the best part of today's town hall?";
    room.submissions = [];
    room.matchups = [];
    room.currentMatchupIndex = 0;
    
    // Clear player round answers
    for (const player of room.players.values()) {
      player.answers = [];
    }

    syncRoom(room.code);

    // 30-second answering timer
    room.startTimer(
      30,
      (left) => {
        io.to(room.code).emit("timer_tick", { timeLeft: left });
      },
      () => {
        // Time is up -> Host review phase
        proceedToHostReview(room);
      }
    );
  }

  // 5. Player submits answers (2 answers)
  socket.on("submit_answers", ({ answers }, callback) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "ANSWERING") return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const sanitizedAnswers = (answers || [])
      .map(a => (a || "").trim())
      .filter(a => a.length > 0);

    if (sanitizedAnswers.length < 2) {
      if (typeof callback === "function") {
        callback({ success: false, message: "Please provide both answers!" });
      }
      return;
    }

    // Check profanity
    const cleaned1 = isProfane(sanitizedAnswers[0]) ? cleanText(sanitizedAnswers[0]) : sanitizedAnswers[0];
    const cleaned2 = isProfane(sanitizedAnswers[1]) ? cleanText(sanitizedAnswers[1]) : sanitizedAnswers[1];

    player.answers = [cleaned1, cleaned2];

    // Push into submissions list
    room.submissions.push(
      {
        id: `${socket.id}_1_${Date.now()}`,
        playerId: socket.id,
        text: cleaned1,
        reported: false,
        approved: true,
        votes: []
      },
      {
        id: `${socket.id}_2_${Date.now()}`,
        playerId: socket.id,
        text: cleaned2,
        reported: false,
        approved: true,
        votes: []
      }
    );

    if (typeof callback === "function") {
      callback({ success: true });
    }

    syncRoom(room.code);

    // Check if all players have submitted
    const allSubmitted = Array.from(room.players.values()).every(
      p => !p.connected || (p.answers && p.answers.length >= 2)
    );

    if (allSubmitted && room.players.size > 0) {
      room.stopTimer();
      proceedToHostReview(room);
    }
  });

  function proceedToHostReview(room) {
    room.stopTimer();
    room.phase = "HOST_REVIEW";
    syncRoom(room.code);
  }

  // 6. Host Moderation Controls
  socket.on("host_toggle_approve_answer", ({ answerId }) => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const sub = room.submissions.find(s => s.id === answerId);
    if (sub) {
      sub.approved = !sub.approved;
      syncRoom(room.code);
    }
  });

  socket.on("host_remove_answer", ({ answerId }) => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    room.submissions = room.submissions.filter(s => s.id !== answerId);
    syncRoom(room.code);
  });

  socket.on("host_skip_prompt", () => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const [newPrompt] = getRandomPrompts(1);
    room.roundPrompt = newPrompt;
    room.submissions = [];
    for (const player of room.players.values()) {
      player.answers = [];
    }
    room.phase = "ANSWERING";
    syncRoom(room.code);

    room.startTimer(
      30,
      (left) => {
        io.to(room.code).emit("timer_tick", { timeLeft: left });
      },
      () => {
        proceedToHostReview(room);
      }
    );
  });

  // 7. Host starts Voting Phase
  socket.on("host_start_voting", () => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "HOST_REVIEW") return;

    // Filter approved submissions only
    const approvedSubs = room.submissions.filter(s => s.approved);

    if (approvedSubs.length < 2) {
      // If not enough answers, add fallback hilarious corporate placeholder so game never breaks
      approvedSubs.push(
        { id: `sys_1_${Date.now()}`, playerId: 'sys', text: "It's on my to-do list for Q4.", reported: false, approved: true, votes: [] },
        { id: `sys_2_${Date.now()}`, playerId: 'sys', text: "Let's circle back on this offline.", reported: false, approved: true, votes: [] }
      );
    }

    // Shuffle submissions
    const shuffled = [...approvedSubs].sort(() => 0.5 - Math.random());
    room.matchups = [];

    // Pair answers side-by-side
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        room.matchups.push([shuffled[i], shuffled[i + 1]]);
      } else {
        // Odd number: pair with first submission or a witty bot answer
        room.matchups.push([
          shuffled[i],
          { id: `sys_extra_${Date.now()}`, playerId: 'sys', text: "Synergy and align with strategic initiatives.", reported: false, approved: true, votes: [] }
        ]);
      }
    }

    room.currentMatchupIndex = 0;
    startMatchup(room);
  });

  function startMatchup(room) {
    if (room.currentMatchupIndex >= room.matchups.length) {
      // Round completed -> show leaderboard
      room.phase = "LEADERBOARD";
      syncRoom(room.code);
      return;
    }

    room.phase = "VOTING";
    room.playerVoted = new Set();
    const current = room.matchups[room.currentMatchupIndex];
    current[0].votes = [];
    current[1].votes = [];

    syncRoom(room.code);

    // 10-second voting timer
    room.startTimer(
      10,
      (left) => {
        io.to(room.code).emit("timer_tick", { timeLeft: left });
      },
      () => {
        // Voting done -> show round result
        showMatchupResult(room);
      }
    );
  }

  // 8. Player votes for answer
  socket.on("vote_answer", ({ answerId }, callback) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "VOTING") return;

    // Check if player already voted
    if (room.playerVoted.has(socket.id)) {
      if (typeof callback === "function") callback({ success: false, message: "Already voted!" });
      return;
    }

    const current = room.matchups[room.currentMatchupIndex];
    if (!current) return;

    const [ansA, ansB] = current;
    
    // Players cannot vote for their own answer
    if (ansA.id === answerId && ansA.playerId === socket.id) {
      if (typeof callback === "function") callback({ success: false, message: "You cannot vote for your own answer!" });
      return;
    }
    if (ansB.id === answerId && ansB.playerId === socket.id) {
      if (typeof callback === "function") callback({ success: false, message: "You cannot vote for your own answer!" });
      return;
    }

    if (ansA.id === answerId) {
      ansA.votes.push(socket.id);
      room.playerVoted.add(socket.id);
    } else if (ansB.id === answerId) {
      ansB.votes.push(socket.id);
      room.playerVoted.add(socket.id);
    } else {
      if (typeof callback === "function") callback({ success: false, message: "Invalid answer option." });
      return;
    }

    if (typeof callback === "function") callback({ success: true });

    // If all eligible voters voted, immediately show results
    const eligibleVoters = Array.from(room.players.values()).filter(
      p => p.connected && p.id !== ansA.playerId && p.id !== ansB.playerId
    );

    if (room.playerVoted.size >= eligibleVoters.length && eligibleVoters.length > 0) {
      room.stopTimer();
      showMatchupResult(room);
    }
  });

  // 9. Report answer (Player SFW safeguard)
  socket.on("report_answer", ({ answerId }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const sub = room.submissions.find(s => s.id === answerId);
    if (sub) {
      sub.reported = true;
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit("answer_reported", { answerId, text: sub.text });
      }
    }
  });

  function showMatchupResult(room) {
    room.phase = "ROUND_RESULT";
    const current = room.matchups[room.currentMatchupIndex];
    if (current) {
      const [ansA, ansB] = current;
      const countA = ansA.votes.length;
      const countB = ansB.votes.length;

      // Award points: 100 points per vote, +150 bonus for sweep (Quiplash style)
      if (countA > 0 && ansA.playerId !== 'sys') {
        const playerA = room.players.get(ansA.playerId);
        if (playerA) {
          playerA.score += countA * 100;
          if (countB === 0 && countA >= 2) playerA.score += 150; // Clean sweep bonus
        }
      }
      if (countB > 0 && ansB.playerId !== 'sys') {
        const playerB = room.players.get(ansB.playerId);
        if (playerB) {
          playerB.score += countB * 100;
          if (countA === 0 && countB >= 2) playerB.score += 150; // Clean sweep bonus
        }
      }
    }

    syncRoom(room.code);

    // 7 seconds result reveal before advancing
    room.startTimer(
      7,
      (left) => {
        io.to(room.code).emit("timer_tick", { timeLeft: left });
      },
      () => {
        room.currentMatchupIndex += 1;
        startMatchup(room);
      }
    );
  }

  // 10. Host advances from Leaderboard to next round or end game
  socket.on("host_next_round", () => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    if (room.currentRound >= room.totalRounds) {
      room.phase = "GAME_OVER";
      syncRoom(room.code);
    } else {
      startNextRound(room);
    }
  });

  // 11. Host resets or ends game
  socket.on("host_end_game", () => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    room.phase = "GAME_OVER";
    room.stopTimer();
    syncRoom(room.code);
  });

  socket.on("host_play_again", () => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    room.phase = "LOBBY";
    room.currentRound = 0;
    room.submissions = [];
    room.matchups = [];
    room.stopTimer();
    for (const player of room.players.values()) {
      player.score = 0;
      player.answers = [];
    }
    syncRoom(room.code);
  });

  // Disconnection handler
  socket.on("disconnect", () => {
    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        if (isHost) {
          // Host left
          io.to(currentRoomCode).emit("host_disconnected");
        } else {
          const player = room.players.get(socket.id);
          if (player) {
            player.connected = false;
            syncRoom(currentRoomCode);
          }
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Prompt Drop Server running on port ${PORT}`);
  console.log(`🏢 Built for SAP Town Halls & Team Sessions`);
  console.log(`===============================================`);
});
