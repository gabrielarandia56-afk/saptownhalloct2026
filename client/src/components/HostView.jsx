import React, { useState } from 'react';
import { socket } from '../App';
import { soundFX } from '../utils/sound';
import { Users, Play, Pause, SkipForward, CheckCircle2, XCircle, AlertTriangle, Trophy, RotateCcw, Shield, Eye, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function HostView({ roomCode, hostState, onLeave }) {
  const [totalRounds, setTotalRounds] = useState(3);
  const [showScores, setShowScores] = useState(true);

  if (!hostState) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-12 h-12 border-4 border-sap-blue border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-300 font-medium">Initializing Room {roomCode}...</p>
      </div>
    );
  }

  const {
    phase,
    timeLeft,
    currentRound,
    roundPrompt,
    players,
    allSubmissions,
    currentMatchup,
    currentMatchupIndex,
    totalMatchups
  } = hostState;

  // Trigger confetti when game over or top winner revealed
  if (phase === 'GAME_OVER' || (phase === 'LEADERBOARD' && currentRound === hostState.totalRounds)) {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }

  const handleStartGame = () => {
    soundFX.playClick();
    socket.emit('start_game');
  };

  const handleUpdateRounds = (rounds) => {
    setTotalRounds(rounds);
    socket.emit('update_settings', { totalRounds: rounds });
  };

  const handleToggleApprove = (answerId) => {
    soundFX.playClick();
    socket.emit('host_toggle_approve_answer', { answerId });
  };

  const handleRemoveAnswer = (answerId) => {
    soundFX.playClick();
    socket.emit('host_remove_answer', { answerId });
  };

  const handleSkipPrompt = () => {
    soundFX.playClick();
    socket.emit('host_skip_prompt');
  };

  const handleStartVoting = () => {
    soundFX.playClick();
    socket.emit('host_start_voting');
  };

  const handleNextRound = () => {
    soundFX.playClick();
    socket.emit('host_next_round');
  };

  const handleEndGame = () => {
    if (confirm('Are you sure you want to end the game early?')) {
      soundFX.playClick();
      socket.emit('host_end_game');
    }
  };

  const handlePlayAgain = () => {
    soundFX.playClick();
    socket.emit('host_play_again');
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-pop-in">
      {/* Host Control Header */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-sap-blue/20 border border-sap-blue/40 px-4 py-2 rounded-xl flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room Code</span>
            <span className="font-mono text-3xl sm:text-4xl font-black text-sap-light tracking-widest">{roomCode}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-300">Phase:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-cyan-300 border border-white/15">
                {phase.replace('_', ' ')}
              </span>
            </div>
            {phase !== 'LOBBY' && phase !== 'GAME_OVER' && (
              <div className="text-xs text-slate-400 mt-1">
                Round <span className="text-white font-bold">{currentRound}</span> of <span className="text-white font-bold">{hostState.totalRounds}</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Timer Widget */}
        {timeLeft > 0 && phase !== 'LOBBY' && phase !== 'HOST_REVIEW' && (
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
            <div className={`w-3 h-3 rounded-full ${timeLeft <= 5 ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Time Remaining</span>
              <span className={`text-2xl font-black font-mono leading-none ${timeLeft <= 5 ? 'text-rose-400' : 'text-amber-400'}`}>
                {timeLeft}s
              </span>
            </div>
          </div>
        )}

        {/* Host Action Buttons */}
        <div className="flex items-center gap-2">
          {phase !== 'LOBBY' && phase !== 'GAME_OVER' && (
            <button
              onClick={handleEndGame}
              className="px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/40 transition-all flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>End Game</span>
            </button>
          )}

          <button
            onClick={onLeave}
            className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-medium border border-white/10 transition-all"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* PHASE 1: LOBBY */}
      {phase === 'LOBBY' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Join instructions */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sap-blue/20 text-cyan-300 text-xs font-bold mb-4 border border-sap-blue/40">
                <Users className="w-4 h-4" />
                <span>Waiting for players to join...</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight">
                Join at your device using code:
              </h2>
              <div className="my-6 inline-block bg-gradient-to-r from-sap-navy via-slate-800 to-sap-navy border-2 border-sap-blue p-6 rounded-3xl shadow-2xl">
                <span className="font-mono text-5xl sm:text-7xl font-black text-white tracking-widest px-4">
                  {roomCode}
                </span>
              </div>

              <div className="space-y-2 text-slate-300 text-sm max-w-lg">
                <p>💡 <span className="font-semibold text-white">How it works:</span> In each round, players write 2 witty answers to a corporate prompt. Then everyone votes on the best answers anonymously!</p>
              </div>
            </div>

            {/* Host Round Selection & Start */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase font-bold text-slate-400">Total Rounds:</span>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  {[3, 4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleUpdateRounds(num)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                        totalRounds === num
                          ? 'bg-sap-blue text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className={`px-8 py-4 rounded-2xl font-black text-lg flex items-center gap-3 shadow-xl transition-all transform active:scale-95 ${
                  players.length >= 2
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/20 cursor-pointer'
                    : 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Start Game ({players.length} Joined)</span>
              </button>
            </div>
          </div>

          {/* Connected Players List */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sap-blue" />
                <h3 className="font-bold text-white text-lg">Players Joined</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-sap-blue/20 text-cyan-300 font-bold text-xs border border-sap-blue/30">
                {players.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[360px] space-y-2 pr-1">
              {players.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 text-xs">
                  <Users className="w-8 h-8 mb-2 opacity-30" />
                  <span>No players have joined yet.</span>
                  <span>Share the code with your team!</span>
                </div>
              ) : (
                players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-sap-blue/40 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sap-blue to-cyan-400 flex items-center justify-center font-bold text-xs text-white">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-slate-200">{p.name}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  </div>
                ))
              )}
            </div>
            {players.length < 2 && (
              <p className="mt-3 text-[11px] text-amber-400/90 text-center">
                Need at least 2 players to start the town hall session.
              </p>
            )}
          </div>
        </div>
      )}

      {/* PHASE 2: ANSWERING */}
      {phase === 'ANSWERING' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8 sm:p-12 backdrop-blur-xl text-center shadow-2xl relative overflow-hidden">
          <div className="max-w-3xl mx-auto space-y-6">
            <span className="px-4 py-1.5 rounded-full bg-sap-blue/20 text-cyan-300 text-xs font-bold uppercase tracking-wider border border-sap-blue/40">
              Round {currentRound} Prompt
            </span>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
              "{roundPrompt}"
            </h2>

            <div className="py-6">
              <div className="inline-block bg-white/5 border border-white/10 px-8 py-4 rounded-2xl">
                <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Answers Collected</span>
                <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
                  {hostState.submissionCount} / {hostState.expectedSubmissions}
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-sm">
              Players are currently writing their hilarious answers on their devices...
            </p>

            <div className="pt-4 flex items-center justify-center gap-4">
              <button
                onClick={handleSkipPrompt}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all flex items-center gap-2"
              >
                <SkipForward className="w-4 h-4" />
                <span>Skip this prompt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 3: HOST REVIEW & MODERATION */}
      {phase === 'HOST_REVIEW' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Host Pre-Screening & Moderation</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Review submitted answers before opening the public voting round. You can uncheck or delete any inappropriate submissions.
              </p>
            </div>

            <button
              onClick={handleStartVoting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sap-blue to-sap-accent hover:from-blue-600 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-sap-blue/20 transition-all flex items-center gap-2"
            >
              <span>Launch Voting Round</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allSubmissions && allSubmissions.map((sub, idx) => (
              <div
                key={sub.id || idx}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  sub.approved
                    ? 'bg-white/5 border-white/10'
                    : 'bg-rose-950/30 border-rose-500/40 opacity-75'
                }`}
              >
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-semibold text-slate-300">Author: {sub.playerName}</span>
                    {sub.reported && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                        Reported by player
                      </span>
                    )}
                  </div>
                  <p className="text-base font-medium text-white italic">"{sub.text}"</p>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleApprove(sub.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      sub.approved
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    }`}
                  >
                    {sub.approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{sub.approved ? 'Approved for Voting' : 'Include in Voting'}</span>
                  </button>

                  <button
                    onClick={() => handleRemoveAnswer(sub.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Remove answer"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE 4: VOTING (Big Screen Projection) */}
      {phase === 'VOTING' && currentMatchup && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-12 backdrop-blur-xl shadow-2xl text-center space-y-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Matchup {currentMatchupIndex + 1} of {totalMatchups}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2 max-w-3xl mx-auto">
              "{roundPrompt}"
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Card A */}
            <div className="bg-gradient-to-br from-sap-blue/20 to-slate-900 border-2 border-sap-blue/50 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col justify-center items-center min-h-[180px] transform hover:scale-102 transition-all">
              <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-300 mb-2">Option A</span>
              <p className="text-xl sm:text-2xl font-bold text-white text-center">
                "{currentMatchup.answerA.text}"
              </p>
            </div>

            {/* Card B */}
            <div className="bg-gradient-to-br from-amber-500/20 to-slate-900 border-2 border-amber-500/50 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col justify-center items-center min-h-[180px] transform hover:scale-102 transition-all">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-300 mb-2">Option B</span>
              <p className="text-xl sm:text-2xl font-bold text-white text-center">
                "{currentMatchup.answerB.text}"
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold text-slate-400 animate-pulse">
            Vote on your phone / laptop now!
          </p>
        </div>
      )}

      {/* PHASE 5: ROUND RESULT REVEAL */}
      {phase === 'ROUND_RESULT' && currentMatchup && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-12 backdrop-blur-xl shadow-2xl text-center space-y-8 animate-pop-in">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Results Reveal!
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              "{roundPrompt}"
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Card A Result */}
            <div className={`p-6 sm:p-8 rounded-3xl border-2 flex flex-col justify-between transition-all ${
              currentMatchup.answerA.votes >= currentMatchup.answerB.votes
                ? 'bg-sap-blue/30 border-sap-blue shadow-2xl shadow-sap-blue/30'
                : 'bg-white/5 border-white/10 opacity-70'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    By {currentMatchup.answerA.authorName}
                  </span>
                  {currentMatchup.answerA.votes > currentMatchup.answerB.votes && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-current" /> Winner
                    </span>
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">
                  "{currentMatchup.answerA.text}"
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Votes: {currentMatchup.answerA.voters?.join(', ') || 'None'}</span>
                <span className="text-2xl font-black text-cyan-300 font-mono">
                  {currentMatchup.answerA.votes} {currentMatchup.answerA.votes === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            </div>

            {/* Card B Result */}
            <div className={`p-6 sm:p-8 rounded-3xl border-2 flex flex-col justify-between transition-all ${
              currentMatchup.answerB.votes >= currentMatchup.answerA.votes
                ? 'bg-amber-500/30 border-amber-500 shadow-2xl shadow-amber-500/30'
                : 'bg-white/5 border-white/10 opacity-70'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    By {currentMatchup.answerB.authorName}
                  </span>
                  {currentMatchup.answerB.votes > currentMatchup.answerA.votes && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-current" /> Winner
                    </span>
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">
                  "{currentMatchup.answerB.text}"
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Votes: {currentMatchup.answerB.voters?.join(', ') || 'None'}</span>
                <span className="text-2xl font-black text-amber-300 font-mono">
                  {currentMatchup.answerB.votes} {currentMatchup.answerB.votes === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 6 & 7: LEADERBOARD & GAME OVER */}
      {(phase === 'LEADERBOARD' || phase === 'GAME_OVER') && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl space-y-8 animate-pop-in">
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-xl">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white">
              {phase === 'GAME_OVER' ? '🏆 Final Leaderboard' : `Round ${currentRound} Leaderboard`}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Top corporate wits of the town hall!
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-3">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${
                    idx === 0
                      ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/10 border-amber-500 shadow-xl'
                      : idx === 1
                      ? 'bg-white/10 border-slate-300/40'
                      : idx === 2
                      ? 'bg-amber-900/20 border-amber-700/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                      idx === 0 ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-lg text-white">{p.name}</span>
                  </div>

                  <span className="font-mono text-2xl font-black text-amber-400">
                    {p.score} pts
                  </span>
                </div>
              ))}
          </div>

          {/* Action buttons */}
          <div className="pt-6 border-t border-white/10 flex justify-center gap-4">
            {phase === 'LEADERBOARD' && (
              <button
                onClick={handleNextRound}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-sap-blue to-sap-accent hover:from-blue-600 hover:to-blue-500 text-white font-black text-lg shadow-xl shadow-sap-blue/20 transition-all transform active:scale-95 flex items-center gap-2"
              >
                <span>Proceed to Round {currentRound + 1}</span>
                <span>→</span>
              </button>
            )}

            {phase === 'GAME_OVER' && (
              <button
                onClick={handlePlayAgain}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-lg shadow-xl shadow-emerald-500/20 transition-all transform active:scale-95 flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Play Again with Same Room</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
