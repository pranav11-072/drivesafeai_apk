export type AlertLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface DriverState {
  isMonitoring: boolean;
  drowsinessLevel: number; // 0 to 100
  ear: number; // Eye Aspect Ratio (0.0 to 0.4, < 0.20 means closed)
  mar: number; // Mouth Aspect Ratio (yawning)
  headTilt: number; // Distraction degree
  eyesClosed: boolean;
  isYawning: boolean;
  isDistracted: boolean;
  isUsingPhone: boolean;
  alertLevel: AlertLevel;
  lastAiMessage: string;
  yawnCount: number;
  microSleepCount: number;
  distractionCount: number;
}

export interface SpeedData {
  currentSpeedKmh: number;
  speedLimitKmh: number;
  isOverSpeed: boolean;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
}

export interface TripRecord {
  id: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  drowsinessAlertsCount: number;
  safetyScore: number; // 0 - 100
  aiSummary?: string;
}

export interface AndroidBuildConfig {
  appId: string;
  appName: string;
  versionName: string;
  versionCode: number;
  permissions: string[];
}
