export const ENEMY_TELL_TYPES = [
  "handTwitch",
  "shoulderDrop",
  "coatShift",
  "eyeGlance",
  "holsterTap",
  "leanLeft",
  "leanRight",
  "stillness"
] as const;

export type EnemyTellType = (typeof ENEMY_TELL_TYPES)[number];
export type DrawAnimationStyle =
  | "obviousReach"
  | "baitedReach"
  | "cleanDraw"
  | "sideStepDraw"
  | "snapDraw";
export type PostDrawBehavior = "holdCenter" | "leanLeft" | "leanRight" | "sidestepLeft" | "sidestepRight";
export type AimDisruptionBehavior = "none" | "sideStepLeft" | "sideStepRight" | "narrowTarget";

export type TellIntensities = Record<EnemyTellType, number>;

export interface IdleTellDefinition {
  type: EnemyTellType;
  intensity: number;
  frequencyHz: number;
}

export interface EnemyIdleBehaviorDefinition {
  description: string;
  tells: readonly IdleTellDefinition[];
}

export interface EnemyFakeoutBehaviorDefinition {
  enabled: boolean;
  chanceMultiplier: number;
  minCount: number;
  maxCount: number;
  tellTypes: readonly EnemyTellType[];
  durationMs: readonly [number, number];
  intensity: readonly [number, number];
  earliestAfterReadyMs: number;
  latestBeforeDrawMs: number;
  subtitleLines?: readonly string[];
}

export interface EnemyRealDrawTellDefinition {
  type: EnemyTellType;
  delayAfterDrawMs: number;
  durationMs: number;
  intensity: number;
  description: string;
}

export interface EnemyDrawAnimationDefinition {
  style: DrawAnimationStyle;
  commitment: number;
}

export interface EnemyPostDrawBehaviorDefinition {
  behavior: PostDrawBehavior;
  startsAfterDrawMs: number;
  durationMs: number;
  distance: number;
  chance: number;
}

export interface EnemyAimDisruptionDefinition {
  behavior: AimDisruptionBehavior;
  startsAfterDrawMs: number;
  durationMs: number;
  distance: number;
  chance: number;
  hitZoneScaleMultiplier?: number;
}

export interface EnemySpecialRuleDefinition {
  hitZoneScaleMultiplier?: number;
  note?: string;
}

export interface EnemyBehaviorResultText {
  fellForFakeout: string;
  waitedOutFakeout: string;
  cleanDraw: string;
  aimDisrupted: string;
}

export interface EnemyBehaviorDefinition {
  enemyId: string;
  idle: EnemyIdleBehaviorDefinition;
  fakeouts: EnemyFakeoutBehaviorDefinition;
  realDrawTell: EnemyRealDrawTellDefinition;
  drawAnimation: EnemyDrawAnimationDefinition;
  postDraw: EnemyPostDrawBehaviorDefinition;
  aimDisruption: EnemyAimDisruptionDefinition;
  specialRule?: EnemySpecialRuleDefinition;
  resultText: EnemyBehaviorResultText;
}

export function createEmptyTellIntensities(): TellIntensities {
  return {
    handTwitch: 0,
    shoulderDrop: 0,
    coatShift: 0,
    eyeGlance: 0,
    holsterTap: 0,
    leanLeft: 0,
    leanRight: 0,
    stillness: 0
  };
}
