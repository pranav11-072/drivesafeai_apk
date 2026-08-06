import React, { useState, useEffect } from 'react';
import { Gauge, Navigation, AlertCircle, Compass, Sliders } from 'lucide-react';
import { SpeedData } from '../types';
import { getRandomDemoLocation } from '../utils/geolocation';
import { soundManager } from '../utils/audio';

interface SpeedometerProps {
  speedData: SpeedData;
  setSpeedData: React.Dispatch<React.SetStateAction<SpeedData>>;
}

export const Speedometer: React.FC<SpeedometerProps> = ({
  speedData,
  setSpeedData,
}) => {
  const [isGpsActive, setIsGpsActive] = useState(false);

  // Request real browser geolocation speed if supported
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setIsGpsActive(true);
          const rawSpeedMps = position.coords.speed; // speed in meters/second
          const speedKmh = rawSpeedMps !== null && rawSpeedMps >= 0
            ? Math.round(rawSpeedMps * 3.6)
            : speedData.currentSpeedKmh;

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
        },
        (err) => {
          console.warn("GPS Geolocation error", err);
          setIsGpsActive(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Calculate gauge angle (-120deg to 120deg) based on speed 0-180 km/h
  const maxGaugeSpeed = 180;
  const clampedSpeed = Math.min(speedData.currentSpeedKmh, maxGaugeSpeed);
  const gaugePercent = (clampedSpeed / maxGaugeSpeed) * 100;
  const needleRotation = -120 + (gaugePercent / 100) * 240;

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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
        <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
          <Gauge className="w-4 h-4 text-emerald-400" />
          <span>Vehicle Speed & GPS</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${isGpsActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
          <span className="text-slate-400 font-mono">{isGpsActive ? 'GPS ACTIVE' : 'SIMULATED'}</span>
        </div>
      </div>

      {/* Speedometer Radial Gauge */}
      <div className="relative flex flex-col items-center justify-center my-2">
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* Circular Track SVG */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#1e293b"
              strokeWidth="8"
              strokeDasharray="188.5"
              strokeDashoffset="37.7"
              strokeLinecap="round"
            />
            {/* Active Speed Arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={speedData.isOverSpeed ? '#ef4444' : '#10b981'}
              strokeWidth="8"
              strokeDasharray="188.5"
              strokeDashoffset={188.5 - (gaugePercent / 100) * (188.5 - 37.7)}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>

          {/* Speed Value Text */}
          <div className="absolute text-center flex flex-col items-center">
            <span className={`text-4xl font-black font-mono tracking-tight ${
              speedData.isOverSpeed ? 'text-red-400 animate-pulse' : 'text-white'
            }`}>
              {speedData.currentSpeedKmh}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">KM / H</span>
          </div>
        </div>

        {/* Speed Limit Sign Badge */}
        <button
          onClick={handleToggleSpeedLimit}
          id="btn-toggle-speed-limit"
          title="Click to toggle speed limit setting"
          className={`absolute top-0 right-2 w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center font-bold text-xs shadow-md transition-transform hover:scale-105 ${
            speedData.isOverSpeed
              ? 'border-red-500 bg-red-950/80 text-red-200 animate-bounce'
              : 'border-red-600 bg-white text-slate-900'
          }`}
        >
          <span className="text-[8px] leading-tight font-extrabold uppercase text-slate-500">LIMIT</span>
          <span className="text-sm font-black leading-none">{speedData.speedLimitKmh}</span>
        </button>
      </div>

      {/* Speed Limit Warning Banner */}
      {speedData.isOverSpeed && (
        <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-2.5 text-center flex items-center justify-center gap-2 text-red-300 text-xs font-semibold mb-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>Overspeeding! Reduce speed below {speedData.speedLimitKmh} km/h</span>
        </div>
      )}

      {/* Speed Control Slider for Testing */}
      <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 space-y-1.5">
        <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-slate-400" /> Speed Control Slider
          </span>
          <span className="font-mono text-slate-200">{speedData.currentSpeedKmh} km/h</span>
        </div>
        <input
          type="range"
          min="0"
          max="160"
          value={speedData.currentSpeedKmh}
          onChange={handleSpeedSliderChange}
          id="input-speed-slider"
          className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Current Location */}
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
        <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-mono truncate">{speedData.locationName || getRandomDemoLocation()}</span>
      </div>
    </div>
  );
};
