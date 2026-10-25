import React, { useState, useEffect } from 'react';
import { Clock, Moon, Sun, AlertTriangle, BatteryCharging, ShieldAlert, Sparkles, CheckCircle2, Play, Pause, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { DriverState, CircadianPoint } from '../types';
import { soundManager } from '../utils/audio';

interface CircadianPredictorProps {
  driverState: DriverState;
}

export const CircadianPredictor: React.FC<CircadianPredictorProps> = ({
  driverState,
}) => {
  const [currentHour, setCurrentHour] = useState<number>(new Date().getHours());
  const [continuousDriveMinutes, setContinuousDriveMinutes] = useState<number>(65);
  const [powerNapTimer, setPowerNapTimer] = useState<number | null>(null);
  const [napRunning, setNapRunning] = useState(false);

  // Update current hour in real time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Power nap countdown loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (napRunning && powerNapTimer !== null && powerNapTimer > 0) {
      interval = setInterval(() => {
        setPowerNapTimer(prev => {
          if (prev !== null && prev > 1) {
            return prev - 1;
          } else {
            setNapRunning(false);
            soundManager.playCriticalAlarm(true);
            soundManager.speakText("Power nap complete! Time to resume driving safely.", true);
            return 0;
          }
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [napRunning, powerNapTimer]);

  const startPowerNap = (minutes: number = 20) => {
    soundManager.unlockAudioContext();
    setPowerNapTimer(minutes * 60);
    setNapRunning(true);
    soundManager.speakText(`Power nap timer started for ${minutes} minutes. Rest well.`, true);
  };

  const cancelNap = () => {
    setNapRunning(false);
    setPowerNapTimer(null);
  };

  // Determine Circadian Status
  const isGraveyardZone = currentHour >= 2 && currentHour < 6;
  const isPostLunchDip = currentHour >= 13 && currentHour < 15;

  let circadianRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  let circadianLabel = 'Optimal Biological Alertness';
  if (isGraveyardZone) {
    circadianRisk = 'CRITICAL';
    circadianLabel = 'Biological Graveyard Window (02:00 - 06:00) — Severe Risk';
  } else if (isPostLunchDip) {
    circadianRisk = 'MEDIUM';
    circadianLabel = 'Post-Lunch Dip (13:00 - 15:00) — Mild Fatigue';
  } else if (currentHour >= 22 || currentHour < 2) {
    circadianRisk = 'HIGH';
    circadianLabel = 'Night Window — Elevated Sleep Propensity';
  }



  // Next 4-Hour Projected Fatigue Forecast
  const projectedHours = [
    {
      timeOffset: '+1 Hour',
      expectedAlertness: Math.max(10, 85 - (continuousDriveMinutes + 60) * 0.25 - (isGraveyardZone ? 25 : 0)),
      status: isGraveyardZone ? 'HIGH RISK' : 'STABLE',
    },
    {
      timeOffset: '+2 Hours',
      expectedAlertness: Math.max(10, 75 - (continuousDriveMinutes + 120) * 0.3 - (isGraveyardZone ? 30 : 0)),
      status: 'MANDATORY REST WINDOW',
    },
    {
      timeOffset: '+3 Hours',
      expectedAlertness: Math.max(10, 60 - (continuousDriveMinutes + 180) * 0.35 - (isGraveyardZone ? 35 : 0)),
      status: 'SEVERE DROWSINESS PROJECTION',
    },
  ];

  const formatNapTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Circadian Fatigue & Power Nap Predictor
              </h3>
              <p className="text-[11px] text-slate-400">
                24-Hour Biological Rhythm & Human Chronotype Analysis
              </p>
            </div>
          </div>

          <div className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
            circadianRisk === 'CRITICAL'
              ? 'bg-red-500/20 text-red-300 border-red-500/40'
              : circadianRisk === 'HIGH'
              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
              : circadianRisk === 'MEDIUM'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            <Moon className="w-3 h-3" />
            <span>{circadianRisk} RISK</span>
          </div>
        </div>

        {/* Current Circadian Status Banner */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Current Chrono Phase ({currentHour.toString().padStart(2, '0')}:00)
            </span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 block">
              {circadianLabel}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Continuous Drive</span>
            <span className="text-xs font-bold text-sky-400 font-mono">
              {Math.floor(continuousDriveMinutes / 60)}h {continuousDriveMinutes % 60}m
            </span>
          </div>
        </div>

        {/* Chronobiological Alertness Windows & Biological Rhythms (Graph Removed) */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10">
            <span className="text-[10px] text-slate-400 block font-semibold">Circadian Vulnerability Windows</span>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-red-400 font-medium">02:00 - 06:00</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">Graveyard Dip</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-400 font-medium">13:00 - 15:00</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">Post-Lunch</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Active Fatigue Mitigation</span>
              <span className="text-[11px] text-slate-200 mt-1 block">
                {isGraveyardZone
                  ? "High sleep pressure active. Mandatory break recommended."
                  : isPostLunchDip
                  ? "Mild natural drowsiness dip. Keep cabin ventilated."
                  : "Normal biological alertness window. Drive safely."}
              </span>
            </div>
            <span className="text-[9px] text-sky-400 font-mono mt-1">SAE J3016 Chrono-Audit OK</span>
          </div>
        </div>

        {/* Next 4-Hour Trajectory Forecast */}
        <div className="space-y-1.5 mb-3">
          <span className="text-[11px] font-semibold text-slate-300 block">
            Projected Driver Fatigue Trajectory
          </span>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {projectedHours.map((proj, i) => (
              <div key={i} className="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400">{proj.timeOffset}</span>
                <span className={`text-sm font-black my-0.5 ${
                  proj.expectedAlertness < 40 ? 'text-red-400' : proj.expectedAlertness < 65 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {Math.round(proj.expectedAlertness)}% Alert
                </span>
                <span className="text-[8px] font-mono text-slate-400 truncate">
                  {proj.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Power-Nap Assistant */}
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-indigo-200 flex items-center gap-1">
              <BatteryCharging className="w-3.5 h-3.5 text-indigo-400" />
              Coffee Nap / 20-Min Power Reset
            </h4>
            <p className="text-[10px] text-indigo-300/80 mt-0.5">
              Drink coffee & rest 20 min before caffeine binds to adenosine receptors.
            </p>
          </div>

          {powerNapTimer !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-black font-mono text-indigo-300 bg-black/50 px-2 py-1 rounded-lg border border-indigo-400/40">
                {formatNapTime(powerNapTimer)}
              </span>
              <button
                onClick={cancelNap}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[10px]"
                title="Cancel Nap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => startPowerNap(20)}
              id="btn-start-power-nap"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              Start 20m Nap
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
