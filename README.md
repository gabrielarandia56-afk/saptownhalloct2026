# 💡 Prompt Drop — SAP Town Hall Party Game

A Quiplash-style, high-energy party game designed specifically for SAP town halls and corporate all-hands meetings. 100% SFW, hilarious, and easy to run with 20–50+ players.

---

## 🚀 Quick Start Guide

### 1. Start the Backend Server (Port 5000)
```powershell
cd prompt-drop/server
npm start
```

### 2. Start the Frontend Application (Port 3000)
In a separate terminal:
```powershell
cd prompt-drop/client
npm run dev
```

Open your browser to [http://localhost:3000](http://localhost:3000).

---

## 🎮 How to Play

### For the Host (Auditorium / Big Screen / Teams Screenshare)
1. Open the web app and click **"Create Host Room"**.
2. A unique **4-letter Room Code** (e.g., `ABCD`) is displayed in large fonts on screen.
3. Choose the total number of rounds (3 to 5).
4. Once all players have joined, click **"Start Game"**.
5. **Host Moderation**:
   - Before each voting phase, the host has a review dashboard where any inappropriate answers can be excluded or removed.
   - Host can also skip a prompt or end the game early if needed.
6. Progress through rounds to reveal vote tallies, authors, and the final leaderboard champions!

### For Players (Mobile Phone or Laptop)
1. Open the game on mobile or desktop.
2. Enter the **4-letter Room Code** and your **Display Name**.
3. **Answering Phase**: You have 30 seconds to type **2 witty answers** to the round's prompt.
4. **Voting Phase**: 
   - Side-by-side anonymous answer options appear on your screen.
   - Tap your favorite answer within the 10-second timer.
   - You cannot vote for your own answer.
   - If an answer is inappropriate, you can tap the 🚩 Flag icon to report it to the host.
5. Watch the big screen for point reveals, sweep bonuses, and leaderboard ranks!

---

## 🛡️ SFW & Corporate Safety Features
- **Pre-written prompt library**: Curated specifically for corporate life, hybrid work, agile, and SAP culture.
- **Profanity & leetspeak filter**: Automatically sanitizes player names and submitted text.
- **Host Pre-Screening Phase**: All answers are reviewed by the host before being pushed to voting.
- **Full Anonymity**: Authors are hidden during the voting phase.
- **No public chat**: Zero risk of unmoderated chat messages.

---

## 🛠️ Architecture & Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS (SAP Brand palette), Lucide Icons, Canvas Confetti, Web Audio API synthesizer.
- **Backend**: Node.js, Express, Socket.IO.
- **State**: In-memory high-performance room state engine supporting 50+ concurrent clients with zero database setup required.
