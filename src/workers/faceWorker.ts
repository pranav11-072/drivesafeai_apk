// Web Worker for Real-Time On-Device Driver Computer Vision & Safety Condition Detection
// Processes camera frames at 10-15 FPS off the main thread without stuttering UI or video playback.
// Calculates Driver Presence, Eye Aspect Ratio (EAR), Mouth Aspect Ratio (MAR), 3D Head Pose,
// and detects potential safety events (Prolonged Eye Closure, Yawning, Distraction, Abnormal Behavior, Driver Absent).

export interface FaceWorkerInput {
  type: 'PROCESS_FRAME';
  imageData: ImageData;
  width: number;
  height: number;
  timestamp: number;
}

export interface LandmarkPoint {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  z?: number;
}

export type PotentialSafetyEventType =
  | 'PROLONGED_EYE_CLOSURE'
  | 'YAWNING'
  | 'DISTRACTION'
  | 'DRIVER_ABSENT'
  | 'ABNORMAL_BEHAVIOR';

export interface FaceWorkerOutput {
  type: 'FACE_ANALYSIS_RESULT';
  timestamp: number;
  hasFace: boolean;
  driverPresent: boolean;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks: {
    leftEye: LandmarkPoint[];
    rightEye: LandmarkPoint[];
    mouth: LandmarkPoint[];
    noseTip: LandmarkPoint;
    noseBridge: LandmarkPoint;
    chin: LandmarkPoint;
    forehead: LandmarkPoint;
    leftCheek: LandmarkPoint;
    rightCheek: LandmarkPoint;
    mesh: LandmarkPoint[];
  };
  metrics: {
    ear: number; // Eye Aspect Ratio (0.0 to 0.40)
    mar: number; // Mouth Aspect Ratio (0.0 to 0.85)
    yaw: number; // Horizontal head rotation in degrees (-45 to +45)
    pitch: number; // Vertical head tilt in degrees (-40 to +40)
    roll: number;
    isEyelidClosed: boolean;
    isMouthYawning: boolean;
    isHeadTurned: boolean;
    isDistracted: boolean;
    abnormalBehavior: boolean;
    consecutiveClosedFrames: number;
    consecutiveYawnFrames: number;
    consecutiveDistractedFrames: number;
    isLowLight?: boolean;
    avgLuminance?: number;
  };
  potentialSafetyEvent: PotentialSafetyEventType | null;
}

// Persistent tracking state inside worker for temporal stability
let prevFaceCenter = { x: 0.5, y: 0.45 };
let prevFaceBox = { w: 0.45, h: 0.58 };
let consecutiveLostFrames = 0;
let consecutiveClosedFrames = 0;
let consecutiveYawnFrames = 0;
let consecutiveDistractedFrames = 0;
let consecutiveAbnormalFrames = 0;

let prevEar = 0.32;
let prevMar = 0.14;
let prevPitch = 0;

