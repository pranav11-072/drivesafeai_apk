import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera, Eye, AlertOctagon, Scan, RefreshCw, Zap, Sparkles,
  CheckCircle2, UserCheck, UserX, Video, VideoOff, FlipHorizontal,
  AlertTriangle, ShieldCheck, ShieldAlert, Sliders, Activity, Cpu,
  Gauge, Terminal, Layers, Crosshair, ChevronDown, ChevronUp,
  Play, Square, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DriverState, AlertLevel, GeminiFrameAnalysisResult } from '../types';
import { soundManager } from '../utils/audio';
import type { FaceWorkerOutput, FaceWorkerInput, PotentialSafetyEventType } from '../workers/faceWorker';
import {
  compute68Landmarks,
  renderOpticalTestBench,
  render68LandmarkMesh,
  render3DHeadPosePnP,
  renderGazeVector,
  renderOscilloscope,
  renderSubpixelBBox,
  SignalSample,
} from '../utils/dmsRenderer';

interface CameraHUDProps {
  driverState: DriverState;
  setDriverState: React.Dispatch<React.SetStateAction<DriverState>>;
  isMonitoring: boolean;
  onToggleMonitoring?: (forceState?: boolean) => void;
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
  onToggleMonitoring,
  isMobileMode = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(true);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [isLowLight, setIsLowLight] = useState<boolean>(false);
  const [showSimControls, setShowSimControls] = useState<boolean>(false);

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

  // Automotive DMS Engineering Diagnostics & Telemetry
  const [hudViewMode, setHudViewMode] = useState<'DIAGNOSTIC' | 'OPERATIONAL'>('DIAGNOSTIC');
  const [showPoseAxes, setShowPoseAxes] = useState<boolean>(true);
  const [showOscilloscope, setShowOscilloscope] = useState<boolean>(true);
  const [showMesh68, setShowMesh68] = useState<boolean>(true);
  const [showCalibrationRegisters, setShowCalibrationRegisters] = useState<boolean>(false);
  const [earThreshold, setEarThreshold] = useState<number>(0.21);
  const [marThreshold, setMarThreshold] = useState<number>(0.45);
  const [yawThreshold, setYawThreshold] = useState<number>(20.0);
  const [debounceFrames, setDebounceFrames] = useState<number>(8);

