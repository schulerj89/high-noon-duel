export type ShotResult = "torso" | "head" | "disarm" | "miss";
export type HitZoneShape = "box" | "sphere";
export type HitZoneParent = "torso" | "head" | "rightHand";

export interface HitZoneDefinition {
  id: string;
  label: string;
  shotResult: ShotResult;
  shape: HitZoneShape;
  parent: HitZoneParent;
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  color: string;
  priority: number;
  styleBonusText?: string;
}

export interface ShotScore {
  shotResult: ShotResult;
  styleBonusText?: string;
}

export const HIT_ZONE_DEFINITIONS = [
  {
    id: "torso",
    label: "Torso",
    shotResult: "torso",
    shape: "box",
    parent: "torso",
    position: [0, 0, 0.1],
    size: [0.92, 1.08, 0.5],
    color: "#5fd36b",
    priority: 1
  },
  {
    id: "head",
    label: "Head",
    shotResult: "head",
    shape: "sphere",
    parent: "head",
    position: [0, 0, 0.08],
    size: [0.34, 0.34, 0.34],
    color: "#ffe56e",
    priority: 3,
    styleBonusText: "Style bonus: head shot."
  },
  {
    id: "gun-hand",
    label: "Gun Hand",
    shotResult: "disarm",
    shape: "box",
    parent: "rightHand",
    position: [0, 0, 0.08],
    size: [0.38, 0.38, 0.36],
    color: "#5ab7ff",
    priority: 4,
    styleBonusText: "Style bonus: disarm."
  }
] as const satisfies readonly HitZoneDefinition[];

export function scoreHitZone(hitZone: HitZoneDefinition | null): ShotScore {
  if (!hitZone) {
    return { shotResult: "miss" };
  }

  return {
    shotResult: hitZone.shotResult,
    styleBonusText: hitZone.styleBonusText
  };
}

export function formatShotResult(result: ShotResult | undefined): string {
  switch (result) {
    case "torso":
      return "Torso";
    case "head":
      return "Head";
    case "disarm":
      return "Disarm";
    case "miss":
      return "Miss";
    case undefined:
      return "--";
  }
}

export function getEnemyFireAt(drawAt: number, reactionTimeMs: number): number {
  return drawAt + reactionTimeMs;
}

export function getMissPunishFireAt(
  playerFiredAt: number,
  scheduledEnemyFireAt: number,
  missPunishDelayMs: number
): number {
  return Math.min(scheduledEnemyFireAt, playerFiredAt + missPunishDelayMs);
}
