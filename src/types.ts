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

export interface SMSDispatchLog {
  id: string;
  timestamp: string;
  recipientPhone: string;
  recipientName: string;
  isIndianNumber: boolean;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  triggerReason: string;
  location: string;
  gpsCoords: string;
  gateway: string;
  messagePreview: string;
  messageId: string;
}

export interface SMSGatewayConfig {
  autoDispatchOnHighSeverity: boolean;
  provider: 'auto_indian' | 'fast2sms' | 'msg91' | 'twilio_india';
  cooldownSeconds: number;
  sendWhatsAppDirect: boolean;
  includeGpsTrackingLink: boolean;
}

export interface RestStop {
  id: string;
  name: string;
  category: 'rest_area' | 'coffee' | 'diner' | 'fuel_ev';
  distanceMiles: number;
  etaMinutes: number;
  rating: number;
  address: string;
  amenities: string[];
  lat: number;
  lng: number;
  isOpen24Hours: boolean;
  phone?: string;
}

export interface IncidentClip {
  id: string;
  timestamp: string;
  reason: 'micro_sleep' | 'severe_fatigue' | 'distraction' | 'manual_capture';
  durationSeconds: number;
  earAtIncident: number;
  speedKmh: number;
  location: string;
  thumbnailUrl: string;
  videoBlobUrl?: string;
}

export interface CircadianPoint {
  hour: number;
  label: string;
  baselineAlertness: number; // 0 - 100
  isGraveyardZone: boolean;
  isPostLunchDip: boolean;
  currentRiskFactor: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CabinLightConfig {
  isEnabled: boolean;
  mode: 'alertness_cyan' | 'pulse_wave' | 'emergency_strobe' | 'sunset_amber';
  intensity: number; // 0 - 100
  autoStrobeOnAlert: boolean;
  strobeSpeedHz: number;
}