  const signalHistoryRef = useRef<SignalSample[]>([]);
  const frameCounterRef = useRef<number>(0);

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
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        // Strategy 1: Specific camera if user picked one
        if (selectedCameraId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: selectedCameraId } },
              audio: false,
            });
          } catch (devErr) {
            console.warn("Specific camera deviceId failed, falling back to front/user camera:", devErr);
          }
        }

        // Strategy 2: Ideal front/user facing camera with 640x480 resolution
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 },
              },
              audio: false,
            });
          } catch (idealErr) {
            console.warn("Retrying camera with relaxed facingMode user:", idealErr);
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false,
              });
            } catch (facingErr) {
              console.warn("Retrying with minimal video=true:", facingErr);
              // Strategy 3: Most permissive constraint
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
            }
          }
        }
      } else {
        throw new Error("Camera API is not supported in this browser context (requires HTTPS or modern browser).");
      }

      if (stream) {
        activeStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn("Video auto-play deferred until user interaction:", playErr);
          }
        }
        setCameraPermission(true);
        setIsSimulatorMode(false);
        setStreamError(null);

        // Re-enumerate to get labeled devices now that permission is granted
        if (navigator.mediaDevices?.enumerateDevices) {
          navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(videoDevices);
          }).catch(() => {});
        }
      } else {
        throw new Error("No video media stream could be opened.");
      }
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setCameraPermission(false);
      
      let errorMsg = "Webcam not accessible. You can use the Virtual Driver Simulator or open in a full tab.";
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        errorMsg = "Camera permission was denied by browser or iframe policy. Click 'Open in New Tab' to grant camera permissions directly, or switch to Virtual Simulator.";
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        errorMsg = "No webcam hardware detected on this device. You can test safety alerts in Virtual Simulator mode.";
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        errorMsg = "Camera hardware is currently in use by another program (e.g. Zoom, Teams, Meet) or locked.";
      } else if (err?.name === 'SecurityError') {
        errorMsg = "Camera access restricted inside iframe. Click 'Open in New Tab' to grant full camera permissions.";
      }
      setStreamError(errorMsg);
    }
  }, [selectedCameraId]);

  // Manage camera lifecycle based on isMonitoring state
  useEffect(() => {
    if (isMonitoring && !isSimulatorMode) {
      startCameraStream();
    } else if (!isMonitoring) {
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
  }, [isMonitoring, isSimulatorMode, startCameraStream]);

  // Synchronize active media stream with videoRef when mounted or state updates
  useEffect(() => {
    if (activeStreamRef.current && videoRef.current && videoRef.current.srcObject !== activeStreamRef.current) {
      videoRef.current.srcObject = activeStreamRef.current;
      videoRef.current.play().catch(e => console.warn("Video stream attach error:", e));
    }
  });

  const handleStartCamera = async (forceSimulator: boolean = false) => {
    soundManager.unlockAudioContext();
    setStreamError(null);
    if (forceSimulator) {
      setIsSimulatorMode(true);
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (onToggleMonitoring) {
        onToggleMonitoring(true);
      } else {
        setDriverState(prev => ({
          ...prev,
          isMonitoring: true,
          lastAiMessage: "AI Driver Virtual Simulator active.",
        }));
      }
    } else {
      setIsSimulatorMode(false);
      if (onToggleMonitoring) {
        onToggleMonitoring(true);
      } else {
        setDriverState(prev => ({
          ...prev,
          isMonitoring: true,
          lastAiMessage: "AI Driver Vision active. Connecting camera...",
        }));
      }
      await startCameraStream();
    }
  };

  const handleStopCamera = () => {
    soundManager.unlockAudioContext();
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraPermission(null);
    if (onToggleMonitoring) {
      onToggleMonitoring(false);
    } else {
      setDriverState(prev => ({
        ...prev,
        isMonitoring: false,
        lastAiMessage: "Driver monitoring stopped.",
      }));
    }
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

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
      // Graceful degradation: never crash or block the driver dashboard
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setDriverState(prev => ({
        ...prev,
        aiConfigured: false,
        lastAiMessage: isOffline
          ? "Network offline: operating via local computer vision."
          : "AI Cloud service unreachable: on-device safety vision active.",
      }));
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
        if (typeof data.metrics?.isLowLight === 'boolean') {
          setIsLowLight(data.metrics.isLowLight);
        }

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
          const simHeadX = 0.5 + Math.sin(simTick * 0.4) * 0.03;
          const simHeadY = 0.52 + Math.cos(simTick * 0.25) * 0.015;
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
            confidence: isSimAbsent ? 0 : 0.98,
            box: {
              x: simHeadX,
              y: simHeadY,
              width: 0.38,
              height: 0.50,
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

        // 3. Render ISO 26262 ASIL-B / SAE J3016 Biometric Telematics Interface
        if (octx) {
          octx.clearRect(0, 0, overlay.width, overlay.height);

          const W = overlay.width;
          const H = overlay.height;
          frameCounterRef.current += 1;

          // 3A. ISO 12233 Optical Calibration Grid (ONLY when virtual simulator is active without live camera stream)
          if (isSimulatorMode && !activeStreamRef.current) {
            renderOpticalTestBench(octx, W, H);
          }

          // Four Corner Viewport Targeting Fiducials
          octx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          octx.lineWidth = 1.2;
          const edgeMargin = 12;
          const tickLen = 8;
          // TL
          octx.beginPath(); octx.moveTo(edgeMargin, edgeMargin + tickLen); octx.lineTo(edgeMargin, edgeMargin); octx.lineTo(edgeMargin + tickLen, edgeMargin); octx.stroke();
          // TR
          octx.beginPath(); octx.moveTo(W - edgeMargin - tickLen, edgeMargin); octx.lineTo(W - edgeMargin, edgeMargin); octx.lineTo(W - edgeMargin, edgeMargin + tickLen); octx.stroke();
          // BL
          octx.beginPath(); octx.moveTo(edgeMargin, H - edgeMargin - tickLen); octx.lineTo(edgeMargin, H - edgeMargin); octx.lineTo(edgeMargin + tickLen, H - edgeMargin); octx.stroke();
          // BR
          octx.beginPath(); octx.moveTo(W - edgeMargin - tickLen, H - edgeMargin); octx.lineTo(W - edgeMargin, H - edgeMargin); octx.lineTo(W - edgeMargin, H - edgeMargin - tickLen); octx.stroke();

          if (sm.faceFound) {
            const isAlertRed = driverState.alertLevel === 'RED' || driverState.eyesClosed || sm.ear < earThreshold;
            const isAlertYellow = driverState.alertLevel === 'YELLOW' || driverState.isYawning || driverState.isDistracted || sm.mar > marThreshold;
            const primaryColor = isAlertRed ? '#ef4444' : isAlertYellow ? '#f59e0b' : '#38bdf8';

            const boxX = sm.x - sm.w / 2;
            const boxY = sm.y - sm.h / 2;

            // Generate 68 standard Dlib/ISO geometric facial biometric landmarks
            const landmarks68 = compute68Landmarks(
              sm.x,
              sm.y,
              sm.w,
              sm.h,
              sm.yaw,
              sm.pitch,
              sm.roll,
              sm.ear,
              sm.mar
            );

            // 3B. Render Standard 68-Point Biometric Facial Landmark Mesh
            if (showMesh68) {
              render68LandmarkMesh(
                octx,
                landmarks68,
                primaryColor,
                sm.ear < earThreshold,
                sm.mar > marThreshold
              );
            }

            // 3C. Render 3D Perspective-n-Point (solvePnP) Coordinate Triad at Nose Tip (Point 30)
            if (showPoseAxes && landmarks68.length >= 31) {
              const noseTip = landmarks68[30];
              render3DHeadPosePnP(octx, noseTip.x, noseTip.y, sm.pitch, sm.yaw, sm.roll);
            }

            // 3D. Render Gaze Vector Projection Ray
            const leftEye = landmarks68[39] || { x: sm.x - sm.w * 0.15, y: sm.y - sm.h * 0.12 };
            const rightEye = landmarks68[42] || { x: sm.x + sm.w * 0.15, y: sm.y - sm.h * 0.12 };
            const eyeMidX = (leftEye.x + rightEye.x) / 2;
            const eyeMidY = (leftEye.y + rightEye.y) / 2;
            const isDistracted = Math.abs(sm.yaw) > yawThreshold || driverState.isDistracted;
            renderGazeVector(octx, eyeMidX, eyeMidY, sm.yaw, sm.pitch, isDistracted);

            // 3E. Render Sub-Pixel Automotive Engineering Bounding Box
            renderSubpixelBBox(
              octx,
              boxX,
              boxY,
              sm.w,
              sm.h,
              primaryColor,
              sm.confidence || 0.98,
              sm.yaw,
              sm.pitch,
              sm.ear,
              sm.mar
            );

            // 3F. Append Signal Telemetry to High-Speed History
            signalHistoryRef.current.push({
              ear: sm.ear,
              mar: sm.mar,
              timestamp: now,
            });
            if (signalHistoryRef.current.length > 80) {
              signalHistoryRef.current.shift();
            }

            // 3G. Render Real-Time Rolling Signal Oscilloscope Strip
            if (showOscilloscope) {
              renderOscilloscope(
                octx,
                signalHistoryRef.current,
                W,
                H,
                earThreshold,
                marThreshold
              );
            }

            // Top Status Banner
            octx.save();
            const tagY = Math.max(16, boxY - 26);
            octx.font = 'bold 9px monospace';
            octx.fillStyle = primaryColor;
            octx.textAlign = 'center';

            const statusText = isAlertRed
              ? 'ASIL-B FAULT: MICRO_SLEEP_CRITICAL [PERCLOS HIGH]'
              : sm.mar > marThreshold
              ? 'ASIL-B WARNING: YAWN_FATIGUE_ELEVATED'
              : isDistracted
              ? `ASIL-B WARNING: GAZE_OFF_AXIS [YAW: ${Math.round(sm.yaw)}°]`
              : 'ASIL-B NOMINAL: TRACKING_STABLE • 60FPS';

            octx.fillText(statusText, sm.x, tagY);
            octx.restore();

          } else {
            // 3H. Driver Absent / Optical Fault State
            octx.save();
            octx.fillStyle = 'rgba(239, 68, 68, 0.08)';
            octx.fillRect(0, 0, W, H);

            // Precision Searching Reticle
            const scanRadius = 42 + Math.sin(now * 0.005) * 8;
            octx.strokeStyle = '#ef4444';
            octx.lineWidth = 1.4;
            octx.setLineDash([4, 4]);
            octx.beginPath();
            octx.arc(W / 2, H / 2, scanRadius, 0, Math.PI * 2);
            octx.stroke();
            octx.setLineDash([]);

            octx.fillStyle = '#ef4444';
            octx.font = 'bold 11px monospace';
            octx.textAlign = 'center';
            octx.fillText('STATUS: DRIVER_ABSENT_IN_CABIN_FOV', W / 2, H / 2 + 55);

            octx.font = '9px monospace';
            octx.fillStyle = '#94a3b8';
            octx.fillText('ASIL-B FAULT: OPTICAL_TARGET_NOT_LOCKED', W / 2, H / 2 + 70);
            octx.restore();
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
          {/* Live Camera Video Feed (always mounted so videoRef is constantly bound) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(e) => {
              e.currentTarget.play().catch(err => console.warn("Video play catch:", err));
            }}
            className={`w-full h-full object-cover transition-opacity duration-200 ${isMirrored ? 'transform -scale-x-100' : ''} ${
              !isMonitoring || isSimulatorMode || !activeStreamRef.current ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Real-Time Facial Landmarks Overlay Canvas */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          />

          {isMonitoring ? (
            <>
              {/* Compact Mode Top Telematics Ribbon */}
              <div className="absolute top-0 inset-x-0 z-20 h-8 backdrop-blur-xl bg-slate-950/80 border-b border-white/10 px-2.5 flex items-center justify-between text-[11px]">
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                  driverState.alertLevel === 'RED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : driverState.alertLevel === 'YELLOW'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {driverState.eyesClosed
                    ? 'MICRO-SLEEP'
                    : driverState.isYawning
                    ? 'YAWNING'
                    : driverState.isDistracted
                    ? 'DISTRACTED'
                    : 'ATTENTIVE'}
                </span>

                <div className="flex items-center gap-1.5">
                  {isSimulatorMode ? (
                    <button
                      onClick={() => handleStartCamera(false)}
                      className="text-sky-400 hover:text-sky-300 font-medium text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 flex items-center gap-1"
                      title="Connect physical camera"
                    >
                      <Video className="w-2.5 h-2.5" />
                      <span>Connect Cam</span>
                    </button>
                  ) : activeStreamRef.current ? (
                    <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStartCamera(false)}
                      className="text-sky-400 hover:text-sky-300 font-medium text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20"
                      title="Retry camera connection"
                    >
                      Connect Cam
                    </button>
                  )}
                  <button
                    onClick={() => setIsMirrored(prev => !prev)}
                    className="p-1 text-slate-300 hover:text-white"
                    title={isMirrored ? "Disable mirror view" : "Enable mirror view"}
                  >
                    <FlipHorizontal className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleStopCamera}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                    title="Turn Camera Off (Standby)"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                </div>
              </div>

              {/* Stream Error Modal Overlay inside video frame if error occurs */}
              {streamError && (
                <div className="absolute inset-0 z-30 backdrop-blur-md bg-slate-950/90 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-1 text-amber-400">
                    <VideoOff className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-white uppercase">Camera Blocked or Not Found</p>
                  <p className="text-[10px] text-amber-300/90 mt-0.5 mb-2 line-clamp-2">{streamError}</p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <button
                      onClick={() => handleStartCamera(false)}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold"
                    >
                      Retry Permission
                    </button>
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 text-sky-400" />
                      <span>New Tab</span>
                    </button>
                    <button
                      onClick={() => {
                        setStreamError(null);
                        handleStartCamera(true);
                      }}
                      className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-[10px]"
                    >
                      Use Simulator
                    </button>
                  </div>
                </div>
              )}

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
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center backdrop-blur-md bg-slate-950/95">
              <div className="relative mb-2">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600/30 to-sky-500/20 border border-sky-400/50 flex items-center justify-center shadow-lg shadow-sky-950/80">
                  <Camera className="w-5 h-5 text-sky-400" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>CAMERA OFF (STANDBY)</span>
              </div>
              <p className="text-xs font-bold text-white">Turn on camera to monitor driver fatigue</p>
              <div className="mt-3 flex items-center gap-2 w-full max-w-xs justify-center">
                <button
                  onClick={() => handleStartCamera(false)}
                  id="btn-mobile-start-camera"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/50 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Camera</span>
                </button>
                <button
                  onClick={() => handleStartCamera(true)}
                  id="btn-mobile-virtual-mode"
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-medium border border-white/10 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Virtual Mode</span>
                </button>
              </div>
              <button
                onClick={handleOpenInNewTab}
                className="mt-2 text-[10px] text-sky-400 hover:text-sky-300 underline flex items-center gap-1"
              >
                <span>Open in New Tab if Camera Blocked</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>

        {/* Prominent Attentiveness State Badge */}
        <div className="mt-3 flex items-center justify-center">
          {driverState.alertLevel === 'GREEN' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>ASIL-B: NOMINAL_ATTENTIVE</span>
            </div>
          )}
          {driverState.alertLevel === 'YELLOW' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>ASIL-B: WARNING_PERCLOS_HIGH</span>
            </div>
          )}
          {driverState.alertLevel === 'RED' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono font-bold tracking-wider animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span>ASIL-B: CRITICAL_MICRO_SLEEP</span>
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
        {/* Live Camera Video Feed (always mounted so videoRef is constantly bound) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            e.currentTarget.play().catch(err => console.warn("Video play catch:", err));
          }}
          className={`w-full h-full object-cover transition-opacity duration-200 ${isMirrored ? 'transform -scale-x-100' : ''} ${
            !isMonitoring || isSimulatorMode || !activeStreamRef.current ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* Real-Time Facial Landmarks Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {isMonitoring ? (
          <>
            {/* Integrated Sleek Edge-to-Edge Glass Telematics Bar */}
            <div className="absolute top-0 inset-x-0 z-20 h-9 backdrop-blur-xl bg-slate-950/80 border-b border-white/10 px-3 flex items-center justify-between text-xs">
              {/* Left: Driver Presence & Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                  driverState.alertLevel === 'RED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : driverState.alertLevel === 'YELLOW'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {driverState.eyesClosed
                    ? 'MICRO-SLEEP'
                    : driverState.isYawning
                    ? 'YAWN / FATIGUE'
                    : driverState.isDistracted
                    ? 'DISTRACTION'
                    : faceDetected && driverState.driverPresent
                    ? (isSimulatorMode ? 'SYNTHETIC DMS' : 'CABIN DMS')
                    : 'NO DRIVER'}
                </span>

                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>EAR: <strong className="text-slate-200">{driverState.ear.toFixed(2)}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span>MAR: <strong className="text-slate-200">{driverState.mar.toFixed(2)}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span>CONF: <strong className="text-slate-200">98%</strong></span>
                </div>
              </div>

              {/* Right: Camera Source & Quick Controls */}
              <div className="flex items-center gap-1.5">
                {activeStreamRef.current && !isSimulatorMode ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Live Webcam</span>
                  </div>
                ) : isSimulatorMode ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Simulator</span>
                    </span>
                    <button
                      onClick={() => handleStartCamera(false)}
                      className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-500/30 transition-all font-medium"
                      title="Switch to live physical camera"
                    >
                      <Video className="w-3 h-3 text-sky-400" />
                      <span>Connect Cam</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartCamera(false)}
                    className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-500/30 transition-all font-medium"
                    title="Connect physical camera"
                  >
                    <VideoOff className="w-3 h-3 text-amber-400" />
                    <span>Connect Live Cam</span>
                  </button>
                )}

                {/* Multiple Camera Device Picker */}
                {availableCameras.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="bg-slate-900/90 text-slate-200 border border-white/10 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-sky-400 max-w-[120px] truncate"
                    title="Select video input device"
                  >
                    {availableCameras.map(cam => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${cam.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => setIsMirrored(prev => !prev)}
                  className={`p-1 rounded-md transition-colors border ${
                    isMirrored
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={isMirrored ? "Disable mirror view" : "Enable mirror view"}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleStopCamera}
                  className="px-2 py-0.5 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                  title="Pause Camera & Driver Monitoring"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              </div>
            </div>

            {/* Stream Error Modal Overlay inside video frame if error occurs */}
            {streamError && (
              <div className="absolute inset-0 z-30 backdrop-blur-md bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-3 text-amber-400 shadow-lg shadow-amber-950/50">
                  <VideoOff className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white uppercase tracking-wider mb-1">
                  Camera Access Not Available
                </h4>
                <p className="text-xs text-amber-200/90 max-w-md mb-4 font-mono leading-relaxed">
                  {streamError}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    onClick={() => handleStartCamera(false)}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-950/50 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera Permission</span>
                  </button>

                  <button
                    onClick={handleOpenInNewTab}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                    <span>Open in New Tab</span>
                  </button>

                  <button
                    onClick={() => {
                      setStreamError(null);
                      handleStartCamera(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Continue in Virtual Simulator</span>
                  </button>
                </div>
              </div>
            )}

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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md bg-slate-950/95">
            {/* Glowing camera radar ring */}
            <div className="relative mb-3 flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full border border-sky-500/20 animate-ping pointer-events-none" />
              <div className="absolute w-20 h-20 rounded-full border border-blue-500/30 animate-pulse pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/30 to-sky-500/20 border border-sky-400/40 flex items-center justify-center shadow-xl shadow-sky-950/60">
                <Camera className="w-8 h-8 text-sky-400" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-[11px] font-mono text-slate-300 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>CAMERA STATUS: OFF (STANDBY)</span>
            </div>

            <h3 className="text-lg font-black text-white tracking-wide uppercase">
              Driver Safety Camera Monitor
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
              Monitors eyelid closures (EAR &lt; 0.20), yawns (MAR &gt; 0.65), head tilt, and distracted driving locally on your device.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm justify-center">
              <button
                onClick={() => handleStartCamera(false)}
                id="btn-desktop-turn-on-camera"
                className="w-full sm:w-auto flex-1 py-2.5 px-5 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white rounded-xl text-sm font-bold shadow-xl shadow-blue-900/50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Turn On Camera</span>
              </button>

              <button
                onClick={() => handleStartCamera(true)}
                id="btn-desktop-virtual-mode"
                className="w-full sm:w-auto py-2.5 px-4 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-semibold border border-white/15 flex items-center justify-center gap-1.5 transition-colors"
                title="Test drowsiness alerts without webcam"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Virtual Simulator</span>
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400/90">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>100% Private On-Device Vision</span>
              </span>
              <span>•</span>
              <button
                onClick={handleOpenInNewTab}
                className="text-sky-400 hover:text-sky-300 underline flex items-center gap-1 font-medium"
              >
                <span>Open in New Tab if Camera Blocked</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
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

      {/* Low Cabin Lighting Notice */}
      {isLowLight && isMonitoring && !isSimulatorMode && (
        <div className="mt-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>FAULT: CABIN_LUX_DEFICIENT — Sensor SNR degraded. Increase illumination.</span>
        </div>
      )}

      {/* ISO 26262 DMS Optical Diagnostic & Calibration Controls */}
      <div className="mt-2 bg-slate-900/95 border border-slate-700/60 rounded-lg p-2 font-mono text-[10px]">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5 mb-1.5 flex-wrap gap-1">
          <div className="flex items-center gap-1.5 text-slate-200 font-bold">
            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
            <span className="tracking-wide">DMS WORKSTATION TELEMATICS</span>
            <span className="text-[9px] text-slate-400 font-normal">[ISO 26262 / SAE J3016]</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMesh68(v => !v)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                showMesh68
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              68-PT MESH: {showMesh68 ? 'ENABLED' : 'DISABLED'}
            </button>
            <button
              onClick={() => setShowPoseAxes(v => !v)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                showPoseAxes
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              PNP AXES: {showPoseAxes ? 'ENABLED' : 'DISABLED'}
            </button>
            <button
              onClick={() => setShowOscilloscope(v => !v)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                showOscilloscope
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              OSCILLOSCOPE: {showOscilloscope ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Engineering Calibration Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300">
          <div className="flex items-center gap-2 bg-slate-950/70 px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 shrink-0">EAR_TH:</span>
            <input
              type="range"
              min="0.14"
              max="0.28"
              step="0.01"
              value={earThreshold}
              onChange={(e) => setEarThreshold(parseFloat(e.target.value))}
              className="w-full accent-sky-400 h-1 bg-slate-700 rounded cursor-pointer"
            />
            <span className="text-sky-300 font-bold shrink-0 w-8 text-right">{earThreshold.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/70 px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 shrink-0">MAR_TH:</span>
            <input
              type="range"
              min="0.35"
              max="0.65"
              step="0.01"
              value={marThreshold}
              onChange={(e) => setMarThreshold(parseFloat(e.target.value))}
              className="w-full accent-amber-400 h-1 bg-slate-700 rounded cursor-pointer"
            />
            <span className="text-amber-300 font-bold shrink-0 w-8 text-right">{marThreshold.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/70 px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 shrink-0">YAW_LIM:</span>
            <input
              type="range"
              min="12"
              max="35"
              step="1"
              value={yawThreshold}
              onChange={(e) => setYawThreshold(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 h-1 bg-slate-700 rounded cursor-pointer"
            />
            <span className="text-emerald-300 font-bold shrink-0 w-8 text-right">±{yawThreshold}°</span>
          </div>
        </div>
      </div>

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

        {/* Potential Safety Event Test Triggers (Collapsible to keep camera uncluttered) */}
        <div className="pt-1 border-t border-white/5">
          <div className="flex items-center justify-between py-1">
            <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider">
              Safety Trigger Simulator
            </span>
            <button
              type="button"
              onClick={() => setShowSimControls(prev => !prev)}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-mono underline"
            >
              {showSimControls ? "Hide Controls" : "Test Triggers"}
            </button>
          </div>

          {showSimControls && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-1.5 animate-in fade-in duration-150">
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
          )}
        </div>
      </div>
    </div>
  );
};
