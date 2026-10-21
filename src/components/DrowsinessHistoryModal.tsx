import React, { useState } from 'react';
import {
  X, AlertOctagon, Eye, AlertTriangle, ArrowDownCircle,
  Clock, ShieldAlert, Sparkles, Filter, Download, Trash2,
  CheckCircle2, Compass, Activity, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DrowsinessEvent, DriverState } from '../types';

interface DrowsinessHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: DrowsinessEvent[];
  onClearEvents?: () => void;
  driverState: DriverState;
}

export const DrowsinessHistoryModal: React.FC<DrowsinessHistoryModalProps> = ({
  isOpen,
  onClose,
  events,
  onClearEvents,
  driverState,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DROWSINESS' | 'HEAD_DOWN' | 'DISTRACTION' | 'YAWNING'>('ALL');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const filteredEvents = events.filter(e => {
    if (filterType === 'ALL') return true;
    if (filterType === 'DROWSINESS') return e.type === 'EYES_CLOSED' || e.type === 'HEAD_DOWN';
    if (filterType === 'HEAD_DOWN') return e.type === 'HEAD_DOWN';
    if (filterType === 'DISTRACTION') return e.type === 'DISTRACTION';
    if (filterType === 'YAWNING') return e.type === 'YAWNING';
    return true;
  });

  const criticalCount = events.filter(e => e.severity === 'CRITICAL').length;
  const warningCount = events.filter(e => e.severity === 'WARNING').length;
  const headDownCount = events.filter(e => e.type === 'HEAD_DOWN').length;
  const eyeClosedCount = events.filter(e => e.type === 'EYES_CLOSED').length;

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      exportedAt: new Date().toISOString(),
      summary: {
        totalEvents: events.length,
        criticalAlerts: criticalCount,
        headDownNods: headDownCount,
        eyeClosures: eyeClosedCount,
        currentSafetyScore: driverState.safetyScore,
      },
      events,
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `drowsiness-history-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copySummary = () => {
    const summaryText = `DriveSafe AI Trip History Summary:
Total Events: ${events.length}
Critical Alarms: ${criticalCount}
Head-Down Nods: ${headDownCount}
Eye Closures: ${eyeClosedCount}
Safety Score: ${driverState.safetyScore}/100
Last Event: ${events[0]?.title || 'None'} at ${events[0]?.timestamp || 'N/A'}`;

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-slate-100"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Trip Event History</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono font-semibold border border-sky-500/30">
                  {events.length} {events.length === 1 ? 'incident' : 'incidents'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Timestamped log of drowsiness, head nods & distractions for current trip
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={exportToJson}
              disabled={events.length === 0}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
              title="Download event log as JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Metrics Cards */}
        <div className="grid grid-cols-4 gap-2 p-3 sm:p-4 bg-slate-950/30 border-b border-white/5">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-2.5 text-center">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Total</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">{events.length}</div>
          </div>
          <div className="rounded-2xl bg-red-500/10 border border-red-500/25 p-2.5 text-center">
            <div className="text-[10px] font-mono text-red-300 uppercase font-semibold">Critical</div>
            <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{criticalCount}</div>
          </div>
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-2.5 text-center">
            <div className="text-[10px] font-mono text-amber-300 uppercase font-semibold">Head Nods</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{headDownCount}</div>
          </div>
          <div className="rounded-2xl bg-sky-500/10 border border-sky-500/25 p-2.5 text-center">
            <div className="text-[10px] font-mono text-sky-300 uppercase font-semibold">Micro-Sleep</div>
            <div className="text-xl font-bold font-mono text-sky-400 mt-0.5">{eyeClosedCount}</div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="px-4 py-2.5 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Filter:</span>
            </span>
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'ALL'
                  ? 'bg-sky-500 text-white font-bold'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setFilterType('DROWSINESS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'DROWSINESS'
                  ? 'bg-red-500 text-white font-bold'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Drowsiness ({eyeClosedCount + headDownCount})
            </button>
            <button
              onClick={() => setFilterType('HEAD_DOWN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'HEAD_DOWN'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Head Down ({headDownCount})
            </button>
            <button
              onClick={() => setFilterType('DISTRACTION')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'DISTRACTION'
                  ? 'bg-indigo-500 text-white font-bold'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Distractions ({events.filter(e => e.type === 'DISTRACTION').length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copySummary}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-medium px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy Summary'}
            </button>
            {onClearEvents && events.length > 0 && (
              <button
                onClick={onClearEvents}
                className="text-[11px] text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center gap-1"
                title="Reset trip event log"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Events List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-white/5">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400/80 mb-2" />
              <p className="text-sm font-bold text-white">No incidents recorded in this filter</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                {events.length === 0
                  ? "Drive safe! Any micro-sleep, head nod, or distraction during the trip will automatically appear here with exact timestamps."
                  : "No events match the selected category filter."}
              </p>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isRed = evt.severity === 'CRITICAL';
              const isAmber = evt.severity === 'WARNING';

              return (
                <div
                  key={evt.id}
                  className={`pt-2.5 first:pt-0 flex items-start justify-between gap-3 p-3 rounded-2xl border transition-all ${
                    isRed
                      ? 'bg-red-500/10 border-red-500/30'
                      : isAmber
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isRed
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : isAmber
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    }`}>
                      {evt.type === 'EYES_CLOSED' ? (
                        <Eye className="w-4 h-4" />
                      ) : evt.type === 'HEAD_DOWN' ? (
                        <ArrowDownCircle className="w-4 h-4" />
                      ) : evt.type === 'DISTRACTION' ? (
                        <Compass className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-white">{evt.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                          isRed
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : isAmber
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                        }`}>
                          {evt.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{evt.description}</p>
                      
                      {/* Telemetry Chips */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-mono text-slate-400">
                        {evt.pitchDeg !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-amber-300">
                            Head Pitch: +{evt.pitchDeg}°
                          </span>
                        )}
                        {evt.ear !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-sky-300">
                            EAR: {evt.ear.toFixed(2)}
                          </span>
                        )}
                        {evt.durationSeconds !== undefined && evt.durationSeconds > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-slate-300">
                            Duration: {evt.durationSeconds.toFixed(1)}s
                          </span>
                        )}
                        {evt.speedKmh !== undefined && evt.speedKmh !== null && (
                          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-slate-300">
                            Speed: {evt.speedKmh} km/h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-slate-300">{evt.timestamp}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{evt.date}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-white/10 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Driver Safety Score: <strong className="text-white font-mono">{driverState.safetyScore}/100</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
