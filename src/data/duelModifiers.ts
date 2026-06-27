import type { ShotResult } from "../game/scoring";

export type DuelModifierDifficulty = "Standard" | "Tricky" | "Hard" | "Expert" | "Legendary";
export type EnvironmentVariantId = "highNoon" | "sunsetGlare" | "dustStorm" | "longDistance";
export type DuelModifierId =
  | "high-noon"
  | "sunset-glare"
  | "dust-storm"
  | "long-distance"
  | "disarm-only"
  | "one-bullet"
  | "no-reticle";

export interface DuelModifierEffects {
  hitZoneScaleMultiplier?: number;
  hideHitZonesUnlessEagleEye?: boolean;
  enemyDistanceOffsetZ?: number;
  cameraDistanceOffsetZ?: number;
  cameraFovOffset?: number;
  noReticle?: boolean;
  missInstantLoss?: boolean;
  allowedWinningShotResults?: readonly ShotResult[];
  ruleViolationText?: string;
}

export interface DuelModifierDefinition {
  id: DuelModifierId;
  name: string;
  description: string;
  difficulty: DuelModifierDifficulty;
  rewardMultiplier: number;
  effects: DuelModifierEffects;
  environmentVariant: EnvironmentVariantId;
  resultText?: string;
}

export interface BountyContractDefinition {
  id: string;
  enemyId: string;
  modifierId: DuelModifierId;
  townId?: string;
  isBoss?: boolean;
  isLocked?: boolean;
  isBossDefeated?: boolean;
  lockText?: string;
}

export const DUEL_MODIFIERS = [
  {
    id: "high-noon",
    name: "High Noon",
    description: "Standard duel. No special conditions.",
    difficulty: "Standard",
    rewardMultiplier: 1,
    effects: {},
    environmentVariant: "highNoon",
    resultText: "Standard High Noon terms."
  },
  {
    id: "sunset-glare",
    name: "Sunset Glare",
    description: "Warm glare makes silhouettes harder to read.",
    difficulty: "Tricky",
    rewardMultiplier: 1.15,
    effects: {
      hitZoneScaleMultiplier: 0.92
    },
    environmentVariant: "sunsetGlare",
    resultText: "The sunset glare narrowed your margin."
  },
  {
    id: "dust-storm",
    name: "Dust Storm",
    description: "Dust haze hides the target and suppresses hitbox help without Eagle Eye.",
    difficulty: "Hard",
    rewardMultiplier: 1.25,
    effects: {
      hitZoneScaleMultiplier: 0.9,
      hideHitZonesUnlessEagleEye: true
    },
    environmentVariant: "dustStorm",
    resultText: "The dust storm made the silhouette hard to trust."
  },
  {
    id: "long-distance",
    name: "Long Distance",
    description: "The enemy starts farther down the street.",
    difficulty: "Hard",
    rewardMultiplier: 1.3,
    effects: {
      enemyDistanceOffsetZ: -1.55,
      cameraDistanceOffsetZ: 0.35,
      cameraFovOffset: -1,
      hitZoneScaleMultiplier: 0.84
    },
    environmentVariant: "longDistance",
    resultText: "Long distance made every target smaller."
  },
  {
    id: "disarm-only",
    name: "Disarm Only",
    description: "Only a gun-hand shot satisfies the bounty terms.",
    difficulty: "Expert",
    rewardMultiplier: 1.4,
    effects: {
      allowedWinningShotResults: ["disarm"],
      ruleViolationText: "Bounty terms required a disarm."
    },
    environmentVariant: "highNoon",
    resultText: "Disarm-only terms required the gun hand."
  },
  {
    id: "one-bullet",
    name: "One Bullet",
    description: "A miss ends the duel immediately.",
    difficulty: "Expert",
    rewardMultiplier: 1.25,
    effects: {
      missInstantLoss: true
    },
    environmentVariant: "highNoon",
    resultText: "One bullet left no room for a miss."
  },
  {
    id: "no-reticle",
    name: "No Reticle",
    description: "The aiming reticle disappears after DRAW.",
    difficulty: "Legendary",
    rewardMultiplier: 1.5,
    effects: {
      noReticle: true,
      hitZoneScaleMultiplier: 0.94
    },
    environmentVariant: "sunsetGlare",
    resultText: "No reticle meant pure point shooting."
  }
] as const satisfies readonly DuelModifierDefinition[];

export const BOUNTY_CONTRACTS = [
  { id: "billy-high-noon", enemyId: "billy-the-shaky", modifierId: "high-noon" },
  { id: "ramos-sunset-glare", enemyId: "red-eye-ramos", modifierId: "sunset-glare" },
  { id: "widow-dust-storm", enemyId: "dust-widow", modifierId: "dust-storm" },
  { id: "graves-long-distance", enemyId: "marshal-graves", modifierId: "long-distance" },
  { id: "ramos-disarm-only", enemyId: "red-eye-ramos", modifierId: "disarm-only" },
  { id: "widow-one-bullet", enemyId: "dust-widow", modifierId: "one-bullet" },
  { id: "black-hat-no-reticle", enemyId: "the-black-hat", modifierId: "no-reticle" }
] as const satisfies readonly BountyContractDefinition[];

const MODIFIER_LOOKUP: Record<string, DuelModifierDefinition> = Object.fromEntries(
  DUEL_MODIFIERS.map((modifier) => [modifier.id, modifier])
);
const CONTRACT_LOOKUP: Record<string, BountyContractDefinition> = Object.fromEntries(
  BOUNTY_CONTRACTS.map((contract) => [contract.id, contract])
);
const DEFAULT_MODIFIER = DUEL_MODIFIERS[0];
const DEFAULT_CONTRACT = BOUNTY_CONTRACTS[0];

export function getDuelModifier(modifierId: string): DuelModifierDefinition {
  return MODIFIER_LOOKUP[modifierId] ?? DEFAULT_MODIFIER;
}

export function getBountyContract(contractId: string): BountyContractDefinition {
  return CONTRACT_LOOKUP[contractId] ?? DEFAULT_CONTRACT;
}

export function getDefaultBountyContract(enemyId?: string): BountyContractDefinition {
  return BOUNTY_CONTRACTS.find((contract) => contract.enemyId === enemyId) ?? DEFAULT_CONTRACT;
}
