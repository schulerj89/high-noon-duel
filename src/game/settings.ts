export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  muted: boolean;
  cameraShakeAmount: number;
  screenFlashAmount: number;
  reticleSize: number;
  reticleOpacity: number;
  subtitlesEnabled: boolean;
  reducedMotion: boolean;
  lowDetailMode: boolean;
  showReactionTime: boolean;
  difficultyAssist: boolean;
}

export const SETTINGS_STORAGE_KEY = "high-noon-duel:settings:v1";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  masterVolume: 0.85,
  musicVolume: 0.82,
  sfxVolume: 0.85,
  voiceVolume: 0.9,
  muted: false,
  cameraShakeAmount: 1,
  screenFlashAmount: 1,
  reticleSize: 1,
  reticleOpacity: 1,
  subtitlesEnabled: true,
  reducedMotion: false,
  lowDetailMode: false,
  showReactionTime: true,
  difficultyAssist: false
};

export function loadGameSettings(): GameSettings {
  const storage = getLocalStorage();

  if (!storage) {
    return { ...DEFAULT_GAME_SETTINGS };
  }

  try {
    const rawValue = storage.getItem(SETTINGS_STORAGE_KEY);

    if (!rawValue) {
      return { ...DEFAULT_GAME_SETTINGS };
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return parseGameSettings(parsed);
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveGameSettings(settings: GameSettings): void {
  getLocalStorage()?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function updateGameSettings(
  settings: GameSettings,
  patch: Partial<GameSettings>
): GameSettings {
  return normalizeGameSettings({
    ...settings,
    ...patch
  });
}

function parseGameSettings(value: unknown): GameSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_GAME_SETTINGS };
  }

  return normalizeGameSettings({
    masterVolume: readNumber(value.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume),
    musicVolume: readNumber(value.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume),
    sfxVolume: readNumber(value.sfxVolume, DEFAULT_GAME_SETTINGS.sfxVolume),
    voiceVolume: readNumber(value.voiceVolume, DEFAULT_GAME_SETTINGS.voiceVolume),
    muted: readBoolean(value.muted, DEFAULT_GAME_SETTINGS.muted),
    cameraShakeAmount: readNumber(value.cameraShakeAmount, DEFAULT_GAME_SETTINGS.cameraShakeAmount),
    screenFlashAmount: readNumber(value.screenFlashAmount, DEFAULT_GAME_SETTINGS.screenFlashAmount),
    reticleSize: readNumber(value.reticleSize, DEFAULT_GAME_SETTINGS.reticleSize),
    reticleOpacity: readNumber(value.reticleOpacity, DEFAULT_GAME_SETTINGS.reticleOpacity),
    subtitlesEnabled: readBoolean(value.subtitlesEnabled, DEFAULT_GAME_SETTINGS.subtitlesEnabled),
    reducedMotion: readBoolean(value.reducedMotion, DEFAULT_GAME_SETTINGS.reducedMotion),
    lowDetailMode: readBoolean(value.lowDetailMode, DEFAULT_GAME_SETTINGS.lowDetailMode),
    showReactionTime: readBoolean(value.showReactionTime, DEFAULT_GAME_SETTINGS.showReactionTime),
    difficultyAssist: readBoolean(value.difficultyAssist, DEFAULT_GAME_SETTINGS.difficultyAssist)
  });
}

function normalizeGameSettings(settings: GameSettings): GameSettings {
  return {
    masterVolume: clamp01(settings.masterVolume),
    musicVolume: clamp01(settings.musicVolume),
    sfxVolume: clamp01(settings.sfxVolume),
    voiceVolume: clamp01(settings.voiceVolume),
    muted: settings.muted,
    cameraShakeAmount: clampRange(settings.cameraShakeAmount, 0, 1.5),
    screenFlashAmount: clamp01(settings.screenFlashAmount),
    reticleSize: clampRange(settings.reticleSize, 0.65, 1.75),
    reticleOpacity: clampRange(settings.reticleOpacity, 0.25, 1),
    subtitlesEnabled: settings.subtitlesEnabled,
    reducedMotion: settings.reducedMotion,
    lowDetailMode: settings.lowDetailMode,
    showReactionTime: settings.showReactionTime,
    difficultyAssist: settings.difficultyAssist
  };
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clamp01(value: number): number {
  return clampRange(value, 0, 1);
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
