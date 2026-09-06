// High-Precision Automotive DMS Computer Vision & Biometric Telematics Renderer
// ISO 26262 ASIL-B / SAE J3016 Engineering Test Bench Visualization

export interface Landmark2D {
  x: number;
  y: number;
}

export interface SignalSample {
  ear: number;
  mar: number;
  timestamp: number;
}

/**
 * Generate 68 standard Dlib / ISO 19794 facial biometric landmark coordinates
 * mathematically parameterized by bounding box, yaw, pitch, roll, EAR, and MAR.
 */
export function compute68Landmarks(
  cx: number,
  cy: number,
  w: number,
  h: number,
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
  ear: number,
  mar: number
): Landmark2D[] {
  const pts: Landmark2D[] = [];
  const yawRad = (yawDeg * Math.PI) / 180;
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const rollRad = (rollDeg * Math.PI) / 180;

  const cosR = Math.cos(rollRad);
  const sinR = Math.sin(rollRad);

  // Rotation and offset transform helper
  const tr = (rx: number, ry: number): Landmark2D => {
    // 3D perspective shift based on yaw & pitch
    const persX = rx + yawRad * (w * 0.18) * (1 - Math.abs(ry) / (h * 0.5));
    const persY = ry + pitchRad * (h * 0.14);
    // 2D roll rotation
    const rotX = persX * cosR - persY * sinR;
    const rotY = persX * sinR + persY * cosR;
    return {
      x: cx + rotX,
      y: cy + rotY,
    };
  };

  // 1. Jawline (Points 0 to 16) - 17 points
  const jawWidths = [0.46, 0.44, 0.42, 0.39, 0.35, 0.30, 0.24, 0.14, 0.0, -0.14, -0.24, -0.30, -0.35, -0.39, -0.42, -0.44, -0.46];
  const jawHeights = [-0.10, 0.02, 0.14, 0.25, 0.34, 0.41, 0.46, 0.48, 0.49, 0.48, 0.46, 0.41, 0.34, 0.25, 0.14, 0.02, -0.10];
  for (let i = 0; i < 17; i++) {
    pts.push(tr(w * jawWidths[i], h * jawHeights[i]));
  }

  // 2. Right Eyebrow (Points 17 to 21) - anatomical driver left / HUD right
  const rBrowX = [0.36, 0.30, 0.22, 0.15, 0.08];
  const rBrowY = [-0.20, -0.23, -0.24, -0.23, -0.21];
  for (let i = 0; i < 5; i++) {
    pts.push(tr(w * rBrowX[i], h * rBrowY[i]));
  }

  // 3. Left Eyebrow (Points 22 to 26) - anatomical driver right / HUD left
  const lBrowX = [-0.08, -0.15, -0.22, -0.30, -0.36];
  const lBrowY = [-0.21, -0.23, -0.24, -0.23, -0.20];
  for (let i = 0; i < 5; i++) {
    pts.push(tr(w * lBrowX[i], h * lBrowY[i]));
  }

  // 4. Nose Bridge (Points 27 to 30)
  pts.push(tr(0, -h * 0.16));
  pts.push(tr(0, -h * 0.09));
  pts.push(tr(0, -h * 0.02));
  pts.push(tr(0, h * 0.05)); // Point 30: Nose Tip (Origin for 3D Pose PnP)

  // 5. Nose Base & Nostrils (Points 31 to 35)
  pts.push(tr(-w * 0.09, h * 0.08));
  pts.push(tr(-w * 0.04, h * 0.09));
  pts.push(tr(0, h * 0.095));
  pts.push(tr(w * 0.04, h * 0.09));
  pts.push(tr(w * 0.09, h * 0.08));

  // 6. Right Eye (Points 36 to 41) - HUD Left / Driver Right Eye
  // Modulated by instantaneous EAR
  const rEyeCenterX = -w * 0.20;
  const eyeCenterY = -h * 0.12;
  const eyeHalfW = w * 0.07;
  const eyeAperture = Math.max(0.5, Math.min(12, ear * 28));

  pts.push(tr(rEyeCenterX - eyeHalfW, eyeCenterY)); // 36: Outer Corner
  pts.push(tr(rEyeCenterX - eyeHalfW * 0.45, eyeCenterY - eyeAperture)); // 37: Upper Lid 1
  pts.push(tr(rEyeCenterX + eyeHalfW * 0.45, eyeCenterY - eyeAperture)); // 38: Upper Lid 2
  pts.push(tr(rEyeCenterX + eyeHalfW, eyeCenterY)); // 39: Inner Corner
  pts.push(tr(rEyeCenterX + eyeHalfW * 0.45, eyeCenterY + eyeAperture * 0.8)); // 40: Lower Lid 2
  pts.push(tr(rEyeCenterX - eyeHalfW * 0.45, eyeCenterY + eyeAperture * 0.8)); // 41: Lower Lid 1

  // 7. Left Eye (Points 42 to 47) - HUD Right / Driver Left Eye
  const lEyeCenterX = w * 0.20;
  pts.push(tr(lEyeCenterX - eyeHalfW, eyeCenterY)); // 42: Inner Corner
  pts.push(tr(lEyeCenterX - eyeHalfW * 0.45, eyeCenterY - eyeAperture)); // 43: Upper Lid 1
  pts.push(tr(lEyeCenterX + eyeHalfW * 0.45, eyeCenterY - eyeAperture)); // 44: Upper Lid 2
  pts.push(tr(lEyeCenterX + eyeHalfW, eyeCenterY)); // 45: Outer Corner
  pts.push(tr(lEyeCenterX + eyeHalfW * 0.45, eyeCenterY + eyeAperture * 0.8)); // 46: Lower Lid 2
  pts.push(tr(lEyeCenterX - eyeHalfW * 0.45, eyeCenterY + eyeAperture * 0.8)); // 47: Lower Lid 1

  // 8. Outer Lips (Points 48 to 59)
  const mouthCenterY = h * 0.24;
  const mouthHalfW = w * 0.15;
  const lipAperture = Math.max(2, Math.min(22, mar * 32));

  pts.push(tr(-mouthHalfW, mouthCenterY)); // 48
  pts.push(tr(-mouthHalfW * 0.6, mouthCenterY - lipAperture * 0.4 - 2)); // 49
  pts.push(tr(-mouthHalfW * 0.25, mouthCenterY - lipAperture * 0.5 - 3)); // 50
  pts.push(tr(0, mouthCenterY - lipAperture * 0.45 - 2)); // 51
  pts.push(tr(mouthHalfW * 0.25, mouthCenterY - lipAperture * 0.5 - 3)); // 52
  pts.push(tr(mouthHalfW * 0.6, mouthCenterY - lipAperture * 0.4 - 2)); // 53
  pts.push(tr(mouthHalfW, mouthCenterY)); // 54
  pts.push(tr(mouthHalfW * 0.6, mouthCenterY + lipAperture * 0.5 + 3)); // 55
  pts.push(tr(mouthHalfW * 0.25, mouthCenterY + lipAperture * 0.6 + 4)); // 56
  pts.push(tr(0, mouthCenterY + lipAperture * 0.65 + 4)); // 57
  pts.push(tr(-mouthHalfW * 0.25, mouthCenterY + lipAperture * 0.6 + 4)); // 58
  pts.push(tr(-mouthHalfW * 0.6, mouthCenterY + lipAperture * 0.5 + 3)); // 59

  // 9. Inner Lips (Points 60 to 67) - Directly measures Mouth Aspect Ratio (MAR)
  const innerAperture = Math.max(0.5, Math.min(18, (mar - 0.10) * 32));
  pts.push(tr(-mouthHalfW * 0.75, mouthCenterY)); // 60
  pts.push(tr(-mouthHalfW * 0.3, mouthCenterY - innerAperture * 0.5)); // 61
  pts.push(tr(0, mouthCenterY - innerAperture * 0.6)); // 62
  pts.push(tr(mouthHalfW * 0.3, mouthCenterY - innerAperture * 0.5)); // 63
  pts.push(tr(mouthHalfW * 0.75, mouthCenterY)); // 64
  pts.push(tr(mouthHalfW * 0.3, mouthCenterY + innerAperture * 0.6)); // 65
  pts.push(tr(0, mouthCenterY + innerAperture * 0.7)); // 66
  pts.push(tr(-mouthHalfW * 0.3, mouthCenterY + innerAperture * 0.6)); // 67

  return pts;
}

