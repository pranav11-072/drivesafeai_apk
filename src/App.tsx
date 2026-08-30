import React, { useState } from 'react';
import { Header } from './components/Header';
import { VoiceCommandControl } from './components/VoiceCommandControl';
import { CameraHUD } from './components/CameraHUD';
import { Speedometer } from './components/Speedometer';
import { SafetyMetrics } from './components/SafetyMetrics';
import { EmergencySOS } from './components/EmergencySOS';
import { TripTracker } from './components/TripTracker';
import { RestStopNavigator } from './components/RestStopNavigator';
import { AmbientCabinLight } from './components/AmbientCabinLight';
import { CircadianPredictor } from './components/CircadianPredictor';
import { IncidentRecorder } from './components/IncidentRecorder';
import { TripScorecard } from './components/TripScorecard';
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
    lastAiMessage: 'Click "Start Monitor" or say "Start DriveSafe" to enable AI vision driver safety tracking.',
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
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  const handleToggleMonitoring = (forceState?: boolean) => {
    soundManager.unlockAudioContext();
    setDriverState(prev => {
      const nextMonitoring = forceState !== undefined ? forceState : !prev.isMonitoring;
      if (nextMonitoring === prev.isMonitoring) return prev;
      if (nextMonitoring) {
        soundManager.playSystemChime();
        soundManager.speakText("DriveSafe AI monitoring active.", true);
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
    soundManager.unlockAudioContext();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white relative overflow-x-hidden">
      {/* Frosted Glass Background Ambient Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[130px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[130px] rounded-full"></div>
        <div className="absolute top-[40%] left-[30%] w-[35%] h-[35%] bg-sky-500/10 blur-[110px] rounded-full"></div>
      </div>

      {/* Top Bar Header */}
      <div className="relative z-10">
        <Header
          isMonitoring={driverState.isMonitoring}
          onToggleMonitoring={() => handleToggleMonitoring()}
          onOpenAICoach={() => setIsAICoachOpen(true)}
          onOpenScorecard={() => setIsScorecardOpen(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          alertLevel={driverState.alertLevel}
        />
      </div>

      {/* Main Responsive Dashboard Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-5">
        {/* Voice Command Control HUD Bar */}
        <VoiceCommandControl
          isMonitoring={driverState.isMonitoring}
          onToggleMonitoring={handleToggleMonitoring}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          onOpenAICoach={() => setIsAICoachOpen(true)}
        />

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
              isMonitoring={driverState.isMonitoring}
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
            driverState={driverState}
          />
          <TripTracker
            speedData={speedData}
            driverState={driverState}
            isMonitoring={driverState.isMonitoring}
          />
        </div>

        {/* New Feature Section: Smart Rest Stop & Route Navigator + Ambient Cabin Light */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RestStopNavigator
              driverState={driverState}
              speedData={speedData}
              onOpenAICoach={() => setIsAICoachOpen(true)}
            />
          </div>
          <div className="lg:col-span-1">
            <AmbientCabinLight
              driverState={driverState}
            />
          </div>
        </div>

        {/* New Feature Section: Circadian Predictor + Incident Dashcam Recorder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CircadianPredictor
            driverState={driverState}
          />
          <IncidentRecorder
            driverState={driverState}
            speedData={speedData}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DriveSafe AI • Real-Time Driver Safety & Drowsiness Alert System</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsScorecardOpen(true)}
              className="text-amber-400 hover:underline font-semibold"
            >
              🏆 View Trip Scorecard
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setIsAndroidExportOpen(true)}
              className="text-emerald-400 hover:underline font-semibold"
            >
              📱 Export to Android APK
            </button>
          </div>
        </div>
      </footer>

      {/* Trip Scorecard & Risk Summary Modal */}
      <TripScorecard
        isOpen={isScorecardOpen}
        onClose={() => setIsScorecardOpen(false)}
        driverState={driverState}
        speedData={speedData}
      />

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

