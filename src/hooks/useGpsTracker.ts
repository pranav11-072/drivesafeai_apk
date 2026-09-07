import { useState, useEffect, useRef, useCallback } from 'react';
import { GpsStatus, SpeedData } from '../types';
import { calculateSpeedFromDisplacement, formatCoordinates } from '../utils/geolocation';

interface PreviousGpsFix {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

interface UseGpsTrackerOptions {
  speedLimitKmh?: number;
  onSpeedOverLimit?: (speed: number) => void;
}

export function useGpsTracker(options?: UseGpsTrackerOptions) {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('loading');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [liveGpsSpeedKmh, setLiveGpsSpeedKmh] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('Acquiring GPS fix...');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<number | null>(() => Date.now());

  // Manual test override (clearly labeled when engaged)
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [manualSpeedKmh, setManualSpeedKmh] = useState<number>(0);

  // Random Speed Simulation Engine (Active by default so speedometer works out of the box)
  const [isRandomRunning, setIsRandomRunning] = useState<boolean>(true);
  const [randomSpeedProfile, setRandomSpeedProfile] = useState<'random' | 'city' | 'highway' | 'cruising'>('random');
  const [randomSpeedKmh, setRandomSpeedKmh] = useState<number>(56);
  const [simCoords, setSimCoords] = useState<{ lat: number; lng: number; heading: number }>({
    lat: 37.7749,
    lng: -122.4194,
    heading: 245,
  });

  const targetSpeedRef = useRef<number>(58);
  const currentSpeedFloatRef = useRef<number>(56);
  const lastTargetChangeRef = useRef<number>(Date.now());
  const overspeedBurstUntilRef = useRef<number>(0);

  const prevFixRef = useRef<PreviousGpsFix | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Method to trigger a temporary overspeed burst for testing alarms
  const triggerOverspeedBurst = useCallback((durationMs: number = 6000) => {
    overspeedBurstUntilRef.current = Date.now() + durationMs;
    const limit = options?.speedLimitKmh || 60;
    targetSpeedRef.current = limit + 18;
  }, [options?.speedLimitKmh]);

  // Active random driving simulation loop
  useEffect(() => {
    if (!isRandomRunning || isManualOverride) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const limit = options?.speedLimitKmh || 60;

      // Check if temporary overspeed burst is active
      if (now < overspeedBurstUntilRef.current) {
        targetSpeedRef.current = limit + 18;
      } else if (now - lastTargetChangeRef.current > 3200) {
        lastTargetChangeRef.current = now;

        if (randomSpeedProfile === 'city') {
          // City driving: 30 - 52 km/h
          targetSpeedRef.current = Math.floor(30 + Math.random() * 22);
        } else if (randomSpeedProfile === 'highway') {
          // Highway driving: 80 - 118 km/h
          targetSpeedRef.current = Math.floor(80 + Math.random() * 38);
        } else if (randomSpeedProfile === 'cruising') {
          // Cruising around speed limit
          targetSpeedRef.current = Math.floor(limit - 8 + Math.random() * 16);
        } else {
          // Random Profile: Dynamic variations
          const roll = Math.random();
          if (roll < 0.65) {
            // Cruise around limit (-10 to +4 km/h)
            targetSpeedRef.current = Math.floor(limit - 10 + Math.random() * 14);
          } else if (roll < 0.85) {
            // Speed up / overspeed spike (+5 to +16 km/h)
            targetSpeedRef.current = Math.floor(limit + 5 + Math.random() * 12);
          } else {
            // Slow down for corner / traffic (30 to 45 km/h)
            targetSpeedRef.current = Math.floor(32 + Math.random() * 14);
          }
        }
      }

      // Smooth physics-based acceleration / deceleration
      const delta = targetSpeedRef.current - currentSpeedFloatRef.current;
      const step = Math.sign(delta) * Math.min(Math.abs(delta) * 0.12 + 0.35, 2.4);
      const microJitter = (Math.random() - 0.5) * 0.8;
      currentSpeedFloatRef.current = Math.max(0, Math.min(170, currentSpeedFloatRef.current + step + microJitter));

      const newRoundedSpeed = Math.round(currentSpeedFloatRef.current);
      setRandomSpeedKmh(newRoundedSpeed);

      if (options?.speedLimitKmh && newRoundedSpeed > options.speedLimitKmh) {
        options.onSpeedOverLimit?.(newRoundedSpeed);
      }

      // Advance simulated coordinates along heading
      setSimCoords(prev => {
        const dtHours = 0.3 / 3600; // 300ms in hours
        const distanceKm = currentSpeedFloatRef.current * dtHours;
        const headingRad = (prev.heading * Math.PI) / 180;
        const dLat = (distanceKm / 111.32) * Math.cos(headingRad);
        const dLng = (distanceKm / (111.32 * Math.cos((prev.lat * Math.PI) / 180))) * Math.sin(headingRad);
        const headingWobble = (Math.random() - 0.5) * 1.5;
        return {
          lat: prev.lat + dLat,
          lng: prev.lng + dLng,
          heading: (prev.heading + headingWobble + 360) % 360,
        };
      });

      setLastGpsUpdate(now);
    }, 300);

    return () => clearInterval(interval);
  }, [isRandomRunning, isManualOverride, randomSpeedProfile, options?.speedLimitKmh, options?.onSpeedOverLimit]);

  const clearGpsWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleGpsSuccess = useCallback((position: GeolocationPosition) => {
    const { latitude: lat, longitude: lon, accuracy, heading: rawHeading, speed: rawSpeedMps } = position.coords;
    const now = position.timestamp || Date.now();

    setGpsStatus('active');
    setGpsErrorMessage(null);
    setLatitude(lat);
    setLongitude(lon);
    setAccuracyMeters(accuracy ? Math.round(accuracy) : null);
    setHeading(rawHeading ?? null);
    setLastGpsUpdate(now);

    // Calculate live vehicle speed
    let calculatedSpeed = 0;
    if (rawSpeedMps !== null && rawSpeedMps >= 0) {
      // Browser provided direct hardware speed
      calculatedSpeed = Math.round(rawSpeedMps * 3.6);
    } else if (prevFixRef.current) {
      // Calculate from displacement over time
      calculatedSpeed = calculateSpeedFromDisplacement(
        prevFixRef.current.latitude,
        prevFixRef.current.longitude,
        prevFixRef.current.timestamp,
        lat,
        lon,
        now,
        accuracy || 15
      );
    }

    setLiveGpsSpeedKmh(calculatedSpeed);
    setLocationName(`${formatCoordinates(lat, lon)} (±${Math.round(accuracy || 0)}m)`);

    prevFixRef.current = {
      latitude: lat,
      longitude: lon,
      timestamp: now,
      accuracy: accuracy || 15,
    };
  }, []);

  const handleGpsError = useCallback((error: GeolocationPositionError) => {
    prevFixRef.current = null;
    setLiveGpsSpeedKmh(null);
    setLatitude(null);
    setLongitude(null);
    setAccuracyMeters(null);
    setHeading(null);

    switch (error.code) {
      case error.PERMISSION_DENIED:
        setGpsStatus('denied');
        setGpsErrorMessage('Location permission denied. Please allow location access in your browser settings to track live vehicle speed.');
        setLocationName('Location unavailable (Permission denied)');
        break;
      case error.POSITION_UNAVAILABLE:
        setGpsStatus('unavailable');
        setGpsErrorMessage('GPS position unavailable. Ensure device location or GPS services are switched on.');
        setLocationName('GPS unavailable');
        break;
      case error.TIMEOUT:
        setGpsStatus('unavailable');
        setGpsErrorMessage('GPS request timed out while waiting for satellite fix. Click Retry to reconnect.');
        setLocationName('GPS timed out');
        break;
      default:
        setGpsStatus('unavailable');
        setGpsErrorMessage(error.message || 'GPS tracking error occurred.');
        setLocationName('GPS error');
        break;
    }
  }, []);

  const startGpsWatch = useCallback(() => {
    clearGpsWatch();

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      setGpsErrorMessage('Geolocation is not supported by your browser or device.');
      setLocationName('GPS not supported');
      return;
    }

    setGpsStatus('loading');
    setGpsErrorMessage(null);
    setLocationName('Acquiring GPS fix...');

    try {
      const id = navigator.geolocation.watchPosition(
        handleGpsSuccess,
        handleGpsError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 2000,
        }
      );
      watchIdRef.current = id;
    } catch (e: any) {
      setGpsStatus('unavailable');
      setGpsErrorMessage(e?.message || 'Failed to initialize geolocation watch.');
      setLocationName('GPS initialization failed');
    }
  }, [clearGpsWatch, handleGpsSuccess, handleGpsError]);

  // Request explicit permission / manual retry
  const retryGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      return;
    }

    setGpsStatus('loading');
    setGpsErrorMessage(null);
    setLocationName('Acquiring GPS fix...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleGpsSuccess(pos);
        startGpsWatch();
      },
      (err) => {
        handleGpsError(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [handleGpsSuccess, handleGpsError, startGpsWatch]);

  // Initialize GPS on mount and monitor Permissions API if available
  useEffect(() => {
    startGpsWatch();

    // Check Permissions API if supported
    let permissionStatus: PermissionStatus | null = null;
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          permissionStatus = status;
          if (status.state === 'denied') {
            setGpsStatus('denied');
            setGpsErrorMessage('Location permission denied. Please allow location access in browser settings.');
            setLocationName('Location unavailable (Permission denied)');
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              startGpsWatch();
            } else if (status.state === 'denied') {
              clearGpsWatch();
              setGpsStatus('denied');
              setGpsErrorMessage('Location permission denied. Please allow location access in browser settings.');
              setLocationName('Location unavailable (Permission denied)');
            }
          };
        })
        .catch(() => {
          // Permissions API query not supported or failed; standard watchPosition handles it
        });
    }

    return () => {
      clearGpsWatch();
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [startGpsWatch, clearGpsWatch]);

  // Determine current active speed and telemetry
  const isSpeedAvailable = isManualOverride || isRandomRunning || (gpsStatus === 'active' && liveGpsSpeedKmh !== null);
  const effectiveSpeedKmh: number | null = isManualOverride
    ? manualSpeedKmh
    : isRandomRunning
    ? randomSpeedKmh
    : (gpsStatus === 'active' && liveGpsSpeedKmh !== null ? liveGpsSpeedKmh : null);

  const speedSource: 'gps' | 'manual' | 'random' | 'none' = isManualOverride
    ? 'manual'
    : isRandomRunning
    ? 'random'
    : (gpsStatus === 'active' && liveGpsSpeedKmh !== null)
    ? 'gps'
    : 'none';

  const effectiveLat = latitude !== null ? latitude : (isRandomRunning ? simCoords.lat : null);
  const effectiveLng = longitude !== null ? longitude : (isRandomRunning ? simCoords.lng : null);
  const effectiveHeading = heading !== null ? heading : (isRandomRunning ? Math.round(simCoords.heading) : null);

  const effectiveLocationName =
    gpsStatus === 'active' && latitude !== null && longitude !== null
      ? `${formatCoordinates(latitude, longitude)} (Live GPS)`
      : isRandomRunning
      ? 'Highway 1 Coastal Route • Dynamic Cruise Simulation'
      : locationName;

  const effectiveGpsStatus: GpsStatus =
    gpsStatus === 'active'
      ? 'active'
      : isRandomRunning
      ? 'simulated'
      : gpsStatus;

  return {
    gpsStatus: effectiveGpsStatus,
    rawGpsStatus: gpsStatus,
    latitude: effectiveLat,
    longitude: effectiveLng,
    accuracyMeters: accuracyMeters || (isRandomRunning ? 5 : null),
    heading: effectiveHeading,
    currentSpeedKmh: effectiveSpeedKmh,
    isSpeedAvailable,
    liveGpsSpeedKmh,
    locationName: effectiveLocationName,
    gpsErrorMessage,
    speedSource,
    lastGpsUpdate: lastGpsUpdate,
    // Controls
    isManualOverride,
    setIsManualOverride,
    manualSpeedKmh,
    setManualSpeedKmh,
    isRandomRunning,
    setIsRandomRunning,
    randomSpeedProfile,
    setRandomSpeedProfile,
    triggerOverspeedBurst,
    retryGps,
  };
}
