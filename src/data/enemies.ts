import type { ShotResult } from "../game/scoring";

export type EnemyDifficulty = "Tutorial" | "Moderate" | "Hard" | "Expert" | "Boss";
export type PortraitHatType = "oversized" | "narrow" | "marshal" | "wide" | "black";
export type PortraitBodyShape = "small" | "thin" | "tall" | "poncho" | "broad";
export type PortraitFaceShape = "round" | "long" | "square" | "sharp" | "shadow";

export interface EnemyPortraitPalette {
  paperTint: string;
  ink: string;
  shadow: string;
  accent: string;
  hat: string;
  coat: string;
  skin: string;
}

export interface EnemyProceduralPortraitConfig {
  hatType: PortraitHatType;
  bodyShape: PortraitBodyShape;
  faceShape: PortraitFaceShape;
  hasCoat: boolean;
  hasPoncho: boolean;
  hasBandana: boolean;
  hasScar: boolean;
  hasEyePatch: boolean;
}

export interface EnemyPortraitConfig {
  imageUrl: string;
  boardRotationDeg: number;
  boardOffsetY: number;
  palette: EnemyPortraitPalette;
  procedural: EnemyProceduralPortraitConfig;
}

export interface EnemyVisualConfig {
  coatColor: string;
  shirtColor: string;
  hatColor: string;
  skinColor: string;
  scale: number;
  drawLeanDistance: number;
  frame: EnemyFrameConfig;
  accessories: EnemyAccessoryConfig;
  motion: EnemyMotionConfig;
}

export interface EnemyFrameConfig {
  heightScale: number;
  shoulderWidth: number;
  torsoWidth: number;
  torsoDepth: number;
  waistWidth: number;
  armLength: number;
  armThickness: number;
  legLength: number;
  legThickness: number;
  stanceWidth: number;
  headScale: number;
  hatBrimScale: number;
  hatCrownScale: number;
  hunch: number;
  sideStance: number;
}

export interface EnemyAccessoryConfig {
  hasCoat: boolean;
  hasLongCoat: boolean;
  hasPoncho: boolean;
  hasBandana: boolean;
  hasBadge: boolean;
  hasEyePatch: boolean;
  hasScar: boolean;
}

export interface EnemyMotionConfig {
  idleSway: number;
  handTwitch: number;
  shoulderTwitch: number;
  hitSlump: number;
  disarmJerk: number;
}

export interface EnemyDialogueConfig {
  introLines: readonly string[];
  fakeoutLines?: readonly string[];
  loseLines?: readonly string[];
  winLines?: readonly string[];
}

export interface EnemyDefinition {
  id: string;
  name: string;
  title: string;
  description: string;
  difficultyHint: EnemyDifficulty;
  reactionTimeMs: number;
  accuracy: number;
  fakeoutChance: number;
  reward: number;
  preferredTell: string;
  weakZones: readonly ShotResult[];
  visual: EnemyVisualConfig;
  portrait: EnemyPortraitConfig;
  dialogue: EnemyDialogueConfig;
}

