import { DEFAULT_ENEMY } from "../data/enemies";
import {
  findUpgradeById,
  UPGRADES,
  type UpgradeDefinition,
  type UpgradeId
} from "../data/upgrades";
import type { DuelOutcome } from "./state";

export interface PlayerProgression {
  money: number;
  ownedUpgrades: UpgradeId[];
  duelsWon: number;
  duelsLost: number;
  selectedEnemyId: string;
}

export interface PlayerStats {
  shotTimingBonusMs: number;
  hitZoneScale: number;
  focusGraceMs: number;
  hitZoneHighlightMs: number;
  luckyCharmChance: number;
  luckyCharmWindowMs: number;
}

export type PurchaseUpgradeResult =
  | {
      status: "purchased";
      progression: PlayerProgression;
      upgrade: UpgradeDefinition;
    }
  | {
      status: "owned" | "insufficient-funds" | "missing";
      progression: PlayerProgression;
      upgrade?: UpgradeDefinition;
    };

export const PROGRESSION_STORAGE_KEY = "high-noon-duel:progression:v1";

export const BASE_PLAYER_STATS: PlayerStats = {
  shotTimingBonusMs: 0,
  hitZoneScale: 1,
  focusGraceMs: 0,
  hitZoneHighlightMs: 0,
  luckyCharmChance: 0,
  luckyCharmWindowMs: 0
};

export function createDefaultProgression(): PlayerProgression {
  return {
    money: 0,
    ownedUpgrades: [],
    duelsWon: 0,
    duelsLost: 0,
    selectedEnemyId: DEFAULT_ENEMY.id
  };
}

export function loadProgression(): PlayerProgression {
  const storage = getLocalStorage();

  if (!storage) {
    return createDefaultProgression();
  }

  try {
    const rawValue = storage.getItem(PROGRESSION_STORAGE_KEY);

    if (!rawValue) {
      return createDefaultProgression();
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return parseProgression(parsed) ?? createDefaultProgression();
  } catch {
    return createDefaultProgression();
  }
}

export function saveProgression(progression: PlayerProgression): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  storage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(progression));
}

export function clearSavedProgression(): void {
  getLocalStorage()?.removeItem(PROGRESSION_STORAGE_KEY);
}

export function rememberSelectedEnemy(
  progression: PlayerProgression,
  selectedEnemyId: string
): PlayerProgression {
  return {
    ...progression,
    selectedEnemyId
  };
}

export function recordDuelResult(
  progression: PlayerProgression,
  outcome: DuelOutcome,
  reward: number,
  selectedEnemyId: string
): PlayerProgression {
  return {
    ...progression,
    money: progression.money + (outcome === "win" ? reward : 0),
    duelsWon: progression.duelsWon + (outcome === "win" ? 1 : 0),
    duelsLost: progression.duelsLost + (outcome === "loss" ? 1 : 0),
    selectedEnemyId
  };
}

export function purchaseUpgrade(
  progression: PlayerProgression,
  upgradeId: UpgradeId
): PurchaseUpgradeResult {
  const upgrade = findUpgradeById(upgradeId);

  if (!upgrade) {
    return { status: "missing", progression };
  }

  if (progression.ownedUpgrades.includes(upgradeId)) {
    return { status: "owned", progression, upgrade };
  }

  if (progression.money < upgrade.cost) {
    return { status: "insufficient-funds", progression, upgrade };
  }

  return {
    status: "purchased",
    upgrade,
    progression: {
      ...progression,
      money: progression.money - upgrade.cost,
      ownedUpgrades: [...progression.ownedUpgrades, upgradeId]
    }
  };
}

export function derivePlayerStats(ownedUpgrades: readonly UpgradeId[]): PlayerStats {
  const stats: PlayerStats = { ...BASE_PLAYER_STATS };

  for (const upgrade of UPGRADES) {
    if (!ownedUpgrades.includes(upgrade.id)) {
      continue;
    }

    stats.shotTimingBonusMs += upgrade.effect.shotTimingBonusMs ?? 0;
    stats.hitZoneScale += upgrade.effect.hitZoneScaleBonus ?? 0;
    stats.focusGraceMs += upgrade.effect.focusGraceMs ?? 0;
    stats.hitZoneHighlightMs = Math.max(
      stats.hitZoneHighlightMs,
      upgrade.effect.hitZoneHighlightMs ?? 0
    );
    stats.luckyCharmChance = Math.max(
      stats.luckyCharmChance,
      upgrade.effect.luckyCharmChance ?? 0
    );
    stats.luckyCharmWindowMs = Math.max(
      stats.luckyCharmWindowMs,
      upgrade.effect.luckyCharmWindowMs ?? 0
    );
  }

  return stats;
}

export function getOwnedUpgradeNames(ownedUpgrades: readonly UpgradeId[]): string[] {
  return ownedUpgrades
    .map((upgradeId) => findUpgradeById(upgradeId)?.name)
    .filter((name): name is string => name !== undefined);
}

function parseProgression(value: unknown): PlayerProgression | null {
  if (!isRecord(value)) {
    return null;
  }

  const ownedUpgrades = Array.isArray(value.ownedUpgrades)
    ? uniqueUpgradeIds(value.ownedUpgrades)
    : [];

  return {
    money: readNonNegativeInteger(value.money),
    ownedUpgrades,
    duelsWon: readNonNegativeInteger(value.duelsWon),
    duelsLost: readNonNegativeInteger(value.duelsLost),
    selectedEnemyId:
      typeof value.selectedEnemyId === "string" ? value.selectedEnemyId : DEFAULT_ENEMY.id
  };
}

function readNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function uniqueUpgradeIds(values: readonly unknown[]): UpgradeId[] {
  const ids: UpgradeId[] = [];

  for (const value of values) {
    if (isUpgradeId(value) && !ids.includes(value)) {
      ids.push(value);
    }
  }

  return ids;
}

function isUpgradeId(value: unknown): value is UpgradeId {
  return typeof value === "string" && findUpgradeById(value) !== undefined;
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
