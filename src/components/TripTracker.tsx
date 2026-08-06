import React, { useState, useEffect, useMemo } from 'react';
import { Route, MapPin, Compass, Crosshair, Sparkles, RotateCcw, AlertTriangle, Layers } from 'lucide-react';
import { TripRecord, SpeedData, DriverState, AlertLevel } from '../types';
import { formatTime } from '../utils/geolocation';

interface PathPoint {
  lat: number;
  lng: number;
  speed: number;
  alertLevel?: AlertLevel;
  timestamp: number;
}

interface TripTrackerProps {
  speedData: SpeedData;
  driverState: DriverState;
  isMonitoring: boolean;
}

const INITIAL_DEMO_PATH: PathPoint[] = [
  { lat: 37.7749, lng: -122.4194, speed: 40, timestamp: Date.now() - 300000 },
  { lat: 37.7762, lng: -122.4178, speed: 45, timestamp: Date.now() - 240000 },
  { lat: 37.7781, lng: -122.4152, speed: 52, timestamp: Date.now() - 180000 },
  { lat: 37.7798, lng: -122.4131, speed: 58, alertLevel: 'YELLOW', timestamp: Date.now() - 120000 },
  { lat: 37.7815, lng: -122.4105, speed: 62, timestamp: Date.now() - 60000 },
  { lat: 37.7832, lng: -122.4082, speed: 65, timestamp: Date.now() },
];

