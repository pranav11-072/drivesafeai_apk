import React, { useState, useEffect } from 'react';
import { Activity, Clock, Coffee, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { DriverState } from '../types';
import { formatTime } from '../utils/geolocation';
import { soundManager } from '../utils/audio';

interface SafetyMetricsProps {
  driverState: DriverState;
  isMonitoring: boolean;
}

export const SafetyMetrics: React.FC<SafetyMetricsProps> = ({
  driverState,
  isMonitoring,
}) => {
  const [driveTimeSeconds, setDriveTimeSeconds] = useState(0);

  // Drive duration timer
  useEffect(() => {
    let timer: any = null;
    if (isMonitoring) {
      timer = setInterval(() => {
        setDriveTimeSeconds(prev => {
          const nextSeconds = prev + 1;
          // Remind rest stop every 2 hours (7200 seconds) or 15 minutes in demo mode
          if (nextSeconds > 0 && nextSeconds % 7200 === 0) {
            soundManager.speakText("Two hours of continuous driving reached. Please take a 15-minute rest break.");
          }
          return nextSeconds;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isMonitoring]);

  // Calculate Overall Driving Safety Rating (0-100)
  const baseScore = 100;
  const deductions = (driverState.microSleepCount * 15) + (driverState.yawnCount * 5) + (driverState.distractionCount * 8);
  const safetyScore = Math.max(10, Math.min(100, baseScore - deductions));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full">
      {/* Top Title */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
        <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span>Fatigue & Safety Rating</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          safetyScore >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
          safetyScore >= 60 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
          'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          Score: {safetyScore} / 100
        </span>
      </div>

      {/* Main Score Gauge */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Safety Rating Box */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Driver Safety Score
          </div>
          <span className={`text-3xl font-black font-mono ${
            safetyScore >= 80 ? 'text-emerald-400' :
            safetyScore >= 60 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {safetyScore}%
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-1">
            {safetyScore >= 80 ? 'Excellent Focus' : safetyScore >= 60 ? 'Moderate Alertness' : 'High Risk Fatigue'}
          </span>
        </div>

        {/* Continuous Driving Clock */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <Clock className="w-4 h-4 text-indigo-400" /> Continuous Drive
          </div>
          <span className="text-2xl font-black font-mono text-white">
            {formatTime(driveTimeSeconds)}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium mt-1">
            <Coffee className="w-3 h-3" />
            <span>Rest Stop Timer</span>
          </div>
        </div>
      </div>

      {/* Incident Badges */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center">
          <span className="block text-[10px] text-slate-400 font-medium">Micro-Sleeps</span>
          <span className={`text-lg font-bold font-mono ${driverState.microSleepCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>
            {driverState.microSleepCount}
          </span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center">
          <span className="block text-[10px] text-slate-400 font-medium">Yawn Events</span>
          <span className={`text-lg font-bold font-mono ${driverState.yawnCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {driverState.yawnCount}
          </span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center">
          <span className="block text-[10px] text-slate-400 font-medium font-sans">Distractions</span>
          <span className={`text-lg font-bold font-mono ${driverState.distractionCount > 0 ? 'text-indigo-400' : 'text-slate-300'}`}>
            {driverState.distractionCount}
          </span>
        </div>
      </div>
    </div>
  );
};
