import React, { useState, useEffect } from 'react';
import { Gauge, Navigation, AlertCircle, Play, Pause, Sliders, Zap } from 'lucide-react';
import { SpeedData } from '../types';
import { getRandomDemoLocation } from '../utils/geolocation';
import { soundManager } from '../utils/audio';

interface SpeedometerProps {
  speedData: SpeedData;
  setSpeedData: React.Dispatch<React.SetStateAction<SpeedData>>;
  isMonitoring?: boolean;
}

export const Speedometer: React.FC<SpeedometerProps> = ({
  speedData,
  setSpeedData,
  isMonitoring = false,
}) => {
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isLiveSimulating, setIsLiveSimulating] = useState(true);

  // Live speed simulation interval (fluctuates realistic driving speed)
  useEffect(() => {
    if (!isLiveSimulating && !isMonitoring) return;

    const speedInterval = setInterval(() => {
      setSpeedData(prev => {
        // Random acceleration/deceleration between -4 and +5 km/h
        const delta = Math.floor(Math.random() * 10) - 4;
        let newSpeed = Math.max(0, Math.min(145, prev.currentSpeedKmh + delta));
        
        // If speed was 0, kickstart it
        if (newSpeed === 0 && (isLiveSimulating || isMonitoring)) {
          newSpeed = 25;
        }

        const overSpeed = newSpeed > prev.speedLimitKmh;
        const severeOverSpeed = newSpeed >= prev.speedLimitKmh + 20;

        if (severeOverSpeed && !prev.isOverSpeed) {
          soundManager.playCriticalAlarm();
          soundManager.speakText("Critical speed alert! Slow down immediately!");
        } else if (overSpeed && !prev.isOverSpeed) {
          soundManager.playWarningBeep();
        }

        // Also slightly drift lat/lng to simulate vehicle moving along route
        const currentLat = prev.latitude ?? 37.7749;
        const currentLng = prev.longitude ?? -122.4194;
        const distDelta = (newSpeed / 3600) * 0.00015; // movement degrees offset
        const nextLat = currentLat + distDelta * 0.8;
        const nextLng = currentLng + distDelta * 0.6;

        return {
          ...prev,
          currentSpeedKmh: newSpeed,
          latitude: nextLat,
          longitude: nextLng,
          isOverSpeed: overSpeed,
        };
      });
    }, 900);

    return () => clearInterval(speedInterval);
  }, [isLiveSimulating, isMonitoring, setSpeedData]);

  // Request real browser geolocation speed if supported
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setIsGpsActive(true);
          const rawSpeedMps = position.coords.speed; // speed in meters/second
          if (rawSpeedMps !== null && rawSpeedMps >= 0) {
            const speedKmh = Math.round(rawSpeedMps * 3.6);
            setSpeedData(prev => ({
              ...prev,
              currentSpeedKmh: speedKmh,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              isOverSpeed: speedKmh > prev.speedLimitKmh,
            }));

            if (speedKmh > speedData.speedLimitKmh) {
              soundManager.playWarningBeep();
            }
          }
        },
        (err) => {
          console.warn("GPS Geolocation error", err);
          setIsGpsActive(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [setSpeedData, speedData.speedLimitKmh]);

  // Calculate gauge angle (-120deg to 120deg) based on speed 0-180 km/h
  const maxGaugeSpeed = 180;
  const clampedSpeed = Math.min(speedData.currentSpeedKmh, maxGaugeSpeed);
  const gaugePercent = (clampedSpeed / maxGaugeSpeed) * 100;

  const handleSpeedSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(e.target.value, 10);
    const overSpeed = newSpeed > speedData.speedLimitKmh;
    
    setSpeedData(prev => ({
      ...prev,
      currentSpeedKmh: newSpeed,
      isOverSpeed: overSpeed,
    }));

    if (overSpeed) {
      soundManager.playWarningBeep();
    }
  };

  const handleToggleSpeedLimit = () => {
    const limits = [50, 60, 80, 100, 120];
    const currentIndex = limits.indexOf(speedData.speedLimitKmh);
    const nextLimit = limits[(currentIndex + 1) % limits.length];
    
    setSpeedData(prev => ({
      ...prev,
      speedLimitKmh: nextLimit,
      isOverSpeed: prev.currentSpeedKmh > nextLimit,
    }));
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 text-blue-400">
            <Gauge className="w-4 h-4" />
          </div>
          <span>Live Vehicle Speed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsLiveSimulating(!isLiveSimulating)}
            id="btn-toggle-live-speed-sim"
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-all border ${
              isLiveSimulating || isMonitoring
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveSimulating || isMonitoring ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
            <span>{isLiveSimulating || isMonitoring ? 'LIVE SIM ACTIVE' : 'LIVE PAUSED'}</span>
          </button>
        </div>
      </div>

      {/* Speedometer Radial Gauge */}
      <div className="relative flex flex-col items-center justify-center my-2">
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
              stroke={speedData.isOverSpeed ? '#ef4444' : '#38bdf8'}
              strokeWidth="8"
              strokeDasharray="188.5"
              strokeDashoffset={188.5 - (gaugePercent / 100) * (188.5 - 37.7)}
              strokeLinecap="round"
              className="transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
            />
          </svg>

          {/* Speed Value Text */}
          <div className="absolute text-center flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-black font-mono tracking-tight transition-all ${
                speedData.isOverSpeed ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse' : 'text-white drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]'
              }`}>
                {speedData.currentSpeedKmh}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-blue-300/80 font-bold mt-1">KM / H LIVE</span>
          </div>
        </div>

        {/* Speed Limit Sign Badge */}
        <button
          onClick={handleToggleSpeedLimit}
          id="btn-toggle-speed-limit"
          title="Click to toggle speed limit setting"
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

      {/* Manual Speed Adjust Slider */}
      <div className="backdrop-blur-md bg-white/5 rounded-xl p-3 border border-white/10 space-y-1.5">
        <div className="flex justify-between items-center text-xs text-slate-300 font-medium">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" /> Manual Speed Control
          </span>
          <span className="font-mono text-blue-300 font-bold">{speedData.currentSpeedKmh} km/h</span>
        </div>
        <input
          type="range"
          min="0"
          max="160"
          value={speedData.currentSpeedKmh}
          onChange={handleSpeedSliderChange}
          id="input-speed-slider"
          className="w-full accent-blue-400 h-1.5 bg-slate-800/80 rounded-lg cursor-pointer"
        />
      </div>

      {/* Location Bar */}
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-300 backdrop-blur-md bg-white/5 p-2.5 rounded-xl border border-white/10">
        <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-mono truncate">{speedData.locationName || getRandomDemoLocation()}</span>
      </div>
    </div>
  );
};

