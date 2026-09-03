import { DriverState, SpeedData } from '../types';

export interface FactorDetail {
  id: string;
  name: string;
  isAvailable: boolean;
  deduction: number;
  status: 'safe' | 'caution' | 'critical' | 'unavailable';
  summary: string;
  valueDescription?: string;
}

export interface SafetyRatingInputs {
  driverState: DriverState;
  speedData?: SpeedData | null;
  drivingDurationSeconds?: number;
  harshEventsCount?: number;
}

export interface SafetyRatingResult {
  score: number;
  displayScore: string; // e.g. "87 / 100"
  tier: 'SAFE DRIVING' | 'MODERATE RISK' | 'HIGH RISK';
  tierColor: string;
  tierBg: string;
  tierBorder: string;
  badgeGlow: string;
  factors: FactorDetail[];
  availableFactorsCount: number;
  totalDeductions: number;
}

/**
 * Calculates real-time Driving Safety Rating (0-100) strictly from available real signals.
 * Does NOT fabricate missing data.
 * Missing sensors (e.g. GPS offline) are completely excluded from deductions.
 */
export function calculateSafetyRating({
  driverState,
  speedData,
  drivingDurationSeconds = 0,
  harshEventsCount = 0,
}: SafetyRatingInputs): SafetyRatingResult {
  const factors: FactorDetail[] = [];
  let totalDeductions = 0;

  // 1. DROWSINESS (Available if driver is monitoring and face is detected)
  const isDrowsinessAvailable = driverState.isMonitoring && driverState.driverPresent;
  if (isDrowsinessAvailable) {
    let drowsinessDeduction = 0;
    drowsinessDeduction += (driverState.microSleepCount || 0) * 15;
    drowsinessDeduction += (driverState.yawnCount || 0) * 4;

    if (driverState.eyesClosed || driverState.drowsinessLevel > 60) {
      drowsinessDeduction += 20;
    } else if (driverState.isYawning || driverState.drowsinessLevel > 30) {
      drowsinessDeduction += 8;
    }

    // Cap drowsiness deduction
    drowsinessDeduction = Math.min(45, drowsinessDeduction);
    totalDeductions += drowsinessDeduction;

    factors.push({
      id: 'drowsiness',
      name: 'Drowsiness & Eyelid Closure',
      isAvailable: true,
      deduction: drowsinessDeduction,
      status: drowsinessDeduction >= 20 ? 'critical' : drowsinessDeduction > 0 ? 'caution' : 'safe',
      summary: drowsinessDeduction === 0 ? 'Alert & Attentive' : `${driverState.drowsinessLevel}% drowsiness index`,
      valueDescription: `${driverState.microSleepCount} micro-sleeps, ${driverState.yawnCount} yawns`,
    });
  } else {
    factors.push({
      id: 'drowsiness',
      name: 'Drowsiness',
      isAvailable: false,
      deduction: 0,
      status: 'unavailable',
      summary: driverState.isMonitoring ? 'No Driver Detected' : 'Monitoring Inactive',
    });
  }

  // 2. DISTRACTION (Available if face is detected)
  const isDistractionAvailable = driverState.isMonitoring && driverState.driverPresent;
  if (isDistractionAvailable) {
    let distractionDeduction = 0;
    distractionDeduction += (driverState.distractionCount || 0) * 8;
    if (driverState.isDistracted) distractionDeduction += 10;
    if (driverState.isUsingPhone) distractionDeduction += 15;

    distractionDeduction = Math.min(30, distractionDeduction);
    totalDeductions += distractionDeduction;

    factors.push({
      id: 'distraction',
      name: 'Distraction & Gaze Tracking',
      isAvailable: true,
      deduction: distractionDeduction,
      status: distractionDeduction >= 15 ? 'critical' : distractionDeduction > 0 ? 'caution' : 'safe',
      summary: distractionDeduction === 0 ? 'Forward Road Focus' : 'Driver Looking Away',
      valueDescription: `${driverState.distractionCount} distraction events`,
    });
  } else {
    factors.push({
      id: 'distraction',
      name: 'Distraction',
      isAvailable: false,
      deduction: 0,
      status: 'unavailable',
      summary: 'Face tracking inactive',
    });
  }

  // 3. SPEED (ONLY available if GPS is active and speed is numeric)
  const isSpeedAvailable = Boolean(
    speedData &&
    speedData.isSpeedAvailable &&
    speedData.currentSpeedKmh !== null &&
    speedData.currentSpeedKmh >= 0
  );

  if (isSpeedAvailable && speedData && speedData.currentSpeedKmh !== null) {
    let speedDeduction = 0;
    const speed = speedData.currentSpeedKmh;
    const limit = speedData.speedLimitKmh || 60;
    const overage = speed - limit;

    if (overage > 15) {
      speedDeduction = 20; // Severe overspeeding
    } else if (overage > 0) {
      speedDeduction = 10; // Moderate overspeeding
    }

    totalDeductions += speedDeduction;

    factors.push({
      id: 'speed',
      name: 'Speed & Limit Compliance',
      isAvailable: true,
      deduction: speedDeduction,
      status: speedDeduction >= 20 ? 'critical' : speedDeduction > 0 ? 'caution' : 'safe',
      summary: speedDeduction > 0 ? `${Math.round(overage)} km/h over limit` : 'Within Speed Limit',
      valueDescription: `${Math.round(speed)} / ${limit} km/h`,
    });
  } else {
    // Speed metric is unavailable - do NOT fabricate or deduct
    factors.push({
      id: 'speed',
      name: 'Speed Compliance',
      isAvailable: false,
      deduction: 0,
      status: 'unavailable',
      summary: 'GPS Speed Unavailable (Excluded)',
      valueDescription: speedData?.gpsStatus === 'denied' ? 'Permission Denied' : 'Awaiting Satellite Fix',
    });
  }

  // 4. HARSH DRIVING EVENTS (Harsh braking, sudden swerving)
  if (harshEventsCount > 0) {
    const harshDeduction = Math.min(20, harshEventsCount * 6);
    totalDeductions += harshDeduction;
    factors.push({
      id: 'harsh',
      name: 'Harsh Driving Dynamics',
      isAvailable: true,
      deduction: harshDeduction,
      status: harshDeduction >= 12 ? 'critical' : 'caution',
      summary: `${harshEventsCount} harsh braking/steering events`,
      valueDescription: `${harshEventsCount} event(s) logged`,
    });
  } else {
    factors.push({
      id: 'harsh',
      name: 'Harsh Driving Dynamics',
      isAvailable: true,
      deduction: 0,
      status: 'safe',
      summary: 'Smooth Acceleration & Braking',
      valueDescription: '0 harsh events',
    });
  }

  // 5. DRIVING DURATION (Continuous drive fatigue factor)
  if (driverState.isMonitoring && drivingDurationSeconds > 0) {
    let durationDeduction = 0;
    if (drivingDurationSeconds >= 7200) {
      // 2+ hours of continuous driving
      durationDeduction = 12;
    } else if (drivingDurationSeconds >= 3600) {
      // 1-2 hours of continuous driving
      durationDeduction = 5;
    }
    totalDeductions += durationDeduction;

    const mins = Math.floor(drivingDurationSeconds / 60);
    factors.push({
      id: 'duration',
      name: 'Continuous Driving Duration',
      isAvailable: true,
      deduction: durationDeduction,
      status: durationDeduction >= 12 ? 'caution' : 'safe',
      summary: durationDeduction > 0 ? `${mins}m continuous drive (Break advised)` : `${mins}m driven`,
      valueDescription: `${mins} min active`,
    });
  } else {
    factors.push({
      id: 'duration',
      name: 'Driving Duration',
      isAvailable: false,
      deduction: 0,
      status: 'unavailable',
      summary: 'Standby / Trip not started',
    });
  }

  // 6. SAFETY ALERTS (Active real-time alert level)
  if (driverState.isMonitoring) {
    let alertDeduction = 0;
    if (driverState.alertLevel === 'RED') {
      alertDeduction = 20;
    } else if (driverState.alertLevel === 'YELLOW') {
      alertDeduction = 8;
    }
    totalDeductions += alertDeduction;

    factors.push({
      id: 'alerts',
      name: 'Active Telematics Alerts',
      isAvailable: true,
      deduction: alertDeduction,
      status: driverState.alertLevel === 'RED' ? 'critical' : driverState.alertLevel === 'YELLOW' ? 'caution' : 'safe',
      summary: driverState.alertLevel === 'RED' ? 'Critical Hazard Active' : driverState.alertLevel === 'YELLOW' ? 'Caution Alert Active' : 'Normal State',
      valueDescription: `Alert Level: ${driverState.alertLevel}`,
    });
  }

  // Calculate final score
  const rawScore = 100 - totalDeductions;
  const score = Math.max(10, Math.min(100, Math.round(rawScore)));

  // Tier assignment
  let tier: 'SAFE DRIVING' | 'MODERATE RISK' | 'HIGH RISK';
  let tierColor = 'text-emerald-400';
  let tierBg = 'bg-emerald-500/15';
  let tierBorder = 'border-emerald-500/30';
  let badgeGlow = 'shadow-[0_0_15px_rgba(16,185,129,0.3)]';

  if (score >= 80) {
    tier = 'SAFE DRIVING';
    tierColor = 'text-emerald-400';
    tierBg = 'bg-emerald-500/15';
    tierBorder = 'border-emerald-500/35';
    badgeGlow = 'shadow-[0_0_20px_rgba(16,185,129,0.35)]';
  } else if (score >= 60) {
    tier = 'MODERATE RISK';
    tierColor = 'text-amber-400';
    tierBg = 'bg-amber-500/15';
    tierBorder = 'border-amber-500/35';
    badgeGlow = 'shadow-[0_0_20px_rgba(245,158,11,0.35)]';
  } else {
    tier = 'HIGH RISK';
    tierColor = 'text-red-400';
    tierBg = 'bg-red-500/20';
    tierBorder = 'border-red-500/40';
    badgeGlow = 'shadow-[0_0_25px_rgba(239,68,68,0.45)]';
  }

  const availableFactorsCount = factors.filter(f => f.isAvailable).length;

  return {
    score,
    displayScore: `${score} / 100`,
    tier,
    tierColor,
    tierBg,
    tierBorder,
    badgeGlow,
    factors,
    availableFactorsCount,
    totalDeductions,
  };
}
