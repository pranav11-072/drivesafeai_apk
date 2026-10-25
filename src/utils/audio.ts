// High-Precision Web Audio API Synthesizer for DriveSafe AI Alerts
// Engineered with smooth envelope shaping, anti-clipping gain staging,
// and debounced alert scheduling.
// Supports single-shot 2.0-second buzzer alarms with dedicated buzzer mute control.

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private buzzerMuted: boolean = false;
  private volume: number = 0.85;

  private activeAlarmOscillators: OscillatorNode[] = [];
  private activeAlarmGain: GainNode | null = null;
  private alarmStopTimeout: any = null;
  private isAlarmPlaying: boolean = false;
  private lastAlarmEndTime: number = 0;

  private lastWarningBeepTime: number = 0;
  private lastSpeakTime: number = 0;
  private lastSpokenText: string = '';
  public isContextUnlocked: boolean = false;

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
    this.dispatchBuzzerState();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Dedicated Buzzer Control (Off Buzzer / Mute Buzzer)
  public setBuzzerMuted(muted: boolean): void {
    this.buzzerMuted = muted;
    if (muted) {
      this.stopAlarm();
    }
    this.dispatchBuzzerState();
  }

  public isBuzzerMuted(): boolean {
    return this.buzzerMuted || this.isMuted;
  }

  public toggleBuzzer(): boolean {
    const nextState = !this.buzzerMuted;
    this.setBuzzerMuted(nextState);
    return nextState;
  }

  public silenceBuzzer(): void {
    this.stopAlarm();
  }

  private dispatchBuzzerState(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dms:buzzer_changed', {
        detail: { isBuzzerMuted: this.buzzerMuted, isMuted: this.isMuted }
      }));
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  // Play high-frequency warning alert chirp with 1.2s debounce to prevent audio stacking
  public playWarningBeep(force: boolean = false): void {
    if (this.isMuted || this.buzzerMuted) return;
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
  // EXACT REQUIREMENT: Rings once for exactly 2.0 seconds and then automatically stops!
  // Does not loop continuously. Debounced and guarded so subsequent frames don't re-trigger.
  public playCriticalAlarm(force: boolean = false): void {
    if (this.isMuted || this.buzzerMuted) return;

    // If alarm is already sounding its 2-second alert, do not restart or stack
    if (this.isAlarmPlaying) return;

    const now = Date.now();
    // Enforce cooldown so after the 2-second ring stops, it waits at least 3.5 seconds before repeating
    if (!force && now - this.lastAlarmEndTime < 3500) {
      return;
    }

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      this.isAlarmPlaying = true;
      const t = ctx.currentTime;
      const duration = 2.0; // Strictly 2.0 seconds

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sawtooth';

      // 4-pulse alternating emergency siren over the exact 2-second window (0.5s per pulse cycle)
      // Pulse 1 (0.0s - 0.5s)
      osc1.frequency.setValueAtTime(950, t);
      osc1.frequency.setValueAtTime(1400, t + 0.12);
      osc1.frequency.setValueAtTime(950, t + 0.25);
      osc1.frequency.setValueAtTime(1400, t + 0.38);

      // Pulse 2 (0.5s - 1.0s)
      osc1.frequency.setValueAtTime(950, t + 0.50);
      osc1.frequency.setValueAtTime(1400, t + 0.62);
      osc1.frequency.setValueAtTime(950, t + 0.75);
      osc1.frequency.setValueAtTime(1400, t + 0.88);

      // Pulse 3 (1.0s - 1.5s)
      osc1.frequency.setValueAtTime(950, t + 1.00);
      osc1.frequency.setValueAtTime(1400, t + 1.12);
      osc1.frequency.setValueAtTime(950, t + 1.25);
      osc1.frequency.setValueAtTime(1400, t + 1.38);

      // Pulse 4 (1.5s - 2.0s)
      osc1.frequency.setValueAtTime(950, t + 1.50);
      osc1.frequency.setValueAtTime(1400, t + 1.62);
      osc1.frequency.setValueAtTime(950, t + 1.75);
      osc1.frequency.setValueAtTime(1400, t + 1.88);

      // Lower harmonic sub-oscillator
      for (let p = 0; p < 4; p++) {
        const offset = p * 0.5;
        osc2.frequency.setValueAtTime(475, t + offset);
        osc2.frequency.setValueAtTime(700, t + offset + 0.12);
        osc2.frequency.setValueAtTime(475, t + offset + 0.25);
        osc2.frequency.setValueAtTime(700, t + offset + 0.38);
      }

      // Smooth pulsing volume envelope across the 2 seconds
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.03);
      for (let p = 0; p < 4; p++) {
        const offset = p * 0.5;
        gain.gain.setValueAtTime(0.55, t + offset + 0.03);
        gain.gain.setValueAtTime(0.20, t + offset + 0.24);
        gain.gain.linearRampToValueAtTime(0.60, t + offset + 0.27);
        gain.gain.setValueAtTime(0.20, t + offset + 0.48);
      }
      // Precise taper to zero right at 2.0 seconds
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc1.connect(gain);
      osc2.connect(gain);

      if (this.masterGain) {
        gain.connect(this.masterGain);
      } else {
        gain.connect(ctx.destination);
      }

      this.activeAlarmOscillators = [osc1, osc2];
      this.activeAlarmGain = gain;

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + duration);
      osc2.stop(t + duration);

      // Safety timer to clear references and reset flag precisely after 2.0 seconds
      if (this.alarmStopTimeout) {
        clearTimeout(this.alarmStopTimeout);
      }
      this.alarmStopTimeout = setTimeout(() => {
        this.stopAlarm();
      }, duration * 1000);
    } catch (e) {
      console.warn("Critical alarm audio error:", e);
      this.isAlarmPlaying = false;
    }
  }

  // System activation / status chime
  public playSystemChime(): void {
    if (this.isMuted || this.buzzerMuted) return;
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
    if (this.isMuted || this.buzzerMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

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

  // Stop any active buzzer alarm sounds immediately
  public stopAlarm(): void {
    if (this.alarmStopTimeout) {
      clearTimeout(this.alarmStopTimeout);
      this.alarmStopTimeout = null;
    }

    this.isAlarmPlaying = false;
    this.lastAlarmEndTime = Date.now();

    for (const osc of this.activeAlarmOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    }
    this.activeAlarmOscillators = [];

    if (this.activeAlarmGain) {
      try {
        this.activeAlarmGain.disconnect();
      } catch (e) {}
      this.activeAlarmGain = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  public isAlarmActive(): boolean {
    return this.isAlarmPlaying;
  }
}

export const soundManager = new SoundManager();
