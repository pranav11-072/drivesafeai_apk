import React, { useState, useEffect, useRef } from 'react';
import { Video, ShieldAlert, Download, Play, Pause, Trash2, Camera, Clock, Eye, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IncidentClip, DriverState, SpeedData } from '../types';

interface IncidentRecorderProps {
  driverState: DriverState;
  speedData: SpeedData;
}

const INITIAL_CLIPS: IncidentClip[] = [
  {
    id: 'clip-1',
    timestamp: '00:42:15',
    reason: 'micro_sleep',
    durationSeconds: 10,
    earAtIncident: 0.11,
    speedKmh: 58,
    location: 'Hwy 101 Northbound, Exit 48',
    thumbnailUrl: '',
  },
  {
    id: 'clip-2',
    timestamp: '00:28:40',
    reason: 'severe_fatigue',
    durationSeconds: 10,
    earAtIncident: 0.18,
    speedKmh: 62,
    location: 'Hwy 101, Near Grand Ave',
    thumbnailUrl: '',
  },
];

export const IncidentRecorder: React.FC<IncidentRecorderProps> = ({
  driverState,
  speedData,
}) => {
  const [clips, setClips] = useState<IncidentClip[]>(INITIAL_CLIPS);
  const [selectedClip, setSelectedClip] = useState<IncidentClip | null>(INITIAL_CLIPS[0]);
  const [isRecordingIncident, setIsRecordingIncident] = useState(false);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [replayFrameTick, setReplayFrameTick] = useState(0);

  const prevMicroSleepRef = useRef(driverState.microSleepCount);
  const prevAlertLevelRef = useRef(driverState.alertLevel);

  // Auto-record 10s buffer clip on Micro-Sleep or Critical Red Alert
  useEffect(() => {
    const isNewMicroSleep = driverState.microSleepCount > prevMicroSleepRef.current;
    const isNewRedAlert = driverState.alertLevel === 'RED' && prevAlertLevelRef.current !== 'RED';

    prevMicroSleepRef.current = driverState.microSleepCount;
    prevAlertLevelRef.current = driverState.alertLevel;

    if ((isNewMicroSleep || isNewRedAlert) && !isRecordingIncident) {
      captureIncidentClip(isNewMicroSleep ? 'micro_sleep' : 'severe_fatigue');
    }
  }, [driverState.microSleepCount, driverState.alertLevel, isRecordingIncident]);

  const captureIncidentClip = (reason: 'micro_sleep' | 'severe_fatigue' | 'distraction' | 'manual_capture' = 'manual_capture') => {
    setIsRecordingIncident(true);

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const newClip: IncidentClip = {
      id: `clip-${Date.now()}`,
      timestamp: timeStr,
      reason,
      durationSeconds: 10,
      earAtIncident: driverState.ear,
      speedKmh: speedData.currentSpeedKmh,
      location: speedData.locationName,
      thumbnailUrl: '',
    };

    setTimeout(() => {
      setClips(prev => [newClip, ...prev.slice(0, 7)]);
      setSelectedClip(newClip);
      setIsRecordingIncident(false);
    }, 1200);
  };

  // Replay animation simulation loop
  useEffect(() => {
    let anim: NodeJS.Timeout;
    if (isPlayingReplay) {
      anim = setInterval(() => {
        setReplayFrameTick(prev => (prev + 1) % 30);
      }, 100);
    }
    return () => clearInterval(anim);
  }, [isPlayingReplay]);

  const handleDeleteClip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClips(prev => prev.filter(c => c.id !== id));
    if (selectedClip?.id === id) {
      setSelectedClip(clips.find(c => c.id !== id) || null);
    }
  };

  const handleDownloadClipData = (clip: IncidentClip) => {
    const data = {
      clipId: clip.id,
      timestamp: clip.timestamp,
      incidentType: clip.reason,
      telemetry: {
        ear: clip.earAtIncident,
        speedKmh: clip.speedKmh,
        location: clip.location,
      },
      auditSignature: `DRIVESAFE-AI-VERIFIED-${Date.now()}`,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-${clip.reason}-${clip.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Blackbox Incident Clip Recorder
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                  Auto-Buffered
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                10-Sec Rolling Crash & Micro-Sleep Buffer
              </p>
            </div>
          </div>

          <button
            onClick={() => captureIncidentClip('manual_capture')}
            disabled={isRecordingIncident}
            id="btn-manual-capture-clip"
            className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:bg-red-950 text-white px-3 py-1.5 rounded-xl shadow-md transition-all active:scale-95 border border-red-400/30"
          >
            {isRecordingIncident ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Buffering Clip...</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Save 10s Clip</span>
              </>
            )}
          </button>
        </div>

        {/* Selected Incident Replay Monitor */}
        {selectedClip ? (
          <div className="relative w-full aspect-video bg-slate-950/90 rounded-xl overflow-hidden border border-white/10 p-3 flex flex-col justify-between mb-3">
            {/* Replay Simulated Video HUD */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
              <div className="w-40 h-52 border border-red-500/50 rounded-2xl"></div>
              <div className="absolute top-1/3 left-1/3 w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-red-500 rounded-full"></div>
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-red-400 bg-black/80 px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                INCIDENT REPLAY ({selectedClip.timestamp})
              </span>
              <span className="text-[10px] font-mono text-slate-300 bg-black/80 px-2 py-0.5 rounded">
                EAR: {selectedClip.earAtIncident.toFixed(2)} | {selectedClip.speedKmh} KM/H
              </span>
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <button
                onClick={() => setIsPlayingReplay(prev => !prev)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md transition-all"
              >
                {isPlayingReplay ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
                <span>{isPlayingReplay ? 'Pause Replay' : 'Play 10s Incident'}</span>
              </button>

              <button
                onClick={() => handleDownloadClipData(selectedClip)}
                className="flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200 bg-sky-500/20 px-2.5 py-1 rounded-lg border border-sky-500/30"
              >
                <Download className="w-3 h-3" />
                <span>Export Telemetry</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-white/5 mb-3">
            No incident clips recorded. Drive safely!
          </div>
        )}

        {/* Clip Library List */}
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-300 block">
            Incident Event Log ({clips.length} Events)
          </span>

          {clips.map(clip => {
            const isSelected = selectedClip?.id === clip.id;
            return (
              <div
                key={clip.id}
                onClick={() => setSelectedClip(clip)}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-red-500/20 border-red-400 text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-lg ${clip.reason === 'micro_sleep' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {clip.reason === 'micro_sleep' ? <Eye className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs block capitalize">
                      {clip.reason.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {clip.timestamp} • {clip.location}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-300">
                    {clip.durationSeconds}s
                  </span>
                  <button
                    onClick={(e) => handleDeleteClip(clip.id, e)}
                    className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                    title="Delete clip"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
