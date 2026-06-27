export type ConditionId =
  | "wounded-hand"
  | "rattled-nerves"
  | "dusty-eyes"
  | "damaged-revolver"
  | "bruised-shoulder";

export type ConditionSeverity = "minor" | "moderate";
export type ConditionRepairType = "doctor" | "gunsmith";

export interface ConditionEffect {
  shotTimingBonusMs?: number;
  hitZoneScaleBonus?: number;
  focusGraceMs?: number;
  hitZoneHighlightMs?: number;
  reticleDelayMs?: number;
  missRecoveryPenaltyMs?: number;
  cameraShakeMultiplierBonus?: number;
}

export interface ConditionDefinition {
  id: ConditionId;
  name: string;
  description: string;
  durationDuels: number | null;
  effectSummary: string;
  severity: ConditionSeverity;
  repairCost?: number;
  repairType?: ConditionRepairType;
  uiText: string;
  gainText: string;
  expireText: string;
  effect: ConditionEffect;
}

export const CONDITIONS = [
  {
    id: "wounded-hand",
    name: "Wounded Hand",
    description: "A grazing shot makes the draw a little slower.",
    durationDuels: 2,
    effectSummary: "-45 ms shot timing",
    severity: "moderate",
    repairCost: 35,
    repairType: "doctor",
    uiText: "Draws slightly slower for a couple duels.",
    gainText: "Wounded Hand: the enemy clipped your shooting hand.",
    expireText: "Wounded Hand healed.",
    effect: {
      shotTimingBonusMs: -45
    }
  },
  {
    id: "rattled-nerves",
    name: "Rattled Nerves",
    description: "A bad flinch makes tells and timing harder to trust.",
    durationDuels: 2,
    effectSummary: "-20 ms shot timing, less focus grace",
    severity: "minor",
    uiText: "Fakeouts feel meaner and your timing margin is tighter.",
    gainText: "Rattled Nerves: you bit before the signal.",
    expireText: "Rattled Nerves settled.",
    effect: {
      shotTimingBonusMs: -20,
      focusGraceMs: -35,
      hitZoneHighlightMs: -150
    }
  },
  {
    id: "dusty-eyes",
    name: "Dusty Eyes",
    description: "A face full of grit delays your sight picture.",
    durationDuels: 1,
    effectSummary: "Reticle appears 180 ms late",
    severity: "minor",
    repairCost: 15,
    repairType: "doctor",
    uiText: "Reticle appears a little late next duel.",
    gainText: "Dusty Eyes: the storm got in your sight line.",
    expireText: "Dusty Eyes cleared.",
    effect: {
      reticleDelayMs: 180,
      hitZoneHighlightMs: -450
    }
  },
  {
    id: "damaged-revolver",
    name: "Damaged Revolver",
    description: "The sidearm needs a gunsmith before it feels true again.",
    durationDuels: null,
    effectSummary: "-8% hit forgiveness",
    severity: "moderate",
    repairCost: 45,
    repairType: "gunsmith",
    uiText: "Reduced hit forgiveness until repaired.",
    gainText: "Damaged Revolver: the failed disarm bent your iron.",
    expireText: "Damaged Revolver repaired.",
    effect: {
      hitZoneScaleBonus: -0.08
    }
  },
  {
    id: "bruised-shoulder",
    name: "Bruised Shoulder",
    description: "The last hit makes recoil and recovery rough.",
    durationDuels: 1,
    effectSummary: "More shake, slower miss recovery",
    severity: "minor",
    uiText: "Gunshots shake harder and misses are punished faster.",
    gainText: "Bruised Shoulder: the shot knocked you off balance.",
    expireText: "Bruised Shoulder loosened up.",
    effect: {
      cameraShakeMultiplierBonus: 0.35,
      missRecoveryPenaltyMs: 120
    }
  }
] as const satisfies readonly ConditionDefinition[];

const CONDITION_LOOKUP: Record<string, ConditionDefinition> = Object.fromEntries(
  CONDITIONS.map((condition) => [condition.id, condition])
);

export function findConditionById(conditionId: string): ConditionDefinition | undefined {
  return CONDITION_LOOKUP[conditionId];
}
