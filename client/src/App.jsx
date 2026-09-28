import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import HostView from './components/HostView';
import PlayerView from './components/PlayerView';
import { soundFX } from './utils/sound';
import { Sparkles, Trophy, Users, ShieldCheck, Volume2, VolumeX, Monitor, Smartphone } from 'lucide-react';

// Connect to backend socket (defaults to current host/port when deployed together)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (
  window.location.port === '3000'
    ? `http://${window.location.hostname}:5000`
    : '/'
);

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

export default function App() {
  const [role, setRole] = useState(null); // 'HOST' | 'PLAYER' | null
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [muted, setMuted] = useState(false);

  // Synchronized Game State
  const [gameState, setGameState] = useState(null);
  const [hostState, setHostState] = useState(null);

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      setErrorMsg('');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room_state', (state) => {
      setGameState(state);
    });

    socket.on('host_state', (state) => {
      setHostState(state);
    });

    socket.on('error_msg', (msg) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    });

    socket.on('timer_tick', ({ timeLeft }) => {
      if (timeLeft <= 3 && timeLeft > 0) {
        soundFX.playTick();
      } else if (timeLeft === 0) {
        soundFX.playBuzzer();
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_state');
      socket.off('host_state');
      socket.off('error_msg');
      socket.off('timer_tick');
    };
  }, []);

  const handleCreateRoom = () => {
    soundFX.playClick();
    socket.emit('create_room', (res) => {
      if (res && res.success) {
        setRoomCode(res.roomCode);
        setRole('HOST');
      }
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !playerName.trim()) {
      setErrorMsg('Please enter both room code and your name');
      return;
    }

    soundFX.playClick();
    socket.emit('join_room', { roomCode, playerName }, (res) => {
      if (res && res.success) {
        setRoomCode(res.roomCode);
        setRole('PLAYER');
      } else {
        setErrorMsg(res?.message || 'Could not join room');
      }
    });
  };

  const toggleSound = () => {
    const isMuted = soundFX.toggleMute();
    setMuted(isMuted);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-sap-navy to-slate-950 text-white font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sap-blue to-cyan-400 flex items-center justify-center font-black text-xl shadow-lg shadow-sap-blue/30 text-white">
            PD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-sap-light bg-clip-text text-transparent">
                Prompt Drop
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sap-blue/30 text-cyan-300 border border-sap-blue/50">
                SAP Town Hall Edition
              </span>
            </div>
            <p className="text-xs text-slate-400">Quiplash-style quick witty voting for teams</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* Connection status badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            connected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            {connected ? 'Live' : 'Connecting...'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-sm font-medium animate-bounce-short flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            {errorMsg}
          </div>
        )}

        {!role ? (
          /* Welcome / Role Selection Screen */
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 my-auto">
            {/* Player Card (Left / Top) */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col justify-between hover:border-sap-blue/50 transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-sap-blue/20 border border-sap-blue/40 flex items-center justify-center text-sap-blue mb-4">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Join as Player</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Use your phone or laptop to answer prompts and vote anonymously for your team's favorite answers.
                </p>

                <form onSubmit={handleJoinRoom} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      4-Letter Room Code
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ABCD"
                      className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 font-mono text-center tracking-widest text-2xl font-bold focus:outline-none focus:border-sap-blue focus:ring-2 focus:ring-sap-blue/20 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Your Display Name
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="e.g. Alex (Engineering)"
                      className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-base font-medium focus:outline-none focus:border-sap-blue focus:ring-2 focus:ring-sap-blue/20"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-sap-blue to-sap-accent hover:from-blue-600 hover:to-blue-500 text-white font-bold text-lg shadow-lg shadow-sap-blue/25 hover:shadow-sap-blue/40 transition-all transform active:scale-98 flex items-center justify-center gap-2"
                  >
                    <span>Join Game</span>
                    <span>→</span>
                  </button>
                </form>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Safe for Work: All answers during voting are 100% anonymous.</span>
              </div>
            </div>

            {/* Host Card (Right / Bottom) */}
            <div className="bg-gradient-to-br from-sap-navy/90 to-slate-900/90 backdrop-blur-xl border border-sap-blue/30 p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4">
                  <Monitor className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Host on Main Screen</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Perfect for Town Hall stage displays, projectors, or Zoom/Teams screenshares with full host moderation controls.
                </p>

                <div className="space-y-3 mb-6 bg-white/5 p-4 rounded-2xl border border-white/10 text-xs text-slate-300">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>Generates unique 4-letter room code</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>Pre-screen answers before voting phase</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>Automatic countdowns & celebratory reveal sounds</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>High-contrast big typography for auditoriums</span>
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-lg shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 transition-all transform active:scale-98 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5 text-slate-950" />
                  <span>Create Host Room</span>
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 text-xs text-slate-400 text-center">
                Supports 20 to 50+ concurrent town hall participants
              </div>
            </div>
          </div>
        ) : role === 'HOST' ? (
          <HostView
            roomCode={roomCode}
            hostState={hostState}
            onLeave={() => {
              setRole(null);
              setHostState(null);
              setGameState(null);
            }}
          />
        ) : (
          <PlayerView
            roomCode={roomCode}
            playerName={playerName}
            gameState={gameState}
            onLeave={() => {
              setRole(null);
              setGameState(null);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 px-4 py-3 text-center text-xs text-slate-500">
        Prompt Drop — Designed for High-Engagement SAP Town Halls & All-Hands.
      </footer>
    </div>
  );
}
