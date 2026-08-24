// High-Precision Web Audio API Synthesizer for DriveSafe AI Alerts
// Engineered with smooth envelope shaping, anti-clipping gain staging,
// and debounced alert scheduling.

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;
  private lastWarningBeepTime: number = 0;
  private lastCriticalAlarmTime: number = 0;
  private lastSpeakTime: number = 0;
  private lastSpokenText: string = '';
  private isContextUnlocked: boolean = false;

  constructor() {
    // Auto-unlock AudioContext on first user interaction
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('click', unlock, { once: true, passive: true });
      window.addEventListener('touchstart', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true, passive: true });
    }
  }

  public unlockAudioContext(): void {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.isContextUnlocked = true;
        }).catch(() => {});
      } else {
        this.isContextUnlocked = true;
      }
    } catch (e) {
      console.warn("Audio unlock note:", e);
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.audioCtx.currentTime);
    }
    if (muted) {
      this.stopAlarm();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  // Play high-frequency warning alert chirp with 1.2s debounce to prevent audio stacking
  public playWarningBeep(force: boolean = false): void {
    if (this.isMuted) return;
    const now = Date.now();
    if (!force && now - this.lastWarningBeepTime < 1200) return;
    this.lastWarningBeepTime = now;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Harmonic 2-stage chirp (880Hz -> 1320Hz)
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1320, t + 0.08);

      // Smooth attack and decay envelope
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.setValueAtTime(0.35, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

      osc.connect(gain);
      if (this.masterGain) {
        gain.connect(this.masterGain);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(t);
      osc.stop(t + 0.25);
    } catch (e) {
      console.warn("Audio warning alert error:", e);
    }
  }

  // Play urgent emergency siren alarm on critical status (Red Alert / Severe Fatigue)
  // Debounced to 1.6s to maintain continuous urgency without oscillator cacophony
  public playCriticalAlarm(force: boolean = false): void {
    if (this.isMuted) return;
    const now = Date.now();
    if (!force && now - this.lastCriticalAlarmTime < 1600) return;
    this.lastCriticalAlarmTime = now;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sawtooth';

      // 2-Tone Alternating Emergency Siren Pattern
      // Pulse 1
      osc1.frequency.setValueAtTime(950, t);
      osc1.frequency.setValueAtTime(1400, t + 0.12);
      osc1.frequency.setValueAtTime(950, t + 0.24);
      osc1.frequency.setValueAtTime(1400, t + 0.36);

      osc2.frequency.setValueAtTime(475, t);
      osc2.frequency.setValueAtTime(700, t + 0.12);
      osc2.frequency.setValueAtTime(475, t + 0.24);
      osc2.frequency.setValueAtTime(700, t + 0.36);

      // Volume envelope with pulsing intensity
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.03);
      gain.gain.setValueAtTime(0.4, t + 0.12);
      gain.gain.linearRampToValueAtTime(0.6, t + 0.24);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

      osc1.connect(gain);
      osc2.connect(gain);

      if (this.masterGain) {
        gain.connect(this.masterGain);
      } else {
        gain.connect(ctx.destination);
      }

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.58);
      osc2.stop(t + 0.58);
    } catch (e) {
      console.warn("Critical alarm audio error:", e);
    }
  }

  // System activation / status chime
  public playSystemChime(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.16); // G5

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      osc.connect(gain);
      if (this.masterGain) {
        gain.connect(this.masterGain);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(t);
      osc.stop(t + 0.42);
    } catch (e) {
      console.warn("System chime error:", e);
    }
  }

  // Text-to-speech alert message with debouncing
  public speakText(text: string, force: boolean = false): void {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    const now = Date.now();
    if (!force && this.lastSpokenText === text && now - this.lastSpeakTime < 4000) {
      return;
    }
    this.lastSpeakTime = now;
    this.lastSpokenText = text;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.1;
      utterance.volume = this.volume;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }

  // Stop any active sounds and speech
  public stopAlarm(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }
}

export const soundManager = new SoundManager();
