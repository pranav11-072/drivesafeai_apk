import React from 'react';
import { Shield, Volume2, VolumeX, AlertTriangle, Play, Square, Award } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HeaderProps {
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  onOpenAndroidExport?: () => void;
  onOpenScorecard: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  alertLevel: 'GREEN' | 'YELLOW' | 'RED';
  cabinLightStatus?: 'connected' | 'off' | 'unavailable';
  viewMode?: 'mobile' | 'desktop';
  onToggleViewMode?: (mode: 'mobile' | 'desktop') => void;
}

export const Header: React.FC<HeaderProps> = ({
  isMonitoring,
  onToggleMonitoring,
  onOpenScorecard,
  isMuted,
  onToggleMute,
  alertLevel,
  cabinLightStatus,
  viewMode,
  onToggleViewMode,
}) => {
  return (
    <header className="backdrop-blur-xl bg-[#020617]/70 border-b border-white/10 sticky top-0 z-40 px-4 py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl backdrop-blur-md border transition-all ${
            alertLevel === 'RED' ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]' :
            alertLevel === 'YELLOW' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]' :
            'bg-blue-500/20 text-blue-400 border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
          }`}>
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-xl tracking-tight">DriveSafe AI</h1>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md ${
                alertLevel === 'RED' ? 'bg-red-500 text-white animate-bounce shadow-lg shadow-red-500/50' :
                alertLevel === 'YELLOW' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              }`}>
                {alertLevel === 'RED' ? 'CRITICAL ALERT' : alertLevel === 'YELLOW' ? 'WARNING' : 'SYSTEM ONLINE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Frosted Glass AI Driver Safety & Drowsiness HUD</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile vs Desktop View Switcher */}
          {onToggleViewMode && (
            <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
              <button
                onClick={() => onToggleViewMode('mobile')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'mobile'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mobile Cockpit (Focuses strictly on 5 core features)"
              >
                📱 Mobile
              </button>
              <button
                onClick={() => onToggleViewMode('desktop')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'desktop'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Full Desktop Telematics"
              >
                💻 Desktop
              </button>
            </div>
          )}

          {/* Cabin Light Quick Status Pill */}
          {cabinLightStatus && (
            <div
              id="header-cabin-light-status"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono"
            >
              <span className="text-slate-400 text-[10px] font-bold tracking-wider">CABIN LIGHT</span>
              {cabinLightStatus === 'connected' ? (
                <span className="flex items-center gap-1 text-emerald-300 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  ACTIVE
                </span>
              ) : cabinLightStatus === 'off' ? (
                <span className="flex items-center gap-1 text-amber-300 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  OFF
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  UNAVAILABLE
                </span>
              )}
            </div>
          )}

          {/* Trip Scorecard Button */}
          <button
            onClick={onOpenScorecard}
            id="btn-open-scorecard"
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl backdrop-blur-md bg-amber-500/20 border border-amber-400/30 text-amber-300 hover:bg-amber-500/30 text-xs sm:text-sm font-medium transition-all shadow-lg shadow-amber-950/40"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Trip Scorecard</span>
          </button>

          {/* Monitoring Toggle Button */}
          <button
            onClick={onToggleMonitoring}
            id="btn-toggle-monitoring"
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all backdrop-blur-md border shadow-lg ${
              isMonitoring
                ? 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-400/30 shadow-rose-900/40'
                : 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400/30 shadow-emerald-900/40'
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
            className="p-2 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/10"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};

