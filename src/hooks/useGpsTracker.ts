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
  const [lastGpsUpdate, setLastGpsUpdate] = useState<number | null>(null);

  // Manual test override (clearly labeled when engaged)
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [manualSpeedKmh, setManualSpeedKmh] = useState<number>(0);

  const prevFixRef = useRef<PreviousGpsFix | null>(null);
  const watchIdRef = useRef<number | null>(null);

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

  // Determine current active speed
  const isSpeedAvailable = isManualOverride || (gpsStatus === 'active' && liveGpsSpeedKmh !== null);
  const effectiveSpeedKmh: number | null = isManualOverride
    ? manualSpeedKmh
    : (gpsStatus === 'active' && liveGpsSpeedKmh !== null ? liveGpsSpeedKmh : null);
  const speedSource: 'gps' | 'manual' | 'none' = isManualOverride
    ? 'manual'
    : (gpsStatus === 'active' && liveGpsSpeedKmh !== null)
    ? 'gps'
    : 'none';

  return {
    gpsStatus,
    latitude,
    longitude,
    accuracyMeters,
    heading,
    currentSpeedKmh: effectiveSpeedKmh,
    isSpeedAvailable,
    liveGpsSpeedKmh,
    locationName,
    gpsErrorMessage,
    speedSource,
    lastGpsUpdate,
    // Controls
    isManualOverride,
    setIsManualOverride,
    manualSpeedKmh,
    setManualSpeedKmh,
    retryGps,
  };
}
