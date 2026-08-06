import React, { useState } from 'react';
import { Header } from './components/Header';
import { CameraHUD } from './components/CameraHUD';
import { Speedometer } from './components/Speedometer';
import { SafetyMetrics } from './components/SafetyMetrics';
import { EmergencySOS } from './components/EmergencySOS';
import { TripTracker } from './components/TripTracker';
import { AndroidExportModal } from './components/AndroidExportModal';
import { AICoachModal } from './components/AICoachModal';
import { DriverState, SpeedData } from './types';
import { soundManager } from './utils/audio';

export default function App() {
  const [driverState, setDriverState] = useState<DriverState>({
    isMonitoring: false,
    drowsinessLevel: 0,
    ear: 0.32,
    mar: 0.12,
    headTilt: 0,
    eyesClosed: false,
    isYawning: false,
    isDistracted: false,
    isUsingPhone: false,
    alertLevel: 'GREEN',
    lastAiMessage: 'Click "Start Monitor" to enable AI vision driver safety tracking.',
    yawnCount: 0,
    microSleepCount: 0,
    distractionCount: 0,
  });

  const [speedData, setSpeedData] = useState<SpeedData>({
    currentSpeedKmh: 45,
    speedLimitKmh: 60,
    isOverSpeed: false,
    latitude: 37.7749,
    longitude: -122.4194,
    locationName: 'Highway 101, Express Corridor',
  });

  const [isMuted, setIsMuted] = useState(false);
  const [isAndroidExportOpen, setIsAndroidExportOpen] = useState(false);
  const [isAICoachOpen, setIsAICoachOpen] = useState(false);

  const handleToggleMonitoring = () => {
    setDriverState(prev => {
      const nextMonitoring = !prev.isMonitoring;
      if (nextMonitoring) {
        soundManager.speakText("DriveSafe AI monitoring active.");
      } else {
        soundManager.stopAlarm();
      }
      return {
        ...prev,
        isMonitoring: nextMonitoring,
        lastAiMessage: nextMonitoring
          ? "AI Driver Vision active. Monitoring eyelids & head posture..."
          : "Driver monitoring stopped.",
      };
    });
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Bar Header */}
      <Header
        isMonitoring={driverState.isMonitoring}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenAndroidExport={() => setIsAndroidExportOpen(true)}
        onOpenAICoach={() => setIsAICoachOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        alertLevel={driverState.alertLevel}
      />

      {/* Main Responsive Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* Top Section: Camera Vision & Speedometer HUD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Driver Camera AI Monitor (Takes 2 columns on lg) */}
          <div className="lg:col-span-2">
            <CameraHUD
              driverState={driverState}
              setDriverState={setDriverState}
              isMonitoring={driverState.isMonitoring}
            />
          </div>

          {/* Speedometer & GPS HUD */}
          <div className="lg:col-span-1">
            <Speedometer
              speedData={speedData}
              setSpeedData={setSpeedData}
            />
          </div>
        </div>

        {/* Middle Section: Fatigue Metrics, Emergency SOS, Trip Log */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SafetyMetrics
            driverState={driverState}
            isMonitoring={driverState.isMonitoring}
          />
          <EmergencySOS
            speedData={speedData}
          />
          <TripTracker
            speedData={speedData}
            driverState={driverState}
            isMonitoring={driverState.isMonitoring}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DriveSafe AI • Real-Time Driver Safety & Drowsiness Alert System</span>
          <button
            onClick={() => setIsAndroidExportOpen(true)}
            className="text-emerald-400 hover:underline font-semibold"
          >
            📱 Export to Android APK (Android Studio Setup)
          </button>
        </div>
      </footer>

      {/* Android Studio APK Export Modal */}
      <AndroidExportModal
        isOpen={isAndroidExportOpen}
        onClose={() => setIsAndroidExportOpen(false)}
      />

      {/* Gemini AI Coach Chat Modal */}
      <AICoachModal
        isOpen={isAICoachOpen}
        onClose={() => setIsAICoachOpen(false)}
      />
    </div>
  );
}
