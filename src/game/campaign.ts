import {
  getDuelModifier,
  type BountyContractDefinition,
  type DuelModifierId
} from "../data/duelModifiers";
import {
  getNextTown,
  getTownById,
  STARTING_TOWN_ID,
  TOWNS,
  type TownDefinition,
  type TownId
} from "../data/towns";
import type { DuelResult } from "./state";

export interface TownProgress {
  reputation: number;
  bountiesWon: number;
  bossDefeated: boolean;
}

export interface CampaignState {
  selectedTownId: TownId;
  unlockedTownIds: TownId[];
  completedTownIds: TownId[];
  townProgress: Record<string, TownProgress>;
}

export interface CampaignChange {
  type: "reputation" | "boss-unlocked" | "town-completed" | "town-unlocked";
  townId: TownId;
  message: string;
}

export interface CampaignDuelResult {
  campaign: CampaignState;
  changes: CampaignChange[];
  completionReward: number;
}

export function createDefaultCampaignState(): CampaignState {
  return normalizeCampaignState({
    selectedTownId: STARTING_TOWN_ID,
    unlockedTownIds: [STARTING_TOWN_ID],
    completedTownIds: [],
    townProgress: {}
  });
}

export function parseCampaignState(value: unknown): CampaignState {
  if (!isRecord(value)) {
    return createDefaultCampaignState();
  }

  return normalizeCampaignState({
    selectedTownId: isTownId(value.selectedTownId) ? value.selectedTownId : STARTING_TOWN_ID,
    unlockedTownIds: Array.isArray(value.unlockedTownIds)
      ? uniqueTownIds(value.unlockedTownIds)
      : [STARTING_TOWN_ID],
    completedTownIds: Array.isArray(value.completedTownIds)
      ? uniqueTownIds(value.completedTownIds)
      : [],
    townProgress: parseTownProgress(value.townProgress)
  });
}

export function normalizeCampaignState(state: CampaignState): CampaignState {
  const completedTownIds = uniqueTownIds(state.completedTownIds);
  const unlockedTownIds = uniqueTownIds([STARTING_TOWN_ID, ...state.unlockedTownIds]);
  const townProgress: Record<string, TownProgress> = {};

  for (const town of TOWNS) {
    const progress = state.townProgress[town.id];
    townProgress[town.id] = {
      reputation: readNonNegativeInteger(progress?.reputation),
      bountiesWon: readNonNegativeInteger(progress?.bountiesWon),
      bossDefeated: progress?.bossDefeated === true
    };

    if (
      town.unlockRequirement.type === "town-complete" &&
      town.unlockRequirement.townId &&
      completedTownIds.includes(town.unlockRequirement.townId) &&
      !unlockedTownIds.includes(town.id)
    ) {
      unlockedTownIds.push(town.id);
    }
  }

  const selectedTownId = unlockedTownIds.includes(state.selectedTownId)
    ? state.selectedTownId
    : STARTING_TOWN_ID;

  return {
    selectedTownId,
    unlockedTownIds,
    completedTownIds,
    townProgress
  };
}

export function selectCampaignTown(
  campaign: CampaignState,
  townId: TownId
): CampaignState {
  if (!isTownUnlocked(campaign, townId)) {
    return campaign;
  }

  return {
    ...campaign,
    selectedTownId: townId
  };
}

export function getSelectedTown(campaign: CampaignState): TownDefinition {
  return getTownById(campaign.selectedTownId);
}

export function getTownProgress(
  campaign: CampaignState,
  townId: string
): TownProgress {
  return campaign.townProgress[townId] ?? {
    reputation: 0,
    bountiesWon: 0,
    bossDefeated: false
  };
}

export function isTownUnlocked(campaign: CampaignState, townId: string): townId is TownId {
  return isTownId(townId) && campaign.unlockedTownIds.includes(townId);
}

export function isTownCompleted(campaign: CampaignState, townId: string): boolean {
  return isTownId(townId) && campaign.completedTownIds.includes(townId);
}

export function isTownBossUnlocked(campaign: CampaignState, town: TownDefinition): boolean {
  if (!town.bossEnemyId || !town.bossRequirement) {
    return false;
  }

  if (isTownCompleted(campaign, town.id)) {
    return true;
  }

  const progress = getTownProgress(campaign, town.id);
  return (
    progress.reputation >= town.bossRequirement.reputation ||
    progress.bountiesWon >= town.bossRequirement.bountiesWon
  );
}

export function getTownLockText(campaign: CampaignState, town: TownDefinition): string {
  if (isTownUnlocked(campaign, town.id)) {
    return "";
  }

  return town.unlockRequirement.description;
}

export function getTownBossStatusText(campaign: CampaignState, town: TownDefinition): string {
  if (!town.bossEnemyId) {
    return "No boss";
  }

  if (isTownCompleted(campaign, town.id)) {
    return "Boss defeated";
  }

  if (isTownBossUnlocked(campaign, town)) {
    return "Boss available";
  }

  return town.bossRequirement?.description ?? "Boss locked";
}

export function getUnlockedShopTier(campaign: CampaignState): number {
  return TOWNS.filter((town) => isTownUnlocked(campaign, town.id)).reduce(
    (tier, town) => Math.max(tier, town.shopTier),
    1
  );
}

