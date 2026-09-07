import React, { useState, useEffect, useMemo } from 'react';
import {
  Route,
  MapPin,
  Compass,
  Crosshair,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  Lock,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { TripRecord, SpeedData, DriverState, AlertLevel } from '../types';
import { formatTime, formatCoordinates } from '../utils/geolocation';

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
  onRetryGps?: () => void;
}

export const TripTracker: React.FC<TripTrackerProps> = ({
  speedData,
  driverState,
  isMonitoring,
  onRetryGps,
}) => {
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const isGpsActive = speedData.gpsStatus === 'active' || speedData.gpsStatus === 'simulated' || speedData.speedSource === 'random';
  const isGpsLoading = speedData.gpsStatus === 'loading' && !isGpsActive;
  const isGpsDenied = speedData.gpsStatus === 'denied' && !isGpsActive;
  const isGpsUnavailable = speedData.gpsStatus === 'unavailable' && !isGpsActive;

  // Sample trip logs with realistic historical data
  const [pastTrips, setPastTrips] = useState<TripRecord[]>([
    {
      id: 'trip-101',
      startTime: 'Previous Run, 08:30 AM',
      endTime: '09:15 AM',
      durationSeconds: 2700,
      distanceKm: 34.2,
      avgSpeedKmh: 45,
      maxSpeedKmh: 72,
      drowsinessAlertsCount: 0,
      safetyScore: 98,
      aiSummary: 'Smooth commute with zero fatigue warnings detected.',
    },
    {
      id: 'trip-102',
      startTime: 'Previous Run, 10:15 PM',
      endTime: '11:30 PM',
      durationSeconds: 4500,
      distanceKm: 68.5,
      avgSpeedKmh: 62,
      maxSpeedKmh: 95,
      drowsinessAlertsCount: 2,
      safetyScore: 82,
      aiSummary: 'Late night drive. 2 minor yawn fatigue alerts recorded.',
    },
  ]);

  // Track coordinates when location updates and GPS is active
  useEffect(() => {
    if (
      isGpsActive &&
      speedData.latitude !== null &&
      speedData.longitude !== null
    ) {
      const curLat = speedData.latitude;
      const curLng = speedData.longitude;

      setPathPoints(prev => {
        const last = prev[prev.length - 1];
        // Append if moved noticeably (> 0.00003 deg ~ 3 meters) or first point
        if (
          !last ||
          Math.abs(last.lat - curLat) > 0.00003 ||
          Math.abs(last.lng - curLng) > 0.00003
        ) {
          const newPt: PathPoint = {
            lat: curLat,
            lng: curLng,
            speed: speedData.currentSpeedKmh || 0,
            alertLevel: driverState.alertLevel,
            timestamp: Date.now(),
          };
          const updated = [...prev, newPt];
          if (updated.length > 80) return updated.slice(updated.length - 80);
          return updated;
        }
        return prev;
      });
    }
  }, [
    isGpsActive,
    speedData.latitude,
    speedData.longitude,
    speedData.currentSpeedKmh,
    driverState.alertLevel,
  ]);

  // Update active trip metrics in real time
  useEffect(() => {
    let interval: any = null;
    if (isMonitoring) {
      if (!activeTrip) {
        setActiveTrip({
          id: `trip-${Date.now()}`,
          startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          durationSeconds: 0,
          distanceKm: 0.0,
          avgSpeedKmh: speedData.currentSpeedKmh || 0,
          maxSpeedKmh: speedData.currentSpeedKmh || 0,
          drowsinessAlertsCount: 0,
          safetyScore: 100,
        });
      } else {
        interval = setInterval(() => {
          setActiveTrip(prev => {
            if (!prev) return null;
            const newDuration = prev.durationSeconds + 1;
            const currentSpeed = speedData.currentSpeedKmh || 0;
            const addedDistance = currentSpeed / 3600; // km in 1 second
            const newDistance = prev.distanceKm + addedDistance;
            const newMaxSpeed = Math.max(prev.maxSpeedKmh, currentSpeed);
            const newDrowsinessCount =
              prev.drowsinessAlertsCount + (driverState.alertLevel === 'RED' ? 1 : 0);

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
        aiSummary:
          activeTrip.drowsinessAlertsCount === 0
            ? 'Trip completed with high alertness.'
            : `Trip logged with ${activeTrip.drowsinessAlertsCount} fatigue warning(s).`,
      };
      setPastTrips(prev => [completedTrip, ...prev]);
      setActiveTrip(null);
    }

    return () => clearInterval(interval);
  }, [isMonitoring, speedData.currentSpeedKmh, driverState.alertLevel]);

  // SVG Mini-Map Calculation
  const svgMapData = useMemo(() => {
    if (pathPoints.length === 0) {
      return { pathD: '', svgPoints: [], currentPt: null, startPt: null };
    }

    const lats = pathPoints.map(p => p.lat);
    const lngs = pathPoints.map(p => p.lng);

    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.001, maxLng - minLng);

    minLat -= latSpan * 0.15;
    maxLat += latSpan * 0.15;
    minLng -= lngSpan * 0.15;
    maxLng += lngSpan * 0.15;

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
      setPathPoints([
        {
          lat: speedData.latitude,
          lng: speedData.longitude,
          speed: speedData.currentSpeedKmh || 0,
          timestamp: Date.now(),
        },
      ]);
    } else {
      setPathPoints([]);
    }
  };

  const coordinatesDisplay = isGpsActive && speedData.latitude !== null && speedData.longitude !== null
    ? formatCoordinates(speedData.latitude, speedData.longitude)
    : isGpsLoading
    ? 'Acquiring coordinates...'
    : isGpsDenied
    ? 'Unavailable (Permission Denied)'
    : 'Coordinates Unavailable';

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full">
      {/* Top Title Bar with Dynamic GPS Status */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
          <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 text-blue-400">
            <Route className="w-4 h-4" />
          </div>
          <span>GPS Mini-Map & Trip Analytics</span>
        </div>

        <div className="flex items-center gap-1.5">
          {activeTrip ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              RECORDING TRIP
            </span>
          ) : isGpsActive ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>GPS Active</span>
            </span>
          ) : isGpsLoading ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
              <span>GPS Loading</span>
            </span>
          ) : isGpsDenied ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Permission Denied</span>
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              <AlertTriangle className="w-3 h-3 text-slate-400" />
              <span>GPS Unavailable</span>
            </span>
          )}
        </div>
      </div>

      {/* SVG GPS Mini-Map Canvas Card */}
      <div className="relative w-full aspect-[2.5/1] bg-slate-950/90 rounded-2xl border border-white/10 overflow-hidden shadow-xl mb-3 flex flex-col justify-between">
        {/* SVG Canvas Map */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 340 130">
          <defs>
            <pattern id="miniMapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.8" />
            </pattern>
            <filter id="pathGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#miniMapGrid)" />

          {/* Reference Grid lines */}
          <line x1="0" y1="40" x2="340" y2="40" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="0" y1="90" x2="340" y2="90" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="120" y1="0" x2="120" y2="130" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="240" y1="0" x2="240" y2="130" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" strokeWidth="1" />

          {/* Real Driving Route Path Line if available */}
          {isGpsActive && svgMapData.pathD && (
            <>
              <path
                d={svgMapData.pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="5"
                opacity="0.35"
                filter="url(#pathGlow)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={svgMapData.pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Start Point Dot */}
          {isGpsActive && svgMapData.startPt && (
            <circle cx={svgMapData.startPt.x} cy={svgMapData.startPt.y} r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
          )}

          {/* Alert Markers */}
          {isGpsActive && svgMapData.svgPoints.map((pt, i) => {
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

          {/* Current Vehicle Position */}
          {isGpsActive && svgMapData.currentPt && (
            <g>
              <circle cx={svgMapData.currentPt.x} cy={svgMapData.currentPt.y} r="10" fill="rgba(16, 185, 129, 0.3)" className="animate-ping" />
              <circle cx={svgMapData.currentPt.x} cy={svgMapData.currentPt.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Informative Center Overlays when GPS is not active with points */}
        {isGpsActive && pathPoints.length <= 1 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none z-10">
            <Radio className="w-6 h-6 text-emerald-400 animate-pulse mb-1" />
            <p className="text-xs font-semibold text-emerald-200">GPS Active</p>
            <p className="text-[10px] text-slate-400 max-w-xs mt-0.5">
              Driving route will trace here in real time as your vehicle travels.
            </p>
          </div>
        )}

        {isGpsLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none z-10">
            <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mb-1" />
            <p className="text-xs font-semibold text-sky-200">Acquiring GPS Signal...</p>
            <p className="text-[10px] text-slate-400 max-w-xs mt-0.5">
              Connecting to device GPS to enable live route tracking.
            </p>
          </div>
        )}

        {isGpsDenied && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-black/40 backdrop-blur-xs">
            <Lock className="w-6 h-6 text-amber-400 mb-1" />
            <p className="text-xs font-semibold text-amber-200">Location Permission Denied</p>
            <p className="text-[10px] text-slate-400 max-w-xs mt-0.5">
              Live route plotting requires browser location permission.
            </p>
            {onRetryGps && (
              <button
                onClick={onRetryGps}
                className="mt-2 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 px-2 py-0.5 rounded font-bold transition-all pointer-events-auto"
              >
                Retry Location Permission
              </button>
            )}
          </div>
        )}

        {isGpsUnavailable && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-black/40 backdrop-blur-xs">
            <AlertTriangle className="w-6 h-6 text-slate-400 mb-1" />
            <p className="text-xs font-semibold text-slate-300">GPS Tracking Unavailable</p>
            <p className="text-[10px] text-slate-400 max-w-xs mt-0.5">
              {speedData.gpsErrorMessage || "No GPS sensor detected or location service is disabled."}
            </p>
          </div>
        )}

        {/* Top Floating Map HUD Badges */}
        <div className="relative z-10 p-2 flex items-center justify-between text-[10px] pointer-events-none">
          <div className="backdrop-blur-md bg-black/60 px-2 py-0.5 rounded-lg border border-white/20 text-slate-200 flex items-center gap-1 font-mono shadow-md">
            <Compass className="w-3 h-3 text-blue-400" />
            <span>{coordinatesDisplay}</span>
          </div>
          <div
            className={`backdrop-blur-md px-2 py-0.5 rounded-lg border flex items-center gap-1 font-mono font-bold shadow-md ${
              isGpsActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                : isGpsLoading
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                : isGpsDenied
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span>
              {isGpsActive
                ? speedData.speedSource === 'random'
                  ? 'SIM DRIVE (±5m)'
                  : `GPS FIX (±${speedData.accuracyMeters || 10}m)`
                : isGpsLoading
                ? 'ACQUIRING FIX'
                : isGpsDenied
                ? 'PERMISSION DENIED'
                : 'NO GPS'}
            </span>
          </div>
        </div>

        {/* Bottom Floating Map HUD Footer */}
        <div className="relative z-10 p-2 flex items-center justify-between text-[10px]">
          <div className="backdrop-blur-md bg-black/60 px-2 py-0.5 rounded-lg border border-white/20 text-slate-300 flex items-center gap-1 font-sans truncate max-w-[200px]">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{speedData.locationName}</span>
          </div>

          {isGpsActive && (
            <button
              onClick={handleResetTrack}
              id="btn-reset-gps-track"
              title="Re-center & Reset GPS Track"
              className="backdrop-blur-md bg-white/10 hover:bg-white/20 text-slate-200 p-1 rounded-lg border border-white/20 transition-all flex items-center gap-1 font-medium pointer-events-auto"
            >
              <RotateCcw className="w-3 h-3 text-blue-300" />
              <span className="hidden sm:inline">Recenter</span>
            </button>
          )}
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
              <span>{trip.startTime} {trip.endTime ? `→ ${trip.endTime}` : ''}</span>
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
