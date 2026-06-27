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

export interface EnemyPortraitConfig {
  hatType: PortraitHatType;
  bodyShape: PortraitBodyShape;
  faceShape: PortraitFaceShape;
  hasCoat: boolean;
  hasPoncho: boolean;
  hasBandana: boolean;
  hasScar: boolean;
  hasEyePatch: boolean;
  boardRotationDeg: number;
  boardOffsetY: number;
  palette: EnemyPortraitPalette;
}

export interface EnemyVisualConfig {
  coatColor: string;
  shirtColor: string;
  hatColor: string;
  skinColor: string;
  scale: number;
  drawLeanDistance: number;
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
      drawLeanDistance: 0
    },
    portrait: {
      hatType: "oversized",
      bodyShape: "small",
      faceShape: "round",
      hasCoat: true,
      hasPoncho: false,
      hasBandana: false,
      hasScar: false,
      hasEyePatch: false,
      boardRotationDeg: -2.5,
      boardOffsetY: 10,
      palette: {
        paperTint: "#efd59f",
        ink: "#3b2416",
        shadow: "#715033",
        accent: "#b36f2f",
        hat: "#7c532e",
        coat: "#7a5b38",
        skin: "#bd8558"
      }
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
      drawLeanDistance: 0
    },
    portrait: {
      hatType: "narrow",
      bodyShape: "thin",
      faceShape: "long",
      hasCoat: true,
      hasPoncho: false,
      hasBandana: true,
      hasScar: true,
      hasEyePatch: false,
      boardRotationDeg: 1.7,
      boardOffsetY: -4,
      palette: {
        paperTint: "#e8c58c",
        ink: "#351b16",
        shadow: "#74332c",
        accent: "#9d2f28",
        hat: "#35231d",
        coat: "#8e342f",
        skin: "#a96d4b"
      }
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
      drawLeanDistance: 0
    },
    portrait: {
      hatType: "marshal",
      bodyShape: "tall",
      faceShape: "square",
      hasCoat: true,
      hasPoncho: false,
      hasBandana: false,
      hasScar: false,
      hasEyePatch: false,
      boardRotationDeg: -0.8,
      boardOffsetY: 2,
      palette: {
        paperTint: "#ead09a",
        ink: "#253039",
        shadow: "#566777",
        accent: "#b08a45",
        hat: "#1f2427",
        coat: "#2f3d46",
        skin: "#b77b52"
      }
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
      drawLeanDistance: -0.34
    },
    portrait: {
      hatType: "wide",
      bodyShape: "poncho",
      faceShape: "sharp",
      hasCoat: false,
      hasPoncho: true,
      hasBandana: false,
      hasScar: true,
      hasEyePatch: false,
      boardRotationDeg: 2.4,
      boardOffsetY: 8,
      palette: {
        paperTint: "#e5bf84",
        ink: "#232131",
        shadow: "#464d70",
        accent: "#7a4154",
        hat: "#1d1b25",
        coat: "#3f4563",
        skin: "#9f6c52"
      }
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
      drawLeanDistance: 0.12
    },
    portrait: {
      hatType: "black",
      bodyShape: "broad",
      faceShape: "shadow",
      hasCoat: true,
      hasPoncho: false,
      hasBandana: true,
      hasScar: false,
      hasEyePatch: true,
      boardRotationDeg: -1.4,
      boardOffsetY: -8,
      palette: {
        paperTint: "#d8ad72",
        ink: "#130f0d",
        shadow: "#28201b",
        accent: "#a33b31",
        hat: "#0d0c0b",
        coat: "#171514",
        skin: "#9b6847"
      }
    }
  }
] as const satisfies readonly EnemyDefinition[];

export const DEFAULT_ENEMY = ENEMIES[0];
