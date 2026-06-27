import type { EnemyDefinition } from "../data/enemies";
import type { UpgradeId } from "../data/upgrades";
import type { DuelResult, DuelResultReason } from "../game/state";
import type { TuningOverrides } from "./tuning";

export interface ReactionStats {
  count: number;
  totalMs: number;
  fastestMs: number | null;
  slowestMs: number | null;
}

export interface EnemyTelemetry {
  enemyId: string;
  enemyName: string;
  duelsStarted: number;
  wins: number;
  losses: number;
  lossReasons: Record<DuelResultReason, number>;
  fakeoutBites: number;
  fakeoutsWaitedOut: number;
  aimDisruptedShots: number;
  modifierStarts: Record<string, number>;
  modifierResults: Record<string, number>;
  reaction: ReactionStats;
  timeToShot: ReactionStats;
}

export interface PlaytestTelemetry {
  totalDuelsStarted: number;
  wins: number;
  losses: number;
  earlyDrawFouls: number;
  misses: number;
  headHits: number;
  torsoHits: number;
  disarms: number;
  fakeoutBites: number;
  fakeoutsWaitedOut: number;
  aimDisruptedShots: number;
  modifierStarts: Record<string, number>;
  modifierResults: Record<string, number>;
  reaction: ReactionStats;
  enemies: Record<string, EnemyTelemetry>;
  upgradeOwnershipAtDuel: Record<string, number>;
}

export interface PlaytestSummary {
  totalDuelsStarted: number;
  wins: number;
  losses: number;
  winRate: number;
  averageReactionTimeMs: number | null;
  fastestReactionTimeMs: number | null;
  slowestReactionTimeMs: number | null;
  selectedEnemyWinRate: number | null;
}

export interface BalanceReport {
  timestamp: string;
  aggregate: PlaytestTelemetry;
  perEnemy: Record<string, EnemyTelemetry & {
    winRate: number;
    averageReactionTimeMs: number | null;
    averageTimeToShotMs: number | null;
  }>;
  currentTuningOverrides: TuningOverrides;
  ownedUpgrades: readonly UpgradeId[];
}

export interface RecordDuelResultInput {
  enemy: EnemyDefinition;
  result: DuelResult;
  ownedUpgrades: readonly UpgradeId[];
}

export const TELEMETRY_STORAGE_KEY = "high-noon-duel:telemetry:v1";

const LOSS_REASONS: readonly DuelResultReason[] = [
  "clean shot",
  "enemy was faster",
  "early draw",
  "missed shot",
  "rule violation"
];

export function createEmptyTelemetry(): PlaytestTelemetry {
  return {
    totalDuelsStarted: 0,
    wins: 0,
    losses: 0,
    earlyDrawFouls: 0,
    misses: 0,
    headHits: 0,
    torsoHits: 0,
    disarms: 0,
    fakeoutBites: 0,
    fakeoutsWaitedOut: 0,
    aimDisruptedShots: 0,
    modifierStarts: {},
    modifierResults: {},
    reaction: createEmptyReactionStats(),
    enemies: {},
    upgradeOwnershipAtDuel: {}
  };
}

export function loadTelemetry(): PlaytestTelemetry {
  const storage = getLocalStorage();

  if (!storage) {
    return createEmptyTelemetry();
  }

  try {
    const rawValue = storage.getItem(TELEMETRY_STORAGE_KEY);

    if (!rawValue) {
      return createEmptyTelemetry();
    }

    return parseTelemetry(JSON.parse(rawValue) as unknown);
  } catch {
    return createEmptyTelemetry();
  }
}

export function saveTelemetry(telemetry: PlaytestTelemetry): void {
  getLocalStorage()?.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(telemetry));
}

