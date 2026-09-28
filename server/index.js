const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const { getRandomPrompts } = require("./prompts");
const { getRandomTeamNames } = require("./teamNames");
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

const PORT = process.env.PORT || 5000;
const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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
 * - 'INDIVIDUAL_ANSWERING' (20 seconds: players submit their idea for their team)
 * - 'TEAM_VOTING' (60 seconds or until all team leaders press 'Team Ready': internal vote to pick team champion answer)
 * - 'HOST_REVIEW' (Host reviews chosen team answers)
 * - 'VOTING' (Main tournament: all teams/players vote between team answers side-by-side)
 * - 'ROUND_RESULT' (Vote reveal & points awarded to winning teams)
 * - 'LEADERBOARD' (Round standings)
 * - 'GAME_OVER' (Final leaderboard with team names + member rosters)
 */

class Room {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.players = new Map(); // socketId -> { id, name, teamId, isLeader, connected, draftAnswer: "" }
    this.teams = new Map(); // teamId -> { id, name, leaderId, memberIds: [], score: 0, ready: false, draftAnswers: [], selectedAnswer: null }
    this.phase = "LOBBY";
    this.totalRounds = 3;
    this.currentRound = 0;
    this.prompts = [];
    this.timeLeft = 0;
    this.timerInterval = null;
    
    // Per round
    this.roundPrompt = "";
    this.matchups = []; // pairs of team answers [[teamAAns, teamBAns], ...]
    this.currentMatchupIndex = 0;
    this.playerVoted = new Set();
  }

  // Auto divide players into equal teams (prefer 6 to 8, but lower amount of teams the better)
  formTeams() {
    const playerList = Array.from(this.players.values()).filter(p => p.connected);
    const count = playerList.length;
    if (count < 2) return;

    let numTeams = 2;
    if (count >= 32) {
      numTeams = 8;
    } else if (count >= 24) {
      numTeams = 6;
    } else if (count >= 16) {
      numTeams = 4;
    } else if (count >= 8) {
      numTeams = 3;
    } else if (count >= 4) {
      numTeams = 2;
    } else {
      numTeams = 2;
    }

    // Shuffled players
    const shuffled = [...playerList].sort(() => 0.5 - Math.random());
    const names = getRandomTeamNames(numTeams);

    this.teams.clear();
    for (let i = 0; i < numTeams; i++) {
      const teamId = `team_${i + 1}`;
      this.teams.set(teamId, {
        id: teamId,
        name: names[i] || `Team ${i + 1}`,
        leaderId: null,
        memberIds: [],
        score: 0,
        ready: false,
        draftAnswers: [],
        selectedAnswer: null
      });
    }

    const teamIds = Array.from(this.teams.keys());
    shuffled.forEach((p, idx) => {
      const assignedTeamId = teamIds[idx % numTeams];
      p.teamId = assignedTeamId;
      p.isLeader = false;
      const team = this.teams.get(assignedTeamId);
      team.memberIds.push(p.id);
    });

    // Pick random leader for each team
    for (const team of this.teams.values()) {
      if (team.memberIds.length > 0) {
        const randomLeader = team.memberIds[Math.floor(Math.random() * team.memberIds.length)];
        team.leaderId = randomLeader;
        const leaderPlayer = this.players.get(randomLeader);
        if (leaderPlayer) leaderPlayer.isLeader = true;
      }
    }
  }

  getPublicState() {
    const teamsArray = Array.from(this.teams.values()).map(t => ({
      id: t.id,
      name: t.name,
      leaderId: t.leaderId,
      leaderName: this.players.get(t.leaderId)?.name || "Leader",
      score: t.score,
      ready: t.ready,
      members: t.memberIds.map(mid => ({
        id: mid,
        name: this.players.get(mid)?.name || "Member",
        isLeader: mid === t.leaderId
      })),
      selectedAnswer: t.selectedAnswer
    }));

    return {
      code: this.code,
      phase: this.phase,
      totalRounds: this.totalRounds,
      currentRound: this.currentRound,
      timeLeft: this.timeLeft,
      roundPrompt: this.roundPrompt,
      teams: teamsArray,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        isLeader: p.isLeader,
        connected: p.connected,
        hasDrafted: Boolean(p.draftAnswer)
      })),
      currentMatchup: this.getCurrentMatchupPublic(),
      currentMatchupIndex: this.currentMatchupIndex,
      totalMatchups: this.matchups.length
    };
  }

  getHostState() {
    return {
      ...this.getPublicState(),
      allTeamAnswers: Array.from(this.teams.values())
        .filter(t => t.selectedAnswer)
        .map(t => ({
          teamId: t.id,
          teamName: t.name,
          answerId: t.selectedAnswer.id,
          text: t.selectedAnswer.text,
          authorName: this.players.get(t.selectedAnswer.authorId)?.name || "Team Member",
          approved: t.selectedAnswer.approved !== false
        }))
    };
  }

  // Get specific team view for team internal voting phase
  getTeamStateForPlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player || !player.teamId) return null;
    const team = this.teams.get(player.teamId);
    if (!team) return null;

    return {
      teamId: team.id,
      teamName: team.name,
      isLeader: player.isLeader,
      ready: team.ready,
      members: team.memberIds.map(mid => this.players.get(mid)?.name || "Member"),
      draftAnswers: team.draftAnswers.map(d => ({
        id: d.id,
        text: d.text,
        votes: d.votes.length,
        hasVotedForThis: d.votes.includes(socketId)
      }))
    };
  }

  getCurrentMatchupPublic() {
    if (this.phase !== "VOTING" && this.phase !== "ROUND_RESULT") return null;
    const current = this.matchups[this.currentMatchupIndex];
    if (!current) return null;

    const [ansA, ansB] = current;
    if (this.phase === "VOTING") {
      return {
        prompt: this.roundPrompt,
        answerA: { id: ansA.id, text: ansA.text, teamName: "Option A" },
        answerB: { id: ansB.id, text: ansB.text, teamName: "Option B" }
      };
    } else {
      const votesA = ansA.votes || [];
      const votesB = ansB.votes || [];
      return {
        prompt: this.roundPrompt,
        answerA: {
          id: ansA.id,
          text: ansA.text,
          teamId: ansA.teamId,
          teamName: this.teams.get(ansA.teamId)?.name || "Team A",
          authorName: this.players.get(ansA.authorId)?.name || "Member",
          votes: votesA.length,
          voters: votesA.map(vid => this.players.get(vid)?.name || "Someone")
        },
        answerB: {
          id: ansB.id,
          text: ansB.text,
          teamId: ansB.teamId,
          teamName: this.teams.get(ansB.teamId)?.name || "Team B",
          authorName: this.players.get(ansB.authorId)?.name || "Member",
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
      if (this.timeLeft >= 0 && onTick) onTick(this.timeLeft);
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", activeRooms: rooms.size });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"), (err) => {
    if (err) res.status(200).send("Prompt Drop Server Online");
  });
});

