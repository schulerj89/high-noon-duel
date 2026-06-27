import {
  getPracticeMode,
  type PracticeModeDefinition,
  type PracticeModeId
} from "../data/practiceModes";

export type PracticeOutcome = "complete" | "failed" | "foul";

export interface PracticeBest {
  bestScore?: number;
  bestReactionTimeMs?: number;
  updatedAt: number;
}

export type PracticeBests = Partial<Record<PracticeModeId, PracticeBest>>;

export interface PracticeResult {
  modeId: PracticeModeId;
  outcome: PracticeOutcome;
  title: string;
  summary: string;
  score: number;
  reactionTimeMs?: number;
  durationMs?: number;
  hits?: number;
  misses?: number;
  fouls?: number;
  targetText?: string;
  bestImproved?: boolean;
}

export interface PracticeTargetSpec {
  id: string;
  label: string;
  kind: "bottle" | "can" | "sign";
  position: readonly [number, number, number];
  points: number;
}

export const PRACTICE_BESTS_STORAGE_KEY = "high-noon-duel:practice-bests:v1";

export const ACCURACY_DRILL_DURATION_MS = 25_000;
export const ACCURACY_DRILL_MAX_SHOTS = 12;

export const ACCURACY_TARGET_SPECS = [
  {
    id: "left-bottle",
    label: "Bottle",
    kind: "bottle",
    position: [-1.25, 0.82, -4.25],
    points: 115
  },
  {
    id: "right-can",
    label: "Can",
    kind: "can",
    position: [1.12, 0.74, -4.85],
    points: 125
  },
  {
    id: "high-sign",
    label: "Sign",
    kind: "sign",
    position: [-0.42, 1.38, -5.55],
    points: 145
  },
  {
    id: "far-bottle",
    label: "Bottle",
    kind: "bottle",
    position: [0.88, 0.92, -6.15],
    points: 165
  },
  {
    id: "small-can",
    label: "Can",
    kind: "can",
    position: [-0.92, 0.72, -6.75],
    points: 180
  }
] as const satisfies readonly PracticeTargetSpec[];

export function loadPracticeBests(): PracticeBests {
  const storage = getLocalStorage();

  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(PRACTICE_BESTS_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return parsePracticeBests(parsed);
  } catch {
    return {};
  }
}

export function savePracticeBests(bests: PracticeBests): void {
  getLocalStorage()?.setItem(PRACTICE_BESTS_STORAGE_KEY, JSON.stringify(bests));
}

export function recordPracticeBest(
  bests: PracticeBests,
  mode: PracticeModeDefinition,
  result: PracticeResult
): {
  bests: PracticeBests;
  improved: boolean;
} {
  if (result.outcome !== "complete") {
    return { bests, improved: false };
  }

  const current = bests[mode.id];
  const updatedAt = Date.now();

  if (mode.bestKind === "lower-time") {
    if (result.reactionTimeMs === undefined) {
      return { bests, improved: false };
    }

    const improved =
      current?.bestReactionTimeMs === undefined ||
      result.reactionTimeMs < current.bestReactionTimeMs;

    if (!improved) {
      return { bests, improved: false };
    }

    return {
      bests: {
        ...bests,
        [mode.id]: {
          ...current,
          bestReactionTimeMs: result.reactionTimeMs,
          bestScore: Math.max(current?.bestScore ?? 0, result.score),
          updatedAt
        }
      },
      improved: true
    };
  }

  const improved = current?.bestScore === undefined || result.score > current.bestScore;

  if (!improved) {
    return { bests, improved: false };
  }

  return {
    bests: {
      ...bests,
      [mode.id]: {
        ...current,
        bestScore: result.score,
        updatedAt
      }
    },
    improved: true
  };
}

export function formatPracticeBest(mode: PracticeModeDefinition, best: PracticeBest | undefined): string {
  if (!best) {
    return "No best yet";
  }

  if (mode.bestKind === "lower-time") {
    return best.bestReactionTimeMs === undefined
      ? "No best yet"
      : `${Math.round(best.bestReactionTimeMs)} ms`;
  }

  return best.bestScore === undefined ? "No best yet" : `${Math.round(best.bestScore)} pts`;
}

export function getPracticeBestSummary(
  modeId: PracticeModeId,
  bests: PracticeBests
): string {
  const mode = getPracticeMode(modeId);
  return formatPracticeBest(mode, bests[modeId]);
}

export function scoreAccuracyDrill(input: {
  hits: number;
  misses: number;
  durationMs: number;
  targetPoints: number;
}): number {
  const speedBonus = Math.max(0, Math.round((ACCURACY_DRILL_DURATION_MS - input.durationMs) / 90));
  return Math.max(0, input.targetPoints + speedBonus - input.misses * 45 + input.hits * 20);
}

export function scoreReactionDrill(reactionTimeMs: number): number {
  return Math.max(0, Math.round(1000 - reactionTimeMs));
}

export function scoreFakeoutDrill(input: {
  reactionTimeMs: number;
  waitedOutFakeout: boolean;
}): number {
  const patienceBonus = input.waitedOutFakeout ? 260 : 120;
  return Math.max(0, Math.round(1100 - input.reactionTimeMs + patienceBonus));
}

export function scoreDisarmDrill(input: {
  reactionTimeMs: number;
  hitDisarm: boolean;
}): number {
  if (!input.hitDisarm) {
    return 0;
  }

  return Math.max(0, Math.round(1250 - input.reactionTimeMs));
}

function parsePracticeBests(value: unknown): PracticeBests {
  if (!isRecord(value)) {
    return {};
  }

  const bests: PracticeBests = {};

  for (const [modeId, bestValue] of Object.entries(value)) {
    const mode = getPracticeMode(modeId);

    if (mode.id !== modeId || !isRecord(bestValue)) {
      continue;
    }

    bests[mode.id] = {
      bestScore: optionalNumber(bestValue.bestScore),
      bestReactionTimeMs: optionalNumber(bestValue.bestReactionTimeMs),
      updatedAt: readNonNegativeInteger(bestValue.updatedAt)
    };
  }

  return bests;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
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
