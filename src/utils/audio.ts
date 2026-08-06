// Web Audio API Audio Synthesizer for DriveSafe AI Alerts

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private alarmOscillator: OscillatorNode | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.alarmOscillator) {
      this.stopAlarm();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Play high-frequency warning alert chirp
  public playWarningBeep() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15); // A6 note

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn("Audio alert failed", e);
    }
  }

  // Play urgent loud multi-tone siren alarm on critical status (Red Alert / High Risk)
  public playCriticalAlarm() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      
      // Dual-oscillator for rich, penetrating alarm timbre
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'sawtooth';

      const now = ctx.currentTime;

      // Piercing rapid frequency alternation: 900Hz <-> 1800Hz
      osc1.frequency.setValueAtTime(900, now);
      osc1.frequency.setValueAtTime(1800, now + 0.1);
      osc1.frequency.setValueAtTime(900, now + 0.2);
      osc1.frequency.setValueAtTime(2200, now + 0.3);
      osc1.frequency.setValueAtTime(900, now + 0.4);

      osc2.frequency.setValueAtTime(450, now);
      osc2.frequency.setValueAtTime(900, now + 0.1);
      osc2.frequency.setValueAtTime(450, now + 0.2);
      osc2.frequency.setValueAtTime(1100, now + 0.3);

      // Rapid pulsing gain envelope
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.setValueAtTime(0.1, now + 0.1);
      gain.gain.setValueAtTime(0.7, now + 0.15);
      gain.gain.setValueAtTime(0.1, now + 0.25);
      gain.gain.setValueAtTime(0.8, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn("Critical alarm audio error", e);
    }
  }

  // Text-to-speech alert message
  public speakText(text: string) {
    if (this.isMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // cancel previous speak
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1.2;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error", e);
    }
  }

  // Stop any ongoing sounds
  public stopAlarm() {
    if (this.alarmOscillator) {
      try {
        this.alarmOscillator.stop();
        this.alarmOscillator.disconnect();
      } catch (e) {}
      this.alarmOscillator = null;
    }
  }
}

export const soundManager = new SoundManager();
