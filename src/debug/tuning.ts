import type { EnemyDefinition } from "../data/enemies";
import type { PlayerStats } from "../game/progression";

export interface EnemyTuningOverride {
  reactionTimeMs?: number;
  accuracy?: number;
  fakeoutChance?: number;
}

export interface TuningOverrides {
  enemies: Record<string, EnemyTuningOverride>;
  drawPauseMinMs?: number;
  drawPauseMaxMs?: number;
  playerShotTimingBonusMs?: number;
  focusGraceMs?: number;
  hitZoneScaleMultiplier?: number;
  reticleSwayMultiplier?: number;
}

export interface EffectiveEnemyTuning {
  reactionTimeMs: number;
  accuracy: number;
  fakeoutChance: number;
}

export const TUNING_STORAGE_KEY = "high-noon-duel:tuning:v1";

export function createDefaultTuningOverrides(): TuningOverrides {
  return {
    enemies: {}
  };
}

export function loadTuningOverrides(): TuningOverrides {
  const storage = getLocalStorage();

  if (!storage) {
    return createDefaultTuningOverrides();
  }

  try {
    const rawValue = storage.getItem(TUNING_STORAGE_KEY);

    if (!rawValue) {
      return createDefaultTuningOverrides();
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return parseTuningOverrides(parsed);
  } catch {
    return createDefaultTuningOverrides();
  }
}

export function saveTuningOverrides(overrides: TuningOverrides): void {
  getLocalStorage()?.setItem(TUNING_STORAGE_KEY, JSON.stringify(overrides));
}

export function clearTuningOverrides(): void {
  getLocalStorage()?.removeItem(TUNING_STORAGE_KEY);
}

export function getEnemyTuning(
  enemy: EnemyDefinition,
  overrides: TuningOverrides
): EffectiveEnemyTuning {
  const enemyOverride = overrides.enemies[enemy.id] ?? {};

  return {
    reactionTimeMs: readNumber(enemyOverride.reactionTimeMs, enemy.reactionTimeMs),
    accuracy: clamp(readNumber(enemyOverride.accuracy, enemy.accuracy), 0, 1),
    fakeoutChance: clamp(readNumber(enemyOverride.fakeoutChance, enemy.fakeoutChance), 0, 1)
  };
}

export function setEnemyTuningValue(
  overrides: TuningOverrides,
  enemyId: string,
  key: keyof EnemyTuningOverride,
  value: number
): TuningOverrides {
  return {
    ...overrides,
    enemies: {
      ...overrides.enemies,
      [enemyId]: {
        ...overrides.enemies[enemyId],
        [key]: value
      }
    }
  };
}

export function setGlobalTuningValue(
  overrides: TuningOverrides,
  key: Exclude<keyof TuningOverrides, "enemies">,
  value: number
): TuningOverrides {
  return {
    ...overrides,
    [key]: value
  };
}

export function applyPlayerStatsTuning(
  stats: PlayerStats,
  overrides: TuningOverrides
): PlayerStats {
  const hitZoneScaleMultiplier = readNumber(overrides.hitZoneScaleMultiplier, 1);

  return {
    ...stats,
    shotTimingBonusMs:
      stats.shotTimingBonusMs + readNumber(overrides.playerShotTimingBonusMs, 0),
    focusGraceMs: stats.focusGraceMs + readNumber(overrides.focusGraceMs, 0),
    hitZoneScale: stats.hitZoneScale * Math.max(0.1, hitZoneScaleMultiplier)
  };
}

export function getDrawPauseMinMs(
  fallback: number,
  overrides: TuningOverrides
): number {
  return Math.max(0, readNumber(overrides.drawPauseMinMs, fallback));
}

export function getDrawPauseMaxMs(
  fallback: number,
  overrides: TuningOverrides
): number {
  return Math.max(getDrawPauseMinMs(fallback, overrides), readNumber(overrides.drawPauseMaxMs, fallback));
}

function parseTuningOverrides(value: unknown): TuningOverrides {
  if (!isRecord(value)) {
    return createDefaultTuningOverrides();
  }

  const enemies: Record<string, EnemyTuningOverride> = {};

  if (isRecord(value.enemies)) {
    for (const [enemyId, enemyValue] of Object.entries(value.enemies)) {
      if (!isRecord(enemyValue)) {
        continue;
      }

      enemies[enemyId] = {
        reactionTimeMs: optionalNumber(enemyValue.reactionTimeMs),
        accuracy: optionalNumber(enemyValue.accuracy),
        fakeoutChance: optionalNumber(enemyValue.fakeoutChance)
      };
    }
  }

  return {
    enemies,
    drawPauseMinMs: optionalNumber(value.drawPauseMinMs),
    drawPauseMaxMs: optionalNumber(value.drawPauseMaxMs),
    playerShotTimingBonusMs: optionalNumber(value.playerShotTimingBonusMs),
    focusGraceMs: optionalNumber(value.focusGraceMs),
    hitZoneScaleMultiplier: optionalNumber(value.hitZoneScaleMultiplier),
    reticleSwayMultiplier: optionalNumber(value.reticleSwayMultiplier)
  };
}

function readNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
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