export const ENEMIES = [
  {
    id: "billy-the-shaky",
    name: "Billy the Shaky",
    title: "Nervous Farmhand",
    description: "A tutorial draw with slow hands, poor aim, and no tricks.",
    difficultyHint: "Tutorial",
    reactionTimeMs: 980,
    accuracy: 0.38,
    fakeoutChance: 0,
    reward: 40,
    preferredTell: "Hands tremble, but he does not fake the draw.",
    weakZones: ["torso", "head", "disarm"],
    visual: {
      coatColor: "#7a5b38",
      shirtColor: "#dfc67a",
      hatColor: "#6e4b28",
      skinColor: "#bd8558",
      scale: 0.95,
      drawLeanDistance: 0,
      frame: {
        heightScale: 0.94,
        shoulderWidth: 0.76,
        torsoWidth: 0.7,
        torsoDepth: 0.34,
        waistWidth: 0.58,
        armLength: 0.92,
        armThickness: 0.13,
        legLength: 0.84,
        legThickness: 0.16,
        stanceWidth: 0.34,
        headScale: 0.98,
        hatBrimScale: 1.28,
        hatCrownScale: 1.06,
        hunch: 0.18,
        sideStance: 0
      },
      accessories: {
        hasCoat: true,
        hasLongCoat: false,
        hasPoncho: false,
        hasBandana: false,
        hasBadge: false,
        hasEyePatch: false,
        hasScar: false
      },
      motion: {
        idleSway: 0.055,
        handTwitch: 0.05,
        shoulderTwitch: 0.03,
        hitSlump: 0.32,
        disarmJerk: 0.55
      }
    },
    portrait: {
      imageUrl: "/bounties/billy-the-shaky.webp",
      boardRotationDeg: -2.5,
      boardOffsetY: 10,
      procedural: {
        hatType: "oversized",
        bodyShape: "small",
        faceShape: "round",
        hasCoat: true,
        hasPoncho: false,
        hasBandana: false,
        hasScar: false,
        hasEyePatch: false
      },
      palette: {
        paperTint: "#efd59f",
        ink: "#3b2416",
        shadow: "#715033",
        accent: "#b36f2f",
        hat: "#7c532e",
        coat: "#7a5b38",
        skin: "#bd8558"
      }
    },
    dialogue: {
      introLines: [
        "I ain't scared. Not much, anyway.",
        "My hand's steady enough."
      ],
      loseLines: [
        "I knew I should've stayed home.",
        "That was faster than a rattler."
      ],
      winLines: [
        "I did it? I mean, I meant to do that.",
        "Guess my hand was steady enough."
      ]
    }
  },
  {
    id: "red-eye-ramos",
    name: "Red-Eye Ramos",
    title: "Twitchy Bandit",
    description: "A jittery outlaw who likes to flinch before the real signal.",
    difficultyHint: "Moderate",
    reactionTimeMs: 720,
    accuracy: 0.62,
    fakeoutChance: 0.45,
    reward: 85,
    preferredTell: "Watch the gun hand. He twitches early.",
    weakZones: ["head", "disarm"],
    visual: {
      coatColor: "#8e342f",
      shirtColor: "#e0b45c",
      hatColor: "#35231d",
      skinColor: "#a96d4b",
      scale: 1,
      drawLeanDistance: 0,
      frame: {
        heightScale: 1,
        shoulderWidth: 0.7,
        torsoWidth: 0.58,
        torsoDepth: 0.3,
        waistWidth: 0.48,
        armLength: 1.02,
        armThickness: 0.12,
        legLength: 0.94,
        legThickness: 0.13,
        stanceWidth: 0.34,
        headScale: 0.94,
        hatBrimScale: 0.98,
        hatCrownScale: 1.04,
        hunch: 0.06,
        sideStance: -0.04
      },
      accessories: {
        hasCoat: true,
        hasLongCoat: false,
        hasPoncho: false,
        hasBandana: true,
        hasBadge: false,
        hasEyePatch: false,
        hasScar: true
      },
      motion: {
        idleSway: 0.028,
        handTwitch: 0.1,
        shoulderTwitch: 0.07,
        hitSlump: 0.26,
        disarmJerk: 0.8
      }
    },
    portrait: {
      imageUrl: "/bounties/red-eye-ramos.webp",
      boardRotationDeg: 1.7,
      boardOffsetY: -4,
      procedural: {
        hatType: "narrow",
        bodyShape: "thin",
        faceShape: "long",
        hasCoat: true,
        hasPoncho: false,
        hasBandana: true,
        hasScar: true,
        hasEyePatch: false
      },
      palette: {
        paperTint: "#e8c58c",
        ink: "#351b16",
        shadow: "#74332c",
        accent: "#9d2f28",
        hat: "#35231d",
        coat: "#8e342f",
        skin: "#a96d4b"
      }
    },
    dialogue: {
      introLines: [
        "Blink and you're buried.",
        "You watching my hand, friend?"
      ],
      fakeoutLines: [
        "Too quick for you?",
        "Eyes up."
      ],
      loseLines: [
        "Should've blinked.",
        "Lucky shot."
      ],
      winLines: [
        "Told you not to blink.",
        "You watched the wrong hand."
      ]
    }
  },
  {
    id: "marshal-graves",
    name: "Marshal Graves",
    title: "Old Badge",
    description: "A veteran lawman with fast hands, sharp aim, and a narrow margin.",
    difficultyHint: "Hard",
    reactionTimeMs: 540,
    accuracy: 0.86,
    fakeoutChance: 0.18,
    reward: 140,
    preferredTell: "He stays still until the draw, then moves clean.",
    weakZones: ["disarm"],
    visual: {
      coatColor: "#2f3d46",
      shirtColor: "#c8b47c",
      hatColor: "#1f2427",
      skinColor: "#b77b52",
      scale: 1.03,
      drawLeanDistance: 0,
      frame: {
        heightScale: 1.08,
        shoulderWidth: 0.9,
        torsoWidth: 0.74,
        torsoDepth: 0.34,
        waistWidth: 0.62,
        armLength: 1,
        armThickness: 0.15,
        legLength: 1.02,
        legThickness: 0.17,
        stanceWidth: 0.4,
        headScale: 1,
        hatBrimScale: 1.04,
        hatCrownScale: 1.02,
        hunch: 0,
        sideStance: 0
      },
      accessories: {
        hasCoat: true,
        hasLongCoat: true,
        hasPoncho: false,
        hasBandana: false,
        hasBadge: true,
        hasEyePatch: false,
        hasScar: false
      },
      motion: {
        idleSway: 0.01,
        handTwitch: 0.014,
        shoulderTwitch: 0.01,
        hitSlump: 0.24,
        disarmJerk: 0.45
      }
    },
    portrait: {
      imageUrl: "/bounties/marshal-graves.webp",
      boardRotationDeg: -0.8,
      boardOffsetY: 2,
      procedural: {
        hatType: "marshal",
        bodyShape: "tall",
        faceShape: "square",
        hasCoat: true,
        hasPoncho: false,
        hasBandana: false,
        hasScar: false,
        hasEyePatch: false
      },
      palette: {
        paperTint: "#ead09a",
        ink: "#253039",
        shadow: "#566777",
        accent: "#b08a45",
        hat: "#1f2427",
        coat: "#2f3d46",
        skin: "#b77b52"
      }
    },
    dialogue: {
      introLines: [
        "I've seen faster men fall slower.",
        "Steady now."
      ],
      fakeoutLines: [
        "Hold."
      ],
      loseLines: [
        "Clean draw. Fair enough.",
        "That'll do."
      ],
      winLines: [
        "Lesson's over.",
        "You rushed it."
      ]
    }
  },
  {
    id: "dust-widow",
    name: "Dust Widow",
    title: "Trick Shooter",
    description: "A sidestepping shooter who leans after DRAW and punishes misses.",
    difficultyHint: "Expert",
    reactionTimeMs: 610,
    accuracy: 0.78,
    fakeoutChance: 0.28,
    reward: 175,
    preferredTell: "Her shoulder dips before she slides off center.",
    weakZones: ["head", "disarm"],
    visual: {
      coatColor: "#3f4563",
      shirtColor: "#d9a85b",
      hatColor: "#1d1b25",
      skinColor: "#9f6c52",
      scale: 0.98,
      drawLeanDistance: -0.34,
      frame: {
        heightScale: 1,
        shoulderWidth: 0.82,
        torsoWidth: 0.68,
        torsoDepth: 0.32,
        waistWidth: 0.56,
        armLength: 0.96,
        armThickness: 0.13,
        legLength: 0.92,
        legThickness: 0.14,
        stanceWidth: 0.5,
        headScale: 0.96,
        hatBrimScale: 1.34,
        hatCrownScale: 0.94,
        hunch: 0.02,
        sideStance: -0.12
      },
      accessories: {
        hasCoat: false,
        hasLongCoat: false,
        hasPoncho: true,
        hasBandana: false,
        hasBadge: false,
        hasEyePatch: false,
        hasScar: true
      },
      motion: {
        idleSway: 0.018,
        handTwitch: 0.045,
        shoulderTwitch: 0.03,
        hitSlump: 0.2,
        disarmJerk: 0.62
      }
    },
    portrait: {
      imageUrl: "/bounties/dust-widow.webp",
      boardRotationDeg: 2.4,
      boardOffsetY: 8,
      procedural: {
        hatType: "wide",
        bodyShape: "poncho",
        faceShape: "sharp",
        hasCoat: false,
        hasPoncho: true,
        hasBandana: false,
        hasScar: true,
        hasEyePatch: false
      },
      palette: {
        paperTint: "#e5bf84",
        ink: "#232131",
        shadow: "#464d70",
        accent: "#7a4154",
        hat: "#1d1b25",
        coat: "#3f4563",
        skin: "#9f6c52"
      }
    },
    dialogue: {
      introLines: [
        "The dust sees everything.",
        "One breath. One bullet."
      ],
      fakeoutLines: [
        "There.",
        "Did the wind move?"
      ],
      loseLines: [
        "Dust take me.",
        "You read the wind."
      ],
      winLines: [
        "The dust told me first.",
        "One breath was all I needed."
      ]
    }
  },
  {
    id: "the-black-hat",
    name: "The Black Hat",
    title: "Bounty Board Boss",
    description: "Very fast, accurate, and fond of cruel fakeouts.",
    difficultyHint: "Boss",
    reactionTimeMs: 430,
    accuracy: 0.93,
    fakeoutChance: 0.62,
    reward: 300,
    preferredTell: "His coat barely moves. Do not trust the hand twitch.",
    weakZones: ["head", "disarm"],
    visual: {
      coatColor: "#171514",
      shirtColor: "#a33b31",
      hatColor: "#0d0c0b",
      skinColor: "#9b6847",
      scale: 1.07,
      drawLeanDistance: 0.12,
      frame: {
        heightScale: 1.1,
        shoulderWidth: 1.04,
        torsoWidth: 0.88,
        torsoDepth: 0.38,
        waistWidth: 0.72,
        armLength: 1.06,
        armThickness: 0.18,
        legLength: 1.02,
        legThickness: 0.19,
        stanceWidth: 0.5,
        headScale: 1.04,
        hatBrimScale: 1.38,
        hatCrownScale: 1.16,
        hunch: 0.02,
        sideStance: 0.04
      },
      accessories: {
        hasCoat: true,
        hasLongCoat: true,
        hasPoncho: false,
        hasBandana: true,
        hasBadge: false,
        hasEyePatch: true,
        hasScar: false
      },
      motion: {
        idleSway: 0.006,
        handTwitch: 0.025,
        shoulderTwitch: 0.012,
        hitSlump: 0.18,
        disarmJerk: 0.48
      }
    },
    portrait: {
      imageUrl: "/bounties/the-black-hat.webp",
      boardRotationDeg: -1.4,
      boardOffsetY: -8,
      procedural: {
        hatType: "black",
        bodyShape: "broad",
        faceShape: "shadow",
        hasCoat: true,
        hasPoncho: false,
        hasBandana: true,
        hasScar: false,
        hasEyePatch: true
      },
      palette: {
        paperTint: "#d8ad72",
        ink: "#130f0d",
        shadow: "#28201b",
        accent: "#a33b31",
        hat: "#0d0c0b",
        coat: "#171514",
        skin: "#9b6847"
      }
    },
    dialogue: {
      introLines: [
        "You already lost.",
        "Draw, if you came to die."
      ],
      fakeoutLines: [
        "Now.",
        "Too late."
      ],
      loseLines: [
        "This changes nothing.",
        "Enjoy the breath you bought."
      ],
      winLines: [
        "I told you.",
        "High noon ends here."
      ]
    }
  }
] as const satisfies readonly EnemyDefinition[];

export const DEFAULT_ENEMY = ENEMIES[0];
