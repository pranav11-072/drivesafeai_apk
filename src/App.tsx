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
import { MobileLiveSpeedCard } from './components/MobileLiveSpeedCard';
import { MobileDashboard } from './components/MobileDashboard';
import { DriverState, SpeedData } from './types';
import { soundManager } from './utils/audio';
import { useGpsTracker } from './hooks/useGpsTracker';
import { useCabinLighting } from './hooks/useCabinLighting';

export default function App() {
  const gps = useGpsTracker();

  // Responsive View Mode: Defaults to mobile on phone screens (< 768px), can be toggled manually
  const [viewMode, setViewMode] = useState<'auto' | 'mobile' | 'desktop'>('auto');
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeView = viewMode === 'auto' ? (isMobileScreen ? 'mobile' : 'desktop') : viewMode;

  const [driverState, setDriverState] = useState<DriverState>({
    isMonitoring: false,
    driverPresent: true,
    drowsinessLevel: 0,
    safetyScore: 100,
    ear: 0.32,
    mar: 0.12,
    headTilt: 0,
    eyesClosed: false,
    isYawning: false,
    isDistracted: false,
    isUsingPhone: false,
    abnormalBehavior: false,
    alertLevel: 'GREEN',
    lastAiMessage: 'Click "Start Monitor" or say "Start DriveSafe" to enable AI vision driver safety tracking.',
    yawnCount: 0,
    microSleepCount: 0,
    distractionCount: 0,
  });

  const [speedData, setSpeedData] = useState<SpeedData>({
    currentSpeedKmh: null,
    currentSpeed: null,
    isSpeedAvailable: false,
    speedLimitKmh: 60,
    isOverSpeed: false,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    heading: null,
    locationName: 'Acquiring GPS fix...',
    gpsStatus: 'loading',
    gpsErrorMessage: null,
    speedSource: 'none',
  });

  // Synchronize speedData with live GPS tracker
  React.useEffect(() => {
    setSpeedData(prev => {
      const isOver = gps.currentSpeedKmh !== null && gps.currentSpeedKmh > prev.speedLimitKmh;
      return {
        ...prev,
        currentSpeedKmh: gps.currentSpeedKmh,
        currentSpeed: gps.currentSpeedKmh,
        isSpeedAvailable: gps.isSpeedAvailable,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyMeters: gps.accuracyMeters,
        heading: gps.heading,
        locationName: gps.locationName,
        gpsStatus: gps.gpsStatus,
        gpsErrorMessage: gps.gpsErrorMessage,
        speedSource: gps.speedSource,
        lastGpsUpdate: gps.lastGpsUpdate ?? undefined,
        isOverSpeed: isOver,
      };
    });
  }, [
    gps.currentSpeedKmh,
    gps.isSpeedAvailable,
    gps.latitude,
    gps.longitude,
    gps.accuracyMeters,
    gps.heading,
    gps.locationName,
    gps.gpsStatus,
    gps.gpsErrorMessage,
    gps.speedSource,
    gps.lastGpsUpdate,
  ]);

  const [isMuted, setIsMuted] = useState(false);
  const [isAndroidExportOpen, setIsAndroidExportOpen] = useState(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  // Cabin Lighting State & Vehicle Hardware Architecture
  const cabinLight = useCabinLighting(driverState);

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

      {/* View Switch: Focused Mobile UI vs Full Desktop Telematics */}
      {activeView === 'mobile' ? (
        <div className="relative z-10 flex-1 flex flex-col justify-between py-2">
          <MobileDashboard
            driverState={driverState}
            setDriverState={setDriverState}
            speedData={speedData}
            cabinLightConfig={cabinLight.config}
            isMonitoring={driverState.isMonitoring}
            onToggleMonitoring={handleToggleMonitoring}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onSwitchToDesktopView={() => setViewMode('desktop')}
            onOpenScorecard={() => setIsScorecardOpen(true)}
            onRetryGps={gps.retryGps}
          />

          {/* Minimal Mobile Utility Navigation */}
          <div className="text-center py-2 text-[11px] text-slate-500 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsScorecardOpen(true)}
              className="text-amber-400 hover:underline font-medium"
            >
              🏆 Scorecard
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setIsAndroidExportOpen(true)}
              className="text-emerald-400 hover:underline font-medium"
            >
              📱 Export APK
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setViewMode('desktop')}
              className="text-sky-400 hover:underline font-medium"
            >
              💻 Desktop Mode
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Bar Header */}
          <div className="relative z-10">
            <Header
              isMonitoring={driverState.isMonitoring}
              onToggleMonitoring={() => handleToggleMonitoring()}
              onOpenScorecard={() => setIsScorecardOpen(true)}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              alertLevel={driverState.alertLevel}
              cabinLightStatus={cabinLight.config.hardwareStatus}
              viewMode={activeView}
              onToggleViewMode={(mode) => setViewMode(mode)}
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
            />

            {/* Mobile Experience: Prominently Display Live Vehicle Speed */}
            <MobileLiveSpeedCard
              speedData={speedData}
              setSpeedData={setSpeedData}
              onRetryGps={gps.retryGps}
              isManualOverride={gps.isManualOverride}
              onToggleManualOverride={gps.setIsManualOverride}
              manualSpeedKmh={gps.manualSpeedKmh}
              onSetManualSpeed={gps.setManualSpeedKmh}
              cabinLightConfig={cabinLight.config}
              onToggleCabinPower={cabinLight.togglePower}
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

              {/* Speedometer & GPS HUD (Desktop & Tablet) */}
              <div className="hidden md:flex lg:col-span-1">
                <Speedometer
                  speedData={speedData}
                  setSpeedData={setSpeedData}
                  isMonitoring={driverState.isMonitoring}
                  onRetryGps={gps.retryGps}
                  isManualOverride={gps.isManualOverride}
                  onToggleManualOverride={gps.setIsManualOverride}
                  manualSpeedKmh={gps.manualSpeedKmh}
                  onSetManualSpeed={gps.setManualSpeedKmh}
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
                onRetryGps={gps.retryGps}
              />
            </div>

            {/* New Feature Section: Smart Rest Stop & Route Navigator + Ambient Cabin Light */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <RestStopNavigator
                  driverState={driverState}
                  speedData={speedData}
                />
              </div>
              <div className="lg:col-span-1">
                <AmbientCabinLight
                  driverState={driverState}
                  config={cabinLight.config}
                  setConfig={cabinLight.setConfig}
                  isTestFlashing={cabinLight.isTestFlashing}
                  hardwareMessage={cabinLight.hardwareMessage}
                  onConnectBluetooth={cabinLight.connectBluetooth}
                  onConnectSerial={cabinLight.connectSerial}
                  onDisconnectHardware={cabinLight.disconnectHardware}
                  onSetHardwareState={cabinLight.setHardwareState}
                  onTogglePower={cabinLight.togglePower}
                  onTriggerTestFlash={cabinLight.triggerTestFlash}
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
        </>
      )}

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
    </div>
  );
}

