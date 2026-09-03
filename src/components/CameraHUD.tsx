import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera, Eye, AlertOctagon, Scan, RefreshCw, Zap, Sparkles,
  CheckCircle2, UserCheck, UserX, Video, VideoOff, FlipHorizontal,
  AlertTriangle, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DriverState, AlertLevel, GeminiFrameAnalysisResult } from '../types';
import { soundManager } from '../utils/audio';
import type { FaceWorkerOutput, FaceWorkerInput, PotentialSafetyEventType } from '../workers/faceWorker';

interface CameraHUDProps {
  driverState: DriverState;
  setDriverState: React.Dispatch<React.SetStateAction<DriverState>>;
  isMonitoring: boolean;
  isMobileMode?: boolean;
}

interface SafetyEventRecord {
  trigger: string;
  timestamp: string;
  verdict: string;
  alertLevel: 'GREEN' | 'YELLOW' | 'RED';
  confidence: number;
  thumbnail?: string;
  action: string;
}

export const CameraHUD: React.FC<CameraHUDProps> = ({
  driverState,
  setDriverState,
  isMonitoring,
  isMobileMode = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(true);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);

  // Gemini Event-Driven Analysis States
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [activeEventTrigger, setActiveEventTrigger] = useState<string | null>(null);
  const [lastVerifiedEvent, setLastVerifiedEvent] = useState<SafetyEventRecord | null>(null);
  const [isAiConfigured, setIsAiConfigured] = useState<boolean | null>(null);
  const [latestAiAnalysis, setLatestAiAnalysis] = useState<GeminiFrameAnalysisResult | null>(null);

  // Check Gemini AI configuration status on mount
  useEffect(() => {
    fetch('/api/ai/config-status')
      .then(r => r.json())
      .then(data => {
        setIsAiConfigured(data.configured);
        if (!data.configured) {
          setDriverState(prev => ({
            ...prev,
            aiConfigured: false,
            lastAiMessage: "AI Analysis: Not configured",
          }));
        } else {
          setDriverState(prev => ({
            ...prev,
            aiConfigured: true,
          }));
        }
      })
      .catch(() => {
        setIsAiConfigured(false);
        setDriverState(prev => ({
          ...prev,
          aiConfigured: false,
          lastAiMessage: "AI Analysis: Not configured",
        }));
      });
  }, [setDriverState]);

  // Available video input devices
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Worker references
  const workerRef = useRef<Worker | null>(null);
  const isWorkerBusyRef = useRef<boolean>(false);
  const latestWorkerResultRef = useRef<FaceWorkerOutput | null>(null);

  // Anti-spam debounce for auto-dispatching Gemini analysis
  const lastDispatchedEventTimeRef = useRef<number>(0);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const lastStateUpdateRef = useRef<number>(0);
  const lastWorkerSendTimeRef = useRef<number>(0);

  // EMA smoothing reference for 60 FPS HUD overlay
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
    faceFound: true,
    confidence: 0.95,
  });

  // Enumerate cameras on mount
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      }).catch(err => console.warn("Device enumeration error:", err));
    }
  }, [selectedCameraId]);

  // Function to initialize webcam with user-facing constraints and robust fallbacks
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
        const videoConstraints: MediaTrackConstraints = selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: 'user' };

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...videoConstraints,
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          });
        } catch (idealErr) {
          console.warn("Retrying with relaxed camera constraints:", idealErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (stream) {
        activeStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn("Video play catch:", e));
          };
          videoRef.current.play().catch(e => console.warn("Direct play catch:", e));
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
          ? "Camera permission denied. Virtual Driver Simulator is active."
          : "Webcam not accessible. Virtual Driver Simulator is active."
      );
    }
  }, [selectedCameraId]);

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
      setCameraPermission(null);
      setStreamError(null);
      setActiveEventTrigger(null);
    }

    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
    };
  }, [isMonitoring, startCameraStream]);

  // Helper: Capture current frame as base64 JPEG
  const captureCurrentFrame = useCallback((): string => {
    const video = videoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0 && !isSimulatorMode) {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 360;
      snapCanvas.height = 270;
      const sctx = snapCanvas.getContext('2d');
      if (sctx) {
        sctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
        return snapCanvas.toDataURL('image/jpeg', 0.82);
      }
    }

    // Fallback: capture HUD overlay canvas or render simulated frame
    if (overlayCanvasRef.current) {
      return overlayCanvasRef.current.toDataURL('image/jpeg', 0.82);
    }

    // Default driver frame placeholder
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = 320;
    placeholderCanvas.height = 240;
    const pctx = placeholderCanvas.getContext('2d');
    if (pctx) {
      pctx.fillStyle = '#090d16';
      pctx.fillRect(0, 0, 320, 240);
      pctx.fillStyle = '#38bdf8';
      pctx.font = 'bold 14px monospace';
      pctx.fillText('Driver Safety Snapshot', 70, 120);
      return placeholderCanvas.toDataURL('image/jpeg', 0.82);
    }
    return '';
  }, [isSimulatorMode]);

  // Central Event-Driven Pipeline:
  // Triggered when local real-time detection flags a potential safety event
  // Captures current frame -> Sends only to Gemini -> Updates driver status & safety score -> Triggers alert
  const dispatchSafetyEventToGemini = useCallback(async (
    triggerEvent: PotentialSafetyEventType | 'MANUAL_VERIFY',
    localTelemetry?: any
  ) => {
    // Cooldown check (prevent overlapping requests within 6 seconds unless manual)
    const now = Date.now();
    if (triggerEvent !== 'MANUAL_VERIFY' && now - lastDispatchedEventTimeRef.current < 6000) {
      return;
    }
    lastDispatchedEventTimeRef.current = now;

    setIsAiAnalyzing(true);
    setActiveEventTrigger(triggerEvent);

    const frameBase64 = captureCurrentFrame();

    try {
      const res = await fetch('/api/ai/analyze-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: frameBase64,
          triggerEvent,
          localMetrics: localTelemetry || {
            ear: driverState.ear,
            mar: driverState.mar,
            yaw: driverState.headTilt,
            driverPresent: driverState.driverPresent,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const configured = data.configured !== undefined ? data.configured : true;
        setIsAiConfigured(configured);

        // Parse structured Gemini AI result according to user specifications
        const structuredAnalysis: GeminiFrameAnalysisResult = {
          driverDetected: typeof data.driverDetected === 'boolean' ? data.driverDetected : true,
          attention: data.attention || (data.distracted ? 'distracted' : 'focused'),
          drowsiness: data.drowsiness || (data.fatigueScore > 65 ? 'high' : data.fatigueScore > 35 ? 'medium' : 'low'),
          eyes: data.eyes || (data.eyesClosed ? 'closed' : 'open'),
          yawning: Boolean(data.yawning),
          distraction: Boolean(data.distraction ?? data.distracted),
          riskLevel: data.riskLevel || (data.alertLevel === 'RED' ? 'high' : data.alertLevel === 'YELLOW' ? 'medium' : 'low'),
          confidence: typeof data.confidence === 'number' ? data.confidence : 0.92,
          message: data.message || (!configured ? "AI Analysis: Not configured" : "Driver appears attentive"),
          configured,
        };
        setLatestAiAnalysis(structuredAnalysis);

        // Compute updated safety score based on Gemini risk level and penalty
        const scorePenalty = data.safetyScorePenalty ?? (structuredAnalysis.riskLevel === 'high' ? 25 : structuredAnalysis.riskLevel === 'medium' ? 10 : 0);
        const newSafetyScore = Math.max(15, Math.min(100, (driverState.safetyScore || 100) - scorePenalty));

        const isRed = structuredAnalysis.riskLevel === 'high' || data.alertLevel === 'RED' || !structuredAnalysis.driverDetected;
        const isYellow = structuredAnalysis.riskLevel === 'medium' || data.alertLevel === 'YELLOW';
        const alertLevel: AlertLevel = isRed ? 'RED' : isYellow ? 'YELLOW' : 'GREEN';

        // Update driver state
        setDriverState(prev => ({
          ...prev,
          driverPresent: structuredAnalysis.driverDetected,
          drowsinessLevel: structuredAnalysis.drowsiness === 'high' ? 88 : structuredAnalysis.drowsiness === 'medium' ? 55 : 15,
          safetyScore: newSafetyScore,
          eyesClosed: structuredAnalysis.eyes === 'closed',
          isYawning: structuredAnalysis.yawning,
          isDistracted: structuredAnalysis.distraction || structuredAnalysis.attention === 'distracted',
          abnormalBehavior: structuredAnalysis.attention === 'inattentive' || prev.abnormalBehavior,
          alertLevel,
          aiConfigured: configured,
          lastAiMessage: structuredAnalysis.message,
          lastEventTrigger: triggerEvent,
          microSleepCount: (structuredAnalysis.eyes === 'closed' || triggerEvent === 'PROLONGED_EYE_CLOSURE') ? prev.microSleepCount + 1 : prev.microSleepCount,
          yawnCount: (structuredAnalysis.yawning || triggerEvent === 'YAWNING') ? prev.yawnCount + 1 : prev.yawnCount,
          distractionCount: (structuredAnalysis.distraction || triggerEvent === 'DISTRACTION') ? prev.distractionCount + 1 : prev.distractionCount,
        }));

        // Trigger appropriate audio alert
        if (alertLevel === 'RED' || triggerEvent === 'PROLONGED_EYE_CLOSURE') {
          soundManager.playCriticalAlarm(true);
          soundManager.speakText("Warning! Severe safety alert detected.");
        } else if (alertLevel === 'YELLOW' || triggerEvent === 'YAWNING' || triggerEvent === 'DISTRACTION') {
          soundManager.playWarningBeep(true);
          soundManager.speakText("Attention: please keep eyes focused on the road.");
        } else if (!structuredAnalysis.driverDetected || triggerEvent === 'DRIVER_ABSENT') {
          soundManager.playWarningBeep(true);
          soundManager.speakText("Warning: driver face not detected in camera view.");
        }

        // Record incident verification
        setLastVerifiedEvent({
          trigger: triggerEvent,
          timestamp: new Date().toLocaleTimeString(),
          verdict: structuredAnalysis.message,
          alertLevel,
          confidence: Math.round(structuredAnalysis.confidence * 100),
          thumbnail: frameBase64,
          action: alertLevel === 'RED' ? "Pull over immediately to a safe rest stop" : alertLevel === 'YELLOW' ? "Take a rest break and refocus" : "Driver clear and attentive",
        });
      }
    } catch (err) {
      console.warn("Gemini event analysis error:", err);
    } finally {
      setIsAiAnalyzing(false);
      setTimeout(() => setActiveEventTrigger(null), 3500);
    }
  }, [captureCurrentFrame, driverState.ear, driverState.mar, driverState.headTilt, driverState.driverPresent, driverState.safetyScore, setDriverState]);

  // Real-time Computer Vision via Web Worker & 60 FPS Main-Thread Canvas Overlay
  useEffect(() => {
    if (!isMonitoring) return;

    // Instantiate custom Face Worker off main thread
    const worker = new Worker(new URL('../workers/faceWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<FaceWorkerOutput>) => {
      isWorkerBusyRef.current = false;
      const data = e.data;
      if (data && data.type === 'FACE_ANALYSIS_RESULT') {
        latestWorkerResultRef.current = data;
        setFaceDetected(data.driverPresent);

        // EVENT-DRIVEN ARCHITECTURE:
        // When local real-time detection flags a potential safety event,
        // automatically capture the current frame and send ONLY this event to Gemini!
        if (data.potentialSafetyEvent) {
          dispatchSafetyEventToGemini(data.potentialSafetyEvent, {
            ear: data.metrics.ear,
            mar: data.metrics.mar,
            yaw: data.metrics.yaw,
            pitch: data.metrics.pitch,
            driverPresent: data.driverPresent,
            confidence: data.confidence,
          });
        }
      }
    };

    // Low-resolution off-screen canvas for frame extraction (120x90)
    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = 120;
    analysisCanvas.height = 90;
    const actx = analysisCanvas.getContext('2d', { willReadFrequently: true });

    let animationFrameId: number;
    let simTick = 0;

    const processVideoFrame = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;

      if (overlay) {
        const displayW = overlay.clientWidth || 320;
        const displayH = overlay.clientHeight || 240;
        if (overlay.width !== displayW || overlay.height !== displayH) {
          overlay.width = displayW;
          overlay.height = displayH;
        }

        const octx = overlay.getContext('2d');
        const now = Date.now();

        // 1. Process Live Video with Worker (10-12 FPS)
        const isVideoReady = video && video.readyState >= 2 && video.videoWidth > 0;

        if (isVideoReady && actx && !isSimulatorMode) {
          const shouldSendToWorker = !isWorkerBusyRef.current && (now - lastWorkerSendTimeRef.current >= 90);

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
          // Virtual Driver Simulator Animation Frame
          simTick += 0.035;
          const simHeadX = 0.5 + Math.sin(simTick * 0.4) * 0.04;
          const simHeadY = 0.45 + Math.cos(simTick * 0.25) * 0.02;
          const isSimClosed = driverState.eyesClosed;
          const isSimYawning = driverState.isYawning;
          const isSimDistracted = driverState.isDistracted;
          const isSimAbsent = !driverState.driverPresent;
          const isSimAbnormal = driverState.abnormalBehavior;

          latestWorkerResultRef.current = {
            type: 'FACE_ANALYSIS_RESULT',
            timestamp: now,
            hasFace: !isSimAbsent,
            driverPresent: !isSimAbsent,
            confidence: isSimAbsent ? 0 : 0.96,
            box: {
              x: simHeadX,
              y: simHeadY,
              width: 0.42,
              height: 0.55,
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
              yaw: isSimDistracted ? 32 : Math.round(Math.sin(simTick * 0.4) * 6),
              pitch: isSimAbnormal ? 28 : Math.round(Math.cos(simTick * 0.25) * 5),
              roll: 0,
              isEyelidClosed: isSimClosed,
              isMouthYawning: isSimYawning,
              isHeadTurned: isSimDistracted,
              isDistracted: isSimDistracted,
              abnormalBehavior: isSimAbnormal,
              consecutiveClosedFrames: isSimClosed ? 10 : 0,
              consecutiveYawnFrames: isSimYawning ? 10 : 0,
              consecutiveDistractedFrames: isSimDistracted ? 12 : 0,
            },
            potentialSafetyEvent: isSimAbsent
              ? 'DRIVER_ABSENT'
              : isSimClosed
              ? 'PROLONGED_EYE_CLOSURE'
              : isSimAbnormal
              ? 'ABNORMAL_BEHAVIOR'
              : isSimYawning
              ? 'YAWNING'
              : isSimDistracted
              ? 'DISTRACTION'
              : null,
          };
          setFaceDetected(!isSimAbsent);
        }

        // 2. Main-Thread Smooth Tracking & State Synchronization
        const workerRes = latestWorkerResultRef.current;
        const sm = smoothRef.current;

        if (workerRes && workerRes.hasFace) {
          const { box, metrics } = workerRes;

          const targetX = (isMirrored ? 1 - box.x : box.x) * overlay.width;
          const targetY = box.y * overlay.height;
          const targetW = box.width * overlay.width;
          const targetH = box.height * overlay.height;

          // Exponential Moving Average (EMA) smoothing for jitter-free HUD tracking
          sm.x += (targetX - sm.x) * 0.35;
          sm.y += (targetY - sm.y) * 0.35;
          sm.w += (targetW - sm.w) * 0.35;
          sm.h += (targetH - sm.h) * 0.35;
          sm.ear += (metrics.ear - sm.ear) * 0.30;
          sm.mar += (metrics.mar - sm.mar) * 0.30;
          sm.yaw += (metrics.yaw - sm.yaw) * 0.25;
          sm.pitch += (metrics.pitch - sm.pitch) * 0.25;
          sm.faceFound = true;

          // Regular state update (every 250ms)
          if (now - lastStateUpdateRef.current > 250) {
            lastStateUpdateRef.current = now;

            setDriverState(prev => ({
              ...prev,
              driverPresent: true,
              ear: Number(sm.ear.toFixed(2)),
              mar: Number(sm.mar.toFixed(2)),
              headTilt: Math.round(sm.yaw),
              eyesClosed: metrics.isEyelidClosed,
              isYawning: metrics.isMouthYawning,
              isDistracted: metrics.isDistracted,
              abnormalBehavior: metrics.abnormalBehavior,
            }));
          }
        } else {
          sm.faceFound = false;
          if (now - lastStateUpdateRef.current > 400) {
            lastStateUpdateRef.current = now;
            setDriverState(prev => ({
              ...prev,
              driverPresent: false,
              headTilt: 0,
            }));
          }
        }

        // 3. Render HUD Overlay & Wireframe
        if (octx) {
          octx.clearRect(0, 0, overlay.width, overlay.height);

          // Simulated background cockpit silhouette if camera is off
          if (isSimulatorMode || !cameraPermission) {
            octx.fillStyle = '#080d1a';
            octx.fillRect(0, 0, overlay.width, overlay.height);

            // Horizon & steering wheel guide
            octx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
            octx.lineWidth = 1.5;
            octx.beginPath();
            octx.arc(overlay.width / 2, overlay.height + 30, overlay.height * 0.75, Math.PI, 0);
            octx.stroke();
          }

          if (sm.faceFound) {
            const boxX = sm.x - sm.w / 2;
            const boxY = sm.y - sm.h / 2;
            const mainColor = driverState.alertLevel === 'RED'
              ? '#ef4444'
              : driverState.alertLevel === 'YELLOW'
              ? '#f59e0b'
              : '#38bdf8';

            // Outer Bounding Box
            octx.strokeStyle = mainColor;
            octx.lineWidth = 1.6;
            octx.setLineDash([6, 6]);
            octx.strokeRect(boxX, boxY, sm.w, sm.h);
            octx.setLineDash([]);

            // Reticle Corners
            const cLen = 14;
            octx.lineWidth = 2.5;
            octx.beginPath(); octx.moveTo(boxX, boxY + cLen); octx.lineTo(boxX, boxY); octx.lineTo(boxX + cLen, boxY); octx.stroke();
            octx.beginPath(); octx.moveTo(boxX + sm.w - cLen, boxY); octx.lineTo(boxX + sm.w, boxY); octx.lineTo(boxX + sm.w, boxY + cLen); octx.stroke();
            octx.beginPath(); octx.moveTo(boxX, boxY + sm.h - cLen); octx.lineTo(boxX, boxY + sm.h); octx.lineTo(boxX + cLen, boxY + sm.h); octx.stroke();
            octx.beginPath(); octx.moveTo(boxX + sm.w - cLen, boxY + sm.h); octx.lineTo(boxX + sm.w, boxY + sm.h); octx.lineTo(boxX + sm.w, boxY + sm.h - cLen); octx.stroke();

            // Geometric Landmark Wireframe
            const foreheadY = sm.y - sm.h * 0.38;
            const browY = sm.y - sm.h * 0.24;
            const leftEyeX = sm.x - sm.w * 0.22;
            const rightEyeX = sm.x + sm.w * 0.22;
            const eyeY = sm.y - sm.h * 0.14;
            const noseBridgeY = sm.y - sm.h * 0.02;
            const noseTipY = sm.y + sm.h * 0.08;
            const leftCheekX = sm.x - sm.w * 0.34;
            const rightCheekX = sm.x + sm.w * 0.34;
            const cheekY = sm.y + sm.h * 0.12;
            const mouthY = sm.y + sm.h * 0.28;
            const chinY = sm.y + sm.h * 0.44;

            octx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
            octx.lineWidth = 1;

            // Forehead & Brow lines
            octx.beginPath();
            octx.moveTo(sm.x - sm.w * 0.28, foreheadY);
            octx.lineTo(sm.x + sm.w * 0.28, foreheadY);
            octx.lineTo(rightEyeX, browY);
            octx.lineTo(leftEyeX, browY);
            octx.closePath();
            octx.stroke();

            // Eye to Nose Triangle
            octx.beginPath();
            octx.moveTo(leftEyeX, eyeY);
            octx.lineTo(rightEyeX, eyeY);
            octx.lineTo(sm.x, noseTipY);
            octx.closePath();
            octx.stroke();

            // Jaw Contour
            octx.beginPath();
            octx.moveTo(leftCheekX, cheekY);
            octx.lineTo(leftEyeX, eyeY);
            octx.lineTo(sm.x, noseBridgeY);
            octx.lineTo(rightEyeX, eyeY);
            octx.lineTo(rightCheekX, cheekY);
            octx.lineTo(sm.x + sm.w * 0.18, mouthY);
            octx.lineTo(sm.x, chinY);
            octx.lineTo(sm.x - sm.w * 0.18, mouthY);
            octx.closePath();
            octx.stroke();

            // Eye Points (red if closed)
            const eyeColor = driverState.eyesClosed ? '#ef4444' : '#38bdf8';
            octx.fillStyle = eyeColor;
            octx.beginPath(); octx.arc(leftEyeX, eyeY, 4, 0, Math.PI * 2); octx.fill();
            octx.beginPath(); octx.arc(rightEyeX, eyeY, 4, 0, Math.PI * 2); octx.fill();

            // Mouth Aperture
            octx.strokeStyle = driverState.isYawning ? '#f59e0b' : '#10b981';
            octx.lineWidth = 2;
            octx.beginPath();
            octx.ellipse(sm.x, mouthY, sm.w * 0.18, driverState.isYawning ? 12 : 4, 0, 0, Math.PI * 2);
            octx.stroke();

            // Telemetry Tag on top of bounding box
            octx.fillStyle = 'rgba(9, 13, 22, 0.88)';
            octx.fillRect(boxX, boxY - 26, 210, 22);
            octx.fillStyle = mainColor;
            octx.font = 'bold 10px monospace';

            const statusLabel = driverState.eyesClosed
              ? '● PROLONGED EYE CLOSURE'
              : driverState.isYawning
              ? '● YAWN DETECTED'
              : driverState.isDistracted
              ? '● DISTRACTION (HEAD TURN)'
              : driverState.abnormalBehavior
              ? '● ABNORMAL POSTURE / SLUMP'
              : '● DRIVER ALERT & TRACKED';

            octx.fillText(statusLabel, boxX + 6, boxY - 11);
          } else {
            // Driver Not Detected Alert in HUD
            octx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            octx.fillRect(0, 0, overlay.width, overlay.height);
            octx.fillStyle = '#f87171';
            octx.font = 'bold 14px sans-serif';
            octx.textAlign = 'center';
            octx.fillText('DRIVER NOT DETECTED IN VIEW', overlay.width / 2, overlay.height / 2);
            octx.font = '11px sans-serif';
            octx.fillStyle = '#fca5a5';
            octx.fillText('Please position face towards camera', overlay.width / 2, overlay.height / 2 + 20);
            octx.textAlign = 'start';
          }
        }
      }

      animationFrameId = requestAnimationFrame(processVideoFrame);
    };

    animationFrameId = requestAnimationFrame(processVideoFrame);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [isMonitoring, isSimulatorMode, cameraPermission, isMirrored, driverState.eyesClosed, driverState.isYawning, driverState.isDistracted, driverState.abnormalBehavior, driverState.driverPresent, driverState.alertLevel, setDriverState, dispatchSafetyEventToGemini]);

  // Test Simulators:
  // Instead of static dummy toggles, they immediately trigger the full event-driven pipeline:
  // Event detected -> Frame captured -> Sent to Gemini -> Status & safety score updated -> Alert triggered
  const triggerEyesClosedSimulation = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      eyesClosed: true,
      ear: 0.10,
      drowsinessLevel: 85,
    }));
    dispatchSafetyEventToGemini('PROLONGED_EYE_CLOSURE', {
      ear: 0.10,
      mar: 0.12,
      yaw: 0,
      driverPresent: true,
      closureDurationMs: 1400,
    });
  };

  const triggerYawnSimulation = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      isYawning: true,
      mar: 0.68,
      drowsinessLevel: Math.min(100, prev.drowsinessLevel + 25),
    }));
    dispatchSafetyEventToGemini('YAWNING', {
      ear: 0.28,
      mar: 0.68,
      yaw: 0,
      driverPresent: true,
    });
  };

  const triggerDistractionSimulation = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      isDistracted: true,
      headTilt: 38,
    }));
    dispatchSafetyEventToGemini('DISTRACTION', {
      ear: 0.30,
      mar: 0.14,
      yaw: 38,
      driverPresent: true,
    });
  };

  const triggerNoDriverSimulation = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      driverPresent: false,
    }));
    dispatchSafetyEventToGemini('DRIVER_ABSENT', {
      driverPresent: false,
      ear: 0,
      mar: 0,
      yaw: 0,
    });
  };

  const triggerAbnormalPostureSimulation = () => {
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      abnormalBehavior: true,
      headTilt: -25,
    }));
    dispatchSafetyEventToGemini('ABNORMAL_BEHAVIOR', {
      pitch: 28,
      yaw: 5,
      ear: 0.18,
      driverPresent: true,
      abnormalBehavior: true,
    });
  };

  const resetSimulation = () => {
    soundManager.stopAlarm();
    soundManager.unlockAudioContext();
    setDriverState(prev => ({
      ...prev,
      driverPresent: true,
      eyesClosed: false,
      isYawning: false,
      isDistracted: false,
      isUsingPhone: false,
      abnormalBehavior: false,
      ear: 0.32,
      mar: 0.14,
      headTilt: 0,
      drowsinessLevel: 5,
      safetyScore: 100,
      alertLevel: 'GREEN',
      lastAiMessage: "Driver alert, centered, and verified on the road.",
      lastEventTrigger: undefined,
    }));
    setActiveEventTrigger(null);
  };

  // Dedicated Mobile UI: Focused strictly on Live Camera & Driver Attentiveness State
  if (isMobileMode) {
    return (
      <div id="mobile-live-camera-card" className="w-full">
        <div className="text-center mb-2">
          <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-slate-400 uppercase">
            LIVE CAMERA
          </span>
        </div>

        {/* Video / Camera Canvas Container */}
        <div className="relative w-full aspect-video bg-slate-950/95 rounded-2xl overflow-hidden border border-white/15 shadow-inner flex items-center justify-center">
          {isMonitoring ? (
            <>
              {/* Live Camera Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isMirrored ? 'transform -scale-x-100' : ''} ${
                  isSimulatorMode || !cameraPermission ? 'opacity-0' : 'opacity-100'
                }`}
              />

              {/* Real-Time Facial Landmarks Overlay Canvas */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {/* Top Controls: Flip Mirror & Retry */}
              <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 backdrop-blur-md bg-black/80 px-2 py-1 rounded-lg border border-white/20 text-[11px] shadow-md">
                {isSimulatorMode && (
                  <button
                    onClick={startCameraStream}
                    className="text-amber-400 hover:text-amber-300 font-mono text-[10px] px-1"
                    title="Retry live camera feed"
                  >
                    Retry Cam
                  </button>
                )}
                <button
                  onClick={() => setIsMirrored(prev => !prev)}
                  className="p-0.5 text-slate-300 hover:text-white"
                  title={isMirrored ? "Disable mirror view" : "Enable mirror view"}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Critical Alert Flasher */}
              <AnimatePresence>
                {driverState.alertLevel === 'RED' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{
                      opacity: [0.85, 1, 0.85],
                      backgroundColor: ['rgba(185,28,28,0.55)', 'rgba(220,38,38,0.85)', 'rgba(185,28,28,0.55)']
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse' }}
                    className="absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 z-30"
                  >
                    <AlertOctagon className="w-12 h-12 text-white mb-1 drop-shadow-[0_0_20px_rgba(255,255,255,1)]" />
                    <h3 className="text-lg font-black text-white tracking-wider uppercase drop-shadow">
                      {driverState.eyesClosed ? 'MICRO-SLEEP DETECTED!' : 'DROWSINESS ALERT!'}
                    </h3>
                    <p className="text-[11px] text-red-100 font-bold bg-red-950/90 px-3 py-0.5 rounded-full border border-red-400/50 mt-1">
                      PULL OVER TO SAFETY IMMEDIATELY
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="text-center p-6 text-slate-400 flex flex-col items-center">
              <Camera className="w-10 h-10 text-slate-500 mb-2" />
              <p className="text-xs font-semibold text-slate-300">Driver Camera Standby</p>
              <button
                onClick={() => setDriverState(prev => ({ ...prev, isMonitoring: true }))}
                className="mt-2.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/50 transition-colors"
              >
                Start Camera Feed
              </button>
            </div>
          )}
        </div>

        {/* Stream Error Notice if applicable */}
        {streamError && isMonitoring && (
          <div className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between">
            <span className="truncate">{streamError}</span>
            <button
              onClick={startCameraStream}
              className="underline text-amber-200 hover:text-white font-medium ml-2 text-[11px] shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Prominent Attentiveness State Badge */}
        <div className="mt-3 flex items-center justify-center">
          {driverState.alertLevel === 'GREEN' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <span className="text-base">🟢</span>
              <span className="tracking-wider">ATTENTIVE</span>
            </div>
          )}
          {driverState.alertLevel === 'YELLOW' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-bold tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <span className="text-base">🟡</span>
              <span className="tracking-wider">DROWSY</span>
            </div>
          )}
          {driverState.alertLevel === 'RED' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-bold tracking-wide shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-pulse">
              <span className="text-base">🔴</span>
              <span className="tracking-wider">CRITICAL ALERT</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full">
      {/* Video / Camera Canvas Container */}
      <div className="relative w-full aspect-video bg-slate-950/90 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
        {isMonitoring ? (
          <>
            {/* Live Camera Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isMirrored ? 'transform -scale-x-100' : ''} ${
                isSimulatorMode || !cameraPermission ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Real-Time Facial Landmarks Overlay Canvas */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Top Left: Driver Presence Indicator */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-2 backdrop-blur-md bg-black/80 px-3 py-1 rounded-xl border border-white/20 text-xs shadow-lg">
              {faceDetected && driverState.driverPresent ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">
                    {isSimulatorMode ? 'Sim Driver Present' : 'Driver Present'}
                  </span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span className="font-semibold text-red-300">No Driver in Frame</span>
                </>
              )}
              <span className="text-slate-400 font-mono text-[11px]">| EAR: {driverState.ear.toFixed(2)}</span>
            </div>

            {/* Top Right: Camera Switcher & Mirror Toggle */}
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 backdrop-blur-md bg-black/80 px-2 py-1 rounded-xl border border-white/20 text-[11px] shadow-lg">
              {cameraPermission && !isSimulatorMode ? (
                <div className="flex items-center gap-1 text-emerald-400">
                  <Video className="w-3.5 h-3.5" />
                  <span className="font-medium">Live Feed</span>
                </div>
              ) : (
                <button
                  onClick={startCameraStream}
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                  title="Click to retry live camera"
                >
                  <VideoOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-medium">Sim Mode (Retry Cam)</span>
                </button>
              )}

              {/* Mirror Toggle Button */}
              <button
                onClick={() => setIsMirrored(prev => !prev)}
                className="p-1 text-slate-300 hover:text-white transition-colors ml-1"
                title={isMirrored ? "Disable mirror view" : "Enable mirror view"}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Active Gemini Event Analysis Banner */}
            <AnimatePresence>
              {isAiAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 backdrop-blur-xl bg-blue-950/90 border border-blue-400/50 px-3.5 py-1.5 rounded-full text-xs text-blue-200 shadow-xl shadow-blue-950/80"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-300" />
                  <span className="font-semibold">
                    Potential Event: {activeEventTrigger?.replace(/_/g, ' ') || 'Driver Check'} → Verifying with Gemini AI...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Critical Alert Flasher */}
            <AnimatePresence>
              {driverState.alertLevel === 'RED' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: [0.85, 1, 0.85],
                    scale: [1, 1.02, 1],
                    backgroundColor: ['rgba(185,28,28,0.45)', 'rgba(220,38,38,0.7)', 'rgba(185,28,28,0.45)']
                  }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.45, repeat: Infinity, repeatType: 'reverse' }}
                  className="absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-30"
                >
                  <motion.div
                    animate={{ rotate: [-6, 6, -6], scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.35, repeat: Infinity, repeatType: 'reverse' }}
                  >
                    <AlertOctagon className="w-16 h-16 text-white mb-2 drop-shadow-[0_0_25px_rgba(255,255,255,1)]" />
                  </motion.div>
                  <h3 className="text-2xl font-black text-white tracking-wider uppercase drop-shadow-lg">
                    {driverState.eyesClosed
                      ? 'MICRO-SLEEP DETECTED!'
                      : !driverState.driverPresent
                      ? 'DRIVER NOT DETECTED!'
                      : 'DROWSINESS ALERT!'}
                  </h3>
                  <p className="text-xs text-red-100 font-bold mt-1 tracking-wide bg-red-950/80 px-3.5 py-1 rounded-full border border-red-400/50 shadow-md">
                    PULL OVER IMMEDIATELY TO A SAFE SPOT
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="text-center p-6 text-slate-400 flex flex-col items-center">
            <Camera className="w-12 h-12 text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-300">Driver Safety Camera Standby</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Click &quot;Start Monitor&quot; to activate local computer vision and Gemini safety event analysis.
            </p>
          </div>
        )}
      </div>

      {/* Stream Error Notice if applicable */}
      {streamError && isMonitoring && (
        <div className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between">
          <span>{streamError}</span>
          <button
            onClick={startCameraStream}
            className="underline text-amber-200 hover:text-white font-medium ml-2"
          >
            Retry Camera
          </button>
        </div>
      )}

      {/* Architecture Pipeline Telemetry Bar */}
      <div className="mt-2.5 backdrop-blur-md bg-white/5 rounded-xl p-2.5 border border-white/10">
        <div className="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>AI Safety Assessment</span>
            </span>
            {isAiConfigured === false ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                AI Analysis: Not configured
              </span>
            ) : isAiConfigured === true ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AI Analysis: Configured
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              driverState.alertLevel === 'RED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
              driverState.alertLevel === 'YELLOW' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              Alert: {driverState.alertLevel}
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              Fatigue: {driverState.drowsinessLevel}%
            </span>
          </div>
        </div>

        {/* Structured telemetry pills representing Gemini frame analysis */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 py-1.5 border-y border-white/5 text-[10px] font-mono">
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Driver</span>
            <span className={latestAiAnalysis?.driverDetected ?? driverState.driverPresent ? "text-emerald-300 font-bold" : "text-red-400 font-bold"}>
              {latestAiAnalysis?.driverDetected ?? driverState.driverPresent ? "Present" : "Absent"}
            </span>
          </div>
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Attention</span>
            <span className={latestAiAnalysis?.attention === 'distracted' || driverState.isDistracted ? "text-amber-300 font-bold" : "text-emerald-300 font-bold"}>
              {latestAiAnalysis?.attention || (driverState.isDistracted ? 'distracted' : 'focused')}
            </span>
          </div>
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Drowsiness</span>
            <span className={latestAiAnalysis?.drowsiness === 'high' || driverState.eyesClosed ? "text-red-400 font-bold" : latestAiAnalysis?.drowsiness === 'medium' || driverState.isYawning ? "text-amber-300 font-bold" : "text-emerald-300 font-bold"}>
              {latestAiAnalysis?.drowsiness || (driverState.eyesClosed ? 'high' : driverState.isYawning ? 'medium' : 'low')}
            </span>
          </div>
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Eyes</span>
            <span className={latestAiAnalysis?.eyes === 'closed' || driverState.eyesClosed ? "text-red-400 font-bold" : "text-emerald-300 font-bold"}>
              {latestAiAnalysis?.eyes || (driverState.eyesClosed ? 'closed' : 'open')}
            </span>
          </div>
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Yawning</span>
            <span className={latestAiAnalysis?.yawning || driverState.isYawning ? "text-amber-300 font-bold" : "text-slate-300 font-bold"}>
              {latestAiAnalysis?.yawning || driverState.isYawning ? "Yes" : "No"}
            </span>
          </div>
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Distraction</span>
            <span className={latestAiAnalysis?.distraction || driverState.isDistracted ? "text-amber-300 font-bold" : "text-slate-300 font-bold"}>
              {latestAiAnalysis?.distraction || driverState.isDistracted ? "Yes" : "No"}
            </span>
          </div>
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Risk Level</span>
            <span className={driverState.alertLevel === 'RED' ? "text-red-400 font-bold" : driverState.alertLevel === 'YELLOW' ? "text-amber-300 font-bold" : "text-emerald-300 font-bold"}>
              {latestAiAnalysis?.riskLevel ? latestAiAnalysis.riskLevel.toUpperCase() : driverState.alertLevel === 'RED' ? 'HIGH' : driverState.alertLevel === 'YELLOW' ? 'MEDIUM' : 'LOW'}
            </span>
          </div>
          <div className="bg-black/30 px-1.5 py-1 rounded text-center">
            <span className="text-slate-400 block text-[9px]">Confidence</span>
            <span className="text-blue-300 font-bold">
              {Math.round((latestAiAnalysis?.confidence ?? 0.92) * 100)}%
            </span>
          </div>
        </div>

        <p className="text-xs font-mono text-slate-200 truncate mt-1.5">
          {driverState.lastAiMessage || (isAiConfigured === false ? "AI Analysis: Not configured" : "Monitoring facial posture, gaze direction, and eye closure rate...")}
        </p>
      </div>

      {/* Verified Event Detail Badge if available */}
      {lastVerifiedEvent && (
        <div className="mt-2 px-3 py-1.5 rounded-xl bg-blue-950/40 border border-blue-500/20 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            {lastVerifiedEvent.alertLevel === 'RED' ? (
              <ShieldAlert className="w-4 h-4 text-red-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-slate-300">
              Last Verified: <strong className="text-white">{lastVerifiedEvent.trigger.replace(/_/g, ' ')}</strong> at {lastVerifiedEvent.timestamp} ({lastVerifiedEvent.confidence}% conf)
            </span>
          </div>
          <span className="text-blue-300 font-medium truncate max-w-[180px]">{lastVerifiedEvent.action}</span>
        </div>
      )}

      {/* Action Controls & Real-Time Event Test Buttons */}
      <div className="mt-3 space-y-2">
        {/* Manual On-Demand Verification */}
        <button
          onClick={() => dispatchSafetyEventToGemini('MANUAL_VERIFY')}
          disabled={isAiAnalyzing || !isMonitoring}
          id="btn-analyze-driver-frame"
          className="w-full flex items-center justify-center gap-2 backdrop-blur-md bg-blue-600/90 hover:bg-blue-500 disabled:bg-blue-900/40 text-white py-2 px-3 rounded-xl text-xs font-semibold shadow-lg shadow-blue-950/50 transition-all border border-blue-400/30"
        >
          {isAiAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
              <span>Analyzing Snapshot with Gemini AI...</span>
            </>
          ) : (
            <>
              <Scan className="w-4 h-4 text-blue-200" />
              <span>Verify Current Frame with Gemini AI</span>
            </>
          )}
        </button>

        {/* Potential Safety Event Test Triggers:
            Demonstrates the exact pipeline:
            Local Event Detected -> Capture Frame -> Send to Gemini -> Update Status & Score -> Alert */}
        <div className="grid grid-cols-6 gap-1 pt-1">
          <button
            onClick={triggerEyesClosedSimulation}
            disabled={!isMonitoring}
            id="btn-sim-eyes-closed"
            title="Simulate Prolonged Eye Closure (Micro-sleep)"
            className="backdrop-blur-md bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-slate-200 hover:text-red-300 p-1.5 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1 disabled:opacity-40"
          >
            <Eye className="w-3.5 h-3.5 text-red-400" />
            <span className="truncate w-full text-center">Eyes Closed</span>
          </button>

          <button
            onClick={triggerYawnSimulation}
            disabled={!isMonitoring}
            id="btn-sim-yawn"
            title="Simulate Yawning Fatigue"
            className="backdrop-blur-md bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-slate-200 hover:text-amber-300 p-1.5 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1 disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate w-full text-center">Yawn</span>
          </button>

          <button
            onClick={triggerDistractionSimulation}
            disabled={!isMonitoring}
            id="btn-sim-distract"
            title="Simulate Head-Turn Distraction"
            className="backdrop-blur-md bg-white/5 hover:bg-sky-500/20 border border-white/10 hover:border-sky-500/40 text-slate-200 hover:text-sky-300 p-1.5 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1 disabled:opacity-40"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />
            <span className="truncate w-full text-center">Distracted</span>
          </button>

          <button
            onClick={triggerNoDriverSimulation}
            disabled={!isMonitoring}
            id="btn-sim-no-driver"
            title="Simulate No Driver in Frame"
            className="backdrop-blur-md bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/40 text-slate-200 hover:text-purple-300 p-1.5 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1 disabled:opacity-40"
          >
            <UserX className="w-3.5 h-3.5 text-purple-400" />
            <span className="truncate w-full text-center">No Driver</span>
          </button>

          <button
            onClick={triggerAbnormalPostureSimulation}
            disabled={!isMonitoring}
            id="btn-sim-head-slump"
            title="Simulate Abnormal Posture / Head Slump"
            className="backdrop-blur-md bg-white/5 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/40 text-slate-200 hover:text-orange-300 p-1.5 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1 disabled:opacity-40"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-orange-400" />
            <span className="truncate w-full text-center">Head Slump</span>
          </button>

          <button
            onClick={resetSimulation}
            id="btn-sim-reset"
            title="Reset Driver Alertness"
            className="backdrop-blur-md bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-slate-200 hover:text-emerald-300 p-1.5 rounded-xl text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate w-full text-center">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
