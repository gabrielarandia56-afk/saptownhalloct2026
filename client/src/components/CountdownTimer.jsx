import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Animated Countdown Clock component with pulsing ring and urgent color transitions
 */
export default function CountdownTimer({ timeLeft, totalTime = 60, size = "md" }) {
  if (timeLeft === undefined || timeLeft === null) return null;

  const isUrgent = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  const colorClass = isCritical
    ? 'text-rose-400 bg-rose-500/20 border-rose-500/50'
    : isUrgent
    ? 'text-amber-400 bg-amber-500/20 border-amber-500/50'
    : 'text-cyan-300 bg-sap-blue/20 border-sap-blue/40';

  const pulseClass = isCritical
    ? 'animate-ping'
    : isUrgent
    ? 'animate-pulse'
    : '';

  const sizeClasses = size === "lg"
    ? "px-5 py-2.5 text-3xl"
    : "px-3.5 py-1.5 text-xl";

  return (
    <div className={`inline-flex items-center gap-2.5 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-300 ${colorClass} ${sizeClasses}`}>
      <div className="relative flex items-center justify-center">
        <Clock className={`w-5 h-5 transition-transform duration-500 ${isUrgent ? 'animate-bounce' : 'animate-spin'}`} style={{ animationDuration: isUrgent ? '0.6s' : '8s' }} />
        {isUrgent && (
          <span className={`absolute -inset-1 rounded-full bg-rose-500/30 ${pulseClass}`}></span>
        )}
      </div>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">Timer</span>
        <span className="font-mono font-black tracking-tight">{timeLeft}s</span>
      </div>
    </div>
  );
}