export function getTownBountyContracts(
  town: TownDefinition,
  campaign: CampaignState
): BountyContractDefinition[] {
  const contracts: BountyContractDefinition[] = [];

  for (const enemyId of town.enemyIds) {
    for (const modifierId of getTownModifierIds(town)) {
      contracts.push({
        id: `${town.id}-${enemyId}-${modifierId}`,
        townId: town.id,
        enemyId,
        modifierId
      });
    }
  }

  if (town.bossEnemyId && town.bossModifierId) {
    const bossUnlocked = isTownBossUnlocked(campaign, town);
    contracts.push({
      id: `${town.id}-boss`,
      townId: town.id,
      enemyId: town.bossEnemyId,
      modifierId: town.bossModifierId,
      isBoss: true,
      isBossDefeated: isTownCompleted(campaign, town.id),
      isLocked: !bossUnlocked,
      lockText: bossUnlocked ? undefined : town.bossRequirement?.description ?? "Boss locked"
    });
  }

  return contracts;
}

export function getDefaultCampaignContract(campaign: CampaignState): BountyContractDefinition {
  const town = getSelectedTown(campaign);
  const contracts = getTownBountyContracts(town, campaign);
  return contracts.find((contract) => !contract.isLocked && !contract.isBoss) ?? contracts[0];
}

export function settleCampaignDuel(
  campaign: CampaignState,
  contract: BountyContractDefinition,
  result: DuelResult
): CampaignDuelResult {
  if (result.outcome !== "win" || !contract.townId || !isTownId(contract.townId)) {
    return {
      campaign,
      changes: [],
      completionReward: 0
    };
  }

  const town = getTownById(contract.townId);
  const progress = getTownProgress(campaign, town.id);
  const changes: CampaignChange[] = [];
  const bossWasUnlocked = isTownBossUnlocked(campaign, town);
  let completionReward = 0;
  let nextProgress = progress;
  let completedTownIds = [...campaign.completedTownIds];
  let unlockedTownIds = [...campaign.unlockedTownIds];

  if (contract.isBoss) {
    if (!progress.bossDefeated) {
      nextProgress = {
        ...progress,
        bossDefeated: true
      };
      completedTownIds = appendTownId(completedTownIds, town.id);
      completionReward = town.completionReward ?? 0;
      changes.push({
        type: "town-completed",
        townId: town.id,
        message: `${town.name} cleared.`
      });

      const nextTown = getNextTown(town.id);

      if (nextTown && !unlockedTownIds.includes(nextTown.id)) {
        unlockedTownIds = appendTownId(unlockedTownIds, nextTown.id);
        changes.push({
          type: "town-unlocked",
          townId: nextTown.id,
          message: `${nextTown.name} unlocked.`
        });
      }
    }
  } else {
    nextProgress = {
      ...progress,
      reputation: progress.reputation + 1,
      bountiesWon: progress.bountiesWon + 1
    };
    changes.push({
      type: "reputation",
      townId: town.id,
      message: `+1 ${town.name} reputation.`
    });
  }

  const nextCampaign = normalizeCampaignState({
    ...campaign,
    unlockedTownIds,
    completedTownIds,
    townProgress: {
      ...campaign.townProgress,
      [town.id]: nextProgress
    }
  });

  if (!bossWasUnlocked && isTownBossUnlocked(nextCampaign, town)) {
    changes.push({
      type: "boss-unlocked",
      townId: town.id,
      message: `${town.name} boss unlocked.`
    });
  }

  return {
    campaign: nextCampaign,
    changes,
    completionReward
  };
}

function getTownModifierIds(town: TownDefinition): DuelModifierId[] {
  const modifierIds = uniqueModifierIds(["high-noon", ...town.availableModifierIds]);
  return modifierIds.filter((modifierId) => getDuelModifier(modifierId).id === modifierId);
}

function parseTownProgress(value: unknown): Record<string, TownProgress> {
  if (!isRecord(value)) {
    return {};
  }

  const progress: Record<string, TownProgress> = {};

  for (const [townId, townValue] of Object.entries(value)) {
    if (!isTownId(townId) || !isRecord(townValue)) {
      continue;
    }

    progress[townId] = {
      reputation: readNonNegativeInteger(townValue.reputation),
      bountiesWon: readNonNegativeInteger(townValue.bountiesWon),
      bossDefeated: townValue.bossDefeated === true
    };
  }

  return progress;
}

function appendTownId(ids: readonly TownId[], townId: TownId): TownId[] {
  return ids.includes(townId) ? [...ids] : [...ids, townId];
}

function uniqueTownIds(values: readonly unknown[]): TownId[] {
  const ids: TownId[] = [];

  for (const value of values) {
    if (isTownId(value) && !ids.includes(value)) {
      ids.push(value);
    }
  }

  return ids;
}

function uniqueModifierIds(values: readonly DuelModifierId[]): DuelModifierId[] {
  const ids: DuelModifierId[] = [];

  for (const value of values) {
    if (!ids.includes(value)) {
      ids.push(value);
    }
  }

  return ids;
}

function isTownId(value: unknown): value is TownId {
  return typeof value === "string" && TOWNS.some((town) => town.id === value);
}

function readNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
