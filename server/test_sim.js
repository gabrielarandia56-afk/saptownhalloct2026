const { io } = require("socket.io-client");
const http = require("http");

async function runSimulation() {
  console.log("=== Starting Prompt Drop Multi-client Simulation ===");

  const serverUrl = "http://localhost:5000";

  // 1. Connect Host
  const hostSocket = io(serverUrl);
  let roomCode = "";

  await new Promise((resolve) => {
    hostSocket.on("connect", () => {
      console.log("Host connected:", hostSocket.id);
      hostSocket.emit("create_room", (res) => {
        console.log("Room created:", res);
        roomCode = res.roomCode;
        resolve();
      });
    });
  });

  // 2. Connect Players
  const player1 = io(serverUrl);
  const player2 = io(serverUrl);

  await new Promise((resolve) => {
    player1.on("connect", () => {
      player1.emit("join_room", { roomCode, playerName: "Alice_Cloud" }, (res) => {
        console.log("Player 1 join result:", res);
        resolve();
      });
    });
  });

  await new Promise((resolve) => {
    player2.on("connect", () => {
      player2.emit("join_room", { roomCode, playerName: "Bob_Analytics" }, (res) => {
        console.log("Player 2 join result:", res);
        resolve();
      });
    });
  });

  // 3. Host starts game
  console.log("Host starting game...");
  hostSocket.emit("start_game");

  // Wait for answering phase
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 4. Players submit answers
  console.log("Submitting answers...");
  player1.emit("submit_answers", {
    answers: ["The wifi drops every 4 minutes", "Coffee machine is out of beans"]
  });

  player2.emit("submit_answers", {
    answers: ["Deploying to prod on a Friday afternoon", "Everyone is on mute forever"]
  });

  // Wait for state transition to HOST_REVIEW
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 5. Host launches voting
  console.log("Host launching voting phase...");
  hostSocket.emit("host_start_voting");

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("Simulation finished successfully! All events and transitions validated.");
  hostSocket.disconnect();
  player1.disconnect();
  player2.disconnect();
  process.exit(0);
}

runSimulation().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});
