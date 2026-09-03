import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Clock, AlertTriangle, ChevronDown, ChevronUp, Info, Eye, Gauge, Zap } from 'lucide-react';
import { DriverState, SpeedData } from '../types';
import { formatTime } from '../utils/geolocation';
import { soundManager } from '../utils/audio';
import { calculateSafetyRating } from '../utils/safetyRatingCalculator';

interface SafetyMetricsProps {
  driverState: DriverState;
  speedData?: SpeedData | null;
  isMonitoring: boolean;
  harshEventsCount?: number;
}

export const SafetyMetrics: React.FC<SafetyMetricsProps> = ({
  driverState,
  speedData,
  isMonitoring,
  harshEventsCount = 0,
}) => {
  const [driveTimeSeconds, setDriveTimeSeconds] = useState(0);
  const [showFactorBreakdown, setShowFactorBreakdown] = useState(false);

  // Drive duration timer
  useEffect(() => {
    let timer: any = null;
    if (isMonitoring) {
      timer = setInterval(() => {
        setDriveTimeSeconds(prev => {
          const nextSeconds = prev + 1;
          // Voice reminder at 2 hours
          if (nextSeconds > 0 && nextSeconds % 7200 === 0) {
            soundManager.speakText("Two hours of continuous driving reached. Please take a 15-minute rest break.");
          }
          return nextSeconds;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isMonitoring]);

  // Compute safety rating strictly from available real signals
  const rating = calculateSafetyRating({
    driverState,
    speedData,
    drivingDurationSeconds: driveTimeSeconds,
    harshEventsCount,
  });

  // Fatigue Level (LOW, MODERATE, HIGH)
  const isHighFatigue =
    driverState.alertLevel === 'RED' ||
    driverState.eyesClosed ||
    driverState.microSleepCount > 0 ||
    driverState.drowsinessLevel > 60;

  const isModerateFatigue =
    !isHighFatigue &&
    (driverState.alertLevel === 'YELLOW' ||
     driverState.isYawning ||
     driverState.drowsinessLevel > 30 ||
     driverState.yawnCount > 0);

  const fatigueState = isHighFatigue
    ? { level: 'HIGH', emoji: '🔴', color: 'text-red-400', badge: 'bg-red-500/20 text-red-300 border-red-500/50' }
    : isModerateFatigue
    ? { level: 'MODERATE', emoji: '🟡', color: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50' }
    : { level: 'LOW', emoji: '🟢', color: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' };

  return (
    <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col justify-between h-full">
      {/* Top Header: Title & Fatigue Status Badge */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 text-blue-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-white font-bold text-sm tracking-wide">DRIVING SAFETY RATING</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Explicit 🟢 LOW / 🟡 MODERATE / 🔴 HIGH Badge */}
          <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${fatigueState.badge}`}>
            <span>{fatigueState.emoji}</span>
            <span>{fatigueState.level}</span>
          </span>
        </div>
      </div>

      {/* Emergency Flash Banner if High Fatigue */}
      {isHighFatigue && (
        <div className="mb-3 p-2.5 rounded-xl bg-red-600/30 border border-red-500 text-center shadow-[0_0_20px_rgba(239,68,68,0.4)]">
          <div className="flex items-center justify-center gap-2 text-xs font-black text-white uppercase tracking-wider">
            <span>🛑</span>
            <span>TAKE A BREAK IMMEDIATELY</span>
            <span>🛑</span>
          </div>
          <p className="text-[11px] text-red-200 mt-0.5">
            High fatigue detected. Please pull over at the nearest safe rest area.
          </p>
        </div>
      )}

      {/* Main Core Score Section:
          Large readable numbers:
          87 / 100
          SAFE DRIVING */}
      <div className="bg-black/40 rounded-2xl border border-white/10 p-4 text-center flex flex-col items-center justify-center my-1 relative overflow-hidden">
        <div className="text-[10px] font-mono tracking-[0.2em] text-slate-400 uppercase font-semibold mb-1">
          REAL-TIME DRIVER SCORE
        </div>

        {/* Large Readable Numbers: "87 / 100" */}
        <div className="flex items-baseline justify-center gap-1.5 my-1">
          <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${rating.tierColor} drop-shadow-md`}>
            {rating.score}
          </span>
          <span className="text-xl sm:text-2xl font-mono font-bold text-slate-400">
            / 100
          </span>
        </div>

        {/* Tier Label: "SAFE DRIVING" */}
        <div className={`mt-2 px-3.5 py-1 rounded-full font-black text-xs sm:text-sm tracking-wider uppercase border ${rating.tierBg} ${rating.tierBorder} ${rating.tierColor} ${rating.badgeGlow}`}>
          {rating.tier}
        </div>

        {/* Available Signals Indicator */}
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Calculated from {rating.availableFactorsCount} active signals</span>
          <button
            onClick={() => setShowFactorBreakdown(prev => !prev)}
            className="text-sky-400 hover:text-sky-300 underline ml-1 flex items-center gap-0.5"
            title="Toggle signal breakdown"
          >
            {showFactorBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Factor Breakdown Accordion (Transparent signals, no fabricated data) */}
      {showFactorBreakdown && (
        <div className="mt-2 p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5 text-[11px] font-mono animate-in fade-in duration-150">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Signal Breakdown</span>
            <span>Impact</span>
          </div>

          {rating.factors.map(f => (
            <div key={f.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  !f.isAvailable ? 'bg-slate-600' :
                  f.status === 'safe' ? 'bg-emerald-400' :
                  f.status === 'caution' ? 'bg-amber-400' : 'bg-red-400'
                }`}></span>
                <span className={f.isAvailable ? 'text-slate-200' : 'text-slate-500 line-through'}>
                  {f.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{f.summary}</span>
                <span className={`font-bold ${f.deduction > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {f.isAvailable ? (f.deduction > 0 ? `-${f.deduction}` : '0') : 'N/A'}
                </span>
              </div>
            </div>
          ))}

          <p className="text-[9px] text-slate-500 pt-1 italic">
            * Missing signals (e.g. offline GPS) are strictly excluded from score calculation.
          </p>
        </div>
      )}

      {/* Glanceable Bottom Row: Drive Time & Incident Counters */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-black/30 p-2 rounded-xl border border-white/5 text-center">
          <span className="block text-[9px] font-mono text-slate-400">Drive Time</span>
          <span className="text-sm font-black font-mono text-white">
            {formatTime(driveTimeSeconds)}
          </span>
        </div>

        <div className="bg-black/30 p-2 rounded-xl border border-white/5 text-center">
          <span className="block text-[9px] font-mono text-slate-400">Micro-Sleeps</span>
          <span className={`text-sm font-black font-mono ${driverState.microSleepCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>
            {driverState.microSleepCount}
          </span>
        </div>

        <div className="bg-black/30 p-2 rounded-xl border border-white/5 text-center">
          <span className="block text-[9px] font-mono text-slate-400">Distractions</span>
          <span className={`text-sm font-black font-mono ${driverState.distractionCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {driverState.distractionCount}
          </span>
        </div>
      </div>
    </div>
  );
};
