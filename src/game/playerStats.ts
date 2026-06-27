import {
  CONDITIONS,
  findConditionById,
  type ConditionEffect,
  type ConditionId
} from "../data/conditions";
import { UPGRADES, type UpgradeId } from "../data/upgrades";

export interface PlayerStats {
  shotTimingBonusMs: number;
  hitZoneScale: number;
  focusGraceMs: number;
  hitZoneHighlightMs: number;
  luckyCharmChance: number;
  luckyCharmWindowMs: number;
  reticleDelayMs: number;
  missRecoveryPenaltyMs: number;
  cameraShakeMultiplier: number;
}

export interface ActiveConditionInput {
  id: ConditionId;
}

export const BASE_PLAYER_STATS: PlayerStats = {
  shotTimingBonusMs: 0,
  hitZoneScale: 1,
  focusGraceMs: 0,
  hitZoneHighlightMs: 0,
  luckyCharmChance: 0,
  luckyCharmWindowMs: 0,
  reticleDelayMs: 0,
  missRecoveryPenaltyMs: 0,
  cameraShakeMultiplier: 1
};

export function derivePlayerStats(
  ownedUpgrades: readonly UpgradeId[],
  activeConditions: readonly ActiveConditionInput[] = []
): PlayerStats {
  const stats: PlayerStats = { ...BASE_PLAYER_STATS };

  applyUpgradeEffects(stats, ownedUpgrades);
  applyConditionEffects(stats, activeConditions);

  stats.hitZoneScale = Math.max(0.65, stats.hitZoneScale);
  stats.focusGraceMs = Math.max(0, stats.focusGraceMs);
  stats.hitZoneHighlightMs = Math.max(0, stats.hitZoneHighlightMs);
  stats.reticleDelayMs = Math.max(0, stats.reticleDelayMs);
  stats.missRecoveryPenaltyMs = Math.max(0, stats.missRecoveryPenaltyMs);
  stats.cameraShakeMultiplier = Math.max(1, stats.cameraShakeMultiplier);

  return stats;
}

function applyUpgradeEffects(stats: PlayerStats, ownedUpgrades: readonly UpgradeId[]): void {
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
}

function applyConditionEffects(
  stats: PlayerStats,
  activeConditions: readonly ActiveConditionInput[]
): void {
  const activeIds = new Set(activeConditions.map((condition) => condition.id));

  for (const condition of CONDITIONS) {
    if (!activeIds.has(condition.id)) {
      continue;
    }

    applyConditionEffect(stats, condition.effect);
  }
}

function applyConditionEffect(stats: PlayerStats, effect: ConditionEffect): void {
  stats.shotTimingBonusMs += effect.shotTimingBonusMs ?? 0;
  stats.hitZoneScale += effect.hitZoneScaleBonus ?? 0;
  stats.focusGraceMs += effect.focusGraceMs ?? 0;
  stats.hitZoneHighlightMs += effect.hitZoneHighlightMs ?? 0;
  stats.reticleDelayMs += effect.reticleDelayMs ?? 0;
  stats.missRecoveryPenaltyMs += effect.missRecoveryPenaltyMs ?? 0;
  stats.cameraShakeMultiplier += effect.cameraShakeMultiplierBonus ?? 0;
}

export function getActiveConditionEffectSummary(conditionId: ConditionId): string {
  return findConditionById(conditionId)?.effectSummary ?? "";
}