export const TripTracker: React.FC<TripTrackerProps> = ({
  speedData,
  driverState,
  isMonitoring,
}) => {
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
  const [pathPoints, setPathPoints] = useState<PathPoint[]>(INITIAL_DEMO_PATH);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const [pastTrips, setPastTrips] = useState<TripRecord[]>([
    {
      id: 'trip-101',
      startTime: 'Today, 08:30 AM',
      endTime: 'Today, 09:15 AM',
      durationSeconds: 2700,
      distanceKm: 34.2,
      avgSpeedKmh: 45,
      maxSpeedKmh: 72,
      drowsinessAlertsCount: 0,
      safetyScore: 98,
      aiSummary: 'Smooth morning commute with zero fatigue warnings detected.'
    },
    {
      id: 'trip-102',
      startTime: 'Yesterday, 10:15 PM',
      endTime: 'Yesterday, 11:30 PM',
      durationSeconds: 4500,
      distanceKm: 68.5,
      avgSpeedKmh: 62,
      maxSpeedKmh: 95,
      drowsinessAlertsCount: 2,
      safetyScore: 82,
      aiSummary: 'Late night highway drive. 2 minor yawn fatigue alerts recorded.'
    }
  ]);

  // Track coordinates when location updates
  useEffect(() => {
    if (speedData.latitude !== null && speedData.longitude !== null) {
      const curLat = speedData.latitude;
      const curLng = speedData.longitude;

      setPathPoints(prev => {
        const last = prev[prev.length - 1];
        // Append if moved significantly or first point
        if (!last || Math.abs(last.lat - curLat) > 0.00003 || Math.abs(last.lng - curLng) > 0.00003) {
          const newPt: PathPoint = {
            lat: curLat,
            lng: curLng,
            speed: speedData.currentSpeedKmh,
            alertLevel: driverState.alertLevel,
            timestamp: Date.now(),
          };
          // Keep up to 60 recent path waypoints for performance
          const updated = [...prev, newPt];
          if (updated.length > 60) return updated.slice(updated.length - 60);
          return updated;
        }
        return prev;
      });
    }
  }, [speedData.latitude, speedData.longitude, speedData.currentSpeedKmh, driverState.alertLevel]);

  // Update active trip metrics in real time
  useEffect(() => {
    let interval: any = null;
    if (isMonitoring) {
      if (!activeTrip) {
        setActiveTrip({
          id: `trip-${Date.now()}`,
          startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          durationSeconds: 0,
          distanceKm: 0.1,
          avgSpeedKmh: speedData.currentSpeedKmh || 30,
          maxSpeedKmh: speedData.currentSpeedKmh || 30,
          drowsinessAlertsCount: 0,
          safetyScore: 100,
        });
      } else {
        interval = setInterval(() => {
          setActiveTrip(prev => {
            if (!prev) return null;
            const newDuration = prev.durationSeconds + 1;
            const addedDistance = (speedData.currentSpeedKmh / 3600); // km in 1 second
            const newDistance = prev.distanceKm + addedDistance;
            const newMaxSpeed = Math.max(prev.maxSpeedKmh, speedData.currentSpeedKmh);
            const newDrowsinessCount = prev.drowsinessAlertsCount + (driverState.alertLevel === 'RED' ? 1 : 0);

            return {
              ...prev,
              durationSeconds: newDuration,
              distanceKm: parseFloat(newDistance.toFixed(2)),
              maxSpeedKmh: newMaxSpeed,
              drowsinessAlertsCount: newDrowsinessCount,
            };
          });
        }, 1000);
      }
    } else if (activeTrip) {
      // Complete active trip
      const completedTrip: TripRecord = {
        ...activeTrip,
        endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aiSummary: activeTrip.drowsinessAlertsCount === 0
          ? 'Great job! Trip completed with high alertness.'
          : `Trip logged with ${activeTrip.drowsinessAlertsCount} drowsiness events.`
      };
      setPastTrips(prev => [completedTrip, ...prev]);
      setActiveTrip(null);
    }

    return () => clearInterval(interval);
  }, [isMonitoring, speedData.currentSpeedKmh, driverState.alertLevel]);

  // SVG Mini-Map Calculation
  const svgMapData = useMemo(() => {
    if (pathPoints.length === 0) {
      return { pathD: '', svgPoints: [], currentPt: null };
    }

    const lats = pathPoints.map(p => p.lat);
    const lngs = pathPoints.map(p => p.lng);

    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    // Padding bounds to avoid zero division
    const latSpan = Math.max(0.002, maxLat - minLat);
    const lngSpan = Math.max(0.002, maxLng - minLng);

    minLat -= latSpan * 0.15;
    maxLat += latSpan * 0.15;
    minLng -= lngSpan * 0.15;
    maxLng += lngSpan * 0.15;

    // ViewBox dimensions: W = 340, H = 130
    const mapToSvg = (lat: number, lng: number) => {
      const x = 20 + ((lng - minLng) / (maxLng - minLng)) * 300;
      const y = 110 - ((lat - minLat) / (maxLat - minLat)) * 90;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
    };

    const svgPts = pathPoints.map(p => {
      const coords = mapToSvg(p.lat, p.lng);
      return {
        ...coords,
        alertLevel: p.alertLevel,
        speed: p.speed,
        lat: p.lat,
        lng: p.lng,
      };
    });

    const pathD = svgPts.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    return {
      pathD,
      svgPoints: svgPts,
      currentPt: svgPts[svgPts.length - 1],
      startPt: svgPts[0],
    };
  }, [pathPoints]);

  const handleResetTrack = () => {
    if (speedData.latitude !== null && speedData.longitude !== null) {
      setPathPoints([{
        lat: speedData.latitude,
        lng: speedData.longitude,
        speed: speedData.currentSpeedKmh,
        timestamp: Date.now(),
      }]);
    } else {
      setPathPoints(INITIAL_DEMO_PATH);
    }
  };

  const currentLatStr = speedData.latitude !== null ? speedData.latitude.toFixed(4) : '37.7832';
  const currentLngStr = speedData.longitude !== null ? speedData.longitude.toFixed(4) : '-122.4082';

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
          <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 text-blue-400">
            <Route className="w-4 h-4" />
          </div>
          <span>GPS Mini-Map & Trip Analytics</span>
        </div>
        {activeTrip ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 font-mono backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            RECORDING TRIP
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 font-mono">
            {pathPoints.length} GPS Points
          </span>
        )}
      </div>

      {/* SVG GPS Mini-Map Canvas Card */}
      <div className="relative w-full aspect-[2.5/1] bg-slate-950/90 rounded-2xl border border-white/10 overflow-hidden shadow-xl mb-3 flex flex-col justify-between">
        {/* SVG Canvas Map */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 340 130">
          <defs>
            {/* Dark Grid Overlay */}
            <pattern id="miniMapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.8" />
            </pattern>

            {/* Glowing path filter */}
            <filter id="pathGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#miniMapGrid)" />

          {/* Simulated Road Grid Network Background */}
          <line x1="0" y1="40" x2="340" y2="40" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="0" y1="90" x2="340" y2="90" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="120" y1="0" x2="120" y2="130" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="240" y1="0" x2="240" y2="130" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />

          {/* Glowing Background Path */}
          {svgMapData.pathD && (
            <path
              d={svgMapData.pathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="5"
              opacity="0.35"
              filter="url(#pathGlow)"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Core Driving Route Line */}
          {svgMapData.pathD && (
            <path
              d={svgMapData.pathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Waypoint Markers */}
          {/* Start Point Dot */}
          {svgMapData.startPt && (
            <g>
              <circle cx={svgMapData.startPt.x} cy={svgMapData.startPt.y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          )}

          {/* Fatigue Warnings along the route */}
          {svgMapData.svgPoints.map((pt, i) => {
            if (pt.alertLevel === 'RED' || pt.alertLevel === 'YELLOW') {
              return (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="6" fill="rgba(239, 68, 68, 0.4)" className="animate-ping" />
                  <circle cx={pt.x} cy={pt.y} r="3.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                </g>
              );
            }
            return null;
          })}

          {/* Current Vehicle Live Radar Pulse */}
          {svgMapData.currentPt && (
            <g>
              <circle cx={svgMapData.currentPt.x} cy={svgMapData.currentPt.y} r="10" fill="rgba(56, 189, 248, 0.3)" className="animate-ping" />
              <circle cx={svgMapData.currentPt.x} cy={svgMapData.currentPt.y} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Top Floating Map HUD Badges */}
        <div className="relative z-10 p-2 flex items-center justify-between text-[10px] pointer-events-none">
          <div className="backdrop-blur-md bg-black/60 px-2 py-0.5 rounded-lg border border-white/20 text-slate-200 flex items-center gap-1 font-mono shadow-md">
            <Compass className="w-3 h-3 text-blue-400" />
            <span>{currentLatStr}° N, {currentLngStr}° W</span>
          </div>
          <div className="backdrop-blur-md bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-400/30 flex items-center gap-1 font-mono font-bold shadow-md">
            <Crosshair className="w-3 h-3 text-blue-400" />
            <span>3D GPS FIX</span>
          </div>
        </div>

        {/* Bottom Floating Map HUD Footer */}
        <div className="relative z-10 p-2 flex items-center justify-between text-[10px]">
          <div className="backdrop-blur-md bg-black/60 px-2 py-0.5 rounded-lg border border-white/20 text-slate-300 flex items-center gap-1 font-sans truncate max-w-[200px]">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{speedData.locationName || 'Expressway Corridor'}</span>
          </div>

          <button
            onClick={handleResetTrack}
            id="btn-reset-gps-track"
            title="Re-center & Reset GPS Track"
            className="backdrop-blur-md bg-white/10 hover:bg-white/20 text-slate-200 p-1 rounded-lg border border-white/20 transition-all flex items-center gap-1 font-medium"
          >
            <RotateCcw className="w-3 h-3 text-blue-300" />
            <span className="hidden sm:inline">Recenter</span>
          </button>
        </div>
      </div>

      {/* Active Recording Card */}
      {activeTrip ? (
        <div className="backdrop-blur-md bg-white/5 p-3 rounded-2xl border border-blue-400/30 mb-3 grid grid-cols-3 gap-2 text-center shadow-lg">
          <div>
            <span className="block text-[10px] text-slate-400 font-medium">Trip Distance</span>
            <span className="text-base sm:text-lg font-black text-white font-mono">{activeTrip.distanceKm} km</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-medium">Duration</span>
            <span className="text-base sm:text-lg font-black text-blue-300 font-mono">{formatTime(activeTrip.durationSeconds)}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-medium">Max Speed</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">{activeTrip.maxSpeedKmh} km/h</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-300 backdrop-blur-md bg-white/5 p-2.5 rounded-2xl border border-white/10 text-center mb-3">
          Click &quot;Start Monitor&quot; to log your drive and track real-time vehicle route.
        </div>
      )}

      {/* Past Trips History Section */}
      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
          <span>Recent Driving Log</span>
          <button
            onClick={() => setShowFullHistory(!showFullHistory)}
            className="text-[10px] text-blue-400 hover:underline"
          >
            {showFullHistory ? 'Collapse' : 'View History'}
          </button>
        </div>

        {pastTrips.slice(0, showFullHistory ? 5 : 2).map((trip) => (
          <div key={trip.id} className="backdrop-blur-md bg-white/5 p-2.5 rounded-xl border border-white/10 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-200 mb-1">
              <span>{trip.startTime} → {trip.endTime}</span>
              <span className="text-emerald-400 font-mono font-bold">{trip.distanceKm} km</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1 font-mono">
              <span>Avg: {trip.avgSpeedKmh} km/h</span>
              <span>Max: {trip.maxSpeedKmh} km/h</span>
              <span className={trip.drowsinessAlertsCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                Drowsy: {trip.drowsinessAlertsCount}
              </span>
            </div>
            {trip.aiSummary && (
              <div className="text-[11px] text-blue-300/90 flex items-center gap-1.5 pt-1 border-t border-white/10 mt-1">
                <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
                <span>{trip.aiSummary}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

