import {
  AUDIO_MANIFEST,
  type AudioManifest,
  type MusicAudioId,
  type SfxAudioId,
  type VoiceAudioId
} from "./audioManifest";

export interface MusicPlaybackOptions {
  loop?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
  restart?: boolean;
  volume?: number;
}

export interface AudioPreferences {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  muted: boolean;
}

type AudioCategory = "voice" | "sfx" | "music";

interface AudioTrack<Id extends string> {
  id: Id;
  category: AudioCategory;
  url: string;
  audio: HTMLAudioElement;
  missing: boolean;
}

const AUDIO_PREFERENCES_KEY = "high-noon-duel:audio-preferences:v1";
const DEFAULT_PREFERENCES: AudioPreferences = {
  masterVolume: 0.85,
  musicVolume: 0.82,
  sfxVolume: 0.85,
  voiceVolume: 0.9,
  muted: false
};

export class AudioManager {
  private readonly voiceTracks = new Map<VoiceAudioId, AudioTrack<VoiceAudioId>>();
  private readonly optionalVoiceTracks = new Map<string, AudioTrack<string>>();
  private readonly sfxTracks = new Map<SfxAudioId, AudioTrack<SfxAudioId>>();
  private readonly musicTracks = new Map<MusicAudioId, AudioTrack<MusicAudioId>>();
  private readonly activeMusic = new Map<MusicAudioId, HTMLAudioElement>();
  private readonly musicVolumeFactors = new Map<MusicAudioId, number>();
  private readonly fadeTimers = new Map<MusicAudioId, number>();
  private readonly activeSfx = new Set<HTMLAudioElement>();
  private readonly warnedMissingUrls = new Set<string>();
  private readonly queuedMusic = new Map<MusicAudioId, MusicPlaybackOptions>();

  private activeVoice: HTMLAudioElement | null = null;
  private preferences: AudioPreferences = loadAudioPreferences();
  private unlocked = false;

  public constructor(manifest: AudioManifest = AUDIO_MANIFEST) {
    this.preloadVoice(manifest.voice);
    this.preloadSfx(manifest.sfx);
    this.preloadMusic(manifest.music);
  }

  public unlock(): void {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;
    const queuedMusic = [...this.queuedMusic.entries()];
    this.queuedMusic.clear();

    for (const [id, options] of queuedMusic) {
      this.playMusic(id, options);
    }
  }

  public playVoice(id: VoiceAudioId): void {
    const track = this.voiceTracks.get(id);

    if (!track || !this.canPlay(track)) {
      return;
    }

    if (this.activeVoice) {
      this.activeVoice.pause();
      this.activeVoice.currentTime = 0;
    }

    const audio = track.audio;
    audio.loop = false;
    audio.currentTime = 0;
    this.applyVolume(audio, "voice");
    this.activeVoice = audio;
    void this.safePlay(audio, track);
  }

  public playVoiceFile(id: string, url: string): void {
    let track = this.optionalVoiceTracks.get(url);

    if (!track) {
      track = this.createTrack(id, "voice", url);
      this.optionalVoiceTracks.set(url, track);
    }

    if (!this.canPlay(track)) {
      return;
    }

    if (this.activeVoice) {
      this.activeVoice.pause();
      this.activeVoice.currentTime = 0;
    }

    const audio = track.audio;
    audio.loop = false;
    audio.currentTime = 0;
    this.applyVolume(audio, "voice");
    this.activeVoice = audio;
    void this.safePlay(audio, track);
  }

  public playSfx(id: SfxAudioId): void {
    const track = this.sfxTracks.get(id);

    if (!track || !this.canPlay(track)) {
      return;
    }

    const audio = track.audio.cloneNode(true) as HTMLAudioElement;
    audio.preload = "auto";
    audio.addEventListener("error", () => this.warnMissing(track), { once: true });
    audio.addEventListener(
      "ended",
      () => {
        this.activeSfx.delete(audio);
      },
      { once: true }
    );
    this.applyVolume(audio, "sfx");
    this.activeSfx.add(audio);
    void this.safePlay(audio, track).then((played) => {
      if (!played) {
        this.activeSfx.delete(audio);
      }
    });
  }

