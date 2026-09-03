// Axie Origins Audio & Music Manager
// Powered by official Axie Infinity: Origins battle sound effects and musical tracks

export type MusicTrack = 'home' | 'pvp' | 'pve_1' | 'boss' | 'summer23' | 'lunar_battle';

export class AudioManager {
  private currentTrack: MusicTrack | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmVolume: number = 0.35;
  private sfxVolume: number = 0.65;
  private isBgmMuted: boolean = false;
  private isSfxMuted: boolean = false;
  private isUnlocked: boolean = false;

  private sfxCache: Map<string, HTMLAudioElement> = new Map();
  private availableSfxNames: Set<string> = new Set();
  private onTrackChangeCallbacks: Array<(track: MusicTrack | null, isPlaying: boolean) => void> = [];

  constructor() {
    this.loadSettings();
    this.setupUserInteractionUnlock();
    this.initCatalog();
  }

  private async initCatalog() {
    try {
      const res = await fetch('/catalogs/sfx.json');
      if (res.ok) {
        const json = await res.json();
        if (json && json.items && Array.isArray(json.items)) {
          json.items.forEach((item: any) => {
            if (item.name) this.availableSfxNames.add(item.name);
          });
        }
      }
    } catch {
      // Fallback: available names will be checked dynamically
    }
  }

  private loadSettings() {
    try {
      const savedBgmVol = localStorage.getItem('axie_bgm_volume');
      if (savedBgmVol !== null) this.bgmVolume = parseFloat(savedBgmVol);

      const savedSfxVol = localStorage.getItem('axie_sfx_volume');
      if (savedSfxVol !== null) this.sfxVolume = parseFloat(savedSfxVol);

      const savedBgmMute = localStorage.getItem('axie_bgm_muted');
      if (savedBgmMute !== null) this.isBgmMuted = savedBgmMute === 'true';

      const savedSfxMute = localStorage.getItem('axie_sfx_muted');
      if (savedSfxMute !== null) this.isSfxMuted = savedSfxMute === 'true';
    } catch {}
  }

  private saveSettings() {
    try {
      localStorage.setItem('axie_bgm_volume', this.bgmVolume.toString());
      localStorage.setItem('axie_sfx_volume', this.sfxVolume.toString());
      localStorage.setItem('axie_bgm_muted', this.isBgmMuted.toString());
      localStorage.setItem('axie_sfx_muted', this.isSfxMuted.toString());
    } catch {}
  }