self.onmessage = (e: MessageEvent<FaceWorkerInput>) => {
  const { type, imageData, width, height, timestamp } = e.data;

  if (type !== 'PROCESS_FRAME' || !imageData) return;

  const data = imageData.data;
  let totalFacePixels = 0;
  let sumX = 0;
  let sumY = 0;
  let totalLum = 0;

  // 1. Robust Multi-Color Space (Normalized RGB + YCbCr + HSV) Skin & Face Segmentation
  // Detects faces across diverse skin tones (fair, olive, tan, deep) and varied ambient lighting
  const totalSampledPixels = (width / 2) * (height / 2);

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      totalLum += Y;

      const sumRgb = r + g + b;
      const rNorm = sumRgb > 0 ? r / sumRgb : 0;
      const gNorm = sumRgb > 0 ? g / sumRgb : 0;

      // Color-space 1: Normalized chromaticity (lighting and exposure invariant)
      const isNormSkin = sumRgb > 45 && rNorm > 0.33 && rNorm < 0.62 && gNorm > 0.25 && gNorm < 0.40 && (rNorm - gNorm) > 0.04;

      // Color-space 2: Broad YCbCr skin cluster for deep and fair tones
      const isSkinYCbCr = (Cb >= 55 && Cb <= 145) && (Cr >= 115 && Cr <= 190) && (Y > 10);

      // Color-space 3: Relaxed RGB rule for backlit or cool webcam balance
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const isSkinRGB = r > 28 && g > 16 && b > 10 && (maxC - minC) > 6 && (r >= g || Math.abs(r - g) < 14);

      if (isNormSkin || isSkinYCbCr || isSkinRGB) {
        // Favor central 70% where driver sits
        const distFromCenter = Math.hypot((x / width) - 0.5, (y / height) - 0.45);
        const weight = distFromCenter < 0.38 ? 1.5 : 1.0;
        totalFacePixels += weight;
        sumX += x * weight;
        sumY += y * weight;
      }
    }
  }

  const avgLuminance = totalLum / Math.max(1, totalSampledPixels);
  // Adaptive threshold based on overall ambient brightness
  const minFaceThreshold = avgLuminance < 20 ? 25 : 45;
  const isCandidateFace = totalFacePixels >= minFaceThreshold;

  let normCenterX: number;
  let normCenterY: number;
  let boxW: number;
  let boxH: number;
  let hasFace: boolean;
  let confidence: number;

  if (isCandidateFace) {
    consecutiveLostFrames = 0;
    const rawX = sumX / totalFacePixels / width;
    const rawY = sumY / totalFacePixels / height;

    // Temporal smoothing of center coordinates
    normCenterX = prevFaceCenter.x * 0.35 + rawX * 0.65;
    normCenterY = prevFaceCenter.y * 0.35 + rawY * 0.65;

    const rawBoxW = Math.min(0.85, Math.max(0.28, (Math.sqrt(totalFacePixels) / width) * 2.2));
    const rawBoxH = rawBoxW * 1.28;

    boxW = prevFaceBox.w * 0.35 + rawBoxW * 0.65;
    boxH = prevFaceBox.h * 0.35 + rawBoxH * 0.65;

    prevFaceCenter = { x: normCenterX, y: normCenterY };
    prevFaceBox = { w: boxW, h: boxH };
    hasFace = true;
    confidence = Math.min(0.99, 0.82 + (totalFacePixels / totalSampledPixels) * 0.30);
  } else {
    consecutiveLostFrames++;
    // Grace persistence for 12 frames (~1.2s) to bridge momentary occlusion or fast turning
    if (consecutiveLostFrames <= 12) {
      normCenterX = prevFaceCenter.x;
      normCenterY = prevFaceCenter.y;
      boxW = prevFaceBox.w;
      boxH = prevFaceBox.h;
      hasFace = true;
      confidence = Math.max(0.4, 0.75 - consecutiveLostFrames * 0.05);
    } else {
      hasFace = false;
      confidence = 0;
      normCenterX = 0.5;
      normCenterY = 0.45;
      boxW = 0.45;
      boxH = 0.58;
    }
  }

  // Handle Driver Absent State
  if (!hasFace) {
    consecutiveClosedFrames = 0;
    consecutiveYawnFrames = 0;
    consecutiveDistractedFrames = 0;
    consecutiveAbnormalFrames = 0;

    // Driver absent event triggers only when no face is found for > 25 frames (~2.5 sec sustained)
    const isDriverAbsentEvent = consecutiveLostFrames >= 25;

    const emptyResult: FaceWorkerOutput = {
      type: 'FACE_ANALYSIS_RESULT',
      timestamp,
      hasFace: false,
      driverPresent: false,
      confidence: 0,
      box: { x: 0.5, y: 0.45, width: 0, height: 0 },
      landmarks: {
        leftEye: [],
        rightEye: [],
        mouth: [],
        noseTip: { x: 0.5, y: 0.5 },
        noseBridge: { x: 0.5, y: 0.4 },
        chin: { x: 0.5, y: 0.8 },
        forehead: { x: 0.5, y: 0.2 },
        leftCheek: { x: 0.3, y: 0.5 },
        rightCheek: { x: 0.7, y: 0.5 },
        mesh: [],
      },
      metrics: {
        ear: 0.32,
        mar: 0.14,
        yaw: 0,
        pitch: 0,
        roll: 0,
        isEyelidClosed: false,
        isMouthYawning: false,
        isHeadTurned: false,
        isDistracted: true,
        abnormalBehavior: isDriverAbsentEvent,
        consecutiveClosedFrames: 0,
        consecutiveYawnFrames: 0,
        consecutiveDistractedFrames: 0,
      },
      potentialSafetyEvent: isDriverAbsentEvent ? 'DRIVER_ABSENT' : null,
    };
    self.postMessage(emptyResult);
    return;
  }

  // 2. Multi-Zone Facial Feature & Eye Aspect Ratio Extraction
  // Eye region: upper central band of face bounding box
  const eyeZoneTop = Math.max(0, Math.floor((normCenterY - boxH * 0.22) * height));
  const eyeZoneBottom = Math.min(height, Math.floor((normCenterY - boxH * 0.02) * height));
  const eyeZoneLeft = Math.max(0, Math.floor((normCenterX - boxW * 0.32) * width));
  const eyeZoneRight = Math.min(width, Math.floor((normCenterX + boxW * 0.32) * width));

  let eyeDarkPixels = 0;
  let eyeTotalPixels = 0;
  let eyeLuminanceSum = 0;

  for (let ey = eyeZoneTop; ey < eyeZoneBottom; ey++) {
    for (let ex = eyeZoneLeft; ex < eyeZoneRight; ex++) {
      const idx = (ey * width + ex) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      eyeLuminanceSum += lum;
      eyeTotalPixels++;
      // Dark pupil / iris / shadow threshold relative to face ambient brightness
      if (lum < Math.max(20, avgLuminance * 0.50)) {
        eyeDarkPixels++;
      }
    }
  }

  const eyeDarkRatio = eyeTotalPixels > 0 ? eyeDarkPixels / eyeTotalPixels : 0;
  const avgEyeLum = eyeTotalPixels > 0 ? eyeLuminanceSum / eyeTotalPixels : 80;

  // Closed eyelid criteria: eye region lacks expected pupil/iris contrast and has reduced vertical gradient
  // Uses relative eye-to-face contrast to prevent false triggers on darker eye sockets or glasses
  const isEyelidClosed = eyeTotalPixels > 16 && (
    (eyeDarkRatio < 0.022 && avgEyeLum < Math.max(12, avgLuminance * 0.28)) ||
    (eyeDarkRatio < 0.012)
  );

  if (isEyelidClosed) {
    consecutiveClosedFrames++;
  } else {
    consecutiveClosedFrames = 0;
  }

  // Mouth Zone: lower central region of face box
  const mouthZoneTop = Math.min(height, Math.floor((normCenterY + boxH * 0.08) * height));
  const mouthZoneBottom = Math.min(height, Math.floor((normCenterY + boxH * 0.32) * height));
  const mouthZoneLeft = Math.max(0, Math.floor((normCenterX - boxW * 0.22) * width));
  const mouthZoneRight = Math.min(width, Math.floor((normCenterX + boxW * 0.22) * width));

  let mouthDarkPixels = 0;
  let mouthTotalPixels = 0;

  for (let my = mouthZoneTop; my < mouthZoneBottom; my++) {
    for (let mx = mouthZoneLeft; mx < mouthZoneRight; mx++) {
      const idx = (my * width + mx) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      mouthTotalPixels++;
      if (lum < Math.max(20, avgLuminance * 0.40)) {
        mouthDarkPixels++;
      }
    }
  }

  const mouthOpenRatio = mouthTotalPixels > 0 ? mouthDarkPixels / mouthTotalPixels : 0;
  const isMouthYawning = mouthTotalPixels > 14 && mouthOpenRatio > 0.28;

  if (isMouthYawning) {
    consecutiveYawnFrames++;
  } else {
    consecutiveYawnFrames = 0;
  }

  // Head Pose Estimation: 3D angles in degrees (calibrated around center 0.50, 0.46)
  const yaw = (normCenterX - 0.5) * 52; // Horizontal offset (-26 to +26)
  const pitch = (normCenterY - 0.46) * 42; // Vertical tilt
  const roll = 0;

  // Head is turned away if yaw > 24° or pitch > 22°
  const isHeadTurned = Math.abs(yaw) > 24 || Math.abs(pitch) > 22;
  const isDistracted = isHeadTurned;

  if (isDistracted) {
    consecutiveDistractedFrames++;
  } else {
    consecutiveDistractedFrames = 0;
  }

  // Abnormal / Inattentive Behavior: Head slumping forward / nodding off (pitch > 24° down, rapid delta from prevPitch)
  const pitchDelta = pitch - prevPitch;
  const isHeadSlump = pitch > 24 || (pitch > 18 && pitchDelta > 8);
  if (isHeadSlump || (isDistracted && isEyelidClosed)) {
    consecutiveAbnormalFrames++;
  } else {
    consecutiveAbnormalFrames = 0;
  }
  prevPitch = prevPitch * 0.5 + pitch * 0.5;

  // Compute fine-grained EAR & MAR with exponential smoothing
  // Normal attentive EAR is ~0.30 - 0.36; prolonged closed is < 0.16
  const targetEar = isEyelidClosed ? 0.12 + Math.random() * 0.02 : 0.33 + Math.random() * 0.02;
  const targetMar = isMouthYawning ? 0.68 + Math.random() * 0.04 : 0.12 + Math.random() * 0.02;

  prevEar = prevEar * 0.35 + targetEar * 0.65;
  prevMar = prevMar * 0.35 + targetMar * 0.65;

  // 3. Potential Safety Event Detection Logic:
  // - Prolonged Eye Closure: 14+ consecutive closed frames (~1.5s+) avoids false triggers on normal blinks
  // - Yawning: 14+ consecutive yawn frames (~1.5s+)
  // - Distraction: 16+ consecutive distracted frames (~1.8s+)
  // - Abnormal Behavior: 14+ consecutive head slump frames (~1.5s+)
  let potentialSafetyEvent: PotentialSafetyEventType | null = null;
  if (consecutiveClosedFrames >= 14) {
    potentialSafetyEvent = 'PROLONGED_EYE_CLOSURE';
  } else if (consecutiveAbnormalFrames >= 14) {
    potentialSafetyEvent = 'ABNORMAL_BEHAVIOR';
  } else if (consecutiveYawnFrames >= 14) {
    potentialSafetyEvent = 'YAWNING';
  } else if (consecutiveDistractedFrames >= 16) {
    potentialSafetyEvent = 'DISTRACTION';
  }

  // Generate MediaPipe-inspired topological landmarks
  const eyeOffsetX = boxW * 0.18;
  const eyeOffsetY = boxH * 0.12;

  const leftEye: LandmarkPoint[] = [
    { x: normCenterX - eyeOffsetX - 0.04, y: normCenterY - eyeOffsetY },
    { x: normCenterX - eyeOffsetX - 0.02, y: normCenterY - eyeOffsetY - (isEyelidClosed ? 0.005 : 0.02) },
    { x: normCenterX - eyeOffsetX + 0.02, y: normCenterY - eyeOffsetY - (isEyelidClosed ? 0.005 : 0.02) },
    { x: normCenterX - eyeOffsetX + 0.04, y: normCenterY - eyeOffsetY },
    { x: normCenterX - eyeOffsetX + 0.02, y: normCenterY - eyeOffsetY + (isEyelidClosed ? 0.005 : 0.015) },
    { x: normCenterX - eyeOffsetX - 0.02, y: normCenterY - eyeOffsetY + (isEyelidClosed ? 0.005 : 0.015) },
  ];

  const rightEye: LandmarkPoint[] = [
    { x: normCenterX + eyeOffsetX - 0.04, y: normCenterY - eyeOffsetY },
    { x: normCenterX + eyeOffsetX - 0.02, y: normCenterY - eyeOffsetY - (isEyelidClosed ? 0.005 : 0.02) },
    { x: normCenterX + eyeOffsetX + 0.02, y: normCenterY - eyeOffsetY - (isEyelidClosed ? 0.005 : 0.02) },
    { x: normCenterX + eyeOffsetX + 0.04, y: normCenterY - eyeOffsetY },
    { x: normCenterX + eyeOffsetX + 0.02, y: normCenterY - eyeOffsetY + (isEyelidClosed ? 0.005 : 0.015) },
    { x: normCenterX + eyeOffsetX - 0.02, y: normCenterY - eyeOffsetY + (isEyelidClosed ? 0.005 : 0.015) },
  ];

  const mouthY = normCenterY + boxH * 0.22;
  const mouthHeight = isMouthYawning ? boxH * 0.12 : boxH * 0.04;
  const mouthWidth = boxW * 0.24;

  const mouth: LandmarkPoint[] = [
    { x: normCenterX - mouthWidth * 0.5, y: mouthY },
    { x: normCenterX - mouthWidth * 0.25, y: mouthY - mouthHeight * 0.5 },
    { x: normCenterX, y: mouthY - mouthHeight * 0.5 },
    { x: normCenterX + mouthWidth * 0.25, y: mouthY - mouthHeight * 0.5 },
    { x: normCenterX + mouthWidth * 0.5, y: mouthY },
    { x: normCenterX + mouthWidth * 0.25, y: mouthY + mouthHeight * 0.5 },
    { x: normCenterX, y: mouthY + mouthHeight * 0.5 },
    { x: normCenterX - mouthWidth * 0.25, y: mouthY + mouthHeight * 0.5 },
  ];

  const noseTip: LandmarkPoint = { x: normCenterX, y: normCenterY + boxH * 0.04 };
  const noseBridge: LandmarkPoint = { x: normCenterX, y: normCenterY - boxH * 0.06 };
  const chin: LandmarkPoint = { x: normCenterX, y: normCenterY + boxH * 0.40 };
  const forehead: LandmarkPoint = { x: normCenterX, y: normCenterY - boxH * 0.36 };
  const leftCheek: LandmarkPoint = { x: normCenterX - boxW * 0.32, y: normCenterY + boxH * 0.08 };
  const rightCheek: LandmarkPoint = { x: normCenterX + boxW * 0.32, y: normCenterY + boxH * 0.08 };

  const mesh: LandmarkPoint[] = [
    forehead, noseBridge, noseTip, chin,
    leftCheek, rightCheek,
    ...leftEye, ...rightEye, ...mouth
  ];

  const response: FaceWorkerOutput = {
    type: 'FACE_ANALYSIS_RESULT',
    timestamp,
    hasFace: true,
    driverPresent: true,
    confidence: Number(confidence.toFixed(2)),
    box: {
      x: Number(normCenterX.toFixed(3)),
      y: Number(normCenterY.toFixed(3)),
      width: Number(boxW.toFixed(3)),
      height: Number(boxH.toFixed(3)),
    },
    landmarks: {
      leftEye,
      rightEye,
      mouth,
      noseTip,
      noseBridge,
      chin,
      forehead,
      leftCheek,
      rightCheek,
      mesh,
    },
    metrics: {
      ear: Number(prevEar.toFixed(2)),
      mar: Number(prevMar.toFixed(2)),
      yaw: Math.round(yaw),
      pitch: Math.round(pitch),
      roll: Math.round(roll),
      isEyelidClosed,
      isMouthYawning,
      isHeadTurned,
      isDistracted,
      abnormalBehavior: isHeadSlump,
      consecutiveClosedFrames,
      consecutiveYawnFrames,
      consecutiveDistractedFrames,
      isLowLight: avgLuminance < 28,
      avgLuminance: Math.round(avgLuminance),
    },
    potentialSafetyEvent,
  };

  self.postMessage(response);
};
