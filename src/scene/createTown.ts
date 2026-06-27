import * as THREE from "three";
import type { TownId } from "../data/towns";
import {
  createBarrelInstances,
  createBuildingFacade,
  createCactusCluster,
  createCrateInstances,
  createHitchingPost,
  createLantern,
  createWagonWheel,
  type BuildingSpec,
  type PropMaterials
} from "./createProps";

export interface TownSceneOptions {
  townId: TownId;
  lowDetail: boolean;
}

export interface TownScene {
  root: THREE.Group;
  groundMaterial: THREE.MeshStandardMaterial;
  streetMaterial: THREE.MeshStandardMaterial;
  animatedSigns: THREE.Group[];
  accentMaterial: THREE.MeshStandardMaterial;
}

const TOWN_ACCENTS: Record<TownId, string> = {
  dustwater: "#d0a15a",
  "mercy-flats": "#b55a3f",
  "red-cactus": "#b34235",
  "widows-ridge": "#8e765a",
  "black-hat-canyon": "#34302f"
};

export function createTownScene(options: TownSceneOptions): TownScene {
  const root = new THREE.Group();
  root.name = "procedural-western-town";
  const textures = createTownTextures();
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: "#c98542",
    map: textures.dirt,
    roughness: 1
  });
  const streetMaterial = new THREE.MeshStandardMaterial({
    color: "#8b5a37",
    map: textures.dirt,
    roughness: 1
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: TOWN_ACCENTS[options.townId],
    map: textures.wood,
    roughness: 0.86
  });
  const materials: PropMaterials = {
    wood: new THREE.MeshStandardMaterial({ color: "#8a5530", map: textures.wood, roughness: 0.9 }),
    darkWood: new THREE.MeshStandardMaterial({ color: "#43281d", map: textures.wood, roughness: 0.92 }),
    paper: new THREE.MeshStandardMaterial({ color: "#ecd098", map: textures.paper, roughness: 0.96 }),
    signFace: accentMaterial,
    metal: new THREE.MeshStandardMaterial({ color: "#25201c", roughness: 0.64, metalness: 0.22 }),
    cactus: new THREE.MeshStandardMaterial({ color: "#4f7a46", roughness: 0.9 }),
    lantern: new THREE.MeshBasicMaterial({ color: "#ffbd5e" })
  };
  const animatedSigns: THREE.Group[] = [];

  root.add(createGround(groundMaterial, streetMaterial, options.lowDetail));
  root.add(createBoardwalks(materials));

  for (const spec of getBuildingSpecs(options.townId)) {
    const facade = createBuildingFacade(spec, materials);
    root.add(facade.root);
    animatedSigns.push(facade.signPivot);
  }

  root.add(createWaterTowerSilhouette(materials));
  root.add(createStreetProps(materials, options.lowDetail));

  return {
    root,
    groundMaterial,
    streetMaterial,
    animatedSigns,
    accentMaterial
  };
}

export function updateTownScene(
  town: TownScene,
  input: {
    now: number;
    reducedMotion: boolean;
    lowDetail: boolean;
  }
): void {
  const sway = input.reducedMotion ? 0 : Math.sin(input.now * 0.0018) * 0.045;

  town.animatedSigns.forEach((sign, index) => {
    sign.rotation.z = sway * (index % 2 === 0 ? 1 : -0.72);
  });

  town.root.traverse((object) => {
    if (object.name === "lantern") {
      object.visible = !input.lowDetail;
    }
  });
}

function createGround(
  groundMaterial: THREE.Material,
  streetMaterial: THREE.Material,
  lowDetail: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = "ground-and-street";

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(26, 28), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -4;
  ground.receiveShadow = true;
  group.add(ground);

  const street = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 23), streetMaterial);
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, 0.014, -4.5);
  street.receiveShadow = true;
  group.add(street);

  const patchCount = lowDetail ? 18 : 44;
  const patchGeometry = new THREE.CircleGeometry(0.18, 8);
  const patchMaterial = new THREE.MeshStandardMaterial({
    color: "#deb46a",
    roughness: 1,
    transparent: true,
    opacity: 0.32
  });
  const patches = new THREE.InstancedMesh(patchGeometry, patchMaterial, patchCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const scale = new THREE.Vector3();

  for (let i = 0; i < patchCount; i += 1) {
    const x = -5.9 + ((i * 1.47) % 11.8);
    const z = -0.8 - ((i * 0.61) % 10.7);
    scale.set(0.6 + (i % 4) * 0.18, 0.42 + (i % 3) * 0.13, 1);
    matrix.compose(new THREE.Vector3(x, 0.025, z), quaternion, scale);
    patches.setMatrixAt(i, matrix);
  }

  patches.receiveShadow = true;
  group.add(patches);
  return group;
}

function createBoardwalks(materials: PropMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = "boardwalks";

  for (const side of [-1, 1] as const) {
    const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 17.2), materials.wood);
    boardwalk.position.set(side * 3.08, 0.08, -5.1);
    boardwalk.castShadow = true;
    boardwalk.receiveShadow = true;
    group.add(boardwalk);

    for (let i = 0; i < 11; i += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.026, 0.035), materials.darkWood);
      plank.position.set(side * 3.08, 0.18, -12.8 + i * 1.55);
      plank.receiveShadow = true;
      group.add(plank);
    }
  }

  return group;
}

