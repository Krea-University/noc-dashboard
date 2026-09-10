// Web Audio API Synthesizer & Sound Manager for KREA IT NOC

class SoundManager {
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;
  private masterEnabled: boolean = true;
  private masterVolume: number = 0.8; // 0.0 - 1.0
  private listeners: Array<(unlocked: boolean, enabled: boolean) => void> = [];

  constructor() {
    // Restore user preference from localStorage
    const savedEnabled = localStorage.getItem('krea_noc_sound_enabled');
    if (savedEnabled !== null) {
      this.masterEnabled = savedEnabled === 'true';
    }
    const savedVol = localStorage.getItem('krea_noc_master_volume');
    if (savedVol !== null) {
      this.masterVolume = parseFloat(savedVol);
    }
  }

  public subscribe(cb: (unlocked: boolean, enabled: boolean) => void) {
    this.listeners.push(cb);
    cb(this.isUnlocked, this.masterEnabled);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.isUnlocked, this.masterEnabled));
  }

  public isAudioUnlocked(): boolean {
    return this.isUnlocked && this.ctx !== null && this.ctx.state === 'running';
  }

  public isSoundEnabled(): boolean {
    return this.masterEnabled;
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('krea_noc_master_volume', this.masterVolume.toString());
  }

  public toggleMasterSound(): boolean {
    this.masterEnabled = !this.masterEnabled;
    localStorage.setItem('krea_noc_sound_enabled', this.masterEnabled.toString());
    this.notify();
    return this.masterEnabled;
  }

  public async unlockAudio(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      // Play a short soft unlock chime to verify
      this.playTone(523.25, 0.1, 0.05); // C5
      this.isUnlocked = true;
      this.masterEnabled = true;
      localStorage.setItem('krea_noc_sound_enabled', 'true');
      this.notify();
      return true;
    } catch (e) {
      console.error('Failed unlocking AudioContext:', e);
      return false;
    }
  }

  public playAlert(channel: string, action: string, volumePct: number = 80) {
    if (!this.masterEnabled) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    const gain = (volumePct / 100) * this.masterVolume;

    if (action === 'RECOVERY') {
      this.playRecoveryChime(gain);
      return;
    }

    switch (channel.toUpperCase()) {
      case 'SWITCH':
        this.playSwitchDownAlert(gain);
        break;
      case 'SERVER':
        this.playServerDownAlert(gain);
        break;
      case 'BIOMETRIC':
        this.playBiometricDownAlert(gain);
        break;
      case 'ILL':
        this.playILLDownAlert(gain);
        break;
      case 'CLASSROOM':
        // Muted by rule
        break;
      default:
        this.playSwitchDownAlert(gain);
    }
  }

  // 1. SWITCH Alert: Descending dual-tone warning
  private playSwitchDownAlert(gain: number) {
    this.playTone(440, 0.25, gain, 'sawtooth');
    setTimeout(() => this.playTone(330, 0.35, gain, 'sawtooth'), 280);
  }

  // 2. SERVER Alert: Heavy urgent klaxon alarm
  private playServerDownAlert(gain: number) {
    this.playTone(587.33, 0.2, gain, 'square'); // D5
    setTimeout(() => this.playTone(440.00, 0.2, gain, 'square'), 220); // A4
    setTimeout(() => this.playTone(587.33, 0.3, gain, 'square'), 440);
  }

  // 3. BIOMETRIC Alert: High-frequency distinct chirp
  private playBiometricDownAlert(gain: number) {
    this.playTone(659.25, 0.15, gain, 'sine'); // E5
    setTimeout(() => this.playTone(880.00, 0.25, gain, 'sine'), 160); // A5
  }

  // 4. ILL Alert: Fast urgent sweeping tone
  private playILLDownAlert(gain: number) {
    this.playTone(880, 0.15, gain, 'triangle');
    setTimeout(() => this.playTone(659, 0.15, gain, 'triangle'), 160);
    setTimeout(() => this.playTone(880, 0.25, gain, 'triangle'), 320);
  }

  // 5. RECOVERY Chime: Pleasant ascending triad (C-E-G)
  private playRecoveryChime(gain: number) {
    this.playTone(523.25, 0.2, gain * 0.7, 'sine'); // C5
    setTimeout(() => this.playTone(659.25, 0.2, gain * 0.7, 'sine'), 180); // E5
    setTimeout(() => this.playTone(783.99, 0.4, gain * 0.8, 'sine'), 360); // G5
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Tone playback error:', e);
    }
  }
}

export const soundManager = new SoundManager();
