import React, { useRef, useEffect, useState } from 'react';
import { Camera, Eye, AlertOctagon, Scan, RefreshCw, Smartphone, Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full">
      {/* Video / Camera Canvas Container */}
      <div className="relative w-full aspect-video bg-slate-950/80 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
        {isMonitoring ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* AI Bounding Box Overlay Simulation with Framer Motion */}
            <motion.div
              key={driverState.alertLevel}
              animate={
                driverState.alertLevel === 'RED'
                  ? {
                      scale: [1, 1.02, 1],
                      borderColor: ['rgba(239, 68, 68, 1)', 'rgba(248, 113, 113, 1)', 'rgba(239, 68, 68, 1)'],
                      boxShadow: [
                        '0 0 0px rgba(239, 68, 68, 0)',
                        '0 0 30px rgba(239, 68, 68, 0.8)',
                        '0 0 0px rgba(239, 68, 68, 0)'
                      ],
                      backgroundColor: ['rgba(239, 68, 68, 0.05)', 'rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.05)']
                    }
                  : driverState.alertLevel === 'YELLOW'
                  ? {
                      scale: [1, 1.01, 1],
                      borderColor: ['rgba(251, 191, 36, 1)', 'rgba(254, 240, 138, 1)', 'rgba(251, 191, 36, 1)'],
                      boxShadow: [
                        '0 0 0px rgba(251, 191, 36, 0)',
                        '0 0 18px rgba(251, 191, 36, 0.6)',
                        '0 0 0px rgba(251, 191, 36, 0)'
                      ],
                      backgroundColor: 'rgba(251, 191, 36, 0.05)'
                    }
                  : {
                      scale: 1,
                      borderColor: 'rgba(96, 165, 250, 0.6)',
                      boxShadow: '0 0 0px rgba(0,0,0,0)',
                      backgroundColor: 'rgba(0,0,0,0)'
                    }
              }
              transition={
                driverState.alertLevel === 'RED'
                  ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
                  : driverState.alertLevel === 'YELLOW'
                  ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.3 }
              }
              className={`absolute inset-4 border-2 rounded-xl pointer-events-none ${
                driverState.alertLevel === 'RED' ? 'text-red-500' :
                driverState.alertLevel === 'YELLOW' ? 'text-amber-400' :
                'text-blue-400'
              }`}
            >
              {/* Bounding Box Corner Reticles with pulse */}
              <motion.div
                animate={driverState.alertLevel === 'RED' ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4, repeat: Infinity }}
                className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-current"
              ></motion.div>
              <motion.div
                animate={driverState.alertLevel === 'RED' ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4, repeat: Infinity }}
                className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-current"
              ></motion.div>
              <motion.div
                animate={driverState.alertLevel === 'RED' ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4, repeat: Infinity }}
                className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-current"
              ></motion.div>
              <motion.div
                animate={driverState.alertLevel === 'RED' ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4, repeat: Infinity }}
                className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-current"
              ></motion.div>

              {/* Status Banner inside Video */}
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-2 left-2 flex items-center gap-2 backdrop-blur-md bg-black/60 px-3 py-1 rounded-xl border border-white/20 text-xs shadow-lg"
              >
                <span className={`w-2 h-2 rounded-full ${
                  driverState.alertLevel === 'RED' ? 'bg-red-500 animate-ping' :
                  driverState.alertLevel === 'YELLOW' ? 'bg-amber-400' : 'bg-emerald-400'
                }`}></span>
                <span className="font-mono text-slate-100">EAR: {driverState.ear.toFixed(2)}</span>
              </motion.div>
            </motion.div>

            {/* Critical Alert Flasher with Framer Motion */}
            <AnimatePresence>
              {driverState.alertLevel === 'RED' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{
                    opacity: [0.85, 1, 0.85],
                    scale: [1, 1.02, 1],
                    backgroundColor: ['rgba(220,38,38,0.4)', 'rgba(239,68,68,0.7)', 'rgba(220,38,38,0.4)']
                  }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    duration: 0.45,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut'
                  }}
                  className="absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-20"
                >
                  <motion.div
                    animate={{ rotate: [-6, 6, -6], scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.35, repeat: Infinity, repeatType: 'reverse' }}
                  >
                    <AlertOctagon className="w-16 h-16 text-white mb-2 drop-shadow-[0_0_20px_rgba(255,255,255,1)]" />
                  </motion.div>
                  <motion.h3
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 0.45, repeat: Infinity }}
                    className="text-2xl font-black text-white tracking-wider uppercase drop-shadow-lg"
                  >
                    DROWSINESS DETECTED!
                  </motion.h3>
                  <p className="text-xs text-red-100 font-bold mt-1 tracking-wide bg-red-950/80 px-3 py-1 rounded-full border border-red-400/50 shadow-md">
                    PULL OVER IMMEDIATELY TO A SAFE SPOT
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="text-center p-6 text-slate-400 flex flex-col items-center">
            <Camera className="w-12 h-12 text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-300">Driver Camera Standby</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Click &quot;Start Monitor&quot; above to enable live AI vision & drowsiness detection.
            </p>
          </div>
        )}
      </div>

      {/* AI Message & Status Bar */}
      <div className="mt-3 backdrop-blur-md bg-white/5 rounded-xl p-3 border border-white/10">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-300 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> AI Driver Observation
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
          className="w-full flex items-center justify-center gap-2 backdrop-blur-md bg-blue-600/90 hover:bg-blue-500 disabled:bg-blue-900/50 text-white py-2 px-3 rounded-xl text-xs font-semibold shadow-lg shadow-blue-950/50 transition-all border border-blue-400/30"
        >
          {isAiAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
              <span>Analyzing Frame with Gemini AI...</span>
            </>
          ) : (
            <>
              <Scan className="w-4 h-4 text-blue-200" />
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
            className="backdrop-blur-md bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-slate-200 hover:text-red-300 p-2 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5 text-red-400" />
            <span>Eyes Closed</span>
          </button>

          <button
            onClick={triggerYawn}
            id="btn-sim-yawn"
            title="Simulate Yawning"
            className="backdrop-blur-md bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-slate-200 hover:text-amber-300 p-2 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Yawn</span>
          </button>

          <button
            onClick={triggerDistraction}
            id="btn-sim-distract"
            title="Simulate Distraction"
            className="backdrop-blur-md bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/40 text-slate-200 hover:text-blue-300 p-2 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-blue-400" />
            <span>Distracted</span>
          </button>

          <button
            onClick={resetSimulation}
            id="btn-sim-reset"
            title="Reset Alertness"
            className="backdrop-blur-md bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-slate-200 hover:text-emerald-300 p-2 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