export function recordDuelStarted(
  telemetry: PlaytestTelemetry,
  enemy: EnemyDefinition,
  modifierId?: string
): PlaytestTelemetry {
  const enemyTelemetry = getEnemyTelemetry(telemetry, enemy);

  return {
    ...telemetry,
    totalDuelsStarted: telemetry.totalDuelsStarted + 1,
    modifierStarts: incrementMapValue(telemetry.modifierStarts, modifierId),
    enemies: {
      ...telemetry.enemies,
      [enemy.id]: {
        ...enemyTelemetry,
        duelsStarted: enemyTelemetry.duelsStarted + 1,
        modifierStarts: incrementMapValue(enemyTelemetry.modifierStarts, modifierId)
      }
    }
  };
}

export function recordTelemetryDuelResult(
  telemetry: PlaytestTelemetry,
  input: RecordDuelResultInput
): PlaytestTelemetry {
  const { result, enemy, ownedUpgrades } = input;
  const playerReactionTimeMs = result.stats.playerReactionTimeMs;
  const enemyTelemetry = getEnemyTelemetry(telemetry, enemy);
  const shotResult = result.stats.shotResult;
  const modifierId = result.stats.modifierId;
  const nextEnemy = {
    ...enemyTelemetry,
    wins: enemyTelemetry.wins + (result.outcome === "win" ? 1 : 0),
    losses: enemyTelemetry.losses + (result.outcome === "loss" ? 1 : 0),
    lossReasons: {
      ...enemyTelemetry.lossReasons,
      [result.reason]: enemyTelemetry.lossReasons[result.reason] + (result.outcome === "loss" ? 1 : 0)
    },
    fakeoutBites:
      enemyTelemetry.fakeoutBites + (result.stats.firedDuringFakeout ? 1 : 0),
    fakeoutsWaitedOut:
      enemyTelemetry.fakeoutsWaitedOut + (result.stats.waitedOutFakeout ? 1 : 0),
    aimDisruptedShots:
      enemyTelemetry.aimDisruptedShots + (result.stats.aimDisrupted ? 1 : 0),
    modifierResults: incrementMapValue(enemyTelemetry.modifierResults, modifierId),
    reaction:
      playerReactionTimeMs === undefined
        ? enemyTelemetry.reaction
        : addReactionSample(enemyTelemetry.reaction, playerReactionTimeMs),
    timeToShot:
      playerReactionTimeMs === undefined
        ? enemyTelemetry.timeToShot
        : addReactionSample(enemyTelemetry.timeToShot, playerReactionTimeMs)
  };

  return {
    ...telemetry,
    wins: telemetry.wins + (result.outcome === "win" ? 1 : 0),
    losses: telemetry.losses + (result.outcome === "loss" ? 1 : 0),
    earlyDrawFouls: telemetry.earlyDrawFouls + (result.reason === "early draw" ? 1 : 0),
    misses:
      telemetry.misses +
      (result.reason === "missed shot" || shotResult === "miss" ? 1 : 0),
    headHits: telemetry.headHits + (shotResult === "head" ? 1 : 0),
    torsoHits: telemetry.torsoHits + (shotResult === "torso" ? 1 : 0),
    disarms: telemetry.disarms + (shotResult === "disarm" ? 1 : 0),
    fakeoutBites: telemetry.fakeoutBites + (result.stats.firedDuringFakeout ? 1 : 0),
    fakeoutsWaitedOut:
      telemetry.fakeoutsWaitedOut + (result.stats.waitedOutFakeout ? 1 : 0),
    aimDisruptedShots:
      telemetry.aimDisruptedShots + (result.stats.aimDisrupted ? 1 : 0),
    modifierResults: incrementMapValue(telemetry.modifierResults, modifierId),
    reaction:
      playerReactionTimeMs === undefined
        ? telemetry.reaction
        : addReactionSample(telemetry.reaction, playerReactionTimeMs),
    enemies: {
      ...telemetry.enemies,
      [enemy.id]: nextEnemy
    },
    upgradeOwnershipAtDuel: recordOwnedUpgrades(
      telemetry.upgradeOwnershipAtDuel,
      ownedUpgrades
    )
  };
}

