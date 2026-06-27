export type UpgradeId =
  | "lightweight-revolver"
  | "steady-grip"
  | "focus-breathing"
  | "eagle-eye"
  | "lucky-charm";

export interface UpgradeEffect {
  shotTimingBonusMs?: number;
  hitZoneScaleBonus?: number;
  focusGraceMs?: number;
  hitZoneHighlightMs?: number;
  luckyCharmChance?: number;
  luckyCharmWindowMs?: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  effectSummary: string;
  effect: UpgradeEffect;
}

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: "lightweight-revolver",
    name: "Lightweight Revolver",
    description: "A trimmed-down sidearm that comes up a hair faster.",
    cost: 40,
    effectSummary: "-35 ms effective shot timing",
    effect: {
      shotTimingBonusMs: 35
    }
  },
  {
    id: "steady-grip",
    name: "Steady Grip",
    description: "Better stance and grip make valid hits slightly more forgiving.",
    cost: 85,
    effectSummary: "+16% hit forgiveness",
    effect: {
      hitZoneScaleBonus: 0.16
    }
  },
  {
    id: "focus-breathing",
    name: "Focus Breathing",
    description: "A short breath after DRAW buys a narrow timing grace window.",
    cost: 140,
    effectSummary: "+70 ms focus grace",
    effect: {
      focusGraceMs: 70
    }
  },
  {
    id: "eagle-eye",
    name: "Eagle Eye",
    description: "The first moment after DRAW briefly reveals clean target zones.",
    cost: 175,
    effectSummary: "Highlights hit zones for 0.85s",
    effect: {
      hitZoneHighlightMs: 850
    }
  },
  {
    id: "lucky-charm",
    name: "Lucky Charm",
    description: "A small chance to survive when the enemy barely beats the draw.",
    cost: 220,
    effectSummary: "28% save chance within 85 ms",
    effect: {
      luckyCharmChance: 0.28,
      luckyCharmWindowMs: 85
    }
  }
];

export function findUpgradeById(upgradeId: string): UpgradeDefinition | undefined {
  return UPGRADES.find((upgrade) => upgrade.id === upgradeId);
}