io.on("connection", (socket) => {
  let currentRoomCode = null;
  let isHost = false;

  function syncRoom(code) {
    const room = rooms.get(code);
    if (!room) return;
    io.to(code).emit("room_state", room.getPublicState());
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit("host_state", room.getHostState());
    }
    // Emit private team state updates
    for (const player of room.players.values()) {
      if (player.connected) {
        io.to(player.id).emit("team_state", room.getTeamStateForPlayer(player.id));
      }
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

    if (typeof callback === "function") callback({ success: true, roomCode: code });
    syncRoom(code);
  });

  // Host Bot Spawner for load testing
  socket.on("host_spawn_bots", ({ count = 50 }) => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "LOBBY") return;

    const botNames = [
      "Alex_SAP", "Beatrix_Fiori", "Carlos_ABAP", "Daria_Cloud", "Ethan_Hana",
      "Fatima_DevOps", "George_Consulting", "Hannah_Hypercare", "Ian_Agile", "Julia_BAPI",
      "Kevin_Cutover", "Liam_SuccessFactors", "Maya_Analytics", "Noah_Basis", "Olivia_Security",
      "Peter_Integration", "Quinn_Data", "Rachel_Scrum", "Sam_PMO", "Tara_Enterprise",
      "Uma_SupplyChain", "Victor_S4Hana", "Wendy_Finance", "Xavier_Solutions", "Yasmine_UI",
      "Zack_Testing", "Aiden_Salesforce", "Bella_Ariba", "Caleb_Middleware", "Diana_Architecture",
      "Eli_Platform", "Fiona_Release", "Gabe_Consultant", "Harper_Workflows", "Isaac_Schemas",
      "Jasmine_Transformation", "Kai_API", "Luna_Config", "Milo_Reports", "Nora_Legacy",
      "Oscar_Migration", "Penny_Sandbox", "Riley_Staging", "Stella_Production", "Tyler_Frontend",
      "Uri_Backend", "Vera_Quality", "Will_Automation", "Xena_Pipelines", "Zoe_Innovations"
    ];

    const targetCount = Math.min(count, botNames.length);
    for (let i = 0; i < targetCount; i++) {
      const botId = `bot_${Date.now()}_${i}`;
      room.players.set(botId, {
        id: botId,
        name: botNames[i],
        teamId: null,
        isLeader: false,
        connected: true,
        isBot: true,
        draftAnswer: ""
      });
    }

    syncRoom(currentRoomCode);
  });

  // 2. Player joins room
  socket.on("join_room", ({ roomCode, playerName }, callback) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === "function") callback({ success: false, message: "Room not found. Check the code!" });
      return;
    }

    const cleanName = (playerName || "").trim();
    if (!cleanName || isProfane(cleanName)) {
      if (typeof callback === "function") callback({ success: false, message: "Please enter a valid, SFW name." });
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: cleanName,
      teamId: null,
      isLeader: false,
      connected: true,
      draftAnswer: ""
    });

    socket.join(code);
    currentRoomCode = code;
    isHost = false;

    if (typeof callback === "function") {
      callback({ success: true, roomCode: code, playerId: socket.id, playerName: cleanName });
    }

    syncRoom(code);
  });

  // 3. Host updates settings
  socket.on("update_settings", ({ totalRounds }) => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "LOBBY") return;
    room.totalRounds = parseInt(totalRounds, 10) || 3;
    syncRoom(currentRoomCode);
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

    // Auto divide into teams & pick leaders
    room.formTeams();
    room.prompts = getRandomPrompts(room.totalRounds);
    room.currentRound = 0;
    startNextRound(room);
  });

  function startNextRound(room) {
    room.currentRound += 1;
    if (room.currentRound > room.totalRounds) {
      room.phase = "GAME_OVER";
      room.stopTimer();
      syncRoom(room.code);
      return;
    }

    room.phase = "INDIVIDUAL_ANSWERING";
    room.roundPrompt = room.prompts[room.currentRound - 1] || "The most memorable moment of this town hall…";
    room.matchups = [];
    room.currentMatchupIndex = 0;

    // Reset team and player round drafts
    for (const player of room.players.values()) {
      player.draftAnswer = "";
    }
    for (const team of room.teams.values()) {
      team.ready = false;
      team.draftAnswers = [];
      team.selectedAnswer = null;
    }

    syncRoom(room.code);

    // Auto-generate witty draft answers for bot players
    const botSnippets = [
      "Let's align our deliverables in the next sprint.",
      "Blame it on the legacy custom Z-table.",
      "It works completely fine on my local development sandbox.",
      "The transport request is still waiting for senior sign-off.",
      "Rebooting the server and praying for zero hypercare tickets.",
      "According to the agile manifesto, we need more coffee.",
      "Let's take this offline and circle back after the town hall.",
      "The client requested 37 additional custom fields in standard Fiori.",
      "Automated by AI before anyone noticed."
    ];

    for (const player of room.players.values()) {
      if (player.isBot && player.teamId) {
        const randomSnippet = botSnippets[Math.floor(Math.random() * botSnippets.length)];
        player.draftAnswer = randomSnippet;
        const team = room.teams.get(player.teamId);
        if (team) {
          team.draftAnswers.push({
            id: `draft_${player.id}_${Date.now()}`,
            authorId: player.id,
            text: randomSnippet,
            votes: []
          });
        }
      }
    }

    // 20-second individual input timer
    room.startTimer(
      20,
      (left) => io.to(room.code).emit("timer_tick", { timeLeft: left }),
      () => proceedToTeamVoting(room)
    );
  }

  // 5. Individual player inputs their answer idea (20s phase)
  socket.on("submit_draft_answer", ({ answer }, callback) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "INDIVIDUAL_ANSWERING") return;

    const player = room.players.get(socket.id);
    if (!player || !player.teamId) return;

    const text = (answer || "").trim();
    if (!text) {
      if (typeof callback === "function") callback({ success: false, message: "Please type an answer" });
      return;
    }

    const cleaned = isProfane(text) ? cleanText(text) : text;
    player.draftAnswer = cleaned;

    const team = room.teams.get(player.teamId);
    if (team) {
      // Add or update team draft list
      const existing = team.draftAnswers.find(d => d.authorId === socket.id);
      if (existing) {
        existing.text = cleaned;
      } else {
        team.draftAnswers.push({
          id: `draft_${socket.id}_${Date.now()}`,
          authorId: socket.id,
          text: cleaned,
          votes: []
        });
      }
    }

    if (typeof callback === "function") callback({ success: true });
    syncRoom(room.code);
  });

  // 6. Transition to Team Voting Phase (60s timer)
  function proceedToTeamVoting(room) {
    room.stopTimer();
    room.phase = "TEAM_VOTING";

    // Ensure every team has at least one default answer if none submitted
    for (const team of room.teams.values()) {
      if (team.draftAnswers.length === 0) {
        team.draftAnswers.push({
          id: `draft_${team.id}_sys`,
          authorId: team.leaderId || 'sys',
          text: "Let's circle back offline and sync next quarter.",
          votes: []
        });
      }
    }

    syncRoom(room.code);

    // Bots vote randomly on their team drafts
    for (const team of room.teams.values()) {
      if (team.draftAnswers.length > 0) {
        team.memberIds.forEach(mid => {
          const p = room.players.get(mid);
          if (p && p.isBot) {
            const randomDraft = team.draftAnswers[Math.floor(Math.random() * team.draftAnswers.length)];
            randomDraft.votes.push(p.id);
          }
        });
      }
      const leader = room.players.get(team.leaderId);
      if (leader && leader.isBot) {
        team.ready = true;
      }
    }

    // 60-second team internal voting timer
    room.startTimer(
      60,
      (left) => io.to(room.code).emit("timer_tick", { timeLeft: left }),
      () => finalizeTeamSelectionsAndProceed(room)
    );

    // If all teams ready (e.g. all bot leaders), proceed quickly
    if (Array.from(room.teams.values()).every(t => t.ready)) {
      setTimeout(() => {
        finalizeTeamSelectionsAndProceed(room);
      }, 1500);
    }
  }

  // 7. Team member votes on their team's draft answers
  socket.on("team_vote_draft", ({ draftId }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "TEAM_VOTING") return;

    const player = room.players.get(socket.id);
    if (!player || !player.teamId) return;

    const team = room.teams.get(player.teamId);
    if (!team) return;

    // Clear previous vote by this player in this team
    for (const draft of team.draftAnswers) {
      draft.votes = draft.votes.filter(vid => vid !== socket.id);
    }

    const selectedDraft = team.draftAnswers.find(d => d.id === draftId);
    if (selectedDraft) {
      selectedDraft.votes.push(socket.id);
    }

    syncRoom(room.code);
  });

  // 8. Team Leader presses "Team Ready"
  socket.on("team_leader_ready", () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "TEAM_VOTING") return;

    const player = room.players.get(socket.id);
    if (!player || !player.isLeader || !player.teamId) return;

    const team = room.teams.get(player.teamId);
    if (!team) return;

    team.ready = true;
    syncRoom(room.code);

    // If all teams are ready, immediately proceed!
    const allTeamsReady = Array.from(room.teams.values()).every(t => t.ready);
    if (allTeamsReady) {
      room.stopTimer();
      finalizeTeamSelectionsAndProceed(room);
    }
  });

  function finalizeTeamSelectionsAndProceed(room) {
    room.stopTimer();

    // Select the answer with highest votes for each team (or first if tie)
    for (const team of room.teams.values()) {
      const sorted = [...team.draftAnswers].sort((a, b) => b.votes.length - a.votes.length);
      const chosen = sorted[0] || { id: `sys_${team.id}`, authorId: 'sys', text: "Deliver high business value." };
      team.selectedAnswer = {
        id: chosen.id,
        teamId: team.id,
        authorId: chosen.authorId,
        text: chosen.text,
        approved: true,
        votes: []
      };
    }

    room.phase = "HOST_REVIEW";
    syncRoom(room.code);
  }

  // 9. Host Moderation & Launch Public Voting
  socket.on("host_toggle_approve_answer", ({ teamId }) => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const team = room.teams.get(teamId);
    if (team && team.selectedAnswer) {
      team.selectedAnswer.approved = !team.selectedAnswer.approved;
      syncRoom(room.code);
    }
  });

  socket.on("host_start_voting", () => {
    if (!currentRoomCode || !isHost) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "HOST_REVIEW") return;

    const approvedTeamAnswers = Array.from(room.teams.values())
      .filter(t => t.selectedAnswer && t.selectedAnswer.approved)
      .map(t => t.selectedAnswer);

    if (approvedTeamAnswers.length < 2) {
      approvedTeamAnswers.push({
        id: `sys_bot_${Date.now()}`,
        teamId: 'sys',
        authorId: 'sys',
        text: "Synergy and cloud transformation.",
        votes: []
      });
    }

    const shuffled = [...approvedTeamAnswers].sort(() => 0.5 - Math.random());
    room.matchups = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        room.matchups.push([shuffled[i], shuffled[i + 1]]);
      } else {
        room.matchups.push([
          shuffled[i],
          { id: `sys_extra_${Date.now()}`, teamId: 'sys', authorId: 'sys', text: "Per my previous email.", votes: [] }
        ]);
      }
    }

    room.currentMatchupIndex = 0;
    startMatchup(room);
  });

  function startMatchup(room) {
    if (room.currentMatchupIndex >= room.matchups.length) {
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

    // Bots vote in arena matchups
    for (const player of room.players.values()) {
      if (player.isBot && player.connected) {
        if (player.teamId !== current[0].teamId && player.teamId !== current[1].teamId) {
          const pickA = Math.random() > 0.5;
          if (pickA) {
            current[0].votes.push(player.id);
          } else {
            current[1].votes.push(player.id);
          }
          room.playerVoted.add(player.id);
        }
      }
    }

    // 10-second public voting timer
    room.startTimer(
      10,
      (left) => io.to(room.code).emit("timer_tick", { timeLeft: left }),
      () => showMatchupResult(room)
    );
  }

  // 10. All players vote in the main matchup
  socket.on("vote_answer", ({ answerId }, callback) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.phase !== "VOTING") return;

    if (room.playerVoted.has(socket.id)) {
      if (typeof callback === "function") callback({ success: false, message: "Already voted!" });
      return;
    }

    const current = room.matchups[room.currentMatchupIndex];
    if (!current) return;
    const [ansA, ansB] = current;

    const player = room.players.get(socket.id);
    // Prevent voting for own team's answer
    if (player && (ansA.teamId === player.teamId && ansA.id === answerId)) {
      if (typeof callback === "function") callback({ success: false, message: "Cannot vote for your own team!" });
      return;
    }
    if (player && (ansB.teamId === player.teamId && ansB.id === answerId)) {
      if (typeof callback === "function") callback({ success: false, message: "Cannot vote for your own team!" });
      return;
    }

    if (ansA.id === answerId) {
      ansA.votes.push(socket.id);
      room.playerVoted.add(socket.id);
    } else if (ansB.id === answerId) {
      ansB.votes.push(socket.id);
      room.playerVoted.add(socket.id);
    } else {
      if (typeof callback === "function") callback({ success: false, message: "Invalid option" });
      return;
    }

    if (typeof callback === "function") callback({ success: true });

    // If all eligible voters voted, reveal results immediately
    const eligibleCount = Array.from(room.players.values()).filter(
      p => p.connected && p.teamId !== ansA.teamId && p.teamId !== ansB.teamId
    ).length;

    if (room.playerVoted.size >= eligibleCount && eligibleCount > 0) {
      room.stopTimer();
      showMatchupResult(room);
    }
  });

  function showMatchupResult(room) {
    room.phase = "ROUND_RESULT";
    const current = room.matchups[room.currentMatchupIndex];
    if (current) {
      const [ansA, ansB] = current;
      const countA = ansA.votes.length;
      const countB = ansB.votes.length;

      // Award team scores: 100 points per vote + 150 sweep bonus
      if (countA > 0 && ansA.teamId !== 'sys') {
        const teamA = room.teams.get(ansA.teamId);
        if (teamA) {
          teamA.score += countA * 100;
          if (countB === 0 && countA >= 2) teamA.score += 150;
        }
      }
      if (countB > 0 && ansB.teamId !== 'sys') {
        const teamB = room.teams.get(ansB.teamId);
        if (teamB) {
          teamB.score += countB * 100;
          if (countA === 0 && countB >= 2) teamB.score += 150;
        }
      }
    }

    syncRoom(room.code);

    // 7 seconds result reveal
    room.startTimer(
      7,
      (left) => io.to(room.code).emit("timer_tick", { timeLeft: left }),
      () => {
        room.currentMatchupIndex += 1;
        startMatchup(room);
      }
    );
  }

  // 11. Host advances round or ends game
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
    room.stopTimer();
    for (const team of room.teams.values()) {
      team.score = 0;
    }
    syncRoom(room.code);
  });

  socket.on("disconnect", () => {
    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        if (isHost) {
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
  console.log(`🚀 Prompt Drop (Team Edition) running on port ${PORT}`);
  console.log(`🏢 Built for SAP Town Halls & Team Sessions`);
  console.log(`===============================================`);
});
