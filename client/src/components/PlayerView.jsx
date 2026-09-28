import React, { useState, useEffect } from 'react';
import { socket } from '../App';
import { soundFX } from '../utils/sound';
import { Check, Send, ThumbsUp, AlertCircle, Trophy, Sparkles, Crown, Users, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PlayerView({ roomCode, playerName, gameState, onLeave }) {
  const [teamState, setTeamState] = useState(null);
  const [draftInput, setDraftInput] = useState('');
  const [draftSubmitted, setDraftSubmitted] = useState(false);
  const [selectedDraftVote, setSelectedDraftVote] = useState(null);
  const [arenaVote, setArenaVote] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    socket.on('team_state', (tState) => {
      setTeamState(tState);
    });

    return () => {
      socket.off('team_state');
    };
  }, []);

  const phase = gameState?.phase;
  const currentRound = gameState?.currentRound;
  const matchupIndex = gameState?.currentMatchupIndex;

  // Reset local state across phases — ALWAYS called before any conditional return!
  useEffect(() => {
    if (!gameState) return;
    if (phase === 'INDIVIDUAL_ANSWERING') {
      setDraftInput('');
      setDraftSubmitted(false);
      setSelectedDraftVote(null);
      setArenaVote(null);
    }
    if (phase === 'TEAM_VOTING') {
      setSelectedDraftVote(null);
    }
    if (phase === 'VOTING') {
      setArenaVote(null);
    }
    if (phase === 'GAME_OVER') {
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      } catch (e) {}
    }
  }, [phase, currentRound, matchupIndex, gameState]);

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300">
        <div className="w-10 h-10 border-4 border-sap-blue border-t-transparent rounded-full animate-spin mb-3"></div>
        <p>Connecting to room {roomCode}...</p>
      </div>
    );
  }

  const { timeLeft, roundPrompt, currentMatchup, totalRounds, teams } = gameState;
  const myTeam = teams?.find((t) => t.members.some((m) => m.name === playerName));
  const isLeader = teamState?.isLeader;

  // 1. Submit individual draft answer (20s)
  const handleSubmitDraft = (e) => {
    e.preventDefault();
    if (!draftInput.trim()) {
      setMsg('Please enter an answer!');
      setTimeout(() => setMsg(''), 3000);
      return;
    }

    soundFX.playSubmit();
    socket.emit('submit_draft_answer', { answer: draftInput }, (res) => {
      if (res && res.success) {
        setDraftSubmitted(true);
      } else {
        setMsg(res?.message || 'Failed to submit.');
      }
    });
  };

  // 2. Vote internally on team's draft answers
  const handleVoteDraft = (draftId) => {
    soundFX.playClick();
    setSelectedDraftVote(draftId);
    socket.emit('team_vote_draft', { draftId });
  };

  // 3. Team Leader clicks "Team Ready"
  const handleLeaderReady = () => {
    soundFX.playClick();
    socket.emit('team_leader_ready');
  };

  // 4. Vote in main arena matchup
  const handleArenaVote = (answerId, optionKey) => {
    if (arenaVote) return;
    soundFX.playClick();
    socket.emit('vote_answer', { answerId }, (res) => {
      if (res && res.success) {
        setArenaVote(optionKey);
      } else {
        setMsg(res?.message || 'Could not register vote');
        setTimeout(() => setMsg(''), 3000);
      }
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4 animate-pop-in">
      {/* Player Top Banner */}
      <div className="bg-slate-900/90 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-base">{playerName}</span>
            {isLeader && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" /> Leader
              </span>
            )}
          </div>
          {myTeam && (
            <div className="text-xs text-cyan-300 font-bold mt-0.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{myTeam.name}</span>
              <span className="text-amber-400 font-mono">({myTeam.score} pts)</span>
            </div>
          )}
        </div>

        {timeLeft > 0 && phase !== 'LOBBY' && phase !== 'HOST_REVIEW' && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
            <div className={`w-2.5 h-2.5 rounded-full ${timeLeft <= 5 ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
            <span className={`text-xl font-black font-mono leading-none ${timeLeft <= 5 ? 'text-rose-400' : 'text-amber-400'}`}>
              {timeLeft}s
            </span>
          </div>
        )}
      </div>

      {msg && (
        <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-semibold flex items-center gap-2 animate-bounce-short">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* 1. LOBBY */}
      {phase === 'LOBBY' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-sap-blue/20 text-cyan-300 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white">You're in the Lobby!</h2>
          <p className="text-slate-400 text-sm">
            The host will auto-assign you to a team and assign a Team Leader when the game starts.
          </p>
        </div>
      )}

      {/* 2. INDIVIDUAL ANSWERING (20s) */}
      {phase === 'INDIVIDUAL_ANSWERING' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-5">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 bg-sap-blue/20 px-3 py-1 rounded-full border border-sap-blue/30">
              Round {currentRound} • Individual Input (20s)
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-3 leading-snug">
              "{roundPrompt}"
            </h3>
          </div>

          {!draftSubmitted ? (
            <form onSubmit={handleSubmitDraft} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Your Answer Idea for {myTeam?.name || 'Your Team'}
                </label>
                <input
                  type="text"
                  maxLength={90}
                  value={draftInput}
                  onChange={(e) => setDraftInput(e.target.value)}
                  placeholder="Type something clever..."
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sap-blue focus:ring-2 focus:ring-sap-blue/20"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-sap-blue to-sap-accent hover:from-blue-600 text-white font-black text-base shadow-lg shadow-sap-blue/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit to Team</span>
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Submitted to Team!</h4>
              <p className="text-xs text-slate-400">
                Next, your team will vote internally on the best submission!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. TEAM INTERNAL VOTING (60s) */}
      {phase === 'TEAM_VOTING' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-5">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
              {teamState?.teamName || 'Your Team'} • Pick Best Answer
            </span>
            <p className="text-xs font-semibold text-slate-300 italic mt-2">
              "{roundPrompt}"
            </p>
          </div>

          <div className="space-y-2.5">
            {teamState?.draftAnswers?.map((draft) => (
              <button
                key={draft.id}
                onClick={() => handleVoteDraft(draft.id)}
                className={`w-full p-4 rounded-2xl text-left border-2 transition-all flex items-center justify-between gap-3 ${
                  selectedDraftVote === draft.id || draft.hasVotedForThis
                    ? 'bg-sap-blue/30 border-sap-blue text-white shadow-lg'
                    : 'bg-white/5 border-white/10 hover:border-white/30 text-slate-200'
                }`}
              >
                <span className="text-sm font-bold leading-snug flex-1">
                  "{draft.text}"
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono font-bold text-cyan-300 flex-shrink-0">
                  {draft.votes} {draft.votes === 1 ? 'vote' : 'votes'}
                </span>
              </button>
            ))}
          </div>

          {/* Team Leader "Team Ready" Button */}
          {isLeader ? (
            <div className="pt-3 border-t border-white/10">
              <button
                onClick={handleLeaderReady}
                disabled={teamState?.ready}
                className={`w-full py-4 rounded-2xl font-black text-base shadow-xl transition-all transform active:scale-98 flex items-center justify-center gap-2 ${
                  teamState?.ready
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 cursor-default'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-emerald-500/25 hover:from-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{teamState?.ready ? 'Team is Ready!' : 'Lock & Set Team Ready'}</span>
              </button>
              <p className="text-[11px] text-amber-300 text-center mt-1.5">
                👑 You are the Team Leader — press when your team has made their pick!
              </p>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 pt-2 border-t border-white/10">
              {teamState?.ready ? (
                <span className="text-emerald-400 font-bold">✓ Team Leader marked team as Ready!</span>
              ) : (
                <span>Waiting for Team Leader to click "Team Ready" or timer to finish...</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. HOST REVIEW */}
      {phase === 'HOST_REVIEW' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-3 shadow-xl">
          <div className="w-10 h-10 border-4 border-sap-blue border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <h3 className="text-lg font-bold text-white">Host Reviewing Team Answers</h3>
          <p className="text-xs text-slate-400">
            Get ready for the tournament voting phase!
          </p>
        </div>
      )}

      {/* 5. ARENA VOTING */}
      {phase === 'VOTING' && currentMatchup && (
        <div className="space-y-4">
          <div className="text-center px-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tap favorite answer</span>
            <p className="text-sm font-bold text-white italic mt-0.5 line-clamp-2">
              "{currentMatchup.prompt}"
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => handleArenaVote(currentMatchup.answerA.id, 'A')}
              disabled={Boolean(arenaVote)}
              className={`w-full p-5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between ${
                arenaVote === 'A'
                  ? 'bg-sap-blue border-sap-light shadow-xl scale-102'
                  : arenaVote
                  ? 'bg-white/5 border-white/10 opacity-50'
                  : 'bg-white/5 border-sap-blue/40 hover:border-sap-blue hover:bg-sap-blue/10 active:scale-98'
              }`}
            >
              <span className="text-[10px] uppercase font-extrabold text-cyan-300 tracking-wider block mb-1">
                Option A
              </span>
              <span className="text-lg font-bold text-white leading-snug">
                "{currentMatchup.answerA.text}"
              </span>
              {arenaVote === 'A' && (
                <span className="mt-2 text-xs font-bold text-white flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> Your Pick
                </span>
              )}
            </button>

            <button
              onClick={() => handleArenaVote(currentMatchup.answerB.id, 'B')}
              disabled={Boolean(arenaVote)}
              className={`w-full p-5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between ${
                arenaVote === 'B'
                  ? 'bg-amber-600 border-amber-300 shadow-xl scale-102'
                  : arenaVote
                  ? 'bg-white/5 border-white/10 opacity-50'
                  : 'bg-white/5 border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10 active:scale-98'
              }`}
            >
              <span className="text-[10px] uppercase font-extrabold text-amber-300 tracking-wider block mb-1">
                Option B
              </span>
              <span className="text-lg font-bold text-white leading-snug">
                "{currentMatchup.answerB.text}"
              </span>
              {arenaVote === 'B' && (
                <span className="mt-2 text-xs font-bold text-white flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> Your Pick
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 6. ROUND RESULT */}
      {phase === 'ROUND_RESULT' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl text-center space-y-4 shadow-xl">
          <h3 className="text-lg font-black text-emerald-400">Matchup Complete!</h3>
          <p className="text-xs text-slate-300">
            Check the main screen to see which team won the points!
          </p>
        </div>
      )}

      {/* 7. LEADERBOARD & GAME OVER */}
      {(phase === 'LEADERBOARD' || phase === 'GAME_OVER') && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-4 shadow-xl">
          <div className="text-center">
            <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-1" />
            <h3 className="text-xl font-black text-white">
              {phase === 'GAME_OVER' ? '🏆 Final Team Standings' : `Round ${currentRound} Standings`}
            </h3>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {[...teams]
              .sort((a, b) => b.score - a.score)
              .map((t, idx) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl flex items-center justify-between text-sm ${
                    t.id === myTeam?.id
                      ? 'bg-sap-blue/30 border border-sap-blue text-white font-bold'
                      : 'bg-white/5 border border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">#{idx + 1}</span>
                    <span>{t.name}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">{t.score} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="text-center pt-2">
        <button onClick={onLeave} className="text-xs text-slate-500 hover:text-slate-300 underline">
          Leave game
        </button>
      </div>
    </div>
  );
}
