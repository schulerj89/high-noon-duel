import {
  findConditionById,
  type ConditionDefinition,
  type ConditionId
} from "../data/conditions";
import { DEFAULT_ENEMY } from "../data/enemies";
import {
  findUpgradeById,
  type UpgradeDefinition,
  type UpgradeId
} from "../data/upgrades";
import type { BountyContractDefinition } from "../data/duelModifiers";
import {
  createDefaultCampaignState,
  parseCampaignState,
  settleCampaignDuel,
  type CampaignChange,
  type CampaignState
} from "./campaign";
import type { DuelOutcome, DuelResult } from "./state";

export interface ActiveCondition {
  id: ConditionId;
  remainingDuels: number | null;
  gainedAt: number;
}

export interface PlayerProgression {
  money: number;
  ownedUpgrades: UpgradeId[];
  activeConditions: ActiveCondition[];
  campaign: CampaignState;
  duelsWon: number;
  duelsLost: number;
  selectedEnemyId: string;
}

export interface ConditionChange {
  type: "gained" | "refreshed" | "expired" | "repaired";
  conditionId: ConditionId;
  conditionName: string;
  message: string;
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

export type RepairConditionResult =
  | {
      status: "repaired";
      progression: PlayerProgression;
      condition: ConditionDefinition;
      change: ConditionChange;
    }
  | {
      status: "not-active" | "not-repairable" | "insufficient-funds" | "missing";
      progression: PlayerProgression;
      condition?: ConditionDefinition;
    };

export interface DuelProgressionResult {
  progression: PlayerProgression;
  conditionChanges: ConditionChange[];
  campaignChanges: CampaignChange[];
  campaignReward: number;
}

export interface DuelConsequenceInput {
  result: DuelResult;
  reward: number;
  selectedEnemyId: string;
  modifierId: string;
  contract?: BountyContractDefinition;
}

export const PROGRESSION_STORAGE_KEY = "high-noon-duel:progression:v1";

export function createDefaultProgression(): PlayerProgression {
  return {
    money: 0,
    ownedUpgrades: [],
    activeConditions: [],
    campaign: createDefaultCampaignState(),
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

export function settleDuelProgression(
  progression: PlayerProgression,
  input: DuelConsequenceInput
): DuelProgressionResult {
  const recorded = recordDuelResult(
    progression,
    input.result.outcome,
    input.reward,
    input.selectedEnemyId
  );
  const campaignResult = input.contract
    ? settleCampaignDuel(recorded.campaign, input.contract, input.result)
    : {
        campaign: recorded.campaign,
        changes: [],
        completionReward: 0
      };
  const advanced = advanceActiveConditions(recorded.activeConditions);
  const conditionId = determineConditionGain(input.result, input.modifierId);
  let activeConditions = advanced.conditions;
  const conditionChanges = [...advanced.changes];

  if (conditionId) {
    const applied = addOrRefreshCondition(activeConditions, conditionId);
    activeConditions = applied.conditions;
    conditionChanges.push(applied.change);
  }

  return {
    progression: {
      ...recorded,
      money: recorded.money + campaignResult.completionReward,
      campaign: campaignResult.campaign,
      activeConditions
    },
    conditionChanges,
    campaignChanges: campaignResult.changes,
    campaignReward: campaignResult.completionReward
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

export function repairCondition(
  progression: PlayerProgression,
  conditionId: ConditionId
): RepairConditionResult {
  const condition = findConditionById(conditionId);

  if (!condition) {
    return { status: "missing", progression };
  }

  if (!progression.activeConditions.some((active) => active.id === conditionId)) {
    return { status: "not-active", progression, condition };
  }

  if (condition.repairCost === undefined) {
    return { status: "not-repairable", progression, condition };
  }

  if (progression.money < condition.repairCost) {
    return { status: "insufficient-funds", progression, condition };
  }

  const change: ConditionChange = {
    type: "repaired",
    conditionId,
    conditionName: condition.name,
    message: condition.expireText
  };

  return {
    status: "repaired",
    condition,
    change,
    progression: {
      ...progression,
      money: progression.money - condition.repairCost,
      activeConditions: progression.activeConditions.filter((active) => active.id !== conditionId)
    }
  };
}

export function getOwnedUpgradeNames(ownedUpgrades: readonly UpgradeId[]): string[] {
  return ownedUpgrades
    .map((upgradeId) => findUpgradeById(upgradeId)?.name)
    .filter((name): name is string => name !== undefined);
}

export function getActiveConditionDefinitions(
  activeConditions: readonly ActiveCondition[]
): ConditionDefinition[] {
  return activeConditions
    .map((active) => findConditionById(active.id))
    .filter((condition): condition is ConditionDefinition => condition !== undefined);
}

export function formatConditionDuration(active: ActiveCondition): string {
  if (active.remainingDuels === null) {
    return "until repaired";
  }

  if (active.remainingDuels === 1) {
    return "1 duel";
  }

  return `${active.remainingDuels} duels`;
}

function advanceActiveConditions(activeConditions: readonly ActiveCondition[]): {
  conditions: ActiveCondition[];
  changes: ConditionChange[];
} {
  const conditions: ActiveCondition[] = [];
  const changes: ConditionChange[] = [];

  for (const active of activeConditions) {
    const definition = findConditionById(active.id);

    if (!definition) {
      continue;
    }

    if (active.remainingDuels === null) {
      conditions.push(active);
      continue;
    }

    const remainingDuels = active.remainingDuels - 1;

    if (remainingDuels <= 0) {
      changes.push({
        type: "expired",
        conditionId: active.id,
        conditionName: definition.name,
        message: definition.expireText
      });
      continue;
    }

    conditions.push({
      ...active,
      remainingDuels
    });
  }

  return { conditions, changes };
}

function addOrRefreshCondition(
  activeConditions: readonly ActiveCondition[],
  conditionId: ConditionId
): {
  conditions: ActiveCondition[];
  change: ConditionChange;
} {
  const definition = findConditionById(conditionId);

  if (!definition) {
    throw new Error(`Unknown condition: ${conditionId}`);
  }

  const existing = activeConditions.find((active) => active.id === conditionId);
  const nextActive: ActiveCondition = {
    id: conditionId,
    remainingDuels: definition.durationDuels,
    gainedAt: Date.now()
  };

  if (!existing) {
    return {
      conditions: [...activeConditions, nextActive],
      change: {
        type: "gained",
        conditionId,
        conditionName: definition.name,
        message: definition.gainText
      }
    };
  }

  return {
    conditions: activeConditions.map((active) =>
      active.id === conditionId
        ? {
            ...active,
            remainingDuels: definition.durationDuels,
            gainedAt: nextActive.gainedAt
          }
        : active
    ),
    change: {
      type: "refreshed",
      conditionId,
      conditionName: definition.name,
      message: `${definition.name} persists.`
    }
  };
}

function determineConditionGain(
  result: DuelResult,
  fallbackModifierId: string
): ConditionId | null {
  if (result.outcome !== "loss") {
    return null;
  }

  const modifierId = result.stats.modifierId ?? fallbackModifierId;

  if (result.reason === "early draw" || result.stats.firedDuringFakeout) {
    return "rattled-nerves";
  }

  if (modifierId === "dust-storm" && result.stats.shotResult === "miss") {
    return "dusty-eyes";
  }

  if (result.reason === "rule violation") {
    return "damaged-revolver";
  }

  if (result.reason === "missed shot") {
    return "bruised-shoulder";
  }

  if (result.reason === "enemy was faster") {
    return "wounded-hand";
  }

  return null;
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
    activeConditions: parseActiveConditions(value.activeConditions),
    campaign: parseCampaignState(value.campaign),
    duelsWon: readNonNegativeInteger(value.duelsWon),
    duelsLost: readNonNegativeInteger(value.duelsLost),
    selectedEnemyId:
      typeof value.selectedEnemyId === "string" ? value.selectedEnemyId : DEFAULT_ENEMY.id
  };
}

function parseActiveConditions(value: unknown): ActiveCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const activeConditions: ActiveCondition[] = [];

  for (const item of value) {
    if (!isRecord(item) || !isConditionId(item.id)) {
      continue;
    }

    if (activeConditions.some((active) => active.id === item.id)) {
      continue;
    }

    const definition = findConditionById(item.id);
    const remainingDuels =
      definition?.durationDuels === null
        ? null
        : readPositiveInteger(item.remainingDuels, definition?.durationDuels ?? 1);

    activeConditions.push({
      id: item.id,
      remainingDuels,
      gainedAt: readNonNegativeInteger(item.gainedAt)
    });
  }

  return activeConditions;
}

function readNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback;
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

function isConditionId(value: unknown): value is ConditionId {
  return typeof value === "string" && findConditionById(value) !== undefined;
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