  public playMusic(id: MusicAudioId, options: MusicPlaybackOptions = {}): void {
    const track = this.musicTracks.get(id);

    if (!track) {
      return;
    }

    if (!this.unlocked) {
      this.queuedMusic.set(id, options);
      return;
    }

    if (track.missing) {
      return;
    }

    const fadeInMs = options.fadeInMs ?? 350;
    const loop = options.loop ?? true;
    const volumeFactor = clampVolume(options.volume ?? 1);
    const existing = this.activeMusic.get(id);

    if (existing && !options.restart) {
      existing.loop = loop;
      this.musicVolumeFactors.set(id, volumeFactor);
      this.fadeMusicVolume(id, existing.volume, this.getCategoryVolume("music", volumeFactor), fadeInMs);
      return;
    }

    if (existing) {
      this.clearFade(id);
      existing.pause();
      existing.currentTime = 0;
      this.activeMusic.delete(id);
    }

    const audio = track.audio;
    audio.loop = loop;
    audio.currentTime = 0;
    audio.volume = 0;
    audio.muted = this.preferences.muted;
    this.musicVolumeFactors.set(id, volumeFactor);
    this.activeMusic.set(id, audio);

    void this.safePlay(audio, track).then((played) => {
      if (!played) {
        this.activeMusic.delete(id);
        return;
      }

      this.fadeMusicVolume(id, 0, this.getCategoryVolume("music", volumeFactor), fadeInMs);
    });
  }

  public stopMusic(id: MusicAudioId, fadeOutMs = 300): void {
    const audio = this.activeMusic.get(id);

    if (!audio) {
      this.queuedMusic.delete(id);
      return;
    }

    this.queuedMusic.delete(id);
    this.fadeMusicVolume(id, audio.volume, 0, fadeOutMs, () => {
      audio.pause();
      audio.currentTime = 0;
      this.activeMusic.delete(id);
      this.musicVolumeFactors.delete(id);
    });
  }

  public stopAll(): void {
    if (this.activeVoice) {
      this.activeVoice.pause();
      this.activeVoice.currentTime = 0;
      this.activeVoice = null;
    }

    for (const [id, audio] of this.activeMusic) {
      this.clearFade(id);
      audio.pause();
      audio.currentTime = 0;
    }

    for (const audio of this.activeSfx) {
      audio.pause();
      audio.currentTime = 0;
    }

    this.activeMusic.clear();
    this.activeSfx.clear();
    this.musicVolumeFactors.clear();
    this.queuedMusic.clear();
  }

  public setMasterVolume(value: number): void {
    this.preferences.masterVolume = clampVolume(value);
    this.savePreferences();
    this.updateActiveVolumes();
  }

  public setMusicVolume(value: number): void {
    this.preferences.musicVolume = clampVolume(value);
    this.savePreferences();
    this.updateActiveVolumes();
  }

  public setSfxVolume(value: number): void {
    this.preferences.sfxVolume = clampVolume(value);
    this.savePreferences();
    this.updateActiveVolumes();
  }

  public setVoiceVolume(value: number): void {
    this.preferences.voiceVolume = clampVolume(value);
    this.savePreferences();
    this.updateActiveVolumes();
  }

  public mute(): void {
    this.setMuted(true);
  }

  public unmute(): void {
    this.setMuted(false);
  }

  public toggleMute(): boolean {
    this.setMuted(!this.preferences.muted);
    return this.preferences.muted;
  }

  public isMuted(): boolean {
    return this.preferences.muted;
  }

  public getPreferences(): AudioPreferences {
    return { ...this.preferences };
  }

  private preloadVoice(files: AudioManifest["voice"]): void {
    for (const [id, url] of Object.entries(files) as Array<[VoiceAudioId, string]>) {
      this.voiceTracks.set(id, this.createTrack(id, "voice", url));
    }
  }

  private preloadSfx(files: AudioManifest["sfx"]): void {
    for (const [id, url] of Object.entries(files) as Array<[SfxAudioId, string]>) {
      this.sfxTracks.set(id, this.createTrack(id, "sfx", url));
    }
  }

  private preloadMusic(files: AudioManifest["music"]): void {
    for (const [id, url] of Object.entries(files) as Array<[MusicAudioId, string]>) {
      this.musicTracks.set(id, this.createTrack(id, "music", url));
    }
  }

