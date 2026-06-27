import type { DuelModifierDefinition, EnvironmentVariantId } from "../data/duelModifiers";
import type { EnemyDefinition } from "../data/enemies";
import type { PlayerStats } from "./progression";
import type { ShotResult } from "./scoring";

export interface DuelRules {
  modifierId: string;
  modifierName: string;
  modifierDescription: string;
  modifierResultText?: string;
  reward: number;
  rewardMultiplier: number;
  hitZoneScaleMultiplier: number;
  showReticle: boolean;
  missInstantLoss: boolean;
  hideHitZonesUnlessEagleEye: boolean;
  allowedWinningShotResults: readonly ShotResult[] | null;
  ruleViolationText?: string;
  enemyDistanceOffsetZ: number;
  cameraDistanceOffsetZ: number;
  cameraFovOffset: number;
  environmentVariant: EnvironmentVariantId;
  eagleEyeCanRevealHitZones: boolean;
}

export function deriveDuelRules(
  enemy: EnemyDefinition,
  modifier: DuelModifierDefinition,
  playerStats: PlayerStats
): DuelRules {
  const effects = modifier.effects;

  return {
    modifierId: modifier.id,
    modifierName: modifier.name,
    modifierDescription: modifier.description,
    modifierResultText: modifier.resultText,
    reward: getModifiedReward(enemy.reward, modifier.rewardMultiplier),
    rewardMultiplier: modifier.rewardMultiplier,
    hitZoneScaleMultiplier: Math.max(0.1, effects.hitZoneScaleMultiplier ?? 1),
    showReticle: effects.noReticle !== true,
    missInstantLoss: effects.missInstantLoss === true,
    hideHitZonesUnlessEagleEye: effects.hideHitZonesUnlessEagleEye === true,
    allowedWinningShotResults: effects.allowedWinningShotResults ?? null,
    ruleViolationText: effects.ruleViolationText,
    enemyDistanceOffsetZ: effects.enemyDistanceOffsetZ ?? 0,
    cameraDistanceOffsetZ: effects.cameraDistanceOffsetZ ?? 0,
    cameraFovOffset: effects.cameraFovOffset ?? 0,
    environmentVariant: modifier.environmentVariant,
    eagleEyeCanRevealHitZones: playerStats.hitZoneHighlightMs > 0
  };
}

export function isWinningShotAllowed(
  shotResult: ShotResult,
  rules: DuelRules
): boolean {
  return rules.allowedWinningShotResults === null || rules.allowedWinningShotResults.includes(shotResult);
}

function getModifiedReward(baseReward: number, rewardMultiplier: number): number {
  return Math.round(baseReward * rewardMultiplier);
}
