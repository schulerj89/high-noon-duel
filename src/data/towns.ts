import type { DuelModifierId } from "./duelModifiers";

export type TownId =
  | "dustwater"
  | "mercy-flats"
  | "red-cactus"
  | "widows-ridge"
  | "black-hat-canyon";

export interface TownUnlockRequirement {
  type: "start" | "town-complete";
  townId?: TownId;
  description: string;
}

export interface TownBossRequirement {
  reputation: number;
  bountiesWon: number;
  description: string;
}

export interface TownDefinition {
  id: TownId;
  name: string;
  description: string;
  unlockRequirement: TownUnlockRequirement;
  enemyIds: readonly string[];
  availableModifierIds: readonly DuelModifierId[];
  shopTier: number;
  bossEnemyId?: string;
  bossModifierId?: DuelModifierId;
  bossRequirement?: TownBossRequirement;
  completionReward?: number;
}

export const TOWNS = [
  {
    id: "dustwater",
    name: "Dustwater",
    description: "A dry tutorial stop where the first bad habits get corrected.",
    unlockRequirement: {
      type: "start",
      description: "Starting town."
    },
    enemyIds: ["billy-the-shaky"],
    availableModifierIds: ["high-noon"],
    shopTier: 1,
    bossEnemyId: "billy-the-shaky",
    bossModifierId: "high-noon",
    bossRequirement: {
      reputation: 1,
      bountiesWon: 1,
      description: "Win 1 Dustwater bounty."
    },
    completionReward: 30
  },
  {
    id: "mercy-flats",
    name: "Mercy Flats",
    description: "A twitchy crossroads where fakeouts start to matter.",
    unlockRequirement: {
      type: "town-complete",
      townId: "dustwater",
      description: "Clear Dustwater."
    },
    enemyIds: ["billy-the-shaky", "red-eye-ramos"],
    availableModifierIds: ["high-noon", "sunset-glare"],
    shopTier: 2,
    bossEnemyId: "red-eye-ramos",
    bossModifierId: "sunset-glare",
    bossRequirement: {
      reputation: 2,
      bountiesWon: 2,
      description: "Earn 2 Mercy Flats reputation."
    },
    completionReward: 60
  },
  {
    id: "red-cactus",
    name: "Red Cactus",
    description: "Long streets and strict bounty terms reward precision.",
    unlockRequirement: {
      type: "town-complete",
      townId: "mercy-flats",
      description: "Clear Mercy Flats."
    },
    enemyIds: ["red-eye-ramos", "marshal-graves"],
    availableModifierIds: ["high-noon", "long-distance", "one-bullet"],
    shopTier: 3,
    bossEnemyId: "marshal-graves",
    bossModifierId: "long-distance",
    bossRequirement: {
      reputation: 3,
      bountiesWon: 3,
      description: "Win 3 Red Cactus bounties."
    },
    completionReward: 95
  },
  {
    id: "widows-ridge",
    name: "Widow's Ridge",
    description: "Dust, movement, and disarm contracts make clean aim hard.",
    unlockRequirement: {
      type: "town-complete",
      townId: "red-cactus",
      description: "Clear Red Cactus."
    },
    enemyIds: ["marshal-graves", "dust-widow"],
    availableModifierIds: ["high-noon", "dust-storm", "disarm-only"],
    shopTier: 4,
    bossEnemyId: "dust-widow",
    bossModifierId: "dust-storm",
    bossRequirement: {
      reputation: 3,
      bountiesWon: 3,
      description: "Earn 3 Widow's Ridge reputation."
    },
    completionReward: 140
  },
  {
    id: "black-hat-canyon",
    name: "Black Hat Canyon",
    description: "The final canyon. No friendly terms, no easy tells.",
    unlockRequirement: {
      type: "town-complete",
      townId: "widows-ridge",
      description: "Clear Widow's Ridge."
    },
    enemyIds: ["dust-widow", "the-black-hat"],
    availableModifierIds: ["high-noon", "one-bullet", "no-reticle"],
    shopTier: 5,
    bossEnemyId: "the-black-hat",
    bossModifierId: "no-reticle",
    bossRequirement: {
      reputation: 2,
      bountiesWon: 2,
      description: "Win 2 Black Hat Canyon bounties."
    },
    completionReward: 250
  }
] as const satisfies readonly TownDefinition[];

const TOWN_LOOKUP: Record<string, TownDefinition> = Object.fromEntries(
  TOWNS.map((town) => [town.id, town])
);

export const STARTING_TOWN_ID: TownId = "dustwater";

export function getTownById(townId: string): TownDefinition {
  return TOWN_LOOKUP[townId] ?? TOWNS[0];
}

export function getNextTown(townId: string): TownDefinition | undefined {
  const index = TOWNS.findIndex((town) => town.id === townId);
  return index >= 0 ? TOWNS[index + 1] : undefined;
}
