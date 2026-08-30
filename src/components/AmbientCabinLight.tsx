import React, { useState, useEffect } from 'react';
import { Sun, Moon, Zap, ShieldAlert, Sparkles, Sliders, Eye, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DriverState, CabinLightConfig } from '../types';

interface AmbientCabinLightProps {
  driverState: DriverState;
}

export const AmbientCabinLight: React.FC<AmbientCabinLightProps> = ({
  driverState,
}) => {
  const [config, setConfig] = useState<CabinLightConfig>({
    isEnabled: true,
    mode: 'alertness_cyan',
    intensity: 65,
    autoStrobeOnAlert: true,
    strobeSpeedHz: 4,
  });

  const [isTestFlashing, setIsTestFlashing] = useState(false);

  // Trigger test strobe flash for 2.5 seconds
  const triggerTestFlash = () => {
    setIsTestFlashing(true);
    setTimeout(() => {
      setIsTestFlashing(false);
    }, 2500);
  };

  const isEmergencyTriggered = (config.autoStrobeOnAlert && (driverState.alertLevel === 'RED' || driverState.eyesClosed)) || isTestFlashing;

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full">
      {/* Full-Screen Peripheral Flash Overlay when Critical Fatigue or Strobe Triggered */}
      <AnimatePresence>
        {isEmergencyTriggered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.15, 0.85, 0.15],
              backgroundColor: ['rgba(239,68,68,0.2)', 'rgba(239,68,68,0.85)', 'rgba(239,68,68,0.2)'],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.25,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            className="fixed inset-0 pointer-events-none z-50 mix-blend-screen"
          />
        )}
      </AnimatePresence>

      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Ambient Cabin Lighting & Flash Alert
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Melatonin Suppression
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                470nm Alertness Blue Spectrum & Emergency Peripheral Strobe
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.isEnabled}
              onChange={(e) => setConfig(prev => ({ ...prev, isEnabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
          </label>
        </div>

        {/* Interactive Simulated Vehicle Interior Ambient Halo Preview */}
        <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/10 p-3 flex flex-col justify-between bg-slate-950/90">
          {/* Animated Glow Aura based on active mode */}
          <motion.div
            animate={
              isEmergencyTriggered
                ? {
                    opacity: [0.3, 1, 0.3],
                    backgroundColor: ['rgba(239,68,68,0.4)', 'rgba(239,68,68,0.95)', 'rgba(239,68,68,0.4)'],
                  }
                : config.isEnabled
                ? config.mode === 'pulse_wave'
                  ? {
                      opacity: [0.35, 0.85, 0.35],
                      backgroundColor: ['rgba(6,182,212,0.3)', 'rgba(14,165,233,0.75)', 'rgba(6,182,212,0.3)'],
                    }
                  : config.mode === 'sunset_amber'
                  ? {
                      opacity: config.intensity / 100,
                      backgroundColor: 'rgba(245,158,11,0.5)',
                    }
                  : {
                      opacity: config.intensity / 100,
                      backgroundColor: 'rgba(6,182,212,0.6)',
                    }
                : { opacity: 0.05, backgroundColor: 'rgba(255,255,255,0.05)' }
            }
            transition={{
              duration: isEmergencyTriggered ? 0.25 : config.mode === 'pulse_wave' ? 2.5 : 0.4,
              repeat: isEmergencyTriggered || config.mode === 'pulse_wave' ? Infinity : 0,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 blur-xl pointer-events-none"
          />

          <div className="relative z-10 flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              {isEmergencyTriggered
                ? 'EMERGENCY RED STROBE FLASHING'
                : config.isEnabled
                ? `Mode: ${config.mode.replace('_', ' ').toUpperCase()} (${config.intensity}%)`
                : 'Cabin Ambient Disabled'}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isEmergencyTriggered
                ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
            }`}>
              {isEmergencyTriggered ? 'PERIPHERAL WAKE-UP' : '470nm Active'}
            </span>
          </div>

          <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-400">
            <span>Biological Wavelength: 460-480nm (Alertness Peak)</span>
            <span>Peripheral Vision Coverage: 180°</span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <button
            onClick={() => setConfig(prev => ({ ...prev, mode: 'alertness_cyan', isEnabled: true }))}
            className={`p-2 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
              config.mode === 'alertness_cyan' && config.isEnabled
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-950/50'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-cyan-400" />
            <span>Alertness Cyan</span>
          </button>

          <button
            onClick={() => setConfig(prev => ({ ...prev, mode: 'pulse_wave', isEnabled: true }))}
            className={`p-2 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
              config.mode === 'pulse_wave' && config.isEnabled
                ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-md shadow-sky-950/50'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Pulse Wave</span>
          </button>

          <button
            onClick={() => setConfig(prev => ({ ...prev, mode: 'sunset_amber', isEnabled: true }))}
            className={`p-2 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
              config.mode === 'sunset_amber' && config.isEnabled
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-950/50'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            <span>Sunset Amber</span>
          </button>
        </div>

        {/* Intensity Slider & Strobe Controls */}
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Light Intensity</span>
            <span className="font-mono text-cyan-400">{config.intensity}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={config.intensity}
            onChange={(e) => setConfig(prev => ({ ...prev, intensity: Number(e.target.value) }))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoStrobeOnAlert}
                onChange={(e) => setConfig(prev => ({ ...prev, autoStrobeOnAlert: e.target.checked }))}
                className="rounded border-slate-700 text-cyan-600 focus:ring-0 bg-slate-900"
              />
              <span>Auto Strobe Flash on Red Alert / Micro-Sleep</span>
            </label>

            <button
              onClick={triggerTestFlash}
              disabled={isTestFlashing}
              id="btn-test-cabin-strobe"
              className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 transition-all flex items-center gap-1 active:scale-95"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>{isTestFlashing ? 'Flashing...' : 'Test Strobe'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
