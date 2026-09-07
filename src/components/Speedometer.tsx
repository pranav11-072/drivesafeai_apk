import React from 'react';
import {
  Gauge,
  Navigation,
  AlertCircle,
  Sliders,
  Radio,
  Lock,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause,
  Zap,
  Car,
  Sparkles,
} from 'lucide-react';
import { SpeedData } from '../types';
import { soundManager } from '../utils/audio';
import { formatCoordinates } from '../utils/geolocation';

interface SpeedometerProps {
  speedData: SpeedData;
  setSpeedData: React.Dispatch<React.SetStateAction<SpeedData>>;
  isMonitoring?: boolean;
  onRetryGps?: () => void;
  isManualOverride?: boolean;
  onToggleManualOverride?: (enabled: boolean) => void;
  manualSpeedKmh?: number;
  onSetManualSpeed?: (speed: number) => void;
  isRandomRunning?: boolean;
  onToggleRandomRunning?: (enabled: boolean) => void;
  randomSpeedProfile?: 'random' | 'city' | 'highway' | 'cruising';
  onSetRandomSpeedProfile?: (profile: 'random' | 'city' | 'highway' | 'cruising') => void;
  onTriggerOverspeedBurst?: () => void;
}

export const Speedometer: React.FC<SpeedometerProps> = ({
  speedData,
  setSpeedData,
  isMonitoring = false,
  onRetryGps,
  isManualOverride = false,
  onToggleManualOverride,
  manualSpeedKmh = 0,
  onSetManualSpeed,
  isRandomRunning = true,
  onToggleRandomRunning,
  randomSpeedProfile = 'random',
  onSetRandomSpeedProfile,
  onTriggerOverspeedBurst,
}) => {
  const isGpsActive = speedData.gpsStatus === 'active';
  const isGpsLoading = speedData.gpsStatus === 'loading';
  const isGpsDenied = speedData.gpsStatus === 'denied';
  const isGpsUnavailable = speedData.gpsStatus === 'unavailable';
  const isSimulated = speedData.speedSource === 'random' || speedData.gpsStatus === 'simulated';
  const isSpeedAvailable = speedData.isSpeedAvailable && speedData.currentSpeedKmh !== null;

  // Toggle speed limit presets (50, 60, 80, 100, 120 km/h)
  const handleToggleSpeedLimit = () => {
    const limits = [50, 60, 80, 100, 120];
    const currentIndex = limits.indexOf(speedData.speedLimitKmh);
    const nextLimit = limits[(currentIndex + 1) % limits.length];

    setSpeedData(prev => ({
      ...prev,
      speedLimitKmh: nextLimit,
      isOverSpeed: prev.currentSpeedKmh !== null && prev.currentSpeedKmh > nextLimit,
    }));
  };

  // Handle manual test slider
  const handleManualSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(e.target.value, 10);
    if (onSetManualSpeed) {
      onSetManualSpeed(newSpeed);
    }

    const overSpeed = newSpeed > speedData.speedLimitKmh;
    setSpeedData(prev => ({
      ...prev,
      currentSpeedKmh: newSpeed,
      currentSpeed: newSpeed,
      isSpeedAvailable: true,
      isOverSpeed: overSpeed,
      speedSource: 'manual',
    }));

    if (overSpeed) {
      soundManager.playWarningBeep();
    }
  };

  // Calculate radial gauge angle (-120deg to 120deg) based on speed 0-180 km/h
  const maxGaugeSpeed = 180;
  const clampedSpeed = isSpeedAvailable ? Math.min(speedData.currentSpeedKmh || 0, maxGaugeSpeed) : 0;
  const gaugePercent = isSpeedAvailable ? (clampedSpeed / maxGaugeSpeed) * 100 : 0;

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full relative overflow-hidden">
      {/* Top Header with GPS / Random Simulation Status */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 text-blue-400">
            <Gauge className="w-4 h-4" />
          </div>
          <span>Live Vehicle Speed</span>
        </div>

        {/* Dynamic Telematics Status Pill */}
        <div className="flex items-center gap-1.5">
          {isSimulated && !isManualOverride ? (
            <span
              id="gps-status-simulated"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.25)] font-mono"
              title="Speedometer running live random automotive simulation"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              <span>Random Drive Sim</span>
            </span>
          ) : isGpsActive ? (
            <span
              id="gps-status-active"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)] font-mono"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>GPS Active</span>
              {speedData.accuracyMeters !== null && (
                <span className="text-[9px] text-emerald-400/90 font-normal ml-0.5">
                  ±{speedData.accuracyMeters}m
                </span>
              )}
            </span>
          ) : isGpsLoading ? (
            <span
              id="gps-status-loading"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono"
            >
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
              <span>Acquiring GPS...</span>
            </span>
          ) : isGpsDenied ? (
            <span
              id="gps-status-denied"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Permission Denied</span>
            </span>
          ) : (
            <span
              id="gps-status-unavailable"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-slate-800/80 text-slate-300 border border-slate-700 font-mono"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>GPS Offline</span>
            </span>
          )}
        </div>
      </div>

      {/* Permission Denied Notice Card */}
      {isGpsDenied && (
        <div className="mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-[11px]">Location Permission Denied</p>
              <p className="text-[10px] text-amber-300/80">
                Allow location in browser address bar to track live speed via GPS.
              </p>
            </div>
          </div>
          {onRetryGps && (
            <button
              onClick={onRetryGps}
              id="btn-retry-gps-permission"
              className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap text-amber-100 shrink-0"
            >
              Retry GPS
            </button>
          )}
        </div>
      )}

      {/* GPS Unavailable Notice Card */}
      {isGpsUnavailable && (
        <div className="mb-2 p-2.5 rounded-xl bg-slate-800/80 border border-white/10 text-slate-300 text-xs flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-[11px]">GPS Signal Unavailable</p>
              <p className="text-[10px] text-slate-400">
                {speedData.gpsErrorMessage || "No GPS sensor detected or device location is turned off."}
              </p>
            </div>
          </div>
          {onRetryGps && (
            <button
              onClick={onRetryGps}
              id="btn-retry-gps-unavailable"
              className="text-[10px] bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap text-white shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* GPS Loading Indicator Notice */}
      {isGpsLoading && (
        <div className="mb-2 p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200 text-xs flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
          <span className="text-[11px]">Acquiring GPS Signal... Waiting for device satellite fix.</span>
        </div>
      )}

      {/* Speedometer Radial Gauge */}
      <div className="relative flex flex-col items-center justify-center my-1">
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Circular Track SVG */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="8"
              strokeDasharray="188.5"
              strokeDashoffset="37.7"
              strokeLinecap="round"
            />
            {/* Active Speed Arc with Glow */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={
                speedData.isOverSpeed
                  ? '#ef4444'
                  : isSimulated && !isManualOverride
                  ? '#38bdf8'
                  : isGpsActive
                  ? '#10b981'
                  : isManualOverride
                  ? '#f59e0b'
                  : '#475569'
              }
              strokeWidth="8"
              strokeDasharray="188.5"
              strokeDashoffset={188.5 - (gaugePercent / 100) * (188.5 - 37.7)}
              strokeLinecap="round"
              className="transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
            />
          </svg>

          {/* Speed Value Text: SPEED / 62 km/h or Speed unavailable */}
          <div className="absolute text-center flex flex-col items-center px-4">
            <span className="text-[11px] uppercase tracking-widest font-extrabold text-slate-400 mb-0.5">
              SPEED
            </span>

            {isSpeedAvailable ? (
              <div className="flex items-baseline gap-1">
                <span
                  id="display-live-speed"
                  className={`text-5xl font-black font-mono tracking-tight transition-all ${
                    speedData.isOverSpeed
                      ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse'
                      : isSimulated && !isManualOverride
                      ? 'text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]'
                      : isGpsActive
                      ? 'text-white drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'text-amber-300'
                  }`}
                >
                  {speedData.currentSpeedKmh}
                </span>
                <span className="text-base font-bold font-mono text-slate-400">km/h</span>
              </div>
            ) : (
              <span
                id="display-live-speed-unavailable"
                className="text-sm sm:text-base font-bold text-slate-400 font-mono text-center max-w-[130px] leading-tight my-1"
              >
                Speed unavailable
              </span>
            )}

            <span className="text-[9px] uppercase tracking-widest font-bold mt-1 text-slate-500">
              {isSimulated && !isManualOverride
                ? 'RANDOM CRUISE SIM'
                : isGpsActive
                ? 'ACTUAL GPS'
                : isManualOverride
                ? 'MANUAL TEST OVERRIDE'
                : isGpsLoading
                ? 'AWAITING FIX'
                : isGpsDenied
                ? 'PERMISSION DENIED'
                : 'GPS OFFLINE'}
            </span>
          </div>
        </div>

        {/* Speed Limit Sign Badge */}
        <button
          onClick={handleToggleSpeedLimit}
          id="btn-toggle-speed-limit"
          title="Click to toggle speed limit setting (50, 60, 80, 100, 120 km/h)"
          className={`absolute top-0 right-2 w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center font-bold text-xs shadow-xl transition-all hover:scale-110 ${
            speedData.isOverSpeed
              ? 'border-red-500 bg-red-950/90 text-red-100 animate-bounce shadow-red-900/50'
              : 'border-red-600 bg-white text-slate-900 shadow-white/20'
          }`}
        >
          <span className="text-[8px] leading-tight font-extrabold uppercase text-slate-500">LIMIT</span>
          <span className="text-sm font-black leading-none">{speedData.speedLimitKmh}</span>
        </button>
      </div>

      {/* Speed Limit Warning Banner */}
      {speedData.isOverSpeed && (
        <div className="bg-red-500/20 backdrop-blur-md border border-red-500/40 rounded-xl p-2.5 text-center flex items-center justify-center gap-2 text-red-200 text-xs font-semibold mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>Overspeeding! Reduce speed below {speedData.speedLimitKmh} km/h</span>
        </div>
      )}

      {/* Random Speed & Manual Drive Control Bench */}
      <div className="backdrop-blur-md bg-white/5 rounded-xl p-2.5 border border-white/10 space-y-2 mb-2">
        {/* Row 1: Random Speed Generator Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onToggleRandomRunning && onToggleRandomRunning(!isRandomRunning)}
              id="btn-toggle-random-speed"
              title={isRandomRunning ? "Pause random driving speed" : "Start random driving speed"}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                isRandomRunning && !isManualOverride
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                  : 'bg-slate-800 text-slate-400 border border-white/10 hover:text-white'
              }`}
            >
              {isRandomRunning && !isManualOverride ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                  <Pause className="w-2.5 h-2.5" />
                  <span>Random Active</span>
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Run Randomly</span>
                </>
              )}
            </button>

            {onTriggerOverspeedBurst && (
              <button
                onClick={onTriggerOverspeedBurst}
                id="btn-trigger-overspeed"
                title="Accelerate past speed limit for 6 seconds to test warning alerts"
                className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
              >
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                <span>Test Overspeed</span>
              </button>
            )}
          </div>

          {/* Drive Profile Selector */}
          {onSetRandomSpeedProfile && (
            <div className="flex items-center gap-1 text-[9px] font-mono">
              {(['random', 'city', 'cruising', 'highway'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => onSetRandomSpeedProfile(p)}
                  className={`px-1.5 py-0.5 rounded capitalize transition-all ${
                    randomSpeedProfile === p && isRandomRunning && !isManualOverride
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {p === 'cruising' ? 'cruise' : p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Manual Speed Override Slider */}
        <div className="flex justify-between items-center text-xs text-slate-300 font-medium pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="chk-manual-speed-override"
              checked={isManualOverride}
              onChange={e => onToggleManualOverride && onToggleManualOverride(e.target.checked)}
              className="rounded bg-slate-800 border-white/20 text-amber-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1 text-[11px]">
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>Manual Slider</span>
            </span>
          </label>

          <span className="font-mono text-[11px] text-slate-300">
            {isManualOverride ? (
              <span className="text-amber-300 font-bold">{speedData.currentSpeedKmh} km/h (Manual)</span>
            ) : isSimulated ? (
              <span className="text-sky-300 font-bold">{speedData.currentSpeedKmh} km/h (Random)</span>
            ) : isGpsActive ? (
              <span className="text-emerald-400 font-bold">{speedData.currentSpeedKmh} km/h (GPS)</span>
            ) : (
              <span className="text-slate-400">Offline</span>
            )}
          </span>
        </div>

        {isManualOverride && (
          <div>
            <input
              type="range"
              min="0"
              max="160"
              value={manualSpeedKmh}
              onChange={handleManualSpeedChange}
              id="input-speed-slider"
              className="w-full accent-amber-400 h-1.5 bg-slate-800/80 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-amber-300/80 mt-1 text-center font-mono">
              Manual mode: Drag slider to test overspeed alerts ({speedData.speedLimitKmh} km/h limit)
            </p>
          </div>
        )}
      </div>

      {/* Real Location Bar */}
      <div className="flex items-center gap-2 text-xs text-slate-300 backdrop-blur-md bg-white/5 p-2.5 rounded-xl border border-white/10">
        <Navigation
          className={`w-4 h-4 shrink-0 ${
            isGpsActive
              ? 'text-emerald-400'
              : isGpsLoading
              ? 'text-sky-400 animate-pulse'
              : isGpsDenied
              ? 'text-amber-400'
              : 'text-slate-500'
          }`}
        />
        <span id="speedometer-location-display" className="font-mono truncate text-[11px]">
          {isGpsActive
            ? formatCoordinates(speedData.latitude, speedData.longitude)
            : isGpsLoading
            ? 'Acquiring GPS coordinates...'
            : isGpsDenied
            ? 'Location unavailable (Permission denied)'
            : 'GPS location unavailable'}
        </span>
      </div>
    </div>
  );
};
