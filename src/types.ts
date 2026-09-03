export type AlertLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface DriverState {
  isMonitoring: boolean;
  driverPresent: boolean;
  drowsinessLevel: number; // 0 to 100
  safetyScore: number; // 0 to 100 (real-time driver safety rating)
  ear: number; // Eye Aspect Ratio (0.0 to 0.4, < 0.20 means closed)
  mar: number; // Mouth Aspect Ratio (yawning)
  headTilt: number; // Distraction degree
  eyesClosed: boolean;
  isYawning: boolean;
  isDistracted: boolean;
  isUsingPhone: boolean;
  abnormalBehavior: boolean; // Slumped posture, nodding off, erratic head movement
  alertLevel: AlertLevel;
  lastAiMessage: string;
  lastEventTrigger?: string;
  aiConfigured?: boolean;
  yawnCount: number;
  microSleepCount: number;
  distractionCount: number;
}

export interface GeminiFrameAnalysisResult {
  driverDetected: boolean;
  attention: 'focused' | 'distracted' | 'inattentive';
  drowsiness: 'low' | 'medium' | 'high';
  eyes: 'open' | 'closed' | 'drooping';
  yawning: boolean;
  distraction: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  message: string;
  configured?: boolean;
}

export type GpsStatus = 'loading' | 'active' | 'denied' | 'unavailable';

export interface SpeedData {
  currentSpeedKmh: number | null;
  currentSpeed?: number | null;
  isSpeedAvailable: boolean;
  speedLimitKmh: number;
  isOverSpeed: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  heading: number | null;
  locationName: string;
  gpsStatus: GpsStatus;
  gpsErrorMessage?: string | null;
  speedSource: 'gps' | 'manual' | 'none';
  lastGpsUpdate?: number;
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

export type CabinLightHardwareStatus = 'connected' | 'off' | 'unavailable';

export interface CabinLightHardwareInfo {
  protocol: 'CAN_BUS' | 'BLE_SMART_LIGHT' | 'OBD2_BRIDGE' | 'NONE';
  deviceName?: string;
  connectionType?: 'Bluetooth LE' | 'Web Serial (CAN/OBD-II)' | 'WebSocket Gateway' | 'None';
  connectedAt?: number;
  lastCommandAck?: string;
}

export interface CabinLightConfig {
  hardwareStatus: CabinLightHardwareStatus;
  isEnabled: boolean;
  mode: 'alertness_cyan' | 'pulse_wave' | 'emergency_strobe' | 'sunset_amber';
  intensity: number; // 0 - 100
  colorHex: string;
  autoStrobeOnAlert: boolean;
  strobeSpeedHz: number;
  hardwareInfo: CabinLightHardwareInfo;
}

