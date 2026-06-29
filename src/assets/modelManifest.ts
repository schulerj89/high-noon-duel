export type ModelAssetId =
  | "cowboyMastjie"
  | "cowgirlMastjie"
  | "revolverQuaterniusA"
  | "revolverQuaterniusB"
  | "revolverCreativeTrio"
  | "bigBarnQuaternius"
  | "largeBuildingKenney"
  | "barrelQuaternius"
  | "crateQuaternius"
  | "cactusQuaternius";

export interface ModelAssetDefinition {
  id: ModelAssetId;
  path: string;
  label: string;
  sourceName: string;
  sourceUrl: string;
  creator: string;
  license: "CC0 1.0";
  triangles: number;
  bytes: number;
}

export interface TownModelPlacement {
  assetId: ModelAssetId;
  position: readonly [number, number, number];
  rotationY: number;
  targetHeight: number;
}

export interface EnemyCharacterModelBinding {
  assetId: ModelAssetId;
  position: readonly [number, number, number];
  rotationY: number;
  targetHeight: number;
  materialTint: string;
  materialTintStrength: number;
}

export const MODEL_ASSETS: Record<ModelAssetId, ModelAssetDefinition> = {
  cowboyMastjie: {
    id: "cowboyMastjie",
    path: "/models/characters/cowboy-mastjie.glb",
    label: "Cowboy",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/S8hq7LEXTT",
    creator: "mastjie",
    license: "CC0 1.0",
    triangles: 4278,
    bytes: 300692
  },
  cowgirlMastjie: {
    id: "cowgirlMastjie",
    path: "/models/characters/cowgirl-mastjie.glb",
    label: "Cowgirl",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/bB93W7ZTmG",
    creator: "mastjie",
    license: "CC0 1.0",
    triangles: 4522,
    bytes: 312340
  },
  revolverQuaterniusA: {
    id: "revolverQuaterniusA",
    path: "/models/weapons/revolver-quaternius-a.glb",
    label: "Revolver",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/9C26wSpMS0",
    creator: "Quaternius",
    license: "CC0 1.0",
    triangles: 1434,
    bytes: 79988
  },
  revolverQuaterniusB: {
    id: "revolverQuaterniusB",
    path: "/models/weapons/revolver-quaternius-b.glb",
    label: "Revolver",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/XrnLUz6kQj",
    creator: "Quaternius",
    license: "CC0 1.0",
    triangles: 1334,
    bytes: 73808
  },
  revolverCreativeTrio: {
    id: "revolverCreativeTrio",
    path: "/models/weapons/revolver-creativetrio.glb",
    label: "Revolver",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/wFQbxzzgqU",
    creator: "CreativeTrio",
    license: "CC0 1.0",
    triangles: 794,
    bytes: 97836
  },
  bigBarnQuaternius: {
    id: "bigBarnQuaternius",
    path: "/models/buildings/big-barn-quaternius.glb",
    label: "Big Barn",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/q1N3xn2SpC",
    creator: "Quaternius",
    license: "CC0 1.0",
    triangles: 4220,
    bytes: 187260
  },
  largeBuildingKenney: {
    id: "largeBuildingKenney",
    path: "/models/buildings/large-building-kenney.glb",
    label: "Large Building",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/ppwtREejXg",
    creator: "Kenney",
    license: "CC0 1.0",
    triangles: 2364,
    bytes: 143788
  },
  barrelQuaternius: {
    id: "barrelQuaternius",
    path: "/models/props/barrel-quaternius.glb",
    label: "Barrel",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/ONdghDBByN",
    creator: "Quaternius",
    license: "CC0 1.0",
    triangles: 1384,
    bytes: 75512
  },
  crateQuaternius: {
    id: "crateQuaternius",
    path: "/models/props/crate-quaternius.glb",
    label: "Crate",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/3VGWnZPXmG",
    creator: "Quaternius",
    license: "CC0 1.0",
    triangles: 784,
    bytes: 35812
  },
  cactusQuaternius: {
    id: "cactusQuaternius",
    path: "/models/props/cactus-quaternius.glb",
    label: "Cactus",
    sourceName: "Poly Pizza",
    sourceUrl: "https://poly.pizza/m/HsEJgRLQWX",
    creator: "Quaternius",
    license: "CC0 1.0",
    triangles: 416,
    bytes: 24160
  }
};

export const PLAYER_GUN_MODEL_ID: ModelAssetId = "revolverQuaterniusA";
export const ENEMY_GUN_MODEL_ID: ModelAssetId = "revolverQuaterniusB";

export const ENEMY_CHARACTER_MODEL_BY_ID: Record<string, EnemyCharacterModelBinding> = {
  "billy-the-shaky": {
    assetId: "cowboyMastjie",
    position: [0, 0, 0],
    rotationY: 0,
    targetHeight: 2.08,
    materialTint: "#dfc67a",
    materialTintStrength: 0.08
  },
  "red-eye-ramos": {
    assetId: "cowboyMastjie",
    position: [0, 0, 0],
    rotationY: 0,
    targetHeight: 2.18,
    materialTint: "#8e342f",
    materialTintStrength: 0.2
  },
  "marshal-graves": {
    assetId: "cowboyMastjie",
    position: [0, 0, 0],
    rotationY: 0,
    targetHeight: 2.28,
    materialTint: "#2f3d46",
    materialTintStrength: 0.22
  },
  "dust-widow": {
    assetId: "cowgirlMastjie",
    position: [0, 0, 0],
    rotationY: 0,
    targetHeight: 2.16,
    materialTint: "#3f4563",
    materialTintStrength: 0.16
  },
  "the-black-hat": {
    assetId: "cowboyMastjie",
    position: [0, 0, 0],
    rotationY: 0,
    targetHeight: 2.32,
    materialTint: "#171514",
    materialTintStrength: 0.46
  }
};

export const TOWN_MODEL_PLACEMENTS: readonly TownModelPlacement[] = [
  {
    assetId: "bigBarnQuaternius",
    position: [-5.85, 0, -11.25],
    rotationY: Math.PI * 0.18,
    targetHeight: 2.7
  },
  {
    assetId: "largeBuildingKenney",
    position: [5.65, 0, -11.05],
    rotationY: -Math.PI * 0.2,
    targetHeight: 2.05
  },
  {
    assetId: "barrelQuaternius",
    position: [-2.45, 0, -2.95],
    rotationY: Math.PI * 0.08,
    targetHeight: 0.62
  },
  {
    assetId: "crateQuaternius",
    position: [2.82, 0, -1.86],
    rotationY: -Math.PI * 0.1,
    targetHeight: 0.44
  },
  {
    assetId: "cactusQuaternius",
    position: [-5.25, 0, -6.7],
    rotationY: Math.PI * 0.16,
    targetHeight: 1.05
  },
  {
    assetId: "cactusQuaternius",
    position: [5.45, 0, -8.85],
    rotationY: -Math.PI * 0.22,
    targetHeight: 0.9
  }
];
