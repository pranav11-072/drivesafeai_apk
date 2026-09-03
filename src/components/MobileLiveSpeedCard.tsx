import React from 'react';
import {
  Gauge,
  Navigation,
  AlertCircle,
  Lock,
  RefreshCw,
  AlertTriangle,
  Radio,
  Sliders,
  Sun,
  Power,
} from 'lucide-react';
import { SpeedData, CabinLightConfig } from '../types';
import { formatCoordinates } from '../utils/geolocation';
import { soundManager } from '../utils/audio';

interface MobileLiveSpeedCardProps {
  speedData: SpeedData;
  setSpeedData: React.Dispatch<React.SetStateAction<SpeedData>>;
  onRetryGps?: () => void;
  isManualOverride?: boolean;
  onToggleManualOverride?: (enabled: boolean) => void;
  manualSpeedKmh?: number;
  onSetManualSpeed?: (speed: number) => void;
  cabinLightConfig?: CabinLightConfig;
  onToggleCabinPower?: () => void;
}

export const MobileLiveSpeedCard: React.FC<MobileLiveSpeedCardProps> = ({
  speedData,
  setSpeedData,
  onRetryGps,
  isManualOverride = false,
  onToggleManualOverride,
  manualSpeedKmh = 0,
  onSetManualSpeed,
  cabinLightConfig,
  onToggleCabinPower,
}) => {
  const isGpsActive = speedData.gpsStatus === 'active';
  const isGpsLoading = speedData.gpsStatus === 'loading';
  const isGpsDenied = speedData.gpsStatus === 'denied';
  const isGpsUnavailable = speedData.gpsStatus === 'unavailable';
  const isSpeedAvailable = speedData.isSpeedAvailable && speedData.currentSpeedKmh !== null;

  // Toggle speed limit presets
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

  return (
    <div
      id="mobile-live-speed-hud"
      className="block md:hidden backdrop-blur-xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-blue-500/30 rounded-2xl p-4 shadow-2xl shadow-blue-950/40 relative overflow-hidden"
    >
      {/* Glow highlight for vehicle dashboard */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-blue-500/15 blur-2xl pointer-events-none"></div>

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 text-blue-400">
            <Gauge className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Vehicle Telematics
          </span>
        </div>

        {/* GPS Status Badge */}
        <div className="flex items-center gap-1.5">
          {isGpsActive ? (
            <span
              id="mobile-gps-active-badge"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)] font-mono"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>GPS Active</span>
              {speedData.accuracyMeters !== null && (
                <span className="text-[9px] text-emerald-400/90 font-normal">
                  ±{speedData.accuracyMeters}m
                </span>
              )}
            </span>
          ) : isGpsLoading ? (
            <span
              id="mobile-gps-loading-badge"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono"
            >
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
              <span>Acquiring Fix...</span>
            </span>
          ) : isGpsDenied ? (
            <span
              id="mobile-gps-denied-badge"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Permission Denied</span>
            </span>
          ) : (
            <span
              id="mobile-gps-unavailable-badge"
              className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 font-mono"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>GPS Offline</span>
            </span>
          )}
        </div>
      </div>

      {/* Prominent Live Vehicle Speed Display */}
      <div className="bg-black/40 border border-white/10 rounded-xl p-4 my-1 flex items-center justify-between">
        <div className="flex flex-col">
          {/* Label: SPEED */}
          <span className="text-xs uppercase tracking-widest font-extrabold text-slate-400 mb-1">
            SPEED
          </span>

          {/* Value: 62 km/h or Speed unavailable */}
          {isSpeedAvailable ? (
            <div className="flex items-baseline gap-2">
              <span
                id="mobile-prominent-speed-value"
                className={`text-5xl sm:text-6xl font-black font-mono tracking-tight ${
                  speedData.isOverSpeed
                    ? 'text-red-400 drop-shadow-[0_0_16px_rgba(239,68,68,0.8)] animate-pulse'
                    : isGpsActive
                    ? 'text-white drop-shadow-[0_0_16px_rgba(16,185,129,0.5)]'
                    : 'text-amber-300'
                }`}
              >
                {speedData.currentSpeedKmh}
              </span>
              <span className="text-xl font-bold font-mono text-slate-400">
                km/h
              </span>
            </div>
          ) : (
            <div
              id="mobile-prominent-speed-unavailable"
              className="text-2xl font-bold font-mono text-slate-400 py-1"
            >
              Speed unavailable
            </div>
          )}

          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
              {isGpsActive
                ? 'Actual GPS Sensor'
                : isManualOverride
                ? 'Manual Test Override'
                : isGpsLoading
                ? 'Awaiting Satellite Fix'
                : isGpsDenied
                ? 'Permission Denied'
                : 'Sensor Unavailable'}
            </span>
          </div>
        </div>

        {/* Speed Limit Badge */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleToggleSpeedLimit}
            id="mobile-btn-toggle-limit"
            title="Tap to cycle speed limit presets (50, 60, 80, 100, 120 km/h)"
            className={`w-14 h-14 rounded-full border-3 flex flex-col items-center justify-center font-bold shadow-xl active:scale-95 transition-transform ${
              speedData.isOverSpeed
                ? 'border-red-500 bg-red-950/90 text-red-100 animate-bounce shadow-red-900/60'
                : 'border-red-600 bg-white text-slate-950 shadow-white/20'
            }`}
          >
            <span className="text-[9px] leading-tight font-black uppercase text-slate-600">LIMIT</span>
            <span className="text-lg font-black leading-none font-mono">{speedData.speedLimitKmh}</span>
          </button>
          <span className="text-[9px] text-slate-400">Tap to set</span>
        </div>
      </div>

      {/* Prominent Ambient Cabin Light Status Block */}
      {cabinLightConfig && (
        <div
          id="mobile-cabin-light-status-card"
          className="mt-2.5 bg-black/30 border border-white/10 rounded-xl p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${
              cabinLightConfig.hardwareStatus === 'connected'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : cabinLightConfig.hardwareStatus === 'off'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                CABIN LIGHT
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {cabinLightConfig.hardwareStatus === 'connected' ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="text-sm font-black font-mono text-emerald-300">
                      ACTIVE
                    </span>
                  </>
                ) : cabinLightConfig.hardwareStatus === 'off' ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-sm font-black font-mono text-amber-300">
                      OFF
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    <span className="text-xs font-bold font-mono text-slate-400">
                      HARDWARE UNAVAILABLE
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {onToggleCabinPower && cabinLightConfig.hardwareStatus !== 'unavailable' && (
            <button
              onClick={onToggleCabinPower}
              className="px-2.5 py-1 rounded-lg text-xs font-bold border border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{cabinLightConfig.hardwareStatus === 'connected' ? 'Turn Off' : 'Turn On'}</span>
            </button>
          )}
        </div>
      )}

      {/* Overspeed Alert Notice */}
      {speedData.isOverSpeed && (
        <div className="mt-2.5 bg-red-500/20 border border-red-500/40 rounded-xl p-2.5 text-center flex items-center justify-center gap-2 text-red-200 text-xs font-bold shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>Overspeeding! Reduce speed below {speedData.speedLimitKmh} km/h</span>
        </div>
      )}

      {/* Permission Denied / Unavailable Action Notice */}
      {isGpsDenied && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px]">
              Location permission denied in browser.
            </span>
          </div>
          {onRetryGps && (
            <button
              onClick={onRetryGps}
              className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2 py-1 rounded-lg font-bold text-amber-100 shrink-0"
            >
              Retry GPS
            </button>
          )}
        </div>
      )}

      {isGpsUnavailable && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-slate-800/80 border border-white/10 text-slate-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] truncate">
              {speedData.gpsErrorMessage || "GPS sensor not available."}
            </span>
          </div>
          {onRetryGps && (
            <button
              onClick={onRetryGps}
              className="text-[10px] bg-white/10 hover:bg-white/20 border border-white/20 px-2 py-1 rounded-lg font-bold text-white shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Footer Location Strip & Bench Test Toggle */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate font-mono text-[11px]">
            {isGpsActive
              ? formatCoordinates(speedData.latitude, speedData.longitude)
              : isGpsLoading
              ? 'Acquiring GPS...'
              : 'Speed unavailable'}
          </span>
        </div>

        {/* Manual Test Mode Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={isManualOverride}
            onChange={e => onToggleManualOverride && onToggleManualOverride(e.target.checked)}
            className="rounded bg-slate-800 border-white/20 text-amber-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-[10px] text-amber-300 flex items-center gap-1">
            <Sliders className="w-3 h-3" />
            Test Mode
          </span>
        </label>
      </div>

      {/* Slider when in Test Mode */}
      {isManualOverride && (
        <div className="mt-2 pt-2 border-t border-amber-500/20">
          <div className="flex justify-between items-center text-[10px] text-amber-300 font-mono mb-1">
            <span>Manual Speed Slider</span>
            <span className="font-bold">{speedData.currentSpeedKmh} km/h</span>
          </div>
          <input
            type="range"
            min="0"
            max="160"
            value={manualSpeedKmh}
            onChange={handleManualSpeedChange}
            className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      )}
    </div>
  );
};
