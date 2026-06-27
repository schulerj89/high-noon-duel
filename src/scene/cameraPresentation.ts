import type { DuelPhase, DuelOutcome } from "../game/state";

export interface CameraPresentationInput {
  phase: DuelPhase;
  outcome?: DuelOutcome;
  now: number;
  roundStartedAt: number;
  scheduledDrawAt: number;
  lastShotAt?: number;
  hitPauseActive: boolean;
}

export interface CameraPresentation {
  positionOffset: readonly [number, number, number];
  lookAtOffset: readonly [number, number, number];
  fovOffset: number;
}

export function getCameraPresentation(input: CameraPresentationInput): CameraPresentation {
  const duelProgress = getDuelProgress(input);
  const pushIn = input.phase === "intro" ? 0 : smoothStep(duelProgress) * 0.68;
  const resultLift = input.phase === "resolved" && input.outcome === "win" ? 0.08 : 0;
  const lossDrop = input.phase === "resolved" && input.outcome === "loss" ? -0.04 : 0;
  const shake = getShotShake(input);

  return {
    positionOffset: [
      shake[0],
      resultLift + lossDrop + shake[1],
      -pushIn
    ],
    lookAtOffset: [
      0,
      pushIn * 0.08 + resultLift,
      0
    ],
    fovOffset: -pushIn * 1.15 - (input.hitPauseActive ? 0.6 : 0)
  };
}

function getDuelProgress(input: CameraPresentationInput): number {
  if (input.phase === "intro") {
    return 0;
  }

  if (input.phase === "resolved") {
    return 1;
  }

  const duration = Math.max(1, input.scheduledDrawAt - input.roundStartedAt);
  return clamp01((input.now - input.roundStartedAt) / duration);
}

function getShotShake(input: CameraPresentationInput): readonly [number, number] {
  if (input.lastShotAt === undefined) {
    return [0, 0];
  }

  const age = input.now - input.lastShotAt;
  const durationMs = input.hitPauseActive ? 170 : 135;

  if (age < 0 || age > durationMs) {
    return [0, 0];
  }

  const strength = (1 - age / durationMs) * (input.hitPauseActive ? 0.052 : 0.04);
  return [
    Math.sin(input.now * 0.083) * strength,
    Math.cos(input.now * 0.071) * strength
  ];
}

function smoothStep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
