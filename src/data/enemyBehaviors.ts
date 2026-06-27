import type { EnemyBehaviorDefinition } from "../game/tells";

export const ENEMY_BEHAVIORS = {
  "billy-the-shaky": {
    enemyId: "billy-the-shaky",
    idle: {
      description: "Harmless nervous tremble and hat bobbing.",
      tells: [
        { type: "handTwitch", intensity: 0.16, frequencyHz: 2.1 },
        { type: "shoulderDrop", intensity: 0.08, frequencyHz: 1.35 },
        { type: "holsterTap", intensity: 0.07, frequencyHz: 1.75 }
      ]
    },
    fakeouts: {
      enabled: false,
      chanceMultiplier: 0,
      minCount: 0,
      maxCount: 0,
      tellTypes: ["handTwitch"],
      durationMs: [160, 220],
      intensity: [0.4, 0.6],
      earliestAfterReadyMs: 0,
      latestBeforeDrawMs: 300
    },
    realDrawTell: {
      type: "holsterTap",
      delayAfterDrawMs: 90,
      durationMs: 360,
      intensity: 1,
      description: "His hand visibly drops to the holster before the draw."
    },
    drawAnimation: {
      style: "obviousReach",
      commitment: 0.86
    },
    postDraw: {
      behavior: "holdCenter",
      startsAfterDrawMs: 0,
      durationMs: 0,
      distance: 0,
      chance: 0
    },
    aimDisruption: {
      behavior: "none",
      startsAfterDrawMs: 0,
      durationMs: 0,
      distance: 0,
      chance: 0
    },
    resultText: {
      fellForFakeout: "You jumped at harmless nerves.",
      waitedOutFakeout: "You waited through Billy's shaking hand.",
      cleanDraw: "You beat his obvious draw.",
      aimDisrupted: "Billy stayed centered."
    }
  },
  "red-eye-ramos": {
    enemyId: "red-eye-ramos",
    idle: {
      description: "Jittery eyes and twitching gun hand.",
      tells: [
        { type: "handTwitch", intensity: 0.11, frequencyHz: 2.9 },
        { type: "eyeGlance", intensity: 0.08, frequencyHz: 1.8 }
      ]
    },
    fakeouts: {
      enabled: true,
      chanceMultiplier: 1.35,
      minCount: 1,
      maxCount: 3,
      tellTypes: ["handTwitch", "holsterTap", "shoulderDrop"],
      durationMs: [160, 260],
      intensity: [0.68, 1],
      earliestAfterReadyMs: 80,
      latestBeforeDrawMs: 260,
      subtitleLines: [
        "You flinch easy?",
        "Was that it?",
        "Watch close."
      ]
    },
    realDrawTell: {
      type: "holsterTap",
      delayAfterDrawMs: 55,
      durationMs: 240,
      intensity: 0.95,
      description: "The real move looks like a twitch, but his shoulder commits."
    },
    drawAnimation: {
      style: "baitedReach",
      commitment: 0.94
    },
    postDraw: {
      behavior: "holdCenter",
      startsAfterDrawMs: 0,
      durationMs: 0,
      distance: 0,
      chance: 0
    },
    aimDisruption: {
      behavior: "none",
      startsAfterDrawMs: 0,
      durationMs: 0,
      distance: 0,
      chance: 0
    },
    resultText: {
      fellForFakeout: "You fell for Ramos' fakeout.",
      waitedOutFakeout: "You waited out the twitch.",
      cleanDraw: "You read the committed draw.",
      aimDisrupted: "Ramos stayed in your sights."
    }
  },
  "marshal-graves": {
    enemyId: "marshal-graves",
    idle: {
      description: "Almost perfectly still until the legal draw.",
      tells: [
        { type: "stillness", intensity: 0.92, frequencyHz: 0.2 }
      ]
    },
    fakeouts: {
      enabled: false,
      chanceMultiplier: 0,
      minCount: 0,
      maxCount: 0,
      tellTypes: ["stillness"],
      durationMs: [120, 160],
      intensity: [0.1, 0.2],
      earliestAfterReadyMs: 0,
      latestBeforeDrawMs: 280
    },
    realDrawTell: {
      type: "shoulderDrop",
      delayAfterDrawMs: 35,
      durationMs: 190,
      intensity: 0.42,
      description: "A subtle shoulder set before a clean draw."
    },
    drawAnimation: {
      style: "cleanDraw",
      commitment: 1
    },
    postDraw: {
      behavior: "holdCenter",
      startsAfterDrawMs: 0,
      durationMs: 0,
      distance: 0,
      chance: 0
    },
    aimDisruption: {
      behavior: "none",
      startsAfterDrawMs: 0,
      durationMs: 0,
      distance: 0,
      chance: 0
    },
    resultText: {
      fellForFakeout: "There was no fakeout to chase.",
      waitedOutFakeout: "You held steady through his stillness.",
      cleanDraw: "You beat his clean draw.",
      aimDisrupted: "Graves gave you no movement excuse."
    }
  },
  "dust-widow": {
    enemyId: "dust-widow",
    idle: {
      description: "Quiet poncho movement and a sideways stance.",
      tells: [
        { type: "coatShift", intensity: 0.08, frequencyHz: 0.9 },
        { type: "leanLeft", intensity: 0.05, frequencyHz: 0.55 }
      ]
    },
    fakeouts: {
      enabled: true,
      chanceMultiplier: 0.8,
      minCount: 1,
      maxCount: 1,
      tellTypes: ["coatShift", "shoulderDrop"],
      durationMs: [180, 280],
      intensity: [0.48, 0.74],
      earliestAfterReadyMs: 180,
      latestBeforeDrawMs: 320,
      subtitleLines: [
        "Wind shifted.",
        "See it move?"
      ]
    },
    realDrawTell: {
      type: "shoulderDrop",
      delayAfterDrawMs: 70,
      durationMs: 230,
      intensity: 0.78,
      description: "Her shoulder drops just before she slides."
    },
    drawAnimation: {
      style: "sideStepDraw",
      commitment: 0.9
    },
    postDraw: {
      behavior: "sidestepLeft",
      startsAfterDrawMs: 130,
      durationMs: 520,
      distance: -0.18,
      chance: 0.8
    },
    aimDisruption: {
      behavior: "sideStepLeft",
      startsAfterDrawMs: 170,
      durationMs: 520,
      distance: -0.28,
      chance: 0.85,
      hitZoneScaleMultiplier: 0.98
    },
    resultText: {
      fellForFakeout: "You fired at a poncho twitch.",
      waitedOutFakeout: "You let the dust settle before drawing.",
      cleanDraw: "You tracked her sidestep.",
      aimDisrupted: "She moved before your shot."
    }
  },
  "the-black-hat": {
    enemyId: "the-black-hat",
    idle: {
      description: "Dead still except for a barely visible coat shift.",
      tells: [
        { type: "stillness", intensity: 0.98, frequencyHz: 0.1 },
        { type: "coatShift", intensity: 0.025, frequencyHz: 0.42 }
      ]
    },
    fakeouts: {
      enabled: true,
      chanceMultiplier: 1.15,
      minCount: 1,
      maxCount: 2,
      tellTypes: ["handTwitch", "eyeGlance"],
      durationMs: [110, 180],
      intensity: [0.28, 0.48],
      earliestAfterReadyMs: 120,
      latestBeforeDrawMs: 210,
      subtitleLines: [
        "Now.",
        "Too late."
      ]
    },
    realDrawTell: {
      type: "coatShift",
      delayAfterDrawMs: 35,
      durationMs: 130,
      intensity: 0.34,
      description: "One tiny coat shift after DRAW is the real tell."
    },
    drawAnimation: {
      style: "snapDraw",
      commitment: 1.08
    },
    postDraw: {
      behavior: "leanRight",
      startsAfterDrawMs: 90,
      durationMs: 340,
      distance: 0.08,
      chance: 0.55
    },
    aimDisruption: {
      behavior: "narrowTarget",
      startsAfterDrawMs: 0,
      durationMs: 650,
      distance: 0,
      chance: 1,
      hitZoneScaleMultiplier: 0.92
    },
    specialRule: {
      hitZoneScaleMultiplier: 0.9,
      note: "The Black Hat presents a smaller target."
    },
    resultText: {
      fellForFakeout: "You bit on the Black Hat's tiny fakeout.",
      waitedOutFakeout: "You did not trust the hand twitch.",
      cleanDraw: "You caught the coat shift.",
      aimDisrupted: "The Black Hat gave you a narrow target."
    }
  }
} as const satisfies Record<string, EnemyBehaviorDefinition>;

const BEHAVIOR_LOOKUP: Record<string, EnemyBehaviorDefinition> = ENEMY_BEHAVIORS;
const DEFAULT_BEHAVIOR = ENEMY_BEHAVIORS["billy-the-shaky"];

export function getEnemyBehavior(enemyId: string): EnemyBehaviorDefinition {
  return BEHAVIOR_LOOKUP[enemyId] ?? DEFAULT_BEHAVIOR;
}