  private setupUserInteractionUnlock() {
    const unlock = () => {
      if (this.isUnlocked) return;
      this.isUnlocked = true;

      // Try resuming background music if it was paused by browser autoplay policy
      if (this.bgmAudio && this.currentTrack && !this.isBgmMuted) {
        this.bgmAudio.play().catch(() => {});
      }

      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('touchstart', unlock, { once: false });
  }

  public onTrackChange(cb: (track: MusicTrack | null, isPlaying: boolean) => void) {
    this.onTrackChangeCallbacks.push(cb);
  }

  private notifyTrackChange() {
    const isPlaying = !!(this.bgmAudio && !this.bgmAudio.paused);
    this.onTrackChangeCallbacks.forEach((cb) => cb(this.currentTrack, isPlaying));
  }

  // --- BGM Playback ---

  public async playBgm(track: MusicTrack, fade: boolean = true): Promise<void> {
    if (this.currentTrack === track && this.bgmAudio && !this.bgmAudio.paused) {
      return;
    }

    this.currentTrack = track;
    const src = `/audio/music/${track}.mp3`;

    if (this.bgmAudio) {
      const oldAudio = this.bgmAudio;
      if (fade) {
        let currentVol = oldAudio.volume;
        const fadeOut = setInterval(() => {
          currentVol = Math.max(0, currentVol - 0.05);
          oldAudio.volume = currentVol;
          if (currentVol <= 0) {
            clearInterval(fadeOut);
            oldAudio.pause();
            oldAudio.src = '';
          }
        }, 30);
      } else {
        oldAudio.pause();
        oldAudio.src = '';
      }
    }

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = this.isBgmMuted ? 0 : this.bgmVolume;
    this.bgmAudio = audio;

    try {
      await audio.play();
      this.notifyTrackChange();
    } catch (err) {
      // Browser blocked autoplay; will resume on first click
      this.notifyTrackChange();
    }
  }

  public pauseBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.notifyTrackChange();
    }
  }

  public resumeBgm(): void {
    if (this.bgmAudio && this.currentTrack) {
      this.bgmAudio.play().catch(() => {});
      this.notifyTrackChange();
    } else if (this.currentTrack) {
      this.playBgm(this.currentTrack);
    }
  }

  public stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.currentTrack = null;
      this.notifyTrackChange();
    }
  }

  public setBgmVolume(volume: number): void {
    this.bgmVolume = Math.min(1, Math.max(0, volume));
    if (this.bgmAudio && !this.isBgmMuted) {
      this.bgmAudio.volume = this.bgmVolume;
    }
    this.saveSettings();
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public toggleBgmMute(): boolean {
    this.isBgmMuted = !this.isBgmMuted;
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.isBgmMuted ? 0 : this.bgmVolume;
      if (!this.isBgmMuted && this.bgmAudio.paused && this.currentTrack) {
        this.bgmAudio.play().catch(() => {});
      }
    }
    this.saveSettings();
    this.notifyTrackChange();
    return this.isBgmMuted;
  }

  public isBgmSilenced(): boolean {
    return this.isBgmMuted;
  }

  public getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  // --- Sound Effects (SFX) Playback ---

  public playSfx(sfxName: string, volumeScale: number = 1.0): void {
    if (this.isSfxMuted || this.sfxVolume <= 0) return;

    try {
      const cleanName = sfxName.replace(/\.wav$/, '');
      const src = `/audio/sfx/${cleanName}.wav`;

      let audio = this.sfxCache.get(cleanName);
      if (!audio) {
        audio = new Audio(src);
        this.sfxCache.set(cleanName, audio);
      } else {
        // Clone for polyphonic overlapping sounds
        audio = audio.cloneNode() as HTMLAudioElement;
      }

      const effectiveVolume = Math.min(1, Math.max(0, this.sfxVolume * volumeScale));
      audio.volume = effectiveVolume;
      audio.play().catch(() => {});
    } catch (err) {
      // Ignored
    }
  }

  public playSkillSfx(vfxId: string, phase: 'attack' | 'fly' | 'hit', volumeScale: number = 1.0): void {
    const candidate = `${vfxId}_${phase}`;
    if (this.availableSfxNames.size === 0 || this.availableSfxNames.has(candidate)) {
      this.playSfx(candidate, volumeScale);
      return;
    }

    // Class fallback
    const parts = vfxId.split('_');
    const axieClass = parts[0];
    const classFallback = `${axieClass}_${phase}`;
    if (this.availableSfxNames.has(classFallback)) {
      this.playSfx(classFallback, volumeScale);
    } else {
      // General fallbacks
      if (phase === 'hit') this.playSfx('beast_gore_hit', volumeScale);
      else if (phase === 'attack') this.playSfx('aquatic_slash_attack', volumeScale);
      else if (phase === 'fly') this.playSfx('bird_projectile_fly', volumeScale);
    }
  }

  public playBuffSfx(buffId: string, volumeScale: number = 1.0): void {
    const cleanBuff = buffId.replace(/[-_]apply$/, '').replace(/[-_]boost$/, '');
    this.playSfx(cleanBuff, volumeScale);
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = Math.min(1, Math.max(0, volume));
    this.saveSettings();
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public toggleSfxMute(): boolean {
    this.isSfxMuted = !this.isSfxMuted;
    this.saveSettings();
    return this.isSfxMuted;
  }

  public isSfxSilenced(): boolean {
    return this.isSfxMuted;
  }

  // --- UI Sound Effects ---

  public playUiClick(): void {
    this.playSfx('feather', 0.4);
  }

  public playUiTab(): void {
    this.playSfx('leaf', 0.35);
  }

  public playUiEquip(): void {
    this.playSfx('power_gain', 0.5);
  }

  public playCardPlay(): void {
    this.playSfx('cleanse', 0.6);
  }
}

export const audioManager = new AudioManager();
