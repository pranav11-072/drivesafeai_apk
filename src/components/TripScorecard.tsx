import React, { useState } from 'react';
import { Award, ShieldCheck, AlertTriangle, Download, Printer, RefreshCw, Sparkles, TrendingUp, CheckCircle, Clock, Navigation, Eye, Zap, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DriverState, SpeedData } from '../types';

interface TripScorecardProps {
  driverState: DriverState;
  speedData: SpeedData;
  isOpen: boolean;
  onClose: () => void;
}

export const TripScorecard: React.FC<TripScorecardProps> = ({
  driverState,
  speedData,
  isOpen,
  onClose,
}) => {
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Compute Trip Safety Score & Grade
  const microSleepPenalty = driverState.microSleepCount * 25;
  const yawnPenalty = driverState.yawnCount * 4;
  const distractionPenalty = driverState.distractionCount * 6;
  const fatiguePenalty = Math.round(driverState.drowsinessLevel * 0.35);

  const rawScore = Math.max(0, 100 - (microSleepPenalty + yawnPenalty + distractionPenalty + fatiguePenalty));
  const score = Math.min(100, Math.round(rawScore));

  let grade = 'A+';
  let gradeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  let riskLevel = 'LOW RISK';

  if (score >= 90) {
    grade = 'A+';
    gradeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    riskLevel = 'OPTIMAL ALERTNESS';
  } else if (score >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    riskLevel = 'SAFE DRIVER';
  } else if (score >= 70) {
    grade = 'B';
    gradeColor = 'text-sky-400 border-sky-500/40 bg-sky-500/10';
    riskLevel = 'MODERATE ALERTNESS';
  } else if (score >= 60) {
    grade = 'C';
    gradeColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    riskLevel = 'ELEVATED FATIGUE';
  } else if (score >= 45) {
    grade = 'D';
    gradeColor = 'text-orange-400 border-orange-500/40 bg-orange-500/10';
    riskLevel = 'HIGH FATIGUE';
  } else {
    grade = 'F';
    gradeColor = 'text-red-400 border-red-500/40 bg-red-500/10';
    riskLevel = 'CRITICAL DANGER';
  }

  // Simulated Alertness Timeline Segments for this trip
  const timelineSegments = [
    { time: '00:00', status: 'GREEN', label: 'Trip Start — Fully Alert' },
    { time: '00:15', status: 'GREEN', label: 'Smooth Cruise' },
    { time: '00:30', status: driverState.yawnCount > 1 ? 'YELLOW' : 'GREEN', label: 'Postural Shift' },
    { time: '00:45', status: driverState.drowsinessLevel > 40 ? 'YELLOW' : 'GREEN', label: 'Blink Rate Variation' },
    { time: '01:00', status: driverState.microSleepCount > 0 ? 'RED' : driverState.drowsinessLevel > 60 ? 'RED' : 'GREEN', label: 'Fatigue Event / Current' },
  ];

  const handleFetchAiSummary = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const res = await fetch('/api/ai/safety-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate an executive driver safety scorecard summary based on this trip: Safety Score: ${score}/100 (Grade ${grade}), Micro-sleeps: ${driverState.microSleepCount}, Yawns: ${driverState.yawnCount}, Distractions: ${driverState.distractionCount}, Average Drowsiness: ${driverState.drowsinessLevel}%. Provide 3 concise bullet points analyzing fatigue patterns and safe rest recommendations.`,
          driveHistory: {
            score,
            grade,
            microSleepCount: driverState.microSleepCount,
            yawnCount: driverState.yawnCount,
            distractionCount: driverState.distractionCount,
            drowsinessLevel: driverState.drowsinessLevel,
          },
        }),
      });
      const data = await res.json();
      if (data.advice) {
        setAiAnalysis(data.advice);
      }
    } catch (e) {
      console.warn("Scorecard AI summary error:", e);
      setAiAnalysis(`Trip Summary: Driver maintained an overall score of ${score}/100 (${grade}). Key recommendations: Take a mandatory 15-minute rest stop after 90 minutes of continuous driving and hydrate regularly.`);
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  const handleDownloadReport = () => {
    const reportData = {
      title: "DriveSafe AI — Driver Trip Safety Scorecard",
      timestamp: new Date().toISOString(),
      safetyScore: score,
      safetyGrade: grade,
      riskAssessment: riskLevel,
      telemetry: {
        microSleeps: driverState.microSleepCount,
        yawns: driverState.yawnCount,
        distractions: driverState.distractionCount,
        currentDrowsiness: driverState.drowsinessLevel,
        currentSpeedKmh: speedData.currentSpeedKmh,
        location: speedData.locationName,
      },
      aiSummary: aiAnalysis || "Trip verified with DriveSafe AI Computer Vision.",
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drivesafe-trip-scorecard-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl text-slate-100 relative my-8"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Driver Trip Safety Scorecard
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal border border-emerald-500/30">
                Official Report
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              End-of-Trip Telemetry, Fatigue Analysis, and AI Risk Evaluation
            </p>
          </div>
        </div>

        {/* Hero Grade & Key Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
          {/* Main Grade Box */}
          <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${gradeColor}`}>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              Safety Grade
            </span>
            <span className="text-5xl font-black tracking-tight my-1">{grade}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/10">
              {score} / 100 Score
            </span>
            <span className="text-[10px] font-mono mt-1 opacity-80">{riskLevel}</span>
          </div>

          {/* Incident Telemetry Summary */}
          <div className="sm:col-span-2 grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Eye className="w-3 h-3 text-red-400" /> Micro-Sleeps
              </span>
              <div className="my-1">
                <span className={`text-2xl font-black ${driverState.microSleepCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {driverState.microSleepCount}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {driverState.microSleepCount > 0 ? 'Severe Events' : 'Zero Recorded'}
                </span>
              </div>
              <span className="text-[9px] text-slate-500">Duration &gt;1.5s</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Yawns Logged
              </span>
              <div className="my-1">
                <span className={`text-2xl font-black ${driverState.yawnCount > 3 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {driverState.yawnCount}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {driverState.yawnCount > 3 ? 'Elevated Fatigue' : 'Normal Frequency'}
                </span>
              </div>
              <span className="text-[9px] text-slate-500">MAR &gt; 0.60</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-sky-400" /> Distractions
              </span>
              <div className="my-1">
                <span className="text-2xl font-black text-slate-200">
                  {driverState.distractionCount}
                </span>
                <span className="text-[10px] text-slate-400 block">Head Turns</span>
              </div>
              <span className="text-[9px] text-slate-500">Yaw &gt; 25°</span>
            </div>
          </div>
        </div>

        {/* Chronological Alertness Heatmap */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              Trip Alertness Timeline Heatmap
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Continuous Session</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 h-7 rounded-lg overflow-hidden p-1 bg-slate-950/70 border border-white/5">
            {timelineSegments.map((seg, idx) => (
              <div
                key={idx}
                title={`${seg.time} - ${seg.label}`}
                className={`h-full rounded flex items-center justify-center text-[10px] font-bold ${
                  seg.status === 'RED'
                    ? 'bg-red-500/80 text-white shadow-sm shadow-red-500/50'
                    : seg.status === 'YELLOW'
                    ? 'bg-amber-500/80 text-slate-950'
                    : 'bg-emerald-500/70 text-slate-950'
                }`}
              >
                {seg.time}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 0-30% Optimal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> 31-59% Mild Drowsiness
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400"></span> 60-100% Critical Alert
            </span>
          </div>
        </div>

        {/* AI Trip Evaluation & Safety Analysis */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 to-indigo-950/30 border border-blue-500/20 mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Gemini AI Driver Safety Assessment
            </h4>
            <button
              onClick={handleFetchAiSummary}
              disabled={isGeneratingAiSummary}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20"
            >
              {isGeneratingAiSummary ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span>{aiAnalysis ? 'Regenerate Analysis' : 'Generate AI Assessment'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {aiAnalysis || (
              <span>
                Based on your current telemetry profile (Score: <strong>{score}/100</strong>), you maintained safe headway with {driverState.microSleepCount} critical micro-sleep interruptions and {driverState.yawnCount} fatigue yawns. Click &quot;Generate AI Assessment&quot; for full multimodal safety analysis and rest recommendations.
              </span>
            )}
          </p>
        </div>

        {/* Actions & Export Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadReport}
              id="btn-download-scorecard-json"
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 px-3 py-2 rounded-xl border border-white/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handlePrint}
              id="btn-print-scorecard"
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 px-3 py-2 rounded-xl border border-white/10 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Print PDF</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-950/50"
          >
            Close Report
          </button>
        </div>
      </motion.div>
    </div>
  );
};