export function getPlaytestSummary(
  telemetry: PlaytestTelemetry,
  selectedEnemyId: string
): PlaytestSummary {
  const selectedEnemy = telemetry.enemies[selectedEnemyId];

  return {
    totalDuelsStarted: telemetry.totalDuelsStarted,
    wins: telemetry.wins,
    losses: telemetry.losses,
    winRate: getWinRate(telemetry.wins, telemetry.losses),
    averageReactionTimeMs: getAverageMs(telemetry.reaction),
    fastestReactionTimeMs: telemetry.reaction.fastestMs,
    slowestReactionTimeMs: telemetry.reaction.slowestMs,
    selectedEnemyWinRate: selectedEnemy
      ? getWinRate(selectedEnemy.wins, selectedEnemy.losses)
      : null
  };
}

export function createBalanceReport(
  telemetry: PlaytestTelemetry,
  tuning: TuningOverrides,
  ownedUpgrades: readonly UpgradeId[]
): BalanceReport {
  return {
    timestamp: new Date().toISOString(),
    aggregate: telemetry,
    perEnemy: Object.fromEntries(
      Object.entries(telemetry.enemies).map(([enemyId, enemy]) => [
        enemyId,
        {
          ...enemy,
          winRate: getWinRate(enemy.wins, enemy.losses),
          averageReactionTimeMs: getAverageMs(enemy.reaction),
          averageTimeToShotMs: getAverageMs(enemy.timeToShot)
        }
      ])
    ),
    currentTuningOverrides: tuning,
    ownedUpgrades
  };
}

function getEnemyTelemetry(
  telemetry: PlaytestTelemetry,
  enemy: EnemyDefinition
): EnemyTelemetry {
  return telemetry.enemies[enemy.id] ?? createEnemyTelemetry(enemy);
}

function createEnemyTelemetry(enemy: EnemyDefinition): EnemyTelemetry {
  return {
    enemyId: enemy.id,
    enemyName: enemy.name,
    duelsStarted: 0,
    wins: 0,
    losses: 0,
    lossReasons: createEmptyLossReasons(),
    fakeoutBites: 0,
    fakeoutsWaitedOut: 0,
    aimDisruptedShots: 0,
    modifierStarts: {},
    modifierResults: {},
    reaction: createEmptyReactionStats(),
    timeToShot: createEmptyReactionStats()
  };
}

function createEmptyReactionStats(): ReactionStats {
  return {
    count: 0,
    totalMs: 0,
    fastestMs: null,
    slowestMs: null
  };
}

function createEmptyLossReasons(): Record<DuelResultReason, number> {
  return {
    "clean shot": 0,
    "enemy was faster": 0,
    "early draw": 0,
    "missed shot": 0,
    "rule violation": 0
  };
}

function addReactionSample(stats: ReactionStats, valueMs: number): ReactionStats {
  return {
    count: stats.count + 1,
    totalMs: stats.totalMs + valueMs,
    fastestMs: stats.fastestMs === null ? valueMs : Math.min(stats.fastestMs, valueMs),
    slowestMs: stats.slowestMs === null ? valueMs : Math.max(stats.slowestMs, valueMs)
  };
}

function recordOwnedUpgrades(
  current: Record<string, number>,
  ownedUpgrades: readonly UpgradeId[]
): Record<string, number> {
  const next = { ...current };

  for (const upgradeId of ownedUpgrades) {
    next[upgradeId] = (next[upgradeId] ?? 0) + 1;
  }

  return next;
}

function incrementMapValue(
  current: Record<string, number>,
  key: string | undefined
): Record<string, number> {
  if (!key) {
    return current;
  }

  return {
    ...current,
    [key]: (current[key] ?? 0) + 1
  };
}

function getAverageMs(stats: ReactionStats): number | null {
  return stats.count > 0 ? stats.totalMs / stats.count : null;
}

function getWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  return total > 0 ? wins / total : 0;
}

