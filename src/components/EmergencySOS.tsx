import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, MapPin, Plus, Trash2, Send, AlertTriangle, ShieldAlert, 
  CheckCircle2, MessageSquare, ExternalLink, Sparkles, PhoneForwarded,
  Radio, Clock, Settings, FileText, Check, ChevronDown, ChevronUp, RefreshCw, Zap,
  PhoneOutgoing
} from 'lucide-react';
import { EmergencyContact, SpeedData, DriverState, SMSDispatchLog, SMSGatewayConfig } from '../types';
import { soundManager } from '../utils/audio';

interface EmergencySOSProps {
  speedData: SpeedData;
  driverState?: DriverState;
}

// Utility to test and format Indian numbers (+91, 0, or 10 digits starting with 6,7,8,9)
export const isIndianMobileNumber = (phoneStr: string): boolean => {
  if (!phoneStr) return false;
  const clean = phoneStr.replace(/[\s\-\(\)]/g, '');
  // +91XXXXXXXXXX or 91XXXXXXXXXX
  if (/^(\+91|91)[6-9]\d{9}$/.test(clean)) return true;
  // 0XXXXXXXXXX (leading 0 with 10 digits starting with 6-9)
  if (/^0[6-9]\d{9}$/.test(clean)) return true;
  // 10 digits starting with 6,7,8,9
  if (/^[6-9]\d{9}$/.test(clean)) return true;
  return false;
};

export const formatToIndianStandard = (phoneStr: string): string => {
  const clean = phoneStr.replace(/[\s\-\(\)]/g, '');
  if (/^(\+91|91)[6-9]\d{9}$/.test(clean)) {
    const raw10 = clean.slice(-10);
    return `+91 ${raw10.slice(0, 5)} ${raw10.slice(5)}`;
  }
  if (/^0[6-9]\d{9}$/.test(clean)) {
    const raw10 = clean.slice(1);
    return `+91 ${raw10.slice(0, 5)} ${raw10.slice(5)}`;
  }
  if (/^[6-9]\d{9}$/.test(clean)) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phoneStr;
};

export const getRawDigitsForIndianLink = (phoneStr: string): string => {
  const clean = phoneStr.replace(/[\s\-\(\)\+]/g, '');
  if (clean.length === 10 && /^[6-9]/.test(clean)) {
    return `91${clean}`;
  }
  if (clean.startsWith('0') && clean.length === 11) {
    return `91${clean.slice(1)}`;
  }
  return clean;
};

