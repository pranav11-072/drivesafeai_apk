import React, { useRef, useEffect, useState } from 'react';
import { Camera, Eye, AlertOctagon, Scan, RefreshCw, Smartphone, Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { DriverState } from '../types';
import { soundManager } from '../utils/audio';

interface CameraHUDProps {
  driverState: DriverState;
  setDriverState: React.Dispatch<React.SetStateAction<DriverState>>;
  isMonitoring: boolean;
}

export const CameraHUD: React.FC<CameraHUDProps> = ({
  driverState,
  setDriverState,
  isMonitoring,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Initialize webcam
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (isMonitoring) {
      navigator.mediaDevices?.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      })
      .then((stream) => {
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraPermission(true);
        setStreamError(null);
      })
      .catch((err) => {
        console.warn("Camera access error:", err);
        setCameraPermission(false);
        setStreamError("Webcam not available or permission denied. Simulator mode enabled.");
      });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isMonitoring]);

  // Automated monitoring loop simulating EAR & facial alertness frame check
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      setDriverState(prev => {
        // Subtle random noise for natural EAR fluctuations unless in forced state
        let ear = prev.ear;
        if (!prev.eyesClosed) {
          ear = Math.min(0.38, Math.max(0.24, ear + (Math.random() * 0.04 - 0.02)));
        } else {
          ear = 0.12; // Eyes closed threshold < 0.20
        }

        let alertLevel = prev.alertLevel;
        let dLevel = prev.drowsinessLevel;

        if (ear < 0.20 || prev.eyesClosed) {
          dLevel = Math.min(100, dLevel + 15);
        } else {
          dLevel = Math.max(0, dLevel - 5);
        }

        if (dLevel >= 60 || prev.eyesClosed) {
          alertLevel = 'RED';
          soundManager.playCriticalAlarm();
        } else if (dLevel >= 30 || prev.isYawning || prev.isDistracted) {
          alertLevel = 'YELLOW';
          soundManager.playWarningBeep();
        } else {
          alertLevel = 'GREEN';
        }

        return {
          ...prev,
          ear,
          drowsinessLevel: dLevel,
          alertLevel,
        };
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isMonitoring, setDriverState]);

  // Trigger Gemini Vision Driver Frame Analysis
  const handleAnalyzeFrame = async () => {
    setIsAiAnalyzing(true);
    try {
      let imageBase64 = '';

      if (videoRef.current && cameraPermission) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        }
      }

      // If no live camera snapshot, create a simulated dark HUD snapshot canvas
      if (!imageBase64) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#38bdf8';
          ctx.font = '16px sans-serif';
          ctx.fillText('Driver Frame Analysis', 80, 120);
          imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        }
      }

      const res = await fetch('/api/ai/analyze-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      const data = await res.json();
      if (res.ok) {
        setDriverState(prev => ({
          ...prev,
          drowsinessLevel: data.fatigueScore ?? prev.drowsinessLevel,
          eyesClosed: data.eyesClosed ?? prev.eyesClosed,
          isYawning: data.yawning ?? prev.isYawning,
          isDistracted: data.distracted ?? prev.isDistracted,
          isUsingPhone: data.usingPhone ?? prev.isUsingPhone,
          alertLevel: data.alertLevel || prev.alertLevel,
          lastAiMessage: data.message || "Driver appears alert.",
        }));

        if (data.alertLevel === 'RED' || data.fatigueScore > 60) {
          soundManager.playCriticalAlarm();
          soundManager.speakText("Warning! High drowsiness detected. Please pull over safely!");
        } else if (data.alertLevel === 'YELLOW') {
          soundManager.playWarningBeep();
        }
      }
    } catch (err) {
      console.warn("AI Frame analysis error:", err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Manual Trigger Simulators for Instant Testing
  const triggerEyesClosed = () => {
    setDriverState(prev => ({
      ...prev,
      eyesClosed: true,
      ear: 0.12,
      drowsinessLevel: 85,
      alertLevel: 'RED',
      microSleepCount: prev.microSleepCount + 1,
      lastAiMessage: "DROWSINESS DETECTED: Eyes closed for > 2 seconds!"
    }));
    soundManager.playCriticalAlarm();
    soundManager.speakText("Drowsiness alert! Wake up!");
  };

  const triggerYawn = () => {
    setDriverState(prev => ({
      ...prev,
      isYawning: true,
      mar: 0.65,
      drowsinessLevel: Math.min(100, prev.drowsinessLevel + 25),
      alertLevel: prev.drowsinessLevel > 50 ? 'RED' : 'YELLOW',
      yawnCount: prev.yawnCount + 1,
      lastAiMessage: "FATIGUE WARNING: Frequent yawning detected."
    }));
    soundManager.playWarningBeep();
  };

  const triggerDistraction = () => {
    setDriverState(prev => ({
      ...prev,
      isDistracted: true,
      headTilt: 45,
      alertLevel: 'YELLOW',
      distractionCount: prev.distractionCount + 1,
      lastAiMessage: "DISTRACTION ALERT: Keep eyes focused on the road!"
    }));
    soundManager.playWarningBeep();
  };

  const resetSimulation = () => {
    soundManager.stopAlarm();
    setDriverState(prev => ({
      ...prev,
      eyesClosed: false,
      isYawning: false,
      isDistracted: false,
      isUsingPhone: false,
      ear: 0.32,
      mar: 0.15,
      headTilt: 0,
      drowsinessLevel: 10,
      alertLevel: 'GREEN',
      lastAiMessage: "Driver alert and focused on the road.",
    }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full">
      {/* Video / Camera Canvas Container */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
        {isMonitoring ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* AI Bounding Box Overlay Simulation */}
            <div className={`absolute inset-4 border-2 rounded-xl pointer-events-none transition-all ${
              driverState.alertLevel === 'RED' ? 'border-red-500 bg-red-500/10 animate-pulse' :
              driverState.alertLevel === 'YELLOW' ? 'border-amber-400 bg-amber-400/5' :
              'border-emerald-400/60'
            }`}>
              {/* Bounding Box Corner Reticles */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-current"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-current"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-current"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-current"></div>

              {/* Status Banner inside Video */}
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/50 text-xs">
                <span className={`w-2 h-2 rounded-full ${
                  driverState.alertLevel === 'RED' ? 'bg-red-500 animate-ping' :
                  driverState.alertLevel === 'YELLOW' ? 'bg-amber-400' : 'bg-emerald-400'
                }`}></span>
                <span className="font-mono text-slate-200">EAR: {driverState.ear.toFixed(2)}</span>
              </div>
            </div>

            {/* Critical Alert Flasher */}
            {driverState.alertLevel === 'RED' && (
              <div className="absolute inset-0 bg-red-600/30 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4 animate-pulse">
                <AlertOctagon className="w-14 h-14 text-white mb-2 animate-bounce" />
                <h3 className="text-xl font-black text-white tracking-wider uppercase">DROWSINESS DETECTED!</h3>
                <p className="text-xs text-red-100 font-semibold mt-1">PULL OVER IMMEDIATELY TO A SAFE SPOT</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-6 text-slate-500 flex flex-col items-center">
            <Camera className="w-12 h-12 text-slate-700 mb-2" />
            <p className="text-sm font-medium text-slate-400">Driver Camera Standby</p>
            <p className="text-xs text-slate-600 mt-1 max-w-xs">
              Click &quot;Start Monitor&quot; above to enable live AI vision & drowsiness detection.
            </p>
          </div>
        )}
      </div>

      {/* AI Message & Status Bar */}
      <div className="mt-3 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-400 flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI Driver Observation
          </span>
          <span className={`font-semibold ${
            driverState.alertLevel === 'RED' ? 'text-red-400' :
            driverState.alertLevel === 'YELLOW' ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            Fatigue: {driverState.drowsinessLevel}%
          </span>
        </div>
        <p className="text-xs font-mono text-slate-200 truncate">
          {driverState.lastAiMessage || "Monitoring facial posture and eye blink rates..."}
        </p>
      </div>

      {/* Control Buttons & Test Simulators */}
      <div className="mt-3 space-y-2">
        {/* Analyze Frame with Gemini AI */}
        <button
          onClick={handleAnalyzeFrame}
          disabled={isAiAnalyzing}
          id="btn-analyze-driver-frame"
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white py-2 px-3 rounded-xl text-xs font-semibold shadow-md shadow-indigo-950/50 transition-all border border-indigo-400/30"
        >
          {isAiAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
              <span>Analyzing Frame with Gemini AI...</span>
            </>
          ) : (
            <>
              <Scan className="w-4 h-4 text-indigo-300" />
              <span>Analyze Frame with Gemini Vision AI</span>
            </>
          )}
        </button>

        {/* Quick Simulation Test Buttons */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <button
            onClick={triggerEyesClosed}
            id="btn-sim-eyes-closed"
            title="Simulate Eyes Closed"
            className="bg-slate-800 hover:bg-red-950/60 hover:border-red-500/50 border border-slate-700/80 text-slate-300 hover:text-red-300 p-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5 text-red-400" />
            <span>Eyes Closed</span>
          </button>

          <button
            onClick={triggerYawn}
            id="btn-sim-yawn"
            title="Simulate Yawning"
            className="bg-slate-800 hover:bg-amber-950/60 hover:border-amber-500/50 border border-slate-700/80 text-slate-300 hover:text-amber-300 p-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Yawn</span>
          </button>

          <button
            onClick={triggerDistraction}
            id="btn-sim-distract"
            title="Simulate Distraction"
            className="bg-slate-800 hover:bg-indigo-950/60 hover:border-indigo-500/50 border border-slate-700/80 text-slate-300 hover:text-indigo-300 p-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Distracted</span>
          </button>

          <button
            onClick={resetSimulation}
            id="btn-sim-reset"
            title="Reset Alertness"
            className="bg-slate-800 hover:bg-emerald-950/60 hover:border-emerald-500/50 border border-slate-700/80 text-slate-300 hover:text-emerald-300 p-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