function parseTelemetry(value: unknown): PlaytestTelemetry {
  if (!isRecord(value)) {
    return createEmptyTelemetry();
  }

  const telemetry = createEmptyTelemetry();

  return {
    totalDuelsStarted: readNonNegativeNumber(value.totalDuelsStarted),
    wins: readNonNegativeNumber(value.wins),
    losses: readNonNegativeNumber(value.losses),
    earlyDrawFouls: readNonNegativeNumber(value.earlyDrawFouls),
    misses: readNonNegativeNumber(value.misses),
    headHits: readNonNegativeNumber(value.headHits),
    torsoHits: readNonNegativeNumber(value.torsoHits),
    disarms: readNonNegativeNumber(value.disarms),
    fakeoutBites: readNonNegativeNumber(value.fakeoutBites),
    fakeoutsWaitedOut: readNonNegativeNumber(value.fakeoutsWaitedOut),
    aimDisruptedShots: readNonNegativeNumber(value.aimDisruptedShots),
    modifierStarts: isRecord(value.modifierStarts)
      ? parseNumberMap(value.modifierStarts)
      : telemetry.modifierStarts,
    modifierResults: isRecord(value.modifierResults)
      ? parseNumberMap(value.modifierResults)
      : telemetry.modifierResults,
    reaction: parseReactionStats(value.reaction),
    enemies: isRecord(value.enemies) ? parseEnemyTelemetryMap(value.enemies) : {},
    upgradeOwnershipAtDuel: isRecord(value.upgradeOwnershipAtDuel)
      ? parseNumberMap(value.upgradeOwnershipAtDuel)
      : telemetry.upgradeOwnershipAtDuel
  };
}

function parseEnemyTelemetryMap(value: Record<string, unknown>): Record<string, EnemyTelemetry> {
  const enemies: Record<string, EnemyTelemetry> = {};

  for (const [enemyId, enemyValue] of Object.entries(value)) {
    if (!isRecord(enemyValue)) {
      continue;
    }

    enemies[enemyId] = {
      enemyId,
      enemyName: typeof enemyValue.enemyName === "string" ? enemyValue.enemyName : enemyId,
      duelsStarted: readNonNegativeNumber(enemyValue.duelsStarted),
      wins: readNonNegativeNumber(enemyValue.wins),
      losses: readNonNegativeNumber(enemyValue.losses),
      lossReasons: parseLossReasons(enemyValue.lossReasons),
      fakeoutBites: readNonNegativeNumber(enemyValue.fakeoutBites),
      fakeoutsWaitedOut: readNonNegativeNumber(enemyValue.fakeoutsWaitedOut),
      aimDisruptedShots: readNonNegativeNumber(enemyValue.aimDisruptedShots),
      modifierStarts: isRecord(enemyValue.modifierStarts)
        ? parseNumberMap(enemyValue.modifierStarts)
        : {},
      modifierResults: isRecord(enemyValue.modifierResults)
        ? parseNumberMap(enemyValue.modifierResults)
        : {},
      reaction: parseReactionStats(enemyValue.reaction),
      timeToShot: parseReactionStats(enemyValue.timeToShot)
    };
  }

  return enemies;
}

function parseLossReasons(value: unknown): Record<DuelResultReason, number> {
  const reasons = createEmptyLossReasons();

  if (!isRecord(value)) {
    return reasons;
  }

  for (const reason of LOSS_REASONS) {
    reasons[reason] = readNonNegativeNumber(value[reason]);
  }

  return reasons;
}

function parseReactionStats(value: unknown): ReactionStats {
  if (!isRecord(value)) {
    return createEmptyReactionStats();
  }

  return {
    count: readNonNegativeNumber(value.count),
    totalMs: readNonNegativeNumber(value.totalMs),
    fastestMs: readNullableNumber(value.fastestMs),
    slowestMs: readNullableNumber(value.slowestMs)
  };
}

function parseNumberMap(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => [key, readNonNegativeNumber(rawValue)])
  );
}

function readNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
