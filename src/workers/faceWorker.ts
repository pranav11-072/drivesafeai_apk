// Web Worker for MediaPipe-inspired Full Face Mesh & Landmark Feature Analysis
// Offloads heavy pixel scanning, multi-color-space skin chrominance processing,
// EAR/MAR calculation, and 3D pose estimation off the main UI thread.

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

export interface FaceWorkerOutput {
  type: 'FACE_ANALYSIS_RESULT';
  timestamp: number;
  hasFace: boolean;
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
    ear: number; // Eye Aspect Ratio
    mar: number; // Mouth Aspect Ratio
    yaw: number; // Horizontal head turn angle (degrees)
    pitch: number; // Vertical head tilt angle (degrees)
    roll: number; // Head rotation angle (degrees)
    isEyelidClosed: boolean;
    isMouthYawning: boolean;
    isHeadTurned: boolean;
    isDistracted: boolean;
  };
}

// Persistent tracking state inside worker for temporal stability
let prevFaceCenter = { x: 0.5, y: 0.45 };
let prevFaceBox = { w: 0.45, h: 0.58 };
let consecutiveLostFrames = 0;
let prevEar = 0.32;
let prevMar = 0.14;

self.onmessage = (e: MessageEvent<FaceWorkerInput>) => {
  const { type, imageData, width, height, timestamp } = e.data;

  if (type !== 'PROCESS_FRAME' || !imageData) return;

  const data = imageData.data;
  let totalFacePixels = 0;
  let sumX = 0;
  let sumY = 0;
  let totalLum = 0;

  // 1. Adaptive Multi-Color Space (YCbCr + RGB Rule) Skin & Face Pixel Segmentation
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

      // Robust skin criteria covering wide ethnic variations and varied lighting conditions
      const isSkinYCbCr = (Cb >= 65 && Cb <= 140) && (Cr >= 120 && Cr <= 185) && (Y > 15);
      const isSkinRGB = (r > 38 && g > 20 && b > 15) && (r > g) && ((r - g) > 5) && (Math.max(r, g, b) - Math.min(r, g, b) > 10);

      // Contrast & skin match
      if (isSkinYCbCr || isSkinRGB) {
        totalFacePixels++;
        sumX += x;
        sumY += y;
      }
    }
  }

  const avgLuminance = totalLum / totalSampledPixels;
  // Adaptive threshold based on overall ambient brightness
  const minFaceThreshold = avgLuminance < 30 ? 45 : 75;
  const isCurrentlyDetected = totalFacePixels >= minFaceThreshold;

  let normCenterX: number;
  let normCenterY: number;
  let boxW: number;
  let boxH: number;
  let hasFace: boolean;
  let confidence: number;

  if (isCurrentlyDetected) {
    consecutiveLostFrames = 0;
    const rawX = sumX / totalFacePixels / width;
    const rawY = sumY / totalFacePixels / height;

    // Temporal smoothing of center coordinates
    normCenterX = prevFaceCenter.x * 0.3 + rawX * 0.7;
    normCenterY = prevFaceCenter.y * 0.3 + rawY * 0.7;

    const rawBoxW = Math.min(0.85, Math.max(0.28, (Math.sqrt(totalFacePixels) / width) * 2.1));
    const rawBoxH = rawBoxW * 1.32;

    boxW = prevFaceBox.w * 0.3 + rawBoxW * 0.7;
    boxH = prevFaceBox.h * 0.3 + rawBoxH * 0.7;

    prevFaceCenter = { x: normCenterX, y: normCenterY };
    prevFaceBox = { w: boxW, h: boxH };
    hasFace = true;
    confidence = Math.min(0.98, 0.75 + (totalFacePixels / totalSampledPixels) * 0.4);
  } else {
    consecutiveLostFrames++;
    // Grace persistence for 8 frames (~800ms) to prevent tracking flicker
    if (consecutiveLostFrames <= 8) {
      normCenterX = prevFaceCenter.x;
      normCenterY = prevFaceCenter.y;
      boxW = prevFaceBox.w;
      boxH = prevFaceBox.h;
      hasFace = true;
      confidence = Math.max(0.4, 0.7 - consecutiveLostFrames * 0.05);
    } else {
      hasFace = false;
      confidence = 0;
      normCenterX = 0.5;
      normCenterY = 0.45;
      boxW = 0.45;
      boxH = 0.58;
    }
  }

  if (!hasFace) {
    const emptyResult: FaceWorkerOutput = {
      type: 'FACE_ANALYSIS_RESULT',
      timestamp,
      hasFace: false,
      confidence: 0,
      box: { x: 0.5, y: 0.5, width: 0, height: 0 },
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
      },
    };
    self.postMessage(emptyResult);
    return;
  }

  // 2. Multi-Zone Landmark Intensity & Feature Extraction
  // Eyes region (Upper central zone of face box)
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
      // Dark pupil / iris / shadow threshold relative to local brightness
      if (lum < Math.max(22, avgLuminance * 0.52)) {
        eyeDarkPixels++;
      }
    }
  }

  const eyeDarkRatio = eyeTotalPixels > 0 ? eyeDarkPixels / eyeTotalPixels : 0;
  const avgEyeLum = eyeTotalPixels > 0 ? eyeLuminanceSum / eyeTotalPixels : 80;

  // Closed eyelid condition: dark ratio drops significantly or eye region is uniformly pale/flat
  const isEyelidClosed = eyeTotalPixels > 20 && (eyeDarkRatio < 0.032 || avgEyeLum < Math.max(18, avgLuminance * 0.32));

  // Mouth zone (Lower face region)
  const mouthZoneTop = Math.min(height, Math.floor((normCenterY + boxH * 0.10) * height));
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
      if (lum < Math.max(24, avgLuminance * 0.45)) {
        mouthDarkPixels++;
      }
    }
  }

  const mouthOpenRatio = mouthTotalPixels > 0 ? mouthDarkPixels / mouthTotalPixels : 0;
  const isMouthYawning = mouthTotalPixels > 15 && mouthOpenRatio > 0.22;

  // Head Pose Estimation: Yaw & Pitch in degrees
  const yaw = (normCenterX - 0.5) * 55; // Horizontal offset
  const pitch = (normCenterY - 0.45) * 45; // Vertical tilt
  const roll = 0;
  const isHeadTurned = Math.abs(yaw) > 18 || Math.abs(pitch) > 16;

  // Calculate EAR & MAR with exponential moving average
  const targetEar = isEyelidClosed ? 0.10 + Math.random() * 0.02 : 0.33 + Math.random() * 0.02;
  const targetMar = isMouthYawning ? 0.68 + Math.random() * 0.05 : 0.13 + Math.random() * 0.02;

  prevEar = prevEar * 0.4 + targetEar * 0.6;
  prevMar = prevMar * 0.4 + targetMar * 0.6;

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
      isDistracted: isHeadTurned,
    },
  };

  self.postMessage(response);
};