/**
 * Render ISO 12233 Optical Calibration Grid & Sensor Bench
 * Used when camera is in synthetic validation mode or initializing.
 */
export function renderOpticalTestBench(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number
): void {
  // Deep industrial slate optical background
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, W, H);

  // 20px Minor Engineering Grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x += 20) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y < H; y += 20) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // 100px Major Graduation Grid with Sub-Pixel Ticks
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x += 100) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y < H; y += 100) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Optical Center Boresight Crosshair (CX, CY)
  const cx = W * 0.5;
  const cy = H * 0.5;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Concentric Radial Calibration Rings (FOV Calibration)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
  ctx.lineWidth = 1;
  [40, 80, 130, 180, 240].forEach(r => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Degree graduation marks on 130px ring
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  [0, 45, 90, 135, 180, 225, 270, 315].forEach(deg => {
    const rad = (deg * Math.PI) / 180;
    const gx = cx + Math.cos(rad) * 136;
    const gy = cy + Math.sin(rad) * 136;
    ctx.fillText(`${deg}°`, gx, gy + 2.5);
  });

  // 4 Corner Alignment Fiducials
  const fidLen = 14;
  const fidMargin = 16;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;

  // TL
  ctx.beginPath();
  ctx.moveTo(fidMargin, fidMargin + fidLen);
  ctx.lineTo(fidMargin, fidMargin);
  ctx.lineTo(fidMargin + fidLen, fidMargin);
  ctx.stroke();

  // TR
  ctx.beginPath();
  ctx.moveTo(W - fidMargin - fidLen, fidMargin);
  ctx.lineTo(W - fidMargin, fidMargin);
  ctx.lineTo(W - fidMargin, fidMargin + fidLen);
  ctx.stroke();

  // BL
  ctx.beginPath();
  ctx.moveTo(fidMargin, H - fidMargin - fidLen);
  ctx.lineTo(fidMargin, H - fidMargin);
  ctx.lineTo(fidMargin + fidLen, H - fidMargin);
  ctx.stroke();

  // BR
  ctx.beginPath();
  ctx.moveTo(W - fidMargin - fidLen, H - fidMargin);
  ctx.lineTo(W - fidMargin, H - fidMargin);
  ctx.lineTo(W - fidMargin, H - fidMargin - fidLen);
  ctx.stroke();

  // Sensor Specifications Banner (Authentic Automotive Test Bench)
  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('OPTICAL BENCH: V4L2_SYNTHETIC_BAYER [640x480 RAW12]', fidMargin + 4, H - fidMargin - 4);
  ctx.textAlign = 'right';
  ctx.fillText('CALIBRATION: ISO 26262 ASIL-B TARGET [60.0 FPS]', W - fidMargin - 4, H - fidMargin - 4);
}

