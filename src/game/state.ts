import type { ShotResult, ShotScore } from "./scoring";

export type DuelPhase =
  | "intro"
  | "standoff"
  | "ready"
  | "steady"
  | "waiting"
  | "draw"
  | "missed"
  | "resolved";
export type DuelOutcome = "win" | "loss";
export type DuelResultReason = "clean shot" | "enemy was faster" | "early draw" | "missed shot";

export interface CountdownTiming {
  standoffDurationMs: number;
  readyDurationMs: number;
  steadyDurationMs: number;
  drawPauseMs: number;
}

export interface DuelStats {
  drawAt?: number;
  playerFiredAt?: number;
  enemyFiredAt?: number;
  playerReactionTimeMs?: number;
  enemyReactionTimeMs?: number;
  shotResult?: ShotResult;
  styleBonusText?: string;
  firedDuringFakeout?: boolean;
  waitedOutFakeout?: boolean;
  aimDisrupted?: boolean;
  behaviorResultText?: string;
}

export interface DuelResult {
  outcome: DuelOutcome;
  reason: DuelResultReason;
  resolvedAt: number;
  stats: DuelStats;
}

export interface DuelState {
  phase: DuelPhase;
  roundStartedAt: number;
  phaseStartedAt: number;
  scheduledDrawAt: number;
  stats: DuelStats;
  result?: DuelResult;
}

export function createIntroDuelState(now = 0): DuelState {
  return {
    phase: "intro",
    roundStartedAt: now,
    phaseStartedAt: now,
    scheduledDrawAt: now,
    stats: {}
  };
}

export function startDuel(now: number, timing: CountdownTiming): DuelState {
  return {
    phase: "standoff",
    roundStartedAt: now,
    phaseStartedAt: now,
    scheduledDrawAt:
      now +
      timing.standoffDurationMs +
      timing.readyDurationMs +
      timing.steadyDurationMs +
      timing.drawPauseMs,
    stats: {}
  };
}

export function advanceDuelState(
  state: DuelState,
  now: number,
  timing: CountdownTiming
): DuelState {
  if (state.phase === "intro" || state.phase === "missed" || state.phase === "resolved") {
    return state;
  }

  const standoffEndsAt = state.roundStartedAt + timing.standoffDurationMs;
  const readyEndsAt = standoffEndsAt + timing.readyDurationMs;
  const steadyEndsAt = readyEndsAt + timing.steadyDurationMs;
  let nextPhase: DuelPhase = "standoff";
  let nextPhaseStartedAt = state.roundStartedAt;

  if (now >= state.scheduledDrawAt) {
    nextPhase = "draw";
    nextPhaseStartedAt = state.scheduledDrawAt;
  } else if (now >= steadyEndsAt) {
    nextPhase = "waiting";
    nextPhaseStartedAt = steadyEndsAt;
  } else if (now >= readyEndsAt) {
    nextPhase = "steady";
    nextPhaseStartedAt = readyEndsAt;
  } else if (now >= standoffEndsAt) {
    nextPhase = "ready";
    nextPhaseStartedAt = standoffEndsAt;
  }

  const nextStats =
    nextPhase === "draw" && state.stats.drawAt === undefined
      ? { ...state.stats, drawAt: state.scheduledDrawAt }
      : state.stats;

  if (nextPhase === state.phase && nextStats === state.stats) {
    return state;
  }

  return {
    ...state,
    phase: nextPhase,
    phaseStartedAt: nextPhaseStartedAt,
    stats: nextStats
  };
}

export function resolveEarlyDraw(
  state: DuelState,
  now: number,
  extraStats: Partial<DuelStats> = {}
): DuelState {
  return resolveDuel(state, now, "loss", "early draw", {
    ...state.stats,
    ...extraStats,
    playerFiredAt: now
  });
}

export function resolvePlayerHit(
  state: DuelState,
  firedAt: number,
  shotScore: ShotScore,
  enemyReactionTimeMs: number,
  extraStats: Partial<DuelStats> = {}
): DuelState {
  const drawAt = getDrawAt(state);
  const playerReactionTimeMs = firedAt - drawAt;

  return resolveDuel(state, firedAt, "win", "clean shot", {
    ...state.stats,
    ...extraStats,
    drawAt,
    playerFiredAt: firedAt,
    playerReactionTimeMs,
    enemyReactionTimeMs,
    shotResult: shotScore.shotResult,
    styleBonusText: shotScore.styleBonusText
  });
}

export function recordPlayerMiss(
  state: DuelState,
  firedAt: number,
  shotScore: ShotScore,
  extraStats: Partial<DuelStats> = {}
): DuelState {
  const drawAt = getDrawAt(state);
  const playerReactionTimeMs = firedAt - drawAt;

  return {
    ...state,
    phase: "missed",
    phaseStartedAt: firedAt,
    stats: {
      ...state.stats,
      ...extraStats,
      drawAt,
      playerFiredAt: firedAt,
      playerReactionTimeMs,
      shotResult: shotScore.shotResult
    }
  };
}

export function resolveEnemyShot(
  state: DuelState,
  firedAt: number,
  reason: Extract<DuelResultReason, "enemy was faster" | "missed shot">,
  extraStats: Partial<DuelStats> = {}
): DuelState {
  const drawAt = getDrawAt(state);
  const enemyReactionTimeMs = firedAt - drawAt;

  return resolveDuel(state, firedAt, "loss", reason, {
    ...state.stats,
    ...extraStats,
    drawAt,
    enemyFiredAt: firedAt,
    enemyReactionTimeMs
  });
}

export function formatDuration(ms: number | undefined): string {
  return ms === undefined ? "--" : `${Math.max(0, Math.round(ms))} ms`;
}

function getDrawAt(state: DuelState): number {
  return state.stats.drawAt ?? state.scheduledDrawAt;
}

function resolveDuel(
  state: DuelState,
  resolvedAt: number,
  outcome: DuelOutcome,
  reason: DuelResultReason,
  stats: DuelStats
): DuelState {
  return {
    ...state,
    phase: "resolved",
    phaseStartedAt: resolvedAt,
    stats,
    result: {
      outcome,
      reason,
      resolvedAt,
      stats
    }
  };
}