function createStreetProps(materials: PropMaterials, lowDetail: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = "street-props";
  const barrelPlacements = [
    new THREE.Vector3(-2.55, 0.31, -3.7),
    new THREE.Vector3(-2.3, 0.31, -3.44),
    new THREE.Vector3(-2.66, 0.31, -7.1),
    new THREE.Vector3(2.52, 0.31, -6.4),
    new THREE.Vector3(2.78, 0.31, -6.08),
    new THREE.Vector3(2.34, 0.31, -2.85)
  ];
  const cratePlacements = [
    new THREE.Vector3(-3.06, 0.28, -1.75),
    new THREE.Vector3(-3.32, 0.64, -1.92),
    new THREE.Vector3(3.08, 0.28, -4.18),
    new THREE.Vector3(3.34, 0.28, -8.25),
    new THREE.Vector3(2.96, 0.64, -8.05)
  ];

  group.add(createBarrelInstances(barrelPlacements, materials.wood, materials.metal));
  group.add(createCrateInstances(cratePlacements, materials.darkWood));

  for (const [x, z] of [
    [-2.9, -5.6],
    [2.9, -3.2],
    [-2.9, -8.8]
  ] as const) {
    group.add(createHitchingPost(x, z, materials));
  }

  group.add(createWagonWheel([-3.12, 0.42, -6.48], materials));
  group.add(createWagonWheel([3.18, 0.42, -7.65], materials));

  for (const position of [
    [-5.4, 0, -2.6],
    [5.6, 0, -4.8],
    [-5.9, 0, -8.9],
    [5.2, 0, -10.4]
  ] as const) {
    group.add(createCactusCluster(position, materials));
  }

  if (!lowDetail) {
    for (const position of [
      [-3.04, 1.72, -5.15],
      [3.04, 1.68, -6.95],
      [-3.02, 1.64, -2.7],
      [3.03, 1.72, -3.45]
    ] as const) {
      group.add(createLantern(position, materials));
    }
  }

  return group;
}

function createWaterTowerSilhouette(materials: PropMaterials): THREE.Group {
  const tower = new THREE.Group();
  tower.name = "water-tower-silhouette";
  tower.add(createWaterLeg(-0.32, -0.32, materials));
  tower.add(createWaterLeg(0.32, -0.32, materials));
  tower.add(createWaterLeg(-0.32, 0.32, materials));
  tower.add(createWaterLeg(0.32, 0.32, materials));

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.86, 14), materials.darkWood);
  tank.position.set(5.3, 2.55, -9.6);
  tank.rotation.z = Math.PI / 2;
  tank.castShadow = true;
  tank.receiveShadow = true;
  tower.add(tank);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.12, 1.28), materials.darkWood);
  cap.position.set(5.3, 3.06, -9.6);
  cap.castShadow = true;
  tower.add(cap);
  return tower;
}

function createWaterLeg(dx: number, dz: number, materials: PropMaterials): THREE.Mesh {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 2.35, 6), materials.darkWood);
  leg.position.set(5.3 + dx, 1.18, -9.6 + dz);
  leg.rotation.z = dx * 0.1;
  leg.castShadow = true;
  return leg;
}

function getBuildingSpecs(townId: TownId): BuildingSpec[] {
  const accent = TOWN_ACCENTS[townId];
  return [
    { kind: "saloon", label: "SALOON", side: -1, z: -7.3, width: 1.45, height: 2.85, depth: 2.25, color: "#a14636" },
    { kind: "store", label: "GENERAL", side: -1, z: -4.9, width: 1.32, height: 2.2, depth: 1.8, color: accent },
    { kind: "stable", label: "STABLE", side: -1, z: -2.45, width: 1.4, height: 2.35, depth: 2.15, color: "#6c7e68" },
    { kind: "sheriff", label: "SHERIFF", side: 1, z: -7.75, width: 1.38, height: 2.42, depth: 2.0, color: "#3e6d88" },
    { kind: "hotel", label: "HOTEL", side: 1, z: -5.15, width: 1.34, height: 2.72, depth: 2.42, color: "#b6583f" },
    { kind: "store", label: "SUPPLY", side: 1, z: -2.7, width: 1.24, height: 2.08, depth: 1.82, color: "#c7954f" }
  ];
}

function createTownTextures(): {
  wood: THREE.CanvasTexture;
  paper: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
} {
  return {
    wood: createWoodTexture(),
    paper: createPaperTexture(),
    dirt: createDirtTexture()
  };
}

function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = get2dContext(canvas);
  ctx.fillStyle = "#80502e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = y % 32 === 0 ? "rgba(255,220,150,0.08)" : "rgba(40,20,10,0.12)";
    ctx.fillRect(0, y, 128, 2);
  }

  for (let x = 10; x < 128; x += 28) {
    ctx.strokeStyle = "rgba(39,20,10,0.24)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 5, 128);
    ctx.stroke();
  }

  return configureTexture(new THREE.CanvasTexture(canvas), 2, 2);
}

function createPaperTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 128;
  const ctx = get2dContext(canvas);
  ctx.fillStyle = "#ead09a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#3b2818";
  ctx.font = "bold 16px serif";
  ctx.textAlign = "center";
  ctx.fillText("WANTED", 48, 26);
  ctx.fillRect(28, 42, 40, 42);
  ctx.fillStyle = "rgba(84,44,22,0.18)";
  for (let i = 0; i < 35; i += 1) {
    ctx.fillRect((i * 17) % 96, (i * 29) % 128, 1, 1);
  }
  return configureTexture(new THREE.CanvasTexture(canvas), 1, 1);
}

function createDirtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = get2dContext(canvas);
  ctx.fillStyle = "#b7773f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 220; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,226,152,0.18)" : "rgba(62,34,18,0.12)";
    ctx.fillRect((i * 37) % 128, (i * 19) % 128, 1 + (i % 3), 1);
  }

  return configureTexture(new THREE.CanvasTexture(canvas), 8, 8);
}

function configureTexture(texture: THREE.CanvasTexture, repeatX: number, repeatY: number): THREE.CanvasTexture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create procedural texture context.");
  }

  return context;
}