/**
 * Render Standard 68-Point Biometric Facial Landmark Mesh
 * Sub-pixel vertices with technical wireframe topology lines.
 */
export function render68LandmarkMesh(
  ctx: CanvasRenderingContext2D,
  pts: Landmark2D[],
  primaryColor: string,
  isClosed: boolean,
  isYawn: boolean
): void {
  if (pts.length < 68) return;

  ctx.save();

  // Helper for drawing connected polyline segments
  const drawSegment = (startIdx: number, endIdx: number, closed = false, strokeColor?: string) => {
    ctx.strokeStyle = strokeColor || `${primaryColor}40`; // 25% opacity
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(pts[startIdx].x, pts[startIdx].y);
    for (let i = startIdx + 1; i <= endIdx; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (closed) ctx.closePath();
    ctx.stroke();
  };

  // 1. Jawline (0 to 16)
  drawSegment(0, 16, false);

  // 2. Right Eyebrow (17 to 21)
  drawSegment(17, 21, false);

  // 3. Left Eyebrow (22 to 26)
  drawSegment(22, 26, false);

  // 4. Nose Bridge (27 to 30)
  drawSegment(27, 30, false);

  // 5. Nose Base (31 to 35)
  drawSegment(31, 35, true);

  // 6. Right Eye (36 to 41)
  const eyeStroke = isClosed ? '#ef4444' : primaryColor;
  drawSegment(36, 41, true, eyeStroke);
  // EAR Vertical Chords (P37-P41, P38-P40)
  ctx.strokeStyle = `${eyeStroke}80`;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(pts[37].x, pts[37].y); ctx.lineTo(pts[41].x, pts[41].y);
  ctx.moveTo(pts[38].x, pts[38].y); ctx.lineTo(pts[40].x, pts[40].y);
  ctx.stroke();

  // 7. Left Eye (42 to 47)
  drawSegment(42, 47, true, eyeStroke);
  // EAR Vertical Chords (P43-P47, P44-P46)
  ctx.beginPath();
  ctx.moveTo(pts[43].x, pts[43].y); ctx.lineTo(pts[47].x, pts[47].y);
  ctx.moveTo(pts[44].x, pts[44].y); ctx.lineTo(pts[46].x, pts[46].y);
  ctx.stroke();

  // 8. Outer Lips (48 to 59)
  drawSegment(48, 59, true);

  // 9. Inner Lips (60 to 67)
  const mouthStroke = isYawn ? '#f59e0b' : `${primaryColor}60`;
  drawSegment(60, 67, true, mouthStroke);
  if (isYawn) {
    // MAR Vertical Chord (P62-P66)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pts[62].x, pts[62].y);
    ctx.lineTo(pts[66].x, pts[66].y);
    ctx.stroke();
  }

  // Draw Sub-Pixel Landmark Vertex Dots
  ctx.fillStyle = primaryColor;
  for (let i = 0; i < 68; i++) {
    const pt = pts[i];
    ctx.beginPath();
    // Critical eye/mouth landmarks get slightly brighter vertices
    if (i >= 36 && i <= 47) {
      ctx.fillStyle = isClosed ? '#ef4444' : '#38bdf8';
      ctx.arc(pt.x, pt.y, 1.4, 0, Math.PI * 2);
    } else if (i >= 60 && i <= 67) {
      ctx.fillStyle = isYawn ? '#f59e0b' : '#38bdf8';
      ctx.arc(pt.x, pt.y, 1.4, 0, Math.PI * 2);
    } else if (i === 30) {
      // Nose tip anchor gets highlight
      ctx.fillStyle = '#ffffff';
      ctx.arc(pt.x, pt.y, 2.0, 0, Math.PI * 2);
    } else {
      ctx.fillStyle = `${primaryColor}aa`;
      ctx.arc(pt.x, pt.y, 1.1, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Render 3D Perspective-n-Point (solvePnP) Head Pose Coordinate Triad
 * Originates at Nose Tip (Point 30) with orthogonal Pitch, Yaw, and Boresight vectors.
 */
export function render3DHeadPosePnP(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  pitchDeg: number,
  yawDeg: number,
  rollDeg: number
): void {
  ctx.save();

  const pitchRad = (pitchDeg * Math.PI) / 180;
  const yawRad = (yawDeg * Math.PI) / 180;
  const rollRad = (rollDeg * Math.PI) / 180;

  const axisLength = 36;

  // 1. X-Axis (Pitch / Lateral Vector, Red)
  const xEnd_X = originX + Math.cos(yawRad) * Math.cos(rollRad) * axisLength;
  const xEnd_Y = originY + Math.sin(rollRad) * axisLength;

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(xEnd_X, xEnd_Y);
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('+X (PITCH)', xEnd_X + 4, xEnd_Y + 3);

  // 2. Y-Axis (Yaw / Vertical Vector, Green)
  const yEnd_X = originX - Math.sin(yawRad) * Math.sin(pitchRad) * axisLength;
  const yEnd_Y = originY - Math.cos(pitchRad) * axisLength;

  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(yEnd_X, yEnd_Y);
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.fillText('+Y (YAW)', yEnd_X - 18, yEnd_Y - 4);

  // 3. Z-Axis (Optical Normal / Boresight Vector, Cyan)
  const zLength = 48;
  const zEnd_X = originX + Math.sin(yawRad) * zLength;
  const zEnd_Y = originY + Math.sin(pitchRad) * zLength;

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(zEnd_X, zEnd_Y);
  ctx.stroke();

  // Boresight Arrowhead
  const arrowAngle = Math.atan2(zEnd_Y - originY, zEnd_X - originX);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(zEnd_X, zEnd_Y);
  ctx.lineTo(zEnd_X - 7 * Math.cos(arrowAngle - 0.4), zEnd_Y - 7 * Math.sin(arrowAngle - 0.4));
  ctx.lineTo(zEnd_X - 7 * Math.cos(arrowAngle + 0.4), zEnd_Y - 7 * Math.sin(arrowAngle + 0.4));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.fillText('+Z (BORESIGHT)', zEnd_X + 6, zEnd_Y + 4);

  ctx.restore();
}

/**
 * Render Gaze Vector Ray from Driver Eyes to Cabin Boresight
 */
export function renderGazeVector(
  ctx: CanvasRenderingContext2D,
  eyeCenterX: number,
  eyeCenterY: number,
  yawDeg: number,
  pitchDeg: number,
  isDistracted: boolean
): void {
  ctx.save();

  const rayLen = 50;
  const targetX = eyeCenterX + (yawDeg * 2.2);
  const targetY = eyeCenterY - rayLen + (pitchDeg * 1.5);

  const gazeColor = isDistracted ? '#f59e0b' : '#38bdf8';
  const depAngle = Math.sqrt(yawDeg * yawDeg + pitchDeg * pitchDeg);

  ctx.strokeStyle = gazeColor;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(eyeCenterX, eyeCenterY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Reticle at gaze target
  ctx.strokeStyle = gazeColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 4.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = gazeColor;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    isDistracted ? `OFF-AXIS θ:${depAngle.toFixed(1)}°` : `GAZE: ROADWAY θ:${depAngle.toFixed(1)}°`,
    targetX,
    targetY - 7
  );

  ctx.restore();
}

/**
 * Render Real-Time Rolling Signal Oscilloscope Strip
 * High-speed telemetry buffer showing continuous EAR(t) and MAR(t) signals vs safety thresholds.
 */
export function renderOscilloscope(
  ctx: CanvasRenderingContext2D,
  history: SignalSample[],
  W: number,
  H: number,
  earThresh: number,
  marThresh: number
): void {
  if (history.length < 2) return;

  ctx.save();

  const oscH = 46;
  const oscMargin = 10;
  const oscW = W - (oscMargin * 2);
  const oscX = oscMargin;
  const oscY = H - oscH - 12;

  // Oscilloscope dark frosted viewport
  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(oscX, oscY, oscW, oscH, 4);
  ctx.fill();
  ctx.stroke();

  // Internal Time Divisions (Dashed Grid)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 4]);
  for (let i = 1; i <= 5; i++) {
    const gx = oscX + (oscW * (i / 6));
    ctx.beginPath();
    ctx.moveTo(gx, oscY);
    ctx.lineTo(gx, oscY + oscH);
    ctx.stroke();
  }

  // Baseline mid-divider
  const midY = oscY + oscH * 0.5;
  ctx.beginPath();
  ctx.moveTo(oscX, midY);
  ctx.lineTo(oscX + oscW, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // EAR Critical Threshold Line (Red Dashed)
  const normEarThreshY = oscY + oscH * (1 - Math.min(1, Math.max(0, earThresh / 0.50)));
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(oscX, normEarThreshY);
  ctx.lineTo(oscX + oscW, normEarThreshY);
  ctx.stroke();

  // MAR Yawn Threshold Line (Amber Dashed)
  const normMarThreshY = oscY + oscH * (1 - Math.min(1, Math.max(0, marThresh / 0.85)));
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
  ctx.beginPath();
  ctx.moveTo(oscX, normMarThreshY);
  ctx.lineTo(oscX + oscW, normMarThreshY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Continuous Trace 1: EAR (Cyan)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < history.length; i++) {
    const sample = history[i];
    const x = oscX + (i / (history.length - 1)) * oscW;
    const y = oscY + oscH * (1 - Math.min(1, Math.max(0, sample.ear / 0.50)));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Continuous Trace 2: MAR (Amber)
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < history.length; i++) {
    const sample = history[i];
    const x = oscX + (i / (history.length - 1)) * oscW;
    const y = oscY + oscH * (1 - Math.min(1, Math.max(0, sample.mar / 0.85)));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Oscilloscope Telemetry Legend Header
  const latestSample = history[history.length - 1];
  ctx.fillStyle = '#94a3b8';
  ctx.font = '7.5px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('OSC CH1: EAR [0-0.50]  CH2: MAR [0-0.85]', oscX + 6, oscY + 9);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`EAR: ${latestSample.ear.toFixed(3)} [TH: ${earThresh.toFixed(2)}]`, oscX + oscW - 110, oscY + 9);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`MAR: ${latestSample.mar.toFixed(3)} [TH: ${marThresh.toFixed(2)}]`, oscX + oscW - 6, oscY + 9);

  ctx.restore();
}

/**
 * Render Sub-Pixel Automotive Engineering Bounding Box
 */
export function renderSubpixelBBox(
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  primaryColor: string,
  confidence: number,
  yaw: number,
  pitch: number,
  ear: number,
  mar: number
): void {
  ctx.save();

  // 1px Technical Chamfer Corner Brackets
  const bLen = 16;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1.5;

  // TL
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + bLen); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + bLen, boxY);
  ctx.stroke();
  // TR
  ctx.beginPath();
  ctx.moveTo(boxX + boxW - bLen, boxY); ctx.lineTo(boxX + boxW, boxY); ctx.lineTo(boxX + boxW, boxY + bLen);
  ctx.stroke();
  // BL
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + boxH - bLen); ctx.lineTo(boxX, boxY + boxH); ctx.lineTo(boxX + bLen, boxY + boxH);
  ctx.stroke();
  // BR
  ctx.beginPath();
  ctx.moveTo(boxX + boxW - bLen, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH - bLen);
  ctx.stroke();

  // Top Sub-Pixel Coordinate Tag
  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.strokeStyle = `${primaryColor}60`;
  ctx.lineWidth = 1;
  const tagW = 210;
  const tagH = 15;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY - tagH - 3, tagW, tagH, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `BBOX [${boxX.toFixed(1)}, ${boxY.toFixed(1)}, ${boxW.toFixed(1)}, ${boxH.toFixed(1)}] CONF:${confidence.toFixed(2)}`,
    boxX + 5,
    boxY - 5
  );

  ctx.restore();
}
