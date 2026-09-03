import { useState, useEffect, useRef } from 'react';
import { SpeedData } from '../types';

export function useHarshDrivingDetector(speedData?: SpeedData | null, isMonitoring: boolean = false) {
  const [harshEventsCount, setHarshEventsCount] = useState<number>(0);
  const [lastHarshEventTime, setLastHarshEventTime] = useState<number | null>(null);
  const [isSensorAvailable, setIsSensorAvailable] = useState<boolean>(false);

  const prevSpeedRef = useRef<{ speed: number; time: number } | null>(null);
  const lastEventLoggedTimeRef = useRef<number>(0);

  // 1. Device Accelerometer Detection (if available on phone/tablet)
  useEffect(() => {
    if (!isMonitoring || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return;
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      setIsSensorAvailable(true);

      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      // Magnitude of non-gravitational sudden jerk
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      // Sudden severe deceleration / jerk spike > 17 m/s^2
      const now = Date.now();
      if (magnitude > 17 && now - lastEventLoggedTimeRef.current > 4000) {
        lastEventLoggedTimeRef.current = now;
        setHarshEventsCount(prev => prev + 1);
        setLastHarshEventTime(now);
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [isMonitoring]);

  // 2. GPS Speed Delta Harsh Braking Detection
  useEffect(() => {
    if (!isMonitoring || !speedData || !speedData.isSpeedAvailable || speedData.currentSpeedKmh === null) {
      prevSpeedRef.current = null;
      return;
    }

    const currentSpeed = speedData.currentSpeedKmh;
    const now = Date.now();

    if (prevSpeedRef.current) {
      const timeDeltaSeconds = (now - prevSpeedRef.current.time) / 1000;
      const speedDropKmh = prevSpeedRef.current.speed - currentSpeed;

      // Harsh braking: Speed drops by > 18 km/h in less than 2 seconds
      if (timeDeltaSeconds > 0 && timeDeltaSeconds <= 2.5 && speedDropKmh > 18) {
        if (now - lastEventLoggedTimeRef.current > 4000) {
          lastEventLoggedTimeRef.current = now;
          setHarshEventsCount(prev => prev + 1);
          setLastHarshEventTime(now);
        }
      }
    }

    prevSpeedRef.current = { speed: currentSpeed, time: now };
  }, [speedData, isMonitoring]);

  return {
    harshEventsCount,
    lastHarshEventTime,
    isSensorAvailable,
    resetHarshEvents: () => setHarshEventsCount(0),
  };
}
