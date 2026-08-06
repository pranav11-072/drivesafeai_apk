import React from 'react';
import { Shield, Smartphone, Bot, Volume2, VolumeX, AlertTriangle, Play, Square } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HeaderProps {
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  onOpenAndroidExport: () => void;
  onOpenAICoach: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  alertLevel: 'GREEN' | 'YELLOW' | 'RED';
}

export const Header: React.FC<HeaderProps> = ({
  isMonitoring,
  onToggleMonitoring,
  onOpenAndroidExport,
  onOpenAICoach,
  isMuted,
  onToggleMute,
  alertLevel,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors ${
            alertLevel === 'RED' ? 'bg-red-500/20 text-red-400 animate-pulse' :
            alertLevel === 'YELLOW' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-lg tracking-tight">DriveSafe AI</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                alertLevel === 'RED' ? 'bg-red-500 text-white animate-bounce' :
                alertLevel === 'YELLOW' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {alertLevel === 'RED' ? 'CRITICAL ALERT' : alertLevel === 'YELLOW' ? 'WARNING' : 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">AI Driver Safety & Drowsiness Alert System</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Monitoring Toggle Button */}
          <button
            onClick={onToggleMonitoring}
            id="btn-toggle-monitoring"
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md ${
              isMonitoring
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
            }`}
          >
            {isMonitoring ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Monitor</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Monitor</span>
              </>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            id="btn-toggle-mute"
            title={isMuted ? "Unmute Alarm Sounds" : "Mute Alarm Sounds"}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* AI Safety Coach Button */}
          <button
            onClick={onOpenAICoach}
            id="btn-ai-coach"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-xs sm:text-sm font-medium transition-all"
          >
            <Bot className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">AI Safety Coach</span>
          </button>

          {/* Android APK Export Button */}
          <button
            onClick={onOpenAndroidExport}
            id="btn-android-apk-export"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-teal-900/30 transition-all border border-emerald-400/30"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">Export Android APK</span>
            <span className="sm:hidden">APK</span>
          </button>
        </div>
      </div>
    </header>
  );
};
