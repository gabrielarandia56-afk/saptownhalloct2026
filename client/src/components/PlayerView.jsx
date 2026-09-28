import React, { useState } from 'react';
import { socket } from '../App';
import { soundFX } from '../utils/sound';
import { Check, Send, ThumbsUp, AlertCircle, Trophy, Sparkles, Flag } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PlayerView({ roomCode, playerName, gameState, onLeave }) {
  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [votedOption, setVotedOption] = useState(null);
  const [reportedAnswers, setReportedAnswers] = useState(new Set());
  const [msg, setMsg] = useState('');

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300">
        <div className="w-10 h-10 border-4 border-sap-blue border-t-transparent rounded-full animate-spin mb-3"></div>
        <p>Connecting to room {roomCode}...</p>
      </div>
    );
  }

  const { phase, timeLeft, roundPrompt, currentMatchup, currentRound, totalRounds, players } = gameState;
  const myPlayer = players.find((p) => p.name === playerName);
  const myScore = myPlayer?.score || 0;

  // Reset local state when phase changes
  React.useEffect(() => {
    if (phase === 'ANSWERING') {
      setAns1('');
      setAns2('');
      setSubmitted(false);
      setVotedOption(null);
    }
    if (phase === 'VOTING') {
      setVotedOption(null);
    }
    if (phase === 'GAME_OVER') {
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      } catch (e) {}
    }
  }, [phase, currentRound, gameState.currentMatchupIndex]);

  const handleSubmitAnswers = (e) => {
    e.preventDefault();
    if (!ans1.trim() || !ans2.trim()) {
      setMsg('Please fill in both answers!');
      setTimeout(() => setMsg(''), 3000);
      return;
    }

    soundFX.playSubmit();
    socket.emit('submit_answers', { answers: [ans1, ans2] }, (res) => {
      if (res && res.success) {
        setSubmitted(true);
      } else {
        setMsg(res?.message || 'Failed to submit answers.');
      }
    });
  };

  const handleVote = (answerId, optionKey) => {
    if (votedOption) return;
    soundFX.playClick();
    socket.emit('vote_answer', { answerId }, (res) => {
      if (res && res.success) {
        setVotedOption(optionKey);
      } else {
        setMsg(res?.message || 'Could not register vote');
        setTimeout(() => setMsg(''), 3000);
      }
    });
  };

  const handleReport = (answerId) => {
    if (reportedAnswers.has(answerId)) return;
    soundFX.playClick();
    socket.emit('report_answer', { answerId });
    setReportedAnswers((prev) => new Set(prev).add(answerId));
    setMsg('Answer reported to host for review.');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4 animate-pop-in">
      {/* Player Header Bar */}
      <div className="bg-slate-900/90 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-base">{playerName}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sap-blue/30 text-cyan-300 border border-sap-blue/40 font-mono">
              {roomCode}
            </span>
          </div>
          <span className="text-xs text-amber-400 font-bold font-mono">
            {myScore} pts
          </span>
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
          <h2 className="text-2xl font-black text-white">You're In!</h2>
          <p className="text-slate-400 text-sm">
            Look up at the main screen. The host will start the town hall session shortly.
          </p>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300">
            Get ready to come up with witty corporate responses!
          </div>
        </div>
      )}

      {/* 2. ANSWERING PHASE */}
      {phase === 'ANSWERING' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-5">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 bg-sap-blue/20 px-3 py-1 rounded-full border border-sap-blue/30">
              Round {currentRound} Prompt
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-3 leading-snug">
              "{roundPrompt}"
            </h3>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmitAnswers} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Answer #1
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={ans1}
                  onChange={(e) => setAns1(e.target.value)}
                  placeholder="Your first clever idea..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sap-blue focus:ring-2 focus:ring-sap-blue/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Answer #2
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={ans2}
                  onChange={(e) => setAns2(e.target.value)}
                  placeholder="Your second hilarious take..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sap-blue focus:ring-2 focus:ring-sap-blue/20"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-sap-blue to-sap-accent hover:from-blue-600 hover:to-blue-500 text-white font-black text-base shadow-lg shadow-sap-blue/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Answers</span>
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Answers Locked In!</h4>
              <p className="text-xs text-slate-400">
                Waiting for the rest of the team to finish typing...
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. HOST REVIEW PHASE */}
      {phase === 'HOST_REVIEW' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-3 shadow-xl">
          <div className="w-10 h-10 border-4 border-sap-blue border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <h3 className="text-lg font-bold text-white">Host Reviewing Prompts</h3>
          <p className="text-xs text-slate-400">
            The host is pre-screening submissions before voting begins.
          </p>
        </div>
      )}

      {/* 4. VOTING PHASE */}
      {phase === 'VOTING' && currentMatchup && (
        <div className="space-y-4">
          <div className="text-center px-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tap your favorite answer</span>
            <p className="text-sm font-bold text-white italic mt-0.5 line-clamp-2">
              "{currentMatchup.prompt}"
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Option A Button */}
            <div className="relative">
              <button
                onClick={() => handleVote(currentMatchup.answerA.id, 'A')}
                disabled={Boolean(votedOption)}
                className={`w-full p-5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between ${
                  votedOption === 'A'
                    ? 'bg-sap-blue border-sap-light shadow-xl shadow-sap-blue/30 scale-102'
                    : votedOption
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
                {votedOption === 'A' && (
                  <span className="mt-2 text-xs font-bold text-white flex items-center gap-1">
                    <ThumbsUp className="w-3.5 h-3.5" /> Your Pick
                  </span>
                )}
              </button>
              <button
                onClick={() => handleReport(currentMatchup.answerA.id)}
                className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 p-1 rounded-lg"
                title="Report inappropriate content"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Option B Button */}
            <div className="relative">
              <button
                onClick={() => handleVote(currentMatchup.answerB.id, 'B')}
                disabled={Boolean(votedOption)}
                className={`w-full p-5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between ${
                  votedOption === 'B'
                    ? 'bg-amber-600 border-amber-300 shadow-xl shadow-amber-600/30 scale-102'
                    : votedOption
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
                {votedOption === 'B' && (
                  <span className="mt-2 text-xs font-bold text-white flex items-center gap-1">
                    <ThumbsUp className="w-3.5 h-3.5" /> Your Pick
                  </span>
                )}
              </button>
              <button
                onClick={() => handleReport(currentMatchup.answerB.id)}
                className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 p-1 rounded-lg"
                title="Report inappropriate content"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ROUND RESULT */}
      {phase === 'ROUND_RESULT' && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl text-center space-y-4 shadow-xl">
          <h3 className="text-lg font-black text-emerald-400">Votes Counted!</h3>
          <p className="text-xs text-slate-300">
            Check the main screen to see who wrote each answer and who scored points!
          </p>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Current Score</span>
            <span className="text-3xl font-black font-mono text-amber-400">{myScore} pts</span>
          </div>
        </div>
      )}

      {/* 6 & 7: LEADERBOARD & GAME OVER */}
      {(phase === 'LEADERBOARD' || phase === 'GAME_OVER') && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-4 shadow-xl">
          <div className="text-center">
            <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-1" />
            <h3 className="text-xl font-black text-white">
              {phase === 'GAME_OVER' ? 'Town Hall Champions' : `Round ${currentRound} Standings`}
            </h3>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl flex items-center justify-between text-sm ${
                    p.name === playerName
                      ? 'bg-sap-blue/30 border border-sap-blue text-white font-bold'
                      : 'bg-white/5 border border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">#{idx + 1}</span>
                    <span>{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">{p.score} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Leave room option */}
      <div className="text-center pt-2">
        <button
          onClick={onLeave}
          className="text-xs text-slate-500 hover:text-slate-300 underline"
        >
          Leave game
        </button>
      </div>
    </div>
  );
}
