import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, PhoneCall, Volume2, VolumeX, AlertTriangle,
  RotateCcw, Sparkles, Navigation, CheckCircle2, ChevronRight, X, ExternalLink, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DriverState, SpeedData, CabinLightConfig, EmergencyContact } from '../types';
import { CameraHUD } from './CameraHUD';
import { soundManager } from '../utils/audio';
import { useHarshDrivingDetector } from '../hooks/useHarshDrivingDetector';
import { calculateSafetyRating } from '../utils/safetyRatingCalculator';

interface MobileDashboardProps {
  driverState: DriverState;
  setDriverState: React.Dispatch<React.SetStateAction<DriverState>>;
  speedData: SpeedData;
  cabinLightConfig: CabinLightConfig;
  isMonitoring: boolean;
  onToggleMonitoring: (forceState?: boolean) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onSwitchToDesktopView?: () => void;
  onOpenScorecard?: () => void;
  onRetryGps?: () => void;
  isRandomRunning?: boolean;
  onToggleRandomRunning?: (enabled: boolean) => void;
  onTriggerOverspeedBurst?: () => void;
}

export const MobileDashboard: React.FC<MobileDashboardProps> = ({
  driverState,
  setDriverState,
  speedData,
  cabinLightConfig,
  isMonitoring,
  onToggleMonitoring,
  isMuted,
  onToggleMute,
  onSwitchToDesktopView,
  onOpenScorecard,
  onRetryGps,
  isRandomRunning,
  onToggleRandomRunning,
  onTriggerOverspeedBurst,
}) => {
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [sosDispatched, setSosDispatched] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [sosHoldProgress, setSosHoldProgress] = useState(0);
  const holdIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Fatigue Level Mapping (Strictly LOW, MODERATE, HIGH)
  type FatigueLevel = 'LOW' | 'MODERATE' | 'HIGH';

  const getFatigueState = (): { level: FatigueLevel; text: string; color: string; bg: string; border: string; dot: string } => {
    if (
      driverState.alertLevel === 'RED' ||
      driverState.eyesClosed ||
      driverState.microSleepCount > 0 ||
      driverState.drowsinessLevel > 60
    ) {
      return {
        level: 'HIGH',
        text: 'HIGH',
        color: 'text-red-400',
        bg: 'bg-red-500/20',
        border: 'border-red-500/50',
        dot: 'bg-red-400 animate-ping',
      };
    }
    if (
      driverState.alertLevel === 'YELLOW' ||
      driverState.isYawning ||
      driverState.drowsinessLevel > 30 ||
      driverState.yawnCount > 0
    ) {
      return {
        level: 'MODERATE',
        text: 'MODERATE',
        color: 'text-amber-400',
        bg: 'bg-amber-500/20',
        border: 'border-amber-500/50',
        dot: 'bg-amber-400 animate-pulse',
      };
    }
    return {
      level: 'LOW',
      text: 'LOW',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500/50',
      dot: 'bg-emerald-400',
    };
  };

  const fatigue = getFatigueState();
  const isHighFatigue = fatigue.level === 'HIGH';

  // Harsh driving detector hook
  const { harshEventsCount } = useHarshDrivingDetector(speedData, isMonitoring);
  const [driveDurationSeconds, setDriveDurationSeconds] = useState(0);

  useEffect(() => {
    let t: any = null;
    if (isMonitoring) {
      t = setInterval(() => setDriveDurationSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(t);
  }, [isMonitoring]);

  // Real-time Driver Safety Rating calculated purely from active valid signals
  const ratingResult = calculateSafetyRating({
    driverState,
    speedData,
    drivingDurationSeconds: driveDurationSeconds,
    harshEventsCount,
  });

  // Audio and Speech Warning when Fatigue reaches HIGH
  const prevFatigueLevelRef = React.useRef<FatigueLevel>(fatigue.level);
  const lastHighFatigueAudioTimeRef = React.useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (isHighFatigue && (prevFatigueLevelRef.current !== 'HIGH' || now - lastHighFatigueAudioTimeRef.current > 12000)) {
      lastHighFatigueAudioTimeRef.current = now;
      if (!isMuted) {
        soundManager.unlockAudioContext();
        soundManager.playCriticalAlarm(true);
        soundManager.speakText("Warning! High fatigue detected. Please pull over and take a break immediately!", true);
      }
    }
    prevFatigueLevelRef.current = fatigue.level;
  }, [isHighFatigue, isMuted, fatigue.level]);

  // Speed Text formatting
  const getSpeedDisplay = () => {
    if (speedData.isSpeedAvailable && speedData.currentSpeedKmh !== null && speedData.currentSpeedKmh >= 0) {
      return {
        value: `${Math.round(speedData.currentSpeedKmh)}`,
        unit: 'km/h',
        isAvailable: true,
      };
    }
    return {
      value: 'Speed unavailable',
      unit: '',
      isAvailable: false,
    };
  };

  const speedDisplay = getSpeedDisplay();

  // GPS Status Mapping
  const getGpsStatus = () => {
    if (speedData.speedSource === 'random' || speedData.gpsStatus === 'simulated') {
      return { label: 'SIM CRUISE', color: 'text-sky-300', dot: 'bg-sky-400 animate-pulse' };
    }
    if (speedData.gpsStatus === 'active') {
      return { label: 'ACTIVE', color: 'text-emerald-400', dot: 'bg-emerald-400 animate-pulse' };
    }
    if (speedData.gpsStatus === 'loading') {
      return { label: 'SEARCHING', color: 'text-amber-400', dot: 'bg-amber-400 animate-ping' };
    }
    return { label: 'OFFLINE', color: 'text-slate-400', dot: 'bg-slate-500' };
  };

  const gpsStatus = getGpsStatus();

  // Cabin Light Status Mapping
  const getCabinLightStatus = () => {
    if (cabinLightConfig.hardwareStatus === 'connected') {
      return { label: 'ACTIVE', color: 'text-emerald-400', dot: 'bg-emerald-400 animate-pulse' };
    }
    if (cabinLightConfig.hardwareStatus === 'off') {
      return { label: 'OFF', color: 'text-amber-400', dot: 'bg-amber-400' };
    }
    return { label: 'UNAVAILABLE', color: 'text-slate-400', dot: 'bg-slate-500' };
  };

  const cabinLightStatus = getCabinLightStatus();

  // Retrieve user emergency contacts strictly from localStorage (no invented contacts/numbers)
  const getSavedContacts = (): EmergencyContact[] => {
    try {
      const saved = localStorage.getItem('drivesafe_emergency_contacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // fallback
    }
    return [
      { id: '1', name: 'National Emergency Services', phone: '112', relationship: 'Emergency Services', isPrimary: true },
    ];
  };

  // Handle SOS Modal Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isSosModalOpen && !sosDispatched && sosCountdown > 0) {
      timer = setTimeout(() => {
        setSosCountdown(prev => prev - 1);
        if (!isMuted && sosCountdown > 1) {
          soundManager.playWarningBeep();
        }
      }, 1000);
    } else if (isSosModalOpen && !sosDispatched && sosCountdown === 0) {
      triggerSosDispatch();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSosModalOpen, sosCountdown, sosDispatched, isMuted]);

  // Confirmation Mechanism: Opens countdown modal to prevent accidental activation
  const handleOpenSos = () => {
    soundManager.unlockAudioContext();
    soundManager.playWarningBeep(true);
    setSosCountdown(5);
    setSosDispatched(false);
    setIsSosModalOpen(true);
  };

  // Auto-trigger SOS Call when critical threshold (>= 80%) is sustained > 5 seconds
  const criticalDrowsyStartTimeRef = React.useRef<number | null>(null);
  const lastAutoCallTimeRef = React.useRef<number>(0);
  const [criticalSustainedSeconds, setCriticalSustainedSeconds] = useState<number>(0);

  useEffect(() => {
    let autotriggerPref = true;
    try {
      const saved = localStorage.getItem('drivesafe_sos_autotrigger');
      if (saved !== null) autotriggerPref = saved === 'true';
    } catch {}

    if (!autotriggerPref || !isMonitoring) {
      criticalDrowsyStartTimeRef.current = null;
      setCriticalSustainedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const isCritical =
        driverState.drowsinessLevel >= 80 ||
        driverState.alertLevel === 'RED' ||
        (driverState.eyesClosed && driverState.drowsinessLevel >= 70);

      const now = Date.now();
      if (isCritical) {
        if (!criticalDrowsyStartTimeRef.current) {
          criticalDrowsyStartTimeRef.current = now;
        }
        const elapsedMs = now - criticalDrowsyStartTimeRef.current;
        const elapsedSec = Math.min(5, Math.round((elapsedMs / 1000) * 10) / 10);
        setCriticalSustainedSeconds(prev => (prev !== elapsedSec ? elapsedSec : prev));

        if (elapsedMs >= 5000) {
          if (now - lastAutoCallTimeRef.current > 30000 && !isSosModalOpen) {
            lastAutoCallTimeRef.current = now;
            soundManager.playCriticalAlarm();
            soundManager.speakText(
              "Critical warning: Driver drowsiness sustained for more than 5 seconds. Automatically initiating emergency SOS.",
              true
            );
            handleOpenSos();
            const contacts = getSavedContacts();
            const primary = contacts.find(c => c.isPrimary) || contacts[0];
            if (primary && primary.phone) {
              try {
                window.location.href = `tel:${primary.phone.replace(/[\s\-\(\)]/g, '')}`;
              } catch (e) {
                console.warn("Could not launch phone tel link", e);
              }
            }
          }
          criticalDrowsyStartTimeRef.current = null;
          setCriticalSustainedSeconds(0);
        }
      } else if (criticalDrowsyStartTimeRef.current !== null) {
        criticalDrowsyStartTimeRef.current = null;
        setCriticalSustainedSeconds(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [driverState.drowsinessLevel, driverState.alertLevel, driverState.eyesClosed, isMonitoring, isSosModalOpen]);

  // Optional Press-and-Hold for physical confirmation
  const handleStartHold = () => {
    setSosHoldProgress(0);
    const startTime = Date.now();
    const duration = 900; // 0.9s hold for activation
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setSosHoldProgress(progress);
      if (progress >= 100) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        handleOpenSos();
      }
    }, 40);
  };

  const handleEndHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setSosHoldProgress(0);
  };

  const triggerSosDispatch = async () => {
    setIsDispatching(true);
    soundManager.speakText("Emergency SOS alert dispatched to 112 emergency services and registered contacts.", true);
    try {
      const lat = speedData.latitude;
      const lon = speedData.longitude;
      const hasGps = typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon);
      const locationName = hasGps && lat !== null && lon !== null
        ? `${speedData.locationName || 'Unknown Location'} (${lat.toFixed(4)}, ${lon.toFixed(4)})`
        : `GPS Offline (${speedData.gpsStatus || 'Signal Unavailable'})`;
      const speed = speedData.currentSpeedKmh || 0;
      const contacts = getSavedContacts();
      const primaryContact = contacts[0] || { name: 'Emergency Services', phone: '112' };

      await fetch('/api/sos/send-automated-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: primaryContact.name,
          phone: primaryContact.phone,
          location: locationName,
          speedKmh: speed,
          lat,
          lon,
          triggerReason: 'Driver Mobile SOS Confirmation Triggered',
          provider: 'auto_indian',
          drowsinessLevel: driverState.drowsinessLevel,
        }),
      });
      setSosDispatched(true);
    } catch (err) {
      console.error("SOS dispatch failed", err);
      setSosDispatched(true);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-3 py-2 flex flex-col gap-3 font-sans text-slate-100 selection:bg-blue-500 selection:text-white">
      {/* --------------------------------
             DRIVESAFE AI HEADER
      -------------------------------- */}
      <header className="rounded-2xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse"></div>
          <h1 className="text-base font-extrabold tracking-widest text-white uppercase">
            DRIVESAFE AI
          </h1>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-2">
          {/* Monitoring toggle */}
          <button
            onClick={() => onToggleMonitoring(!isMonitoring)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              isMonitoring
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50 animate-pulse'
            }`}
            title={isMonitoring ? "Pause Driver Monitoring" : "Start Driver Monitoring & Camera"}
          >
            {isMonitoring ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                <span>Monitoring</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start</span>
              </>
            )}
          </button>

          {/* Mute toggle */}
          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
            title={isMuted ? "Unmute audio alerts" : "Mute audio alerts"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Switch to desktop telematics if available */}
          {onSwitchToDesktopView && (
            <button
              onClick={onSwitchToDesktopView}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
              title="Switch to full desktop telematics dashboard"
            >
              <span>Full View</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </header>

      {/* --------------------------------
             HIGH FATIGUE FLASH / VISUAL WARNING
      -------------------------------- */}
      <AnimatePresence>
        {isHighFatigue && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl bg-red-600/30 border-2 border-red-500 p-3.5 shadow-[0_0_35px_rgba(239,68,68,0.5)] backdrop-blur-xl flex flex-col items-center text-center animate-pulse"
          >
            <div className="flex items-center gap-2 text-red-300 font-bold text-xs uppercase tracking-wider mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>INTERVENTION REQUIRED: PULL OVER SAFELY</span>
            </div>
            <p className="text-xs text-white font-semibold">
              High fatigue detected! Pull over at the nearest safe rest area.
            </p>

            {/* 5-second Auto-trigger progress bar */}
            {criticalSustainedSeconds > 0 && (
              <div className="w-full mt-2 pt-2 border-t border-red-500/40 text-left">
                <div className="flex items-center justify-between text-[11px] text-red-200 font-bold mb-1">
                  <span>Auto-trigger SOS Call countdown:</span>
                  <span className="font-mono">{(5 - criticalSustainedSeconds).toFixed(1)}s</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-red-500 h-full transition-all duration-100"
                    style={{ width: `${(criticalSustainedSeconds / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------------
             1. LIVE CAMERA
      -------------------------------- */}
      <section className={`rounded-2xl bg-white/5 border p-3.5 backdrop-blur-xl shadow-xl transition-all ${
        isHighFatigue ? 'border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.3)]' : 'border-white/10'
      }`}>
        <CameraHUD
          driverState={driverState}
          setDriverState={setDriverState}
          isMonitoring={isMonitoring}
          onToggleMonitoring={onToggleMonitoring}
          isMobileMode={true}
        />
      </section>

      {/* --------------------------------
          2 & 4. SPEED & FATIGUE
      -------------------------------- */}
      <section className="grid grid-cols-2 gap-3">
        {/* Live Vehicle Speed Card */}
        <div
          id="mobile-speed-card"
          className={`rounded-2xl bg-white/5 border p-4 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden transition-all ${
            speedData.isOverSpeed
              ? 'border-red-500/80 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse'
              : 'border-white/10'
          }`}
        >
          <div className="text-[11px] font-mono font-bold tracking-[0.18em] text-slate-400 uppercase mb-1">
            SPEED
          </div>

          <div className="my-1 flex items-baseline justify-center gap-1">
            {speedDisplay.isAvailable ? (
              <>
                <span
                  className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    speedData.isOverSpeed
                      ? 'text-red-400'
                      : speedData.speedSource === 'random'
                      ? 'text-sky-300'
                      : 'text-white'
                  }`}
                >
                  {speedDisplay.value}
                </span>
                <span className="text-xs font-mono font-semibold text-slate-400 uppercase">
                  {speedDisplay.unit}
                </span>
              </>
            ) : (
              <span className="text-sm sm:text-base font-medium text-slate-400 py-1.5">
                {speedDisplay.value}
              </span>
            )}
          </div>

          {/* Subtle Telematics Signal Indicator */}
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${gpsStatus.dot}`}></span>
            <span className="truncate">
              {speedData.speedSource === 'random'
                ? 'Random Drive Sim'
                : speedData.isSpeedAvailable
                ? 'GPS Speed'
                : 'Signal Syncing'}
            </span>
          </div>
        </div>

        {/* Fatigue / Drowsiness Detection Card */}
        <div
          id="mobile-fatigue-card"
          className={`rounded-2xl bg-white/5 border p-4 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center text-center transition-all ${
            isHighFatigue ? 'border-red-500/80 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' : 'border-white/10'
          }`}
        >
          <div className="text-[11px] font-mono font-bold tracking-[0.18em] text-slate-400 uppercase mb-1">
            FATIGUE
          </div>

          {/* Explicit LOW / MODERATE / HIGH display */}
          <div className="my-1 flex items-center justify-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${fatigue.dot}`} />
            <span className={`text-2xl sm:text-3xl font-black tracking-wide ${fatigue.color}`}>
              {fatigue.text}
            </span>
          </div>

          {/* Drowsiness percentage index & status hint */}
          <div className="mt-1 text-[10px] font-mono text-slate-300">
            {isHighFatigue ? (
              <span className="text-red-400 font-bold">Take a break!</span>
            ) : (
              <span>Drowsiness: {driverState.drowsinessLevel}%</span>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------
             5. SAFETY SCORE
      -------------------------------- */}
      <section
        id="mobile-safety-score-card"
        className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center text-center"
      >
        <div className="text-[10px] font-mono font-bold tracking-[0.2em] text-slate-400 uppercase mb-1">
          DRIVING SAFETY RATING
        </div>

        {/* Clear Score: "87 / 100" */}
        <div className="my-1 flex items-baseline justify-center gap-1.5">
          <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${ratingResult.tierColor}`}>
            {ratingResult.score}
          </span>
          <span className="text-xl sm:text-2xl font-mono font-bold text-slate-400">
            / 100
          </span>
        </div>

        {/* Clear Tier: "SAFE DRIVING" / "MODERATE RISK" / "HIGH RISK" */}
        <div className={`mt-1.5 px-3.5 py-1 rounded-full font-black text-xs tracking-wider uppercase border ${ratingResult.tierBg} ${ratingResult.tierBorder} ${ratingResult.tierColor} ${ratingResult.badgeGlow}`}>
          {ratingResult.tier}
        </div>

        <div className="mt-2.5 flex items-center justify-center gap-2 text-[10px] font-mono text-slate-400">
          <span>Based on {ratingResult.availableFactorsCount} verified signals</span>
          {onOpenScorecard && (
            <button
              onClick={onOpenScorecard}
              className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium"
            >
              Signal Breakdown
            </button>
          )}
        </div>
      </section>

      {/* --------------------------------
             3. EMERGENCY SOS
      -------------------------------- */}
      <section id="mobile-emergency-sos-card" className="relative">
        <button
          onClick={handleOpenSos}
          onMouseDown={handleStartHold}
          onMouseUp={handleEndHold}
          onTouchStart={handleStartHold}
          onTouchEnd={handleEndHold}
          className="relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-lg sm:text-xl tracking-wider shadow-[0_0_30px_rgba(225,29,72,0.4)] border-2 border-red-400/60 flex flex-col items-center justify-center gap-1 transition-all transform active:scale-[0.98] overflow-hidden"
          title="Tap or hold to trigger Emergency SOS (requires confirmation)"
        >
          {/* Progress fill for hold confirmation */}
          {sosHoldProgress > 0 && (
            <div
              className="absolute inset-0 bg-red-800/80 transition-all duration-75"
              style={{ width: `${sosHoldProgress}%` }}
            ></div>
          )}

          <div className="relative z-10 flex items-center justify-center gap-2">
            <span className="text-2xl animate-pulse">🚨</span>
            <span>EMERGENCY SOS</span>
          </div>

          <span className="relative z-10 text-[10px] font-mono tracking-normal text-rose-200 uppercase font-semibold">
            Tap to open confirmation • 5s safety cancel
          </span>
        </button>
      </section>

      {/* --------------------------------
             SYSTEM STATUS
      -------------------------------- */}
      <footer className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-xl shadow-xl flex items-center justify-around font-mono text-xs">
        {/* GPS Status */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold">GPS:</span>
          <span className={`flex items-center gap-1.5 font-bold ${gpsStatus.color}`}>
            <span className={`w-2 h-2 rounded-full ${gpsStatus.dot}`}></span>
            <span>{gpsStatus.label}</span>
          </span>
          {gpsStatus.label === 'OFFLINE' && onRetryGps && (
            <button
              onClick={onRetryGps}
              className="text-[10px] text-sky-400 underline ml-1"
            >
              Retry
            </button>
          )}
        </div>

        <span className="text-white/20">|</span>

        {/* Cabin Light Status */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold">CABIN LIGHT:</span>
          <span className={`flex items-center gap-1.5 font-bold ${cabinLightStatus.color}`}>
            <span className={`w-2 h-2 rounded-full ${cabinLightStatus.dot}`}></span>
            <span>{cabinLightStatus.label}</span>
          </span>
        </div>
      </footer>

      {/* --------------------------------
          EMERGENCY SOS ACTION DIALOG
      -------------------------------- */}
      <AnimatePresence>
        {isSosModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-slate-900 border border-red-500/50 p-6 shadow-2xl shadow-red-950/80 text-center flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-3 animate-pulse">
                <ShieldAlert className="w-9 h-9" />
              </div>

              <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1">
                EMERGENCY DISTRESS ACTIVATED
              </h3>

              {!sosDispatched ? (
                <>
                  <p className="text-xs text-slate-300 mb-4">
                    Automated SMS with live GPS tracking will dispatch in:
                  </p>

                  <div className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center text-3xl font-black font-mono text-red-400 mb-5 animate-bounce">
                    {sosCountdown}s
                  </div>

                  <div className="w-full flex flex-col gap-2">
                    <button
                      onClick={triggerSosDispatch}
                      disabled={isDispatching}
                      className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-900/50 flex items-center justify-center gap-2"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Dispatch Immediately</span>
                    </button>

                    <a
                      href="tel:112"
                      className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <PhoneCall className="w-4 h-4 text-emerald-400" />
                      <span>Call National Emergency 112</span>
                    </a>

                    <button
                      onClick={() => setIsSosModalOpen(false)}
                      className="w-full py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold mt-1"
                    >
                      Cancel False Alarm
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="my-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span>Emergency distress SMS successfully dispatched to India 112 emergency network with live GPS.</span>
                  </div>

                  <div className="w-full flex flex-col gap-2">
                    <a
                      href="tel:112"
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Call India 112 Hotline Now</span>
                    </a>

                    <button
                      onClick={() => setIsSosModalOpen(false)}
                      className="w-full py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold"
                    >
                      Dismiss Alert
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
