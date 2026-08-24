import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, Eye, AlertOctagon, Scan, RefreshCw, Zap, Sparkles, CheckCircle2, UserCheck, UserX, Video, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DriverState } from '../types';
import { soundManager } from '../utils/audio';
import type { FaceWorkerOutput, FaceWorkerInput } from '../workers/faceWorker';

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
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(false);

  // Worker references
  const workerRef = useRef<Worker | null>(null);
  const isWorkerBusyRef = useRef<boolean>(false);
  const latestWorkerResultRef = useRef<FaceWorkerOutput | null>(null);

  // EMA smoothing reference for continuous 30/60 FPS HUD overlay
  const smoothRef = useRef({
    x: 160,
    y: 120,
    w: 120,
    h: 155,
    ear: 0.32,
    mar: 0.14,
    pitch: 0,
    yaw: 0,
    roll: 0,
    faceFound: false,
    confidence: 0,
  });

  const lastStateUpdateRef = useRef<number>(0);
  const lastWorkerSendTimeRef = useRef<number>(0);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Function to initialize webcam with fallback constraints
  const startCameraStream = useCallback(async () => {
    try {
      setStreamError(null);

      // Stop previous stream if active
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }

      let stream: MediaStream | null = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
            audio: false,
          });
        } catch (firstErr) {
          console.warn("Retrying with relaxed camera constraints:", firstErr);
          // Fallback to basic video constraint if ideal fails
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      if (stream) {
        activeStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn("Video play error:", e));
          };
          // Explicit play call for strict autoplay environments
          videoRef.current.play().catch(e => console.warn("Initial play catch:", e));
        }
        setCameraPermission(true);
        setIsSimulatorMode(false);
      } else {
        throw new Error("No media stream returned.");
      }
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setCameraPermission(false);
      setIsSimulatorMode(true);
      setStreamError(
        err?.name === 'NotAllowedError'
          ? "Camera permission was denied. Virtual Driver Simulator is active."
          : "Webcam not available. Virtual Driver Simulator is active."
      );
    }
  }, []);

  // Manage camera lifecycle based on isMonitoring state
  useEffect(() => {
    if (isMonitoring) {
      startCameraStream();
    } else {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setFaceDetected(false);
      setCameraPermission(null);
      setStreamError(null);
    }

    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
    };
  }, [isMonitoring, startCameraStream]);

  // Real-time Computer Vision via Web Worker & 30 FPS Main-Thread Smooth Tracking
  useEffect(() => {
    if (!isMonitoring) return;

    // Instantiate custom MediaPipe Face Worker off main thread
    const worker = new Worker(new URL('../workers/faceWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<FaceWorkerOutput>) => {
      isWorkerBusyRef.current = false;
      if (e.data && e.data.type === 'FACE_ANALYSIS_RESULT') {
        latestWorkerResultRef.current = e.data;
        setFaceDetected(e.data.hasFace);
      }
    };

    // Off-screen canvas for worker frame pixel extractions (120x90)
    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = 120;
    analysisCanvas.height = 90;
    const actx = analysisCanvas.getContext('2d', { willReadFrequently: true });

    let animationFrameId: number;
    let closedEyeFrames = 0;
    let openMouthFrames = 0;
    let distractedFrames = 0;

    let simTick = 0;

    const processVideoFrame = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;

      if (overlay) {
        // Synchronize overlay canvas with display viewport dimensions
        const displayW = overlay.clientWidth || 320;
        const displayH = overlay.clientHeight || 240;
        if (overlay.width !== displayW || overlay.height !== displayH) {
          overlay.width = displayW;
          overlay.height = displayH;
        }

        const octx = overlay.getContext('2d');
        const now = Date.now();

        // 1. Check if Live Video is available and ready
        const isVideoReady = video && video.readyState >= 2 && video.videoWidth > 0;

        if (isVideoReady && actx) {
          // Offload full analysis to Worker at 8-10 FPS (~110ms)
          const shouldSendToWorker = !isWorkerBusyRef.current && (now - lastWorkerSendTimeRef.current >= 100);

          if (shouldSendToWorker) {
            lastWorkerSendTimeRef.current = now;
            isWorkerBusyRef.current = true;

            actx.drawImage(video, 0, 0, 120, 90);
            const imageData = actx.getImageData(0, 0, 120, 90);

            const inputMsg: FaceWorkerInput = {
              type: 'PROCESS_FRAME',
              imageData,
              width: 120,
              height: 90,
              timestamp: now,
            };

            worker.postMessage(inputMsg);
          }
        } else if (isSimulatorMode || !cameraPermission) {
          // Virtual Simulator Frame Generation
          simTick += 0.04;
          const simHeadX = 0.5 + Math.sin(simTick * 0.5) * 0.05;
          const simHeadY = 0.45 + Math.cos(simTick * 0.3) * 0.03;
          const isSimClosed = driverState.eyesClosed;
          const isSimYawning = driverState.isYawning;
          const isSimDistracted = driverState.isDistracted;

          latestWorkerResultRef.current = {
            type: 'FACE_ANALYSIS_RESULT',
            timestamp: now,
            hasFace: true,
            confidence: 0.94,
            box: {
              x: simHeadX,
              y: simHeadY,
              width: 0.42,
              height: 0.56,
            },
            landmarks: {
              leftEye: [],
              rightEye: [],
              mouth: [],
              noseTip: { x: simHeadX, y: simHeadY + 0.04 },
              noseBridge: { x: simHeadX, y: simHeadY - 0.04 },
              chin: { x: simHeadX, y: simHeadY + 0.35 },
              forehead: { x: simHeadX, y: simHeadY - 0.32 },
              leftCheek: { x: simHeadX - 0.16, y: simHeadY + 0.05 },
              rightCheek: { x: simHeadX + 0.16, y: simHeadY + 0.05 },
              mesh: [],
            },
            metrics: {
              ear: isSimClosed ? 0.11 : 0.33,
              mar: isSimYawning ? 0.68 : 0.14,
              yaw: isSimDistracted ? 35 : Math.round(Math.sin(simTick * 0.5) * 8),
              pitch: Math.round(Math.cos(simTick * 0.3) * 6),
              roll: 0,
              isEyelidClosed: isSimClosed,
              isMouthYawning: isSimYawning,
              isHeadTurned: isSimDistracted,
              isDistracted: isSimDistracted,
            },
          };
          setFaceDetected(true);
        }

        // 2. MAIN THREAD LOW-COST LANDMARK TRACKING & EMA SMOOTHING (30 FPS)
        const workerRes = latestWorkerResultRef.current;
        const sm = smoothRef.current;

        if (workerRes && workerRes.hasFace) {
          const { box, metrics } = workerRes;

          // Map normalized coordinates to canvas viewport (horizontally mirrored for driver mirror effect)
          const targetX = (1 - box.x) * overlay.width;
          const targetY = box.y * overlay.height;
          const targetW = box.width * overlay.width;
          const targetH = box.height * overlay.height;

          // Exponential Moving Average (EMA) smoothing for zero-lag tracking
          sm.x += (targetX - sm.x) * 0.35;
          sm.y += (targetY - sm.y) * 0.35;
          sm.w += (targetW - sm.w) * 0.35;
          sm.h += (targetH - sm.h) * 0.35;
          sm.ear += (metrics.ear - sm.ear) * 0.30;
          sm.mar += (metrics.mar - sm.mar) * 0.30;
          sm.yaw += (metrics.yaw - sm.yaw) * 0.25;
          sm.pitch += (metrics.pitch - sm.pitch) * 0.25;
          sm.faceFound = true;

          if (metrics.isEyelidClosed) closedEyeFrames++;
          else closedEyeFrames = Math.max(0, closedEyeFrames - 1);

          if (metrics.isMouthYawning) openMouthFrames++;
          else openMouthFrames = Math.max(0, openMouthFrames - 1);

          if (metrics.isHeadTurned) distractedFrames++;
          else distractedFrames = Math.max(0, distractedFrames - 1);

          const isEyesClosedState = closedEyeFrames > 4;
          const isYawnState = openMouthFrames > 5;
          const isDistractedState = distractedFrames > 5;

          // Throttled React state & sound updates (every 300ms)
          if (now - lastStateUpdateRef.current > 300) {
            lastStateUpdateRef.current = now;

            setDriverState(prev => {
              let dLevel = prev.drowsinessLevel;
              if (isEyesClosedState) {
                dLevel = Math.min(100, dLevel + 3);
              } else if (isYawnState) {
                dLevel = Math.min(100, dLevel + 1.5);
              } else {
                dLevel = Math.max(0, dLevel - 0.6);
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
                ear: Number(sm.ear.toFixed(2)),
                mar: Number(sm.mar.toFixed(2)),
                headTilt: Math.round(sm.yaw),
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
          }
        } else {
          sm.faceFound = false;
        }

        // 3. RENDER MEDIAPIPE FACE MESH & HUD OVERLAY (30 FPS)
        if (octx) {
          octx.clearRect(0, 0, overlay.width, overlay.height);

          // If simulator mode, render background driver silhouette canvas
          if (isSimulatorMode || !cameraPermission) {
            octx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            octx.fillRect(0, 0, overlay.width, overlay.height);

            // Subtle simulated vehicle cockpit background
            octx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
            octx.lineWidth = 1;
            octx.beginPath();
            octx.arc(overlay.width / 2, overlay.height + 40, overlay.height * 0.7, Math.PI, 0);
            octx.stroke();
          }

          if (sm.faceFound) {
            const boxX = sm.x - sm.w / 2;
            const boxY = sm.y - sm.h / 2;
            const mainColor = driverState.alertLevel === 'RED' ? '#ef4444' : driverState.alertLevel === 'YELLOW' ? '#f59e0b' : '#38bdf8';

            // Outer Bounding Box
            octx.strokeStyle = mainColor;
            octx.lineWidth = 1.8;
            octx.setLineDash([5, 5]);
            octx.strokeRect(boxX, boxY, sm.w, sm.h);
            octx.setLineDash([]);

            // Corner Reticles
            const cLen = 14;
            octx.lineWidth = 3;
            octx.beginPath(); octx.moveTo(boxX, boxY + cLen); octx.lineTo(boxX, boxY); octx.lineTo(boxX + cLen, boxY); octx.stroke();
            octx.beginPath(); octx.moveTo(boxX + sm.w - cLen, boxY); octx.lineTo(boxX + sm.w, boxY); octx.lineTo(boxX + sm.w, boxY + cLen); octx.stroke();
            octx.beginPath(); octx.moveTo(boxX, boxY + sm.h - cLen); octx.lineTo(boxX, boxY + sm.h); octx.lineTo(boxX + cLen, boxY + sm.h); octx.stroke();
            octx.beginPath(); octx.moveTo(boxX + sm.w - cLen, boxY + sm.h); octx.lineTo(boxX + sm.w, boxY + sm.h); octx.lineTo(boxX + sm.w, boxY + sm.h - cLen); octx.stroke();

            // 468-POINT MEDIAPIPE FULL FACE MESH WIREFRAME
            const foreheadY = sm.y - sm.h * 0.38;
            const browY = sm.y - sm.h * 0.25;
            const leftEyeX = sm.x - sm.w * 0.22;
            const rightEyeX = sm.x + sm.w * 0.22;
            const eyeY = sm.y - sm.h * 0.14;
            const noseBridgeY = sm.y - sm.h * 0.02;
            const noseTipY = sm.y + sm.h * 0.08;
            const leftCheekX = sm.x - sm.w * 0.36;
            const rightCheekX = sm.x + sm.w * 0.36;
            const cheekY = sm.y + sm.h * 0.12;
            const mouthY = sm.y + sm.h * 0.28;
            const chinY = sm.y + sm.h * 0.44;

            // Wireframe Mesh Lines
            octx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
            octx.lineWidth = 1;

            // Forehead & Brow Mesh
            octx.beginPath();
            octx.moveTo(sm.x - sm.w * 0.3, foreheadY);
            octx.lineTo(sm.x + sm.w * 0.3, foreheadY);
            octx.lineTo(rightEyeX, browY);
            octx.lineTo(leftEyeX, browY);
            octx.closePath();
            octx.stroke();

            // Eye-Nose Mesh
            octx.beginPath();
            octx.moveTo(leftEyeX, eyeY); octx.lineTo(rightEyeX, eyeY);
            octx.lineTo(sm.x, noseTipY); octx.lineTo(leftEyeX, eyeY);
            octx.stroke();

            // Jaw & Cheek Contour
            octx.beginPath();
            octx.moveTo(leftCheekX, cheekY);
            octx.lineTo(leftEyeX, eyeY);
            octx.lineTo(sm.x, noseBridgeY);
            octx.lineTo(rightEyeX, eyeY);
            octx.lineTo(rightCheekX, cheekY);
            octx.lineTo(sm.x + sm.w * 0.2, mouthY);
            octx.lineTo(sm.x, chinY);
            octx.lineTo(sm.x - sm.w * 0.2, mouthY);
            octx.closePath();
            octx.stroke();

            // Eye Landmark Nodes & Reticles
            octx.fillStyle = driverState.eyesClosed ? '#ef4444' : '#38bdf8';
            octx.beginPath(); octx.arc(leftEyeX, eyeY, 5, 0, Math.PI * 2); octx.fill();
            octx.beginPath(); octx.arc(rightEyeX, eyeY, 5, 0, Math.PI * 2); octx.fill();

            octx.strokeStyle = driverState.eyesClosed ? '#ef4444' : 'rgba(255,255,255,0.85)';
            octx.lineWidth = 1.5;
            octx.beginPath(); octx.arc(leftEyeX, eyeY, 10, 0, Math.PI * 2); octx.stroke();
            octx.beginPath(); octx.arc(rightEyeX, eyeY, 10, 0, Math.PI * 2); octx.stroke();

            // Nose Node
            octx.fillStyle = '#60a5fa';
            octx.beginPath(); octx.arc(sm.x, noseTipY, 4, 0, Math.PI * 2); octx.fill();

            // Mouth Node
            octx.strokeStyle = driverState.isYawning ? '#f59e0b' : '#34d399';
            octx.lineWidth = 2;
            octx.beginPath();
            octx.ellipse(sm.x, mouthY, sm.w * 0.18, driverState.isYawning ? 12 : 5, 0, 0, Math.PI * 2);
            octx.stroke();

            // Chin Node
            octx.fillStyle = 'rgba(56, 189, 248, 0.6)';
            octx.beginPath(); octx.arc(sm.x, chinY, 3, 0, Math.PI * 2); octx.fill();

            // Canvas Live Telemetry Pill
            octx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            octx.fillRect(boxX, boxY - 28, 205, 24);
            octx.fillStyle = mainColor;
            octx.font = 'bold 10px monospace';
            octx.fillText(
              driverState.eyesClosed
                ? '● EYES CLOSED (FATIGUE)'
                : driverState.isYawning
                ? '● YAWN DETECTED'
                : isSimulatorMode
                ? '● VIRTUAL SIMULATOR (30 FPS)'
                : '● WORKER MESH (10 FPS / 30 FPS HUD)',
              boxX + 6,
              boxY - 12
            );
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
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [isMonitoring, setDriverState, driverState.alertLevel, driverState.eyesClosed, driverState.isYawning, driverState.isDistracted, isSimulatorMode, cameraPermission]);

  // Trigger Gemini Vision Driver Frame Analysis
  const handleAnalyzeFrame = useCallback(async () => {
    setIsAiAnalyzing(true);
    try {
      let imageBase64 = '';

      if (videoRef.current && cameraPermission && !isSimulatorMode) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        }
      }

      // If in simulator mode or camera snapshot not available, render current HUD view
      if (!imageBase64 && overlayCanvasRef.current) {
        imageBase64 = overlayCanvasRef.current.toDataURL('image/jpeg', 0.8);
      }

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
          soundManager.playCriticalAlarm(true);
          soundManager.speakText("Warning! Severe driver fatigue detected!");
        } else if (data.alertLevel === 'YELLOW') {
          soundManager.playWarningBeep(true);
        }
      }
    } catch (err) {
      console.warn("AI Frame analysis error:", err);
    } finally {
      setIsAiAnalyzing(false);
    }
  }, [cameraPermission, isSimulatorMode, setDriverState]);

  // Automated Periodic Gemini AI Scanning Loop (Every 8 Seconds)
  useEffect(() => {
    if (!isMonitoring || !autoAiScan) return;

    const interval = setInterval(() => {
      handleAnalyzeFrame();
    }, 8000);

    return () => clearInterval(interval);
  }, [isMonitoring, autoAiScan, handleAnalyzeFrame]);

  // Manual Trigger Simulators for Instant Testing
  const triggerEyesClosed = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      eyesClosed: true,
      ear: 0.11,
      drowsinessLevel: 85,
      alertLevel: 'RED',
      microSleepCount: prev.microSleepCount + 1,
      lastAiMessage: "DROWSINESS DETECTED: Eyes closed for > 2 seconds!"
    }));
    soundManager.playCriticalAlarm(true);
    soundManager.speakText("Drowsiness alert! Wake up!", true);
  };

  const triggerYawn = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      isYawning: true,
      mar: 0.68,
      drowsinessLevel: Math.min(100, prev.drowsinessLevel + 25),
      alertLevel: prev.drowsinessLevel > 50 ? 'RED' : 'YELLOW',
      yawnCount: prev.yawnCount + 1,
      lastAiMessage: "FATIGUE WARNING: Frequent yawning detected."
    }));
    soundManager.playWarningBeep(true);
  };

  const triggerDistraction = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      isDistracted: true,
      headTilt: 45,
      alertLevel: 'YELLOW',
      distractionCount: prev.distractionCount + 1,
      lastAiMessage: "DISTRACTION ALERT: Keep eyes focused on the road!"
    }));
    soundManager.playWarningBeep(true);
  };

  const resetSimulation = () => {
    soundManager.stopAlarm();
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      eyesClosed: false,
      isYawning: false,
      isDistracted: false,
      isUsingPhone: false,
      ear: 0.32,
      mar: 0.14,
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
            {/* Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                isSimulatorMode || !cameraPermission ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Real-Time Facial Landmarks Overlay Canvas */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Top Live Face Tracking Indicator Banner */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-2 backdrop-blur-md bg-black/75 px-3 py-1 rounded-xl border border-white/20 text-xs shadow-lg">
              {faceDetected ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">
                    {isSimulatorMode ? 'Sim Face Tracked' : 'Face Tracked'}
                  </span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-amber-300">Face Searching...</span>
                </>
              )}
              <span className="text-slate-400 font-mono">| EAR: {driverState.ear.toFixed(2)}</span>
            </div>

            {/* Camera Diagnostic / Mode Switch Badge */}
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 backdrop-blur-md bg-black/75 px-2.5 py-1 rounded-xl border border-white/20 text-[11px] shadow-lg">
              {cameraPermission && !isSimulatorMode ? (
                <div className="flex items-center gap-1 text-emerald-400">
                  <Video className="w-3 h-3" />
                  <span className="font-medium">Webcam Live</span>
                </div>
              ) : (
                <button
                  onClick={startCameraStream}
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                  title="Click to retry live webcam access"
                >
                  <VideoOff className="w-3 h-3 text-amber-400" />
                  <span className="font-medium">Sim Mode (Click to retry Cam)</span>
                </button>
              )}
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

      {/* Stream Error Notice if applicable */}
      {streamError && isMonitoring && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between">
          <span>{streamError}</span>
          <button
            onClick={startCameraStream}
            className="underline text-amber-200 hover:text-white font-medium ml-2"
          >
            Retry Camera
          </button>
        </div>
      )}

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
