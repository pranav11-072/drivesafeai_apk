import React, { useState, useEffect } from 'react';
import { Route, Play, Square, Award, AlertTriangle, Sparkles, CheckCircle } from 'lucide-react';
import { TripRecord, SpeedData, DriverState } from '../types';
import { formatTime } from '../utils/geolocation';

interface TripTrackerProps {
  speedData: SpeedData;
  driverState: DriverState;
  isMonitoring: boolean;
}

export const TripTracker: React.FC<TripTrackerProps> = ({
  speedData,
  driverState,
  isMonitoring,
}) => {
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
          <Route className="w-5 h-5" />
          <span>Trip Analytics & Safety Log</span>
        </div>
        {activeTrip && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            RECORDING TRIP
          </span>
        )}
      </div>

      {/* Active Recording Card */}
      {activeTrip ? (
        <div className="bg-slate-950 p-3.5 rounded-xl border border-indigo-500/30 mb-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="block text-[10px] text-slate-400 font-medium">Trip Distance</span>
            <span className="text-lg font-black text-white font-mono">{activeTrip.distanceKm} km</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-medium">Duration</span>
            <span className="text-lg font-black text-indigo-300 font-mono">{formatTime(activeTrip.durationSeconds)}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-medium">Max Speed</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{activeTrip.maxSpeedKmh} km/h</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center mb-3">
          Click &quot;Start Monitor&quot; to begin auto-recording your driving session and safety logs.
        </div>
      )}

      {/* Past Trips History */}
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {pastTrips.map((trip) => (
          <div key={trip.id} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-200 mb-1">
              <span>{trip.startTime} → {trip.endTime}</span>
              <span className="text-emerald-400 font-mono font-bold">{trip.distanceKm} km</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1 font-mono">
              <span>Avg Speed: {trip.avgSpeedKmh} km/h</span>
              <span>Max: {trip.maxSpeedKmh} km/h</span>
              <span className={trip.drowsinessAlertsCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                Drowsy Alerts: {trip.drowsinessAlertsCount}
              </span>
            </div>
            {trip.aiSummary && (
              <div className="text-[11px] text-indigo-300/90 flex items-center gap-1.5 pt-1 border-t border-slate-800/80 mt-1">
                <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                <span>{trip.aiSummary}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