  private createTrack<Id extends string>(
    id: Id,
    category: AudioCategory,
    url: string
  ): AudioTrack<Id> {
    const audio = new Audio(url);
    const track: AudioTrack<Id> = {
      id,
      category,
      url,
      audio,
      missing: false
    };

    audio.preload = "auto";
    audio.addEventListener("error", () => this.warnMissing(track), { once: true });
    audio.load();

    return track;
  }

  private canPlay(track: AudioTrack<string>): boolean {
    return this.unlocked && !track.missing;
  }

  private async safePlay(audio: HTMLAudioElement, track: AudioTrack<string>): Promise<boolean> {
    try {
      await audio.play();
      return true;
    } catch (error) {
      if (isMissingAudioError(error)) {
        this.warnMissing(track);
      }

      return false;
    }
  }

  private warnMissing(track: AudioTrack<string>): void {
    track.missing = true;

    if (this.warnedMissingUrls.has(track.url)) {
      return;
    }

    this.warnedMissingUrls.add(track.url);
    console.warn(
      `[audio] Missing ${track.category} asset "${track.id}" at ${track.url}. Continuing without it.`
    );
  }

  private applyVolume(
    audio: HTMLAudioElement,
    category: AudioCategory,
    volumeFactor = 1
  ): void {
    audio.volume = this.getCategoryVolume(category, volumeFactor);
    audio.muted = this.preferences.muted;
  }

  private getCategoryVolume(category: AudioCategory, volumeFactor = 1): number {
    const categoryVolume =
      category === "music"
        ? this.preferences.musicVolume
        : category === "voice"
          ? this.preferences.voiceVolume
          : this.preferences.sfxVolume;

    return clampVolume(this.preferences.masterVolume * categoryVolume * volumeFactor);
  }

  private updateActiveVolumes(): void {
    if (this.activeVoice) {
      this.applyVolume(this.activeVoice, "voice");
    }

    for (const audio of this.activeSfx) {
      this.applyVolume(audio, "sfx");
    }

    for (const [id, audio] of this.activeMusic) {
      this.applyVolume(audio, "music", this.musicVolumeFactors.get(id) ?? 1);
    }
  }

  private setMuted(value: boolean): void {
    this.preferences.muted = value;
    this.savePreferences();
    this.updateActiveVolumes();
  }

  private savePreferences(): void {
    saveAudioPreferences(this.preferences);
  }

  private fadeMusicVolume(
    id: MusicAudioId,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void
  ): void {
    const audio = this.activeMusic.get(id);

    if (!audio) {
      return;
    }

    this.clearFade(id);

    if (durationMs <= 0) {
      audio.volume = clampVolume(to);
      onComplete?.();
      return;
    }

    const startedAt = performance.now();
    const timerId = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      audio.volume = clampVolume(from + (to - from) * progress);

      if (progress >= 1) {
        this.clearFade(id);
        onComplete?.();
      }
    }, 30);

    this.fadeTimers.set(id, timerId);
  }

  private clearFade(id: MusicAudioId): void {
    const timerId = this.fadeTimers.get(id);

    if (timerId !== undefined) {
      window.clearInterval(timerId);
      this.fadeTimers.delete(id);
    }
  }
}

function loadAudioPreferences(): AudioPreferences {
  const storage = getLocalStorage();

  if (!storage) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const rawValue = storage.getItem(AUDIO_PREFERENCES_KEY);

    if (!rawValue) {
      return { ...DEFAULT_PREFERENCES };
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (!isRecord(parsed)) {
      return { ...DEFAULT_PREFERENCES };
    }

    return {
      masterVolume: readVolume(parsed.masterVolume, DEFAULT_PREFERENCES.masterVolume),
      musicVolume: readVolume(parsed.musicVolume, DEFAULT_PREFERENCES.musicVolume),
      sfxVolume: readVolume(parsed.sfxVolume, DEFAULT_PREFERENCES.sfxVolume),
      voiceVolume: readVolume(parsed.voiceVolume, DEFAULT_PREFERENCES.voiceVolume),
      muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULT_PREFERENCES.muted
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function saveAudioPreferences(preferences: AudioPreferences): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
}

function readVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clampVolume(value) : fallback;
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isMissingAudioError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotSupportedError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
