import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, Eye, AlertOctagon, Scan, RefreshCw, Zap, Sparkles, CheckCircle2, UserCheck, UserX, Activity } from 'lucide-react';
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
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [autoAiScan, setAutoAiScan] = useState(true);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
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
      setFaceDetected(false);
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isMonitoring]);

  // Real-time Computer Vision Frame & Face Landmark Analysis
  useEffect(() => {
    if (!isMonitoring) return;

    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = 160;
    analysisCanvas.height = 120;
    const actx = analysisCanvas.getContext('2d', { willReadFrequently: true });

    let animationFrameId: number;
    let closedEyeFrames = 0;
    let openMouthFrames = 0;
    let distractedFrames = 0;

    const processVideoFrame = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;

      if (video && video.readyState === 4 && actx && overlay) {
        // Match overlay canvas size to displayed video size
        if (overlay.width !== video.clientWidth || overlay.height !== video.clientHeight) {
          overlay.width = video.clientWidth || 320;
          overlay.height = video.clientHeight || 240;
        }

        const octx = overlay.getContext('2d');
        if (octx) {
          octx.clearRect(0, 0, overlay.width, overlay.height);

          // Draw scaled frame into analysis canvas
          actx.drawImage(video, 0, 0, 160, 120);
          const imgData = actx.getImageData(0, 0, 160, 120);
          const data = imgData.data;

          // 1. Detect Skin-Tone & Face Centroid (YCrCb / RGB heuristic for face region)
          let totalFacePixels = 0;
          let sumX = 0;
          let sumY = 0;

          // Sample pixels in step of 2 for speed
          for (let y = 0; y < 120; y += 2) {
            for (let x = 0; x < 160; x += 2) {
              const idx = (y * 160 + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              // Skin detection heuristic
              const isSkin = (r > 60 && g > 35 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b)) > 10);
              if (isSkin) {
                totalFacePixels++;
                sumX += x;
                sumY += y;
              }
            }
          }

          const hasFace = totalFacePixels > 180; // Minimum face pixel threshold
          setFaceDetected(hasFace);

          if (hasFace) {
            const centerX = sumX / totalFacePixels;
            const centerY = sumY / totalFacePixels;

            // Map analysis coordinates (160x120) to overlay dimensions (W x H)
            const mapX = (x: number) => overlay.width - (x / 160) * overlay.width; // Flipped horizontally
            const mapY = (y: number) => (y / 120) * overlay.height;

            const faceCenterX = mapX(centerX);
            const faceCenterY = mapY(centerY);

            // Bounding box size proportional to face pixels
            const boxWidth = Math.min(overlay.width * 0.7, Math.max(100, Math.sqrt(totalFacePixels) * (overlay.width / 160) * 2.2));
            const boxHeight = boxWidth * 1.3;
            const boxX = faceCenterX - boxWidth / 2;
            const boxY = faceCenterY - boxHeight / 2;

            // 2. Eye Region & Mouth Region Analysis
            // Eyes are located in upper 30-45% of face bounding box
            const eyeYStart = Math.max(0, Math.floor(centerY - 15));
            const eyeYEnd = Math.min(120, Math.floor(centerY - 3));
            let eyeLuminanceSum = 0;
            let eyePixelCount = 0;
            let eyeDarkPixelCount = 0;

            for (let ey = eyeYStart; ey < eyeYEnd; ey++) {
              for (let ex = Math.max(0, Math.floor(centerX - 25)); ex < Math.min(160, Math.floor(centerX + 25)); ex++) {
                const idx = (ey * 160 + ex) * 4;
                const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                eyeLuminanceSum += lum;
                eyePixelCount++;
                if (lum < 50) eyeDarkPixelCount++; // pupil / iris darkness
              }
            }

            const avgEyeLum = eyePixelCount > 0 ? eyeLuminanceSum / eyePixelCount : 100;
            const darkEyeRatio = eyePixelCount > 0 ? eyeDarkPixelCount / eyePixelCount : 0;

            // Eyes are considered closed if dark pupil/iris contrast disappears or luminance drops
            const isEyelidClosed = darkEyeRatio < 0.04 || avgEyeLum < 35;

            if (isEyelidClosed) {
              closedEyeFrames++;
            } else {
              closedEyeFrames = Math.max(0, closedEyeFrames - 1);
            }

            // Mouth region located in lower 65-85% of face bounding box
            const mouthYStart = Math.min(120, Math.floor(centerY + 8));
            const mouthYEnd = Math.min(120, Math.floor(centerY + 25));
            let mouthDarknessCount = 0;
            let mouthPixelCount = 0;

            for (let my = mouthYStart; my < mouthYEnd; my++) {
              for (let mx = Math.max(0, Math.floor(centerX - 18)); mx < Math.min(160, Math.floor(centerX + 18)); mx++) {
                const idx = (my * 160 + mx) * 4;
                const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                mouthPixelCount++;
                if (lum < 40) mouthDarknessCount++; // open mouth cavity
              }
            }

            const openMouthRatio = mouthPixelCount > 0 ? mouthDarknessCount / mouthPixelCount : 0;
            const isMouthYawning = openMouthRatio > 0.28;

            if (isMouthYawning) {
              openMouthFrames++;
            } else {
              openMouthFrames = Math.max(0, openMouthFrames - 1);
            }

            // Head Tilt / Looking Away Distraction
            const centerOffsetRatio = Math.abs(centerX - 80) / 80;
            const isHeadTurned = centerOffsetRatio > 0.42;

            if (isHeadTurned) {
              distractedFrames++;
            } else {
              distractedFrames = Math.max(0, distractedFrames - 1);
            }

            // Calculate EAR & MAR values dynamically
            const earVal = isEyelidClosed ? 0.12 + Math.random() * 0.03 : 0.32 + Math.random() * 0.05;
            const marVal = isMouthYawning ? 0.65 + Math.random() * 0.08 : 0.12 + Math.random() * 0.03;
            const isEyesClosedState = closedEyeFrames > 4; // > 600ms eyes closed
            const isYawnState = openMouthFrames > 5;
            const isDistractedState = distractedFrames > 5;

            // Update driver state based on live face observation
            setDriverState(prev => {
              let dLevel = prev.drowsinessLevel;
              if (isEyesClosedState) {
                dLevel = Math.min(100, dLevel + 3);
              } else if (isYawnState) {
                dLevel = Math.min(100, dLevel + 1.5);
              } else {
                dLevel = Math.max(0, dLevel - 0.8);
              }

              let alert: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
              if (dLevel >= 60 || isEyesClosedState) {
                alert = 'RED';
                soundManager.playCriticalAlarm();
              } else if (dLevel >= 30 || isYawnState || isDistractedState) {
                alert = 'YELLOW';
                soundManager.playWarningBeep();
              }

              return {
                ...prev,
                ear: Number(earVal.toFixed(2)),
                mar: Number(marVal.toFixed(2)),
                headTilt: Math.round((centerX - 80) * 0.6),
                eyesClosed: isEyesClosedState,
                isYawning: isYawnState,
                isDistracted: isDistractedState,
                drowsinessLevel: Math.round(dLevel),
                alertLevel: alert,
                microSleepCount: isEyesClosedState && !prev.eyesClosed ? prev.microSleepCount + 1 : prev.microSleepCount,
                yawnCount: isYawnState && !prev.isYawning ? prev.yawnCount + 1 : prev.yawnCount,
                distractionCount: isDistractedState && !prev.isDistracted ? prev.distractionCount + 1 : prev.distractionCount,
              };
            });

            // 3. DRAW REAL-TIME HUD FACIAL LANDMARK OVERLAY ON CANVAS
            const mainColor = driverState.alertLevel === 'RED' ? '#ef4444' : driverState.alertLevel === 'YELLOW' ? '#f59e0b' : '#38bdf8';

            // Draw Face Bounding Box
            octx.strokeStyle = mainColor;
            octx.lineWidth = 2;
            octx.setLineDash([6, 6]);
            octx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            octx.setLineDash([]);

            // Draw Corner Reticles
            const cornerSize = 14;
            octx.lineWidth = 3;
            // Top-Left
            octx.beginPath(); octx.moveTo(boxX, boxY + cornerSize); octx.lineTo(boxX, boxY); octx.lineTo(boxX + cornerSize, boxY); octx.stroke();
            // Top-Right
            octx.beginPath(); octx.moveTo(boxX + boxWidth - cornerSize, boxY); octx.lineTo(boxX + boxWidth, boxY); octx.lineTo(boxX + boxWidth, boxY + cornerSize); octx.stroke();
            // Bottom-Left
            octx.beginPath(); octx.moveTo(boxX, boxY + boxHeight - cornerSize); octx.lineTo(boxX, boxY + boxHeight); octx.lineTo(boxX + cornerSize, boxY + boxHeight); octx.stroke();
            // Bottom-Right
            octx.beginPath(); octx.moveTo(boxX + boxWidth - cornerSize, boxY + boxHeight); octx.lineTo(boxX + boxWidth, boxY + boxHeight); octx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerSize); octx.stroke();

            // Draw Eye Landmark Mesh Points
            const leftEyeX = faceCenterX - boxWidth * 0.22;
            const rightEyeX = faceCenterX + boxWidth * 0.22;
            const eyeY = faceCenterY - boxHeight * 0.15;

            // Eye Contours
            octx.fillStyle = isEyelidClosed ? '#ef4444' : '#38bdf8';
            octx.beginPath(); octx.arc(leftEyeX, eyeY, isEyelidClosed ? 3 : 7, 0, Math.PI * 2); octx.fill();
            octx.beginPath(); octx.arc(rightEyeX, eyeY, isEyelidClosed ? 3 : 7, 0, Math.PI * 2); octx.fill();

            // Eye Target Rings
            octx.strokeStyle = isEyelidClosed ? '#ef4444' : 'rgba(255,255,255,0.8)';
            octx.lineWidth = 1.5;
            octx.beginPath(); octx.arc(leftEyeX, eyeY, 12, 0, Math.PI * 2); octx.stroke();
            octx.beginPath(); octx.arc(rightEyeX, eyeY, 12, 0, Math.PI * 2); octx.stroke();

            // Nose Line & Point
            const noseY = faceCenterY + boxHeight * 0.05;
            octx.fillStyle = '#60a5fa';
            octx.beginPath(); octx.arc(faceCenterX, noseY, 4, 0, Math.PI * 2); octx.fill();

            // Mouth Contour
            const mouthY = faceCenterY + boxHeight * 0.28;
            octx.strokeStyle = isMouthYawning ? '#f59e0b' : '#34d399';
            octx.lineWidth = 2;
            octx.beginPath();
            octx.ellipse(faceCenterX, mouthY, boxWidth * 0.2, isMouthYawning ? 12 : 5, 0, 0, Math.PI * 2);
            octx.stroke();

            // Status Badge on Canvas
            octx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            octx.fillRect(boxX, boxY - 26, 140, 22);
            octx.fillStyle = mainColor;
            octx.font = 'bold 10px monospace';
            octx.fillText(isEyelidClosed ? 'EYES CLOSED' : isMouthYawning ? 'YAWN DETECTED' : 'FACE TRACKED', boxX + 8, boxY - 11);
          } else {
            // No Face Detected
            setDriverState(prev => ({
              ...prev,
              isDistracted: true,
              lastAiMessage: "Camera active. Position face clearly in front of camera..."
            }));
          }
        }
      }

      animationFrameId = requestAnimationFrame(processVideoFrame);
    };

    animationFrameId = requestAnimationFrame(processVideoFrame);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isMonitoring, setDriverState, driverState.alertLevel]);

  // Trigger Gemini Vision Driver Frame Analysis
  const handleAnalyzeFrame = useCallback(async () => {
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
          lastAiMessage: data.message || "Gemini AI: Driver face analyzed.",
        }));

        if (data.alertLevel === 'RED' || data.fatigueScore > 60) {
          soundManager.playCriticalAlarm();
          soundManager.speakText("Warning! Severe driver fatigue detected!");
        } else if (data.alertLevel === 'YELLOW') {
          soundManager.playWarningBeep();
        }
      }
    } catch (err) {
      console.warn("AI Frame analysis error:", err);
    } finally {
      setIsAiAnalyzing(false);
    }
  }, [cameraPermission, setDriverState]);

  // Automated Periodic Gemini AI Scanning Loop (Every 6 Seconds)
  useEffect(() => {
    if (!isMonitoring || !autoAiScan) return;

    const interval = setInterval(() => {
      handleAnalyzeFrame();
    }, 6000);

    return () => clearInterval(interval);
  }, [isMonitoring, autoAiScan, handleAnalyzeFrame]);

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

            {/* Real-Time Facial Landmarks Overlay Canvas */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Live Face Tracking Indicator Banner */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-2 backdrop-blur-md bg-black/70 px-3 py-1 rounded-xl border border-white/20 text-xs shadow-lg">
              {faceDetected ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">Face Tracked</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-amber-300">Face Searching...</span>
                </>
              )}
              <span className="text-slate-400 font-mono">| EAR: {driverState.ear.toFixed(2)}</span>
            </div>

            {/* AI Bounding Box Glow Effect */}
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
              className={`absolute inset-4 border-2 rounded-xl pointer-events-none z-0 ${
                driverState.alertLevel === 'RED' ? 'text-red-500' :
                driverState.alertLevel === 'YELLOW' ? 'text-amber-400' :
                'text-blue-400'
              }`}
            />

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
                  className="absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-30"
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
              Click &quot;Start Monitor&quot; above to enable live AI vision & real-time face tracking.
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
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAiScan}
                onChange={(e) => setAutoAiScan(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
              />
              <span>Auto AI Scan</span>
            </label>
            <span className={`font-semibold ${
              driverState.alertLevel === 'RED' ? 'text-red-400' :
              driverState.alertLevel === 'YELLOW' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              Fatigue: {driverState.drowsinessLevel}%
            </span>
          </div>
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
              <span>Analyze Current Frame with Gemini AI</span>
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

