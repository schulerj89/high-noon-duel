import type { ShotResult } from "../game/scoring";

export type EnemyDifficulty = "Tutorial" | "Moderate" | "Hard" | "Expert" | "Boss";

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
    }
  }
] as const satisfies readonly EnemyDefinition[];

export const DEFAULT_ENEMY = ENEMIES[0];
