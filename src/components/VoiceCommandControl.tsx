import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Radio, Sparkles, Volume2, CheckCircle2, AlertCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface VoiceCommandControlProps {
  isMonitoring: boolean;
  onToggleMonitoring: (start?: boolean) => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onTriggerSOS?: () => void;
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const VoiceCommandControl: React.FC<VoiceCommandControlProps> = ({
  isMonitoring,
  onToggleMonitoring,
  onToggleMute,
  isMuted,
  onTriggerSOS,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [recognizedCommand, setRecognizedCommand] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  const processCommand = useCallback((transcript: string) => {
    const text = transcript.toLowerCase().trim();
    setLastTranscript(transcript);

    if (text.includes('start drive') || text.includes('start monitor') || text.includes('start safety') || text.includes('start tracking')) {
      setRecognizedCommand('Start DriveSafe');
      soundManager.speakText("Voice command confirmed: Starting DriveSafe monitoring.");
      if (!isMonitoring) {
        onToggleMonitoring(true);
      }
    } else if (text.includes('stop drive') || text.includes('stop monitor') || text.includes('stop safety') || text.includes('stop tracking')) {
      setRecognizedCommand('Stop DriveSafe');
      soundManager.speakText("Voice command confirmed: Stopping DriveSafe monitoring.");
      if (isMonitoring) {
        onToggleMonitoring(false);
      }
    } else if (text.includes('mute sound') || text.includes('mute alarm') || text.includes('mute')) {
      setRecognizedCommand('Mute Audio');
      if (!isMuted) {
        onToggleMute();
        soundManager.speakText("Alarms muted.");
      }
    } else if (text.includes('unmute sound') || text.includes('unmute alarm') || text.includes('unmute') || text.includes('sound on')) {
      setRecognizedCommand('Unmute Audio');
      if (isMuted) {
        onToggleMute();
        soundManager.speakText("Alarms unmuted.");
      }
    } else if (text.includes('sos') || text.includes('emergency') || text.includes('help me') || text.includes('dispatch')) {
      setRecognizedCommand('Trigger Emergency SOS');
      soundManager.speakText("Emergency SOS triggered by voice!");
      if (onTriggerSOS) onTriggerSOS();
    } else {
      setRecognizedCommand(null);
    }

    // Auto clear badge after 4 seconds
    setTimeout(() => setRecognizedCommand(null), 4000);
  }, [isMonitoring, isMuted, onToggleMonitoring, onToggleMute, onTriggerSOS]);

  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          setLastTranscript(event.results[i][0].transcript);
        }
      }

      if (finalTranscript) {
        processCommand(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech Recognition Error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorMessage('Microphone access denied for voice commands.');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if user kept listening active
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Ignore restart error
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [processCommand, isListening]);

  const toggleListening = () => {
    if (!isSupported) {
      alert("Speech Recognition is not supported on this browser. Try Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      soundManager.speakText("Voice listening deactivated.");
    } else {
      setErrorMessage(null);
      setIsListening(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          soundManager.speakText("Voice command active. Say Start DriveSafe or Stop DriveSafe.");
        } catch (e) {
          console.warn("Could not start recognition:", e);
        }
      }
    }
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-3 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Mic Status & Toggle Button */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <button
          onClick={toggleListening}
          id="btn-toggle-voice-commands"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg backdrop-blur-md ${
            isListening
              ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/40 shadow-rose-950/50 animate-pulse'
              : 'bg-blue-600/80 hover:bg-blue-500 text-white border border-blue-400/30 shadow-blue-950/50'
          }`}
        >
          {isListening ? (
            <>
              <Radio className="w-4 h-4 text-white animate-spin" />
              <span>Voice Control: Listening</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-blue-200" />
              <span>Enable Hands-Free Voice Control</span>
            </>
          )}
        </button>

        {/* Live Audio Spectrum Pulse */}
        {isListening && (
          <div className="flex items-center gap-1">
            <span className="w-1 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1 h-4 bg-amber-400 rounded-full animate-bounce"></span>
          </div>
        )}
      </div>

      {/* Voice Transcript & Recognition Status */}
      <div className="flex items-center gap-2 text-xs flex-1 max-w-md w-full justify-center sm:justify-end">
        {recognizedCommand ? (
          <div className="flex items-center gap-1.5 backdrop-blur-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Command Executed: <strong>{recognizedCommand}</strong></span>
          </div>
        ) : lastTranscript ? (
          <div className="flex items-center gap-1.5 backdrop-blur-md bg-white/5 border border-white/10 text-slate-300 px-3 py-1 rounded-xl truncate max-w-xs font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">&quot;{lastTranscript}&quot;</span>
          </div>
        ) : errorMessage ? (
          <div className="flex items-center gap-1 text-rose-400 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span className="font-semibold text-slate-300">Voice Commands:</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-blue-300">&quot;Start DriveSafe&quot;</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-rose-300">&quot;Stop DriveSafe&quot;</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-emerald-300">&quot;Emergency SOS&quot;</span>
          </div>
        )}
      </div>
    </div>
  );
};