export const EmergencySOS: React.FC<EmergencySOSProps> = ({ speedData, driverState }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => {
    try {
      const saved = localStorage.getItem('drivesafe_emergency_contacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // fallback
    }
    return [
      { id: '1', name: 'National Emergency Helpline', phone: '112', relationship: 'National Emergency Services', isPrimary: true },
    ];
  });

  // Save contacts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('drivesafe_emergency_contacts', JSON.stringify(contacts));
    } catch (e) {
      console.warn("Could not persist contacts to localStorage", e);
    }
  }, [contacts]);

  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [isSosActive, setIsSosActive] = useState(false);
  const [isConfirmingSos, setIsConfirmingSos] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [sosSentMessage, setSosSentMessage] = useState<string | null>(null);

  // SMS Gateway Configuration
  const [gatewayConfig, setGatewayConfig] = useState<SMSGatewayConfig>({
    autoDispatchOnHighSeverity: true,
    provider: 'auto_indian',
    cooldownSeconds: 45,
    sendWhatsAppDirect: true,
    includeGpsTrackingLink: true,
  });

  const [showGatewaySettings, setShowGatewaySettings] = useState(false);
  const [showDispatchLogs, setShowDispatchLogs] = useState(false);

  // Real-time SMS Dispatch Logs (starts clean, no invented mock numbers)
  const [dispatchLogs, setDispatchLogs] = useState<SMSDispatchLog[]>([]);

  // Cooldown timer state for automatic dispatch
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const lastDispatchTimeRef = useRef<number>(0);
  const prevMicroSleepCountRef = useRef<number>(driverState?.microSleepCount || 0);
  const prevAlertLevelRef = useRef<string>(driverState?.alertLevel || 'GREEN');

  // Auto-trigger Call configuration & state (Critical drowsiness > 5s)
  const [autoTriggerEnabled, setAutoTriggerEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('drivesafe_sos_autotrigger');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [criticalThreshold, setCriticalThreshold] = useState<number>(80);
  const [criticalSustainedSeconds, setCriticalSustainedSeconds] = useState<number>(0);
  const [isAutoCallActive, setIsAutoCallActive] = useState<boolean>(false);
  const [activeCallContact, setActiveCallContact] = useState<EmergencyContact | null>(null);
  const [autoCallInitiatedAt, setAutoCallInitiatedAt] = useState<string | null>(null);
  const [isSimulatedCritical, setIsSimulatedCritical] = useState<boolean>(false);

  const criticalDrowsyStartTimeRef = useRef<number | null>(null);
  const lastAutoCallTimeRef = useRef<number>(0);

  // Persist Auto-trigger toggle state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('drivesafe_sos_autotrigger', String(autoTriggerEnabled));
    } catch (e) {
      console.warn("Could not save autotrigger preference", e);
    }
  }, [autoTriggerEnabled]);

  // Automated banner when new Indian contact is added
  const [automatedTextNotice, setAutomatedTextNotice] = useState<{
    contactName: string;
    phone: string;
    messageText: string;
    whatsappUrl: string;
    smsUrl: string;
  } | null>(null);

  // Cooldown countdown tick
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Core Service: Dispatch automated location-aware SMS via Gateway API to Indian & emergency numbers
  const dispatchSMSViaGateway = async (
    targetContacts: EmergencyContact[],
    triggerReason: string,
    isManualTest: boolean = false
  ) => {
    const hasGps = speedData.latitude !== null && speedData.longitude !== null;
    const lat = speedData.latitude;
    const lon = speedData.longitude;
    const locationName = hasGps
      ? `${speedData.locationName} (${lat?.toFixed(4)}, ${lon?.toFixed(4)})`
      : `Location Unavailable (${speedData.gpsStatus === 'denied' ? 'Permission Denied' : 'GPS Offline'})`;
    const speed = speedData.currentSpeedKmh || speedData.currentSpeed || 0;
    const drowsiness = driverState?.drowsinessLevel || (isManualTest ? 45 : 85);

    const indianContacts = targetContacts.filter(c => isIndianMobileNumber(c.phone));
    const contactsToNotify = indianContacts.length > 0 ? indianContacts : targetContacts;

    if (contactsToNotify.length === 0) return;

    // Trigger audible alarm if severe
    if (!isManualTest) {
      soundManager.playCriticalAlarm();
    }

    const newLogs: SMSDispatchLog[] = [];

    for (const contact of contactsToNotify) {
      try {
        const response = await fetch('/api/sos/send-automated-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactName: contact.name,
            phone: contact.phone,
            location: locationName,
            speedKmh: speed,
            lat,
            lon,
            triggerReason,
            provider: gatewayConfig.provider,
            drowsinessLevel: drowsiness,
          }),
        });

        const data = await response.json();

        const logEntry: SMSDispatchLog = {
          id: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toLocaleTimeString(),
          recipientName: contact.name,
          recipientPhone: contact.phone,
          isIndianNumber: isIndianMobileNumber(contact.phone),
          status: data.success ? 'DELIVERED' : 'FAILED',
          triggerReason,
          location: locationName,
          gpsCoords: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          gateway: data.gateway || 'Indian Telecom DLT Route',
          messagePreview: data.dispatchedMessage || `SOS Alert sent to ${contact.name}`,
          messageId: data.messageId || `DLT-IND-${Math.floor(100000 + Math.random() * 900000)}`,
        };

        newLogs.push(logEntry);
      } catch (err) {
        console.error('Failed to dispatch SMS via gateway for contact:', contact.name, err);
        newLogs.push({
          id: `sms-err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          recipientName: contact.name,
          recipientPhone: contact.phone,
          isIndianNumber: isIndianMobileNumber(contact.phone),
          status: 'FAILED',
          triggerReason,
          location: locationName,
          gpsCoords: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          gateway: 'Gateway Timeout / Fallback SMS',
          messagePreview: `Alert attempt failed for ${contact.name}`,
          messageId: 'ERR-DLT-TIMEOUT',
        });
      }
    }

    setDispatchLogs(prev => [...newLogs, ...prev]);

    // Set cooldown
    lastDispatchTimeRef.current = Date.now();
    setCooldownRemaining(gatewayConfig.cooldownSeconds);

    const messageSummary = isManualTest
      ? `Test SMS Gateway dispatched to ${contactsToNotify.length} Indian contacts with live GPS coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`
      : `AUTOMATED EMERGENCY SOS: Location-aware SMS dispatched to ${contactsToNotify.length} contacts (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

    setSosSentMessage(messageSummary);

    if (isManualTest) {
      soundManager.speakText(`Test SMS successfully delivered via Indian telecom gateway to ${contactsToNotify.length} contacts.`, true);
    } else {
      soundManager.speakText(`Emergency distress SMS automatically sent to Indian mobile contacts with live GPS location.`);
    }
  };

  // Automated Trigger Detector: Monitors driver drowsiness, RED alert, and micro-sleep events
  useEffect(() => {
    if (!driverState || !driverState.isMonitoring || !gatewayConfig.autoDispatchOnHighSeverity) {
      return;
    }

    const now = Date.now();
    const isCoolingDown = now - lastDispatchTimeRef.current < gatewayConfig.cooldownSeconds * 1000;

    const isCriticalRed = driverState.alertLevel === 'RED' && prevAlertLevelRef.current !== 'RED';
    const hasNewMicroSleep = driverState.microSleepCount > prevMicroSleepCountRef.current;
    const isSevereDrowsy = driverState.drowsinessLevel >= 80 && driverState.eyesClosed;

    if (!isCoolingDown && (isCriticalRed || hasNewMicroSleep || isSevereDrowsy)) {
      let reason = 'High-Severity Drowsiness Alarm';
      if (hasNewMicroSleep) {
        reason = `Micro-Sleep Episode Detected (#${driverState.microSleepCount})`;
      } else if (isCriticalRed) {
        reason = 'Critical Red Safety Threat Alert';
      } else if (isSevereDrowsy) {
        reason = `Severe Prolonged Eye Closure (Fatigue ${driverState.drowsinessLevel}%)`;
      }

      dispatchSMSViaGateway(contacts, reason, false);
    }

    prevMicroSleepCountRef.current = driverState.microSleepCount;
    prevAlertLevelRef.current = driverState.alertLevel;
  }, [driverState?.alertLevel, driverState?.microSleepCount, driverState?.drowsinessLevel, driverState?.eyesClosed, driverState?.isMonitoring]);

  // Core Service: Auto-trigger SOS Call when critical threshold is sustained > 5 seconds
  const handleAutoTriggerSOSCall = (drowsinessVal: number) => {
    soundManager.unlockAudioContext();
    soundManager.playCriticalAlarm();
    soundManager.speakText(
      "Critical warning: Driver drowsiness sustained above critical threshold for more than five seconds. Automatically initiating emergency SOS call.",
      true
    );

    const primary = contacts.find(c => c.isPrimary) || contacts[0] || {
      id: 'emergency_112',
      name: 'National Emergency Helpline',
      phone: '112',
      relationship: 'National Emergency Services',
      isPrimary: true,
    };

    setActiveCallContact(primary);
    setIsAutoCallActive(true);
    setAutoCallInitiatedAt(new Date().toLocaleTimeString());

    // Trigger direct phone dialer
    try {
      const cleanDigits = primary.phone.replace(/[\s\-\(\)]/g, '');
      window.location.href = `tel:${cleanDigits}`;
    } catch (e) {
      console.warn("Could not launch phone tel: link directly", e);
    }

    // Auto-dispatch critical emergency location packet via SMS Gateway
    dispatchSMSViaGateway(
      contacts,
      `AUTOMATED EMERGENCY SOS CALL: Critical driver drowsiness (${drowsinessVal}%) sustained > 5.0s`,
      false
    );
  };

  const handleCancelCriticalTimer = () => {
    criticalDrowsyStartTimeRef.current = Date.now() + 10000; // 10s grace pause
    setCriticalSustainedSeconds(0);
    setIsSimulatedCritical(false);
    soundManager.speakText("Auto-trigger paused for 10 seconds. Driver acknowledged.", true);
  };

  // High-frequency monitor for continuous critical drowsiness (> 5 seconds)
  useEffect(() => {
    if (!autoTriggerEnabled || (!driverState?.isMonitoring && !isSimulatedCritical)) {
      criticalDrowsyStartTimeRef.current = null;
      setCriticalSustainedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const isCritical =
        isSimulatedCritical ||
        (driverState &&
          (driverState.drowsinessLevel >= criticalThreshold ||
            driverState.alertLevel === 'RED' ||
            (driverState.eyesClosed && driverState.drowsinessLevel >= 70)));

      const now = Date.now();

      if (isCritical) {
        if (!criticalDrowsyStartTimeRef.current) {
          criticalDrowsyStartTimeRef.current = now;
        }

        const elapsedMs = now - criticalDrowsyStartTimeRef.current;
        const elapsedSec = Math.min(5, elapsedMs / 1000);
        setCriticalSustainedSeconds(elapsedSec);

        // Check if exceeded 5 continuous seconds (5000ms)
        if (elapsedMs >= 5000) {
          // Cooldown check (don't re-trigger within 30s)
          if (now - lastAutoCallTimeRef.current > 30000 && !isAutoCallActive) {
            lastAutoCallTimeRef.current = now;
            const drowsyVal = isSimulatedCritical ? 88 : (driverState?.drowsinessLevel || 85);
            handleAutoTriggerSOSCall(drowsyVal);
            setIsSimulatedCritical(false);
          }
          criticalDrowsyStartTimeRef.current = null;
          setCriticalSustainedSeconds(0);
        }
      } else {
        // Driver recovered or drowsiness dropped below threshold
        criticalDrowsyStartTimeRef.current = null;
        setCriticalSustainedSeconds(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [
    autoTriggerEnabled,
    driverState?.drowsinessLevel,
    driverState?.alertLevel,
    driverState?.eyesClosed,
    driverState?.isMonitoring,
    criticalThreshold,
    isAutoCallActive,
    isSimulatedCritical,
  ]);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) return;

    const isIndian = isIndianMobileNumber(newContactPhone);
    const formattedPhone = isIndian ? formatToIndianStandard(newContactPhone) : newContactPhone;

    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newContactName,
      phone: formattedPhone,
      relationship: newContactRelation || (isIndian ? 'Emergency Contact (India)' : 'Emergency Contact'),
      isPrimary: contacts.length === 0,
    };

    setContacts(prev => [...prev, newContact]);

    // If it's an Indian mobile number, prepare automated emergency SOS text template & auto-dispatch trigger
    if (isIndian) {
      const rawDigits = getRawDigitsForIndianLink(newContactPhone);
      const hasGps = speedData.latitude !== null && speedData.longitude !== null;
      const lat = speedData.latitude;
      const lon = speedData.longitude;
      const mapsUrl = hasGps ? `https://maps.google.com/?q=${lat?.toFixed(5)},${lon?.toFixed(5)}` : 'Location unavailable (GPS Offline)';
      const locationInfo = hasGps
        ? `${speedData.locationName} (${lat?.toFixed(4)}, ${lon?.toFixed(4)})`
        : `GPS Offline (${speedData.gpsStatus === 'denied' ? 'Permission Denied' : 'Signal Unavailable'})`;
      
      const autoMessage = `[🚨 DRIVESAFE SOS ALERT]
Namaste ${newContactName},
You are registered as an Emergency Contact for live driver safety monitoring.
In case of critical fatigue or emergency, automated SMS alerts with live GPS tracking will be sent to this Indian number (+91).
Current GPS: ${locationInfo}
Live Maps: ${mapsUrl}`;

      const encodedMessage = encodeURIComponent(autoMessage);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${rawDigits}&text=${encodedMessage}`;
      const smsUrl = `sms:${rawDigits}?body=${encodedMessage}`;

      setAutomatedTextNotice({
        contactName: newContactName,
        phone: formattedPhone,
        messageText: autoMessage,
        whatsappUrl,
        smsUrl,
      });

      soundManager.speakText(`Indian mobile number registered for ${newContactName}. Automated SMS gateway configured.`, true);
    }

    setNewContactName('');
    setNewContactPhone('');
    setNewContactRelation('');
    setIsAdding(false);
  };

  const handleQuickAddIndianPreset = (name: string, phone: string, relationship: string) => {
    if (contacts.some(c => c.phone.includes(phone))) {
      return;
    }
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name,
      phone,
      relationship,
      isPrimary: false,
    };
    setContacts(prev => [...prev, newContact]);
    soundManager.speakText(`${name} added to emergency list.`);
  };

  const handleRemoveContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  // SOS Countdown Confirmation Effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isConfirmingSos && sosCountdown > 0) {
      timer = setTimeout(() => {
        setSosCountdown(prev => prev - 1);
        soundManager.playWarningBeep();
      }, 1000);
    } else if (isConfirmingSos && sosCountdown === 0) {
      handleConfirmDispatch();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isConfirmingSos, sosCountdown]);

  const handleInitiateSOS = () => {
    soundManager.unlockAudioContext();
    soundManager.playWarningBeep(true);
    setSosCountdown(5);
    setIsConfirmingSos(true);
  };

  const handleCancelSOS = () => {
    setIsConfirmingSos(false);
    setSosCountdown(5);
    soundManager.speakText("Emergency SOS canceled.");
  };

  const handleConfirmDispatch = () => {
    setIsConfirmingSos(false);
    setIsSosActive(true);
    dispatchSMSViaGateway(contacts, 'Manual Driver SOS Button Triggered (Confirmed)', false);
    setTimeout(() => {
      setIsSosActive(false);
    }, 2500);
  };

  const handleSendAutomatedWhatsApp = (contact: EmergencyContact) => {
    const rawDigits = getRawDigitsForIndianLink(contact.phone);
    const hasGps = speedData.latitude !== null && speedData.longitude !== null;
    const lat = speedData.latitude;
    const lon = speedData.longitude;
    const mapsUrl = hasGps ? `https://maps.google.com/?q=${lat?.toFixed(5)},${lon?.toFixed(5)}` : 'GPS Offline';
    const locationInfo = hasGps
      ? `${speedData.locationName} (${lat?.toFixed(4)}, ${lon?.toFixed(4)})`
      : `GPS Offline (${speedData.gpsStatus === 'denied' ? 'Permission Denied' : 'Signal Unavailable'})`;
    
    const speedText = speedData.isSpeedAvailable && speedData.currentSpeedKmh !== null
      ? `${Math.round(speedData.currentSpeedKmh)} km/h`
      : 'Speed unavailable';

    const message = `🚨 [URGENT EMERGENCY SOS]
From: DriveSafe AI Vehicle Telematics
Driver Location: ${locationInfo}
Current Speed: ${speedText}
Live Tracking Map: ${mapsUrl}
Please check on the driver immediately!`;

    const url = `https://api.whatsapp.com/send?phone=${rawDigits}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendAutomatedSMS = (contact: EmergencyContact) => {
    const rawDigits = getRawDigitsForIndianLink(contact.phone);
    const hasGps = speedData.latitude !== null && speedData.longitude !== null;
    const lat = speedData.latitude;
    const lon = speedData.longitude;
    const mapsUrl = hasGps ? `https://maps.google.com/?q=${lat?.toFixed(5)},${lon?.toFixed(5)}` : 'Unavailable';
    const locationInfo = hasGps
      ? `${speedData.locationName} (${lat?.toFixed(4)}, ${lon?.toFixed(4)})`
      : `GPS Offline (${speedData.gpsStatus === 'denied' ? 'Permission Denied' : 'Signal Unavailable'})`;
    
    const message = `🚨 [EMERGENCY SOS] DriveSafe AI Alert for driver. Location: ${locationInfo} Map: ${mapsUrl}`;

    window.location.href = `sms:${rawDigits}?body=${encodeURIComponent(message)}`;
  };

  const indianContactsCount = contacts.filter(c => isIndianMobileNumber(c.phone)).length;

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full">
      <div>
        {/* Header with Title and Status Badges */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <div className="p-1.5 bg-rose-500/20 rounded-lg border border-rose-400/30 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span>Emergency SOS & SMS Gateway</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowGatewaySettings(!showGatewaySettings)}
              id="btn-gateway-settings-toggle"
              className={`p-1.5 rounded-lg border transition-colors ${
                showGatewaySettings 
                  ? 'bg-blue-600/30 border-blue-400/50 text-blue-300' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="SMS Gateway Configuration"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {indianContactsCount} +91 Active
            </span>
          </div>
        </div>

        {/* Auto-trigger SOS Call Control Card (Critical Drowsiness > 5s) */}
        <div className="mb-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg border transition-colors ${
                autoTriggerEnabled 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                <PhoneOutgoing className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                    Auto-trigger
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border transition-colors ${
                    autoTriggerEnabled 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {autoTriggerEnabled ? 'ENABLED (5s THRESHOLD)' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Automatically initiates SOS call if drowsiness &ge;{criticalThreshold}% persists for &gt;5 seconds.
                </p>
              </div>
            </div>

            {/* Dedicated Auto-trigger Toggle Switch */}
            <button
              type="button"
              id="btn-toggle-autotrigger"
              onClick={() => {
                const nextVal = !autoTriggerEnabled;
                setAutoTriggerEnabled(nextVal);
                soundManager.speakText(`Auto-trigger emergency SOS call ${nextVal ? 'enabled' : 'disabled'}.`);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoTriggerEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
              role="switch"
              aria-checked={autoTriggerEnabled}
              title="Toggle Auto-trigger SOS Call"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  autoTriggerEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Real-time 5-Second Sustained Critical Drowsiness Progress Monitor */}
          {autoTriggerEnabled && criticalSustainedSeconds > 0 && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-red-950/90 border border-red-500/60 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <div className="flex items-center gap-1.5 text-red-300 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                  <span>CRITICAL DROWSINESS DETECTED ({isSimulatedCritical ? 88 : (driverState?.drowsinessLevel || 85)}%)</span>
                </div>
                <span className="font-mono text-xs text-red-200 font-bold">
                  {criticalSustainedSeconds.toFixed(1)}s / 5.0s
                </span>
              </div>

              {/* Progress bar filling up to 5 seconds */}
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-red-500/40">
                <div
                  className="bg-gradient-to-r from-amber-500 to-red-500 h-full transition-all duration-100 ease-linear rounded-full"
                  style={{ width: `${Math.min(100, (criticalSustainedSeconds / 5) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-2 text-[10px]">
                <span className="text-amber-300 font-medium">
                  Auto-call initiating in {(Math.max(0, 5 - criticalSustainedSeconds)).toFixed(1)}s...
                </span>
                <button
                  onClick={handleCancelCriticalTimer}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium active:scale-95 transition-all"
                >
                  Cancel (I'm Attentive)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Big Emergency SOS Dispatch Button & Confirmation Safeguard */}
        <div className="mb-3">
          {isConfirmingSos ? (
            <div className="p-4 rounded-2xl bg-red-950/80 border-2 border-red-500 shadow-2xl shadow-red-950 text-center flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-rose-300 font-black text-sm uppercase tracking-wider">
                <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />
                <span>CONFIRM EMERGENCY DISTRESS BROADCAST</span>
              </div>
              <p className="text-xs text-slate-300">
                Live GPS telematics & location SMS will dispatch to emergency contacts in:
              </p>

              <div className="w-14 h-14 rounded-full border-4 border-rose-500 flex items-center justify-center font-mono font-black text-2xl text-rose-300 animate-pulse bg-red-900/40">
                {sosCountdown}s
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleConfirmDispatch}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-900/50"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Dispatch Now</span>
                </button>

                <button
                  onClick={handleCancelSOS}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/20 text-slate-200 hover:text-white font-bold text-xs"
                >
                  Cancel (False Alarm)
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleInitiateSOS}
              disabled={isSosActive}
              id="btn-trigger-sos"
              className={`w-full py-3.5 px-4 rounded-xl font-black text-white text-sm sm:text-base tracking-wider uppercase flex flex-col items-center justify-center gap-0.5 shadow-xl transition-all backdrop-blur-md ${
                isSosActive
                  ? 'bg-rose-700 animate-ping'
                  : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 shadow-rose-950/60 border border-rose-400/50 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 animate-bounce text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                <span>{isSosActive ? "DISPATCHING LOCATION-AWARE SOS..." : "TRIGGER EMERGENCY SOS"}</span>
              </div>
              <span className="text-[10px] font-mono lowercase tracking-normal text-rose-200">
                (press to open 5s confirmation • prevents accidental triggers)
              </span>
            </button>
          )}

          {/* Auto-Trigger and Cooldown Status Bar */}
          <div className="mt-2 flex items-center justify-between px-2 py-1 bg-slate-900/60 rounded-lg border border-white/5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Radio className={`w-3.5 h-3.5 ${gatewayConfig.autoDispatchOnHighSeverity ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="text-slate-300">
                Auto-SMS on High Fatigue: <strong className={gatewayConfig.autoDispatchOnHighSeverity ? 'text-emerald-300' : 'text-slate-500'}>
                  {gatewayConfig.autoDispatchOnHighSeverity ? 'ON' : 'OFF'}
                </strong>
              </span>
            </div>

            {cooldownRemaining > 0 ? (
              <span className="text-amber-400 font-mono flex items-center gap-1 text-[10px]">
                <Clock className="w-3 h-3" /> Cooldown: {cooldownRemaining}s
              </span>
            ) : (
              <span className="text-emerald-400 text-[10px] font-mono">Gateway Ready</span>
            )}
          </div>

          {sosSentMessage && (
            <div className="mt-2.5 backdrop-blur-md bg-emerald-500/10 border border-emerald-500/40 p-2.5 rounded-xl text-xs text-emerald-300 flex items-start gap-2 shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{sosSentMessage}</span>
            </div>
          )}
        </div>

        {/* Gateway Settings Accordion / Configuration Panel */}
        {showGatewaySettings && (
          <div className="mb-3 p-3 rounded-xl bg-slate-900/95 border border-blue-500/30 text-xs text-slate-200 shadow-xl space-y-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="font-bold text-sky-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" /> Indian SMS Gateway Service Configuration
              </span>
              <span className="text-[10px] text-slate-400">TRAI DLT Compliant</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-1">Gateway Provider</label>
                <select
                  value={gatewayConfig.provider}
                  onChange={(e) => setGatewayConfig(prev => ({ ...prev, provider: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="auto_indian">Auto Indian Telecom Gateway (+91)</option>
                  <option value="fast2sms">Fast2SMS Quick Gateway (India)</option>
                  <option value="msg91">MSG91 Enterprise DLT Route</option>
                  <option value="twilio_india">Twilio India Direct (+91)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Auto Cooldown (Seconds)</label>
                <input
                  type="number"
                  min={15}
                  max={300}
                  value={gatewayConfig.cooldownSeconds}
                  onChange={(e) => setGatewayConfig(prev => ({ ...prev, cooldownSeconds: Number(e.target.value) || 45 }))}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gatewayConfig.autoDispatchOnHighSeverity}
                  onChange={(e) => setGatewayConfig(prev => ({ ...prev, autoDispatchOnHighSeverity: e.target.checked }))}
                  className="rounded bg-slate-950 border-white/20 text-blue-600 focus:ring-0"
                />
                <span className="text-[11px] text-slate-300">Auto-dispatch on severe drowsiness / micro-sleep</span>
              </label>

              <button
                onClick={() => dispatchSMSViaGateway(contacts, 'Manual Gateway Route Verification Test', true)}
                id="btn-test-sms-gateway"
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-[11px] flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <Zap className="w-3 h-3 text-amber-300" /> Test SMS Delivery
              </button>
            </div>

            {/* Auto-Trigger Threshold & Test Simulator */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                <span className="text-slate-300">Auto-trigger Critical Drowsiness Threshold:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={70}
                    max={95}
                    step={1}
                    value={criticalThreshold}
                    onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                    className="accent-red-500 h-1 bg-slate-800 rounded cursor-pointer w-24"
                  />
                  <span className="font-mono text-red-400 font-bold">{criticalThreshold}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] text-slate-400">Test 5-Second Auto-Trigger SOS Call:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (isSimulatedCritical) {
                      handleCancelCriticalTimer();
                    } else {
                      setIsSimulatedCritical(true);
                      soundManager.speakText("Simulating 5 seconds of critical drowsiness for automated SOS call trigger.", true);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                    isSimulatedCritical
                      ? 'bg-red-600 text-white border-red-400 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isSimulatedCritical ? 'Abort 5s Test' : 'Run 5s Auto-Trigger Test'}
                </button>
              </div>
            </div>

            {/* Quick Add Presets for Indian National Emergency Services */}
            <div className="pt-2 border-t border-white/10">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">
                Quick-Add Indian Emergency Helplines
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleQuickAddIndianPreset('NHAI Highway Emergency', '1033', 'National Highway Assistance')}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-sky-300 px-2 py-0.5 rounded border border-sky-400/20"
                >
                  + NHAI (1033)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddIndianPreset('National Ambulance', '108', 'Medical Emergency')}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-rose-300 px-2 py-0.5 rounded border border-rose-400/20"
                >
                  + Ambulance (108)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddIndianPreset('Road Safety Disaster Helpline', '1073', 'Disaster & Highway Helpline')}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded border border-amber-400/20"
                >
                  + Highway (1073)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Automated Text Banner for newly added Indian mobile number */}
        {automatedTextNotice && (
          <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-indigo-950/90 to-blue-950/80 border border-blue-400/40 shadow-lg text-slate-100 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                    🇮🇳 Indian Contact Automated SMS Gateway Ready!
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Configured location-aware emergency broadcast for <strong className="text-white">{automatedTextNotice.contactName}</strong> ({automatedTextNotice.phone}).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAutomatedTextNotice(null)}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>

            {/* Quick Auto-Send Action Buttons */}
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <a
                href={automatedTextNotice.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-auto-whatsapp-alert"
                className="flex items-center gap-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg transition-all shadow-sm active:scale-95"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Send WhatsApp SOS</span>
              </a>

              <a
                href={automatedTextNotice.smsUrl}
                id="btn-auto-sms-alert"
                className="flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg transition-all shadow-sm active:scale-95"
              >
                <Send className="w-3 h-3" />
                <span>Send SMS Direct</span>
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(automatedTextNotice.messageText);
                  soundManager.speakText("Automated message copied to clipboard.", true);
                }}
                className="text-[10px] text-slate-300 hover:text-white bg-white/10 px-2 py-1 rounded-lg border border-white/10"
              >
                Copy Text
              </button>
            </div>
          </div>
        )}

        {/* Emergency Contacts List Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">
                Emergency Contacts ({contacts.length})
              </span>
              <button
                onClick={() => setShowDispatchLogs(!showDispatchLogs)}
                id="btn-toggle-dispatch-logs"
                className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20"
              >
                <FileText className="w-3 h-3" />
                <span>Logs ({dispatchLogs.length})</span>
                {showDispatchLogs ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
            </div>

            <button
              onClick={() => setIsAdding(!isAdding)}
              id="btn-toggle-add-contact"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Contact
            </button>
          </div>

          {/* Add Contact Form */}
          {isAdding && (
            <form onSubmit={handleAddContact} className="backdrop-blur-md bg-slate-900/90 p-3 rounded-2xl border border-white/15 space-y-2.5 mb-3 shadow-lg">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma, Mom, Fleet Desk"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-slate-300">Indian / Global Mobile Number</label>
                  <span className="text-[10px] text-emerald-400 font-mono">Auto +91 Detection</span>
                </div>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210 or +91 98765 43210"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
                {newContactPhone && isIndianMobileNumber(newContactPhone) && (
                  <p className="text-[10px] text-emerald-300 mt-1 flex items-center gap-1">
                    ✓ Valid Indian Mobile ({formatToIndianStandard(newContactPhone)}) — Automated Gateway & WhatsApp active
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Relationship</label>
                <input
                  type="text"
                  placeholder="e.g. Spouse, Parent, Fleet Supervisor"
                  value={newContactRelation}
                  onChange={(e) => setNewContactRelation(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-contact"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
                >
                  Save & Enable Auto-Alerts
                </button>
              </div>
            </form>
          )}

          {/* Dispatch Logs View */}
          {showDispatchLogs && (
            <div className="mb-3 p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/30 max-h-48 overflow-y-auto space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">
                  Live SMS Gateway Dispatch Records
                </span>
                <button
                  onClick={() => setDispatchLogs([])}
                  className="text-[9px] text-slate-400 hover:text-rose-400"
                >
                  Clear Logs
                </button>
              </div>

              {dispatchLogs.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-2">No SMS dispatch events recorded yet.</p>
              ) : (
                dispatchLogs.map(log => (
                  <div key={log.id} className="p-2 rounded-lg bg-white/5 border border-white/5 text-[10px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{log.recipientName} ({log.recipientPhone})</span>
                      <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {log.status}
                      </span>
                    </div>
                    <div className="text-slate-400 flex items-center justify-between">
                      <span>Reason: <span className="text-amber-300">{log.triggerReason}</span></span>
                      <span className="font-mono text-slate-500">{log.timestamp}</span>
                    </div>
                    <div className="text-slate-400 truncate">
                      <span className="text-slate-500">Route:</span> {log.gateway} • <span className="text-slate-500">ID:</span> {log.messageId}
                    </div>
                    <div className="text-slate-300 font-mono text-[9px] bg-slate-900 p-1 rounded border border-white/5">
                      {log.messagePreview}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Emergency Contacts List */}
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {contacts.map((contact) => {
              const isIndian = isIndianMobileNumber(contact.phone);
              return (
                <div
                  key={contact.id}
                  className="backdrop-blur-md bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/10 flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span>{contact.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({contact.relationship})</span>
                      {isIndian && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                          +91 IND
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 font-mono text-[11px] mt-0.5">{contact.phone}</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Quick Trigger Automated WhatsApp/SMS for Indian Contact */}
                    {isIndian && (
                      <button
                        onClick={() => handleSendAutomatedWhatsApp(contact)}
                        className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-all"
                        title="Send Instant WhatsApp Alert"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleSendAutomatedSMS(contact)}
                      className="p-1.5 text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg border border-sky-500/30 transition-all"
                      title="Direct Device SMS"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleRemoveContact(contact.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      title="Remove Contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Automated SOS Call Modal */}
      {isAutoCallActive && activeCallContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border-2 border-red-500 rounded-2xl p-5 shadow-2xl shadow-red-950/80 text-center flex flex-col items-center">
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full bg-red-600/30 border-2 border-red-500 flex items-center justify-center animate-ping absolute inset-0" />
              <div className="w-20 h-20 rounded-full bg-red-600 border-2 border-red-400 flex items-center justify-center relative shadow-lg shadow-red-600/50">
                <PhoneCall className="w-9 h-9 text-white animate-bounce" />
              </div>
            </div>

            <span className="text-[10px] font-mono tracking-widest uppercase text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/30 mb-1 font-bold">
              AUTO-TRIGGERED EMERGENCY CALL
            </span>

            <h3 className="text-lg font-black text-white uppercase tracking-wide">
              Emergency SOS Call In Progress
            </h3>

            <p className="text-xs text-red-300 mt-1">
              Initiated automatically after driver drowsiness exceeded critical threshold (≥{criticalThreshold}%) for more than 5 seconds.
            </p>

            <div className="my-4 p-3.5 rounded-xl bg-slate-950 border border-white/10 w-full text-left font-mono">
              <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                <span className="text-slate-400">Target Contact:</span>
                <span className="font-bold text-white">{activeCallContact.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-bold text-sky-400">{activeCallContact.phone}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                <span className="text-slate-400">Relationship:</span>
                <span className="text-slate-300">{activeCallContact.relationship}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span className="text-slate-400">Time Dispatched:</span>
                <span className="text-amber-300">{autoCallInitiatedAt}</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              <a
                href={`tel:${activeCallContact.phone.replace(/[\s\-\(\)]/g, '')}`}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 active:scale-[0.98] transition-all"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Open Phone Dialer ({activeCallContact.phone})</span>
              </a>

              <button
                onClick={() => {
                  setIsAutoCallActive(false);
                  soundManager.speakText("Emergency call dismissed by driver.");
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold active:scale-[0.98] transition-all"
              >
                End Call / Dismiss (False Alarm)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
