export type PracticeModeId =
  | "reaction-drill"
  | "accuracy-drill"
  | "fakeout-drill"
  | "disarm-drill";

export type PracticeBestKind = "lower-time" | "higher-score";

export interface PracticeModeDefinition {
  id: PracticeModeId;
  name: string;
  subtitle: string;
  description: string;
  goalText: string;
  bestKind: PracticeBestKind;
}

export const PRACTICE_MODES = [
  {
    id: "reaction-drill",
    name: "Reaction Drill",
    subtitle: "Wait. Draw. Click.",
    description: "Practice the READY, STEADY, random pause, DRAW rhythm without an enemy shot.",
    goalText: "Click as fast as possible after DRAW. Early clicks foul the run.",
    bestKind: "lower-time"
  },
  {
    id: "accuracy-drill",
    name: "Accuracy Drill",
    subtitle: "Bottles, cans, signs.",
    description: "Shoot procedural range targets down the street and balance speed with accuracy.",
    goalText: "Clear the targets with as few misses as possible before the timer runs out.",
    bestKind: "higher-score"
  },
  {
    id: "fakeout-drill",
    name: "Fakeout Drill",
    subtitle: "Do not bite.",
    description: "Read a twitchy opponent and ignore fake hand movement before the legal cue.",
    goalText: "Wait through fakeouts, then click on the real DRAW.",
    bestKind: "higher-score"
  },
  {
    id: "disarm-drill",
    name: "Disarm Drill",
    subtitle: "Small target. Clean hand.",
    description: "Train precision on the gun hand without risking a bounty or an injury.",
    goalText: "Wait for DRAW and hit the gun hand. Torso and head hits do not count.",
    bestKind: "higher-score"
  }
] as const satisfies readonly PracticeModeDefinition[];

const PRACTICE_MODE_LOOKUP: Record<string, PracticeModeDefinition> = Object.fromEntries(
  PRACTICE_MODES.map((mode) => [mode.id, mode])
);

export function getPracticeMode(modeId: string): PracticeModeDefinition {
  return PRACTICE_MODE_LOOKUP[modeId] ?? PRACTICE_MODES[0];
}
