import * as THREE from "three";
import type { EnemyDefinition } from "../data/enemies";
import { createEnemyMaterials } from "./enemyMaterials";
import { captureEnemyBasePose, type EnemyRig } from "./enemyRig";

export function createEnemy(enemy: EnemyDefinition): EnemyRig {
  const { frame, accessories } = enemy.visual;
  const materials = createEnemyMaterials(enemy);
  const root = new THREE.Group();
  root.name = `enemy-${enemy.id}`;
  root.position.set(0, 0, -5.7);
  root.rotation.y = frame.sideStance;
  root.scale.setScalar(enemy.visual.scale);

  const heightScale = frame.heightScale;
  const bootHeight = 0.24 * heightScale;
  const legLength = frame.legLength * heightScale;
  const torsoHeight = 0.92 * heightScale;
  const headRadius = 0.25 * frame.headScale * heightScale;
  const hipY = bootHeight + legLength;
  const torsoCenterY = hipY + torsoHeight * 0.5;
  const shoulderY = torsoCenterY + torsoHeight * 0.45;
  const headY = shoulderY + 0.36 * heightScale + headRadius * 0.32;
  const armLength = frame.armLength * heightScale;
  const upperArmLength = armLength * 0.47;
  const forearmLength = armLength * 0.49;
  const armRadius = frame.armThickness * 0.5;

  addBoots(root, materials, frame.stanceWidth, bootHeight);
  addLegs(root, materials, frame, bootHeight, legLength);

  const torso = new THREE.Group();
  torso.name = "torso";
  torso.position.set(0, torsoCenterY, 0);
  torso.rotation.x = frame.hunch * 0.28;
  root.add(torso);
  addTorso(torso, materials, enemy, torsoHeight);

  const belt = createBox("belt", [frame.waistWidth + 0.16, 0.08, frame.torsoDepth + 0.08], materials.leather);
  belt.position.set(0, hipY + 0.08 * heightScale, 0.02);
  root.add(belt);

  const holster = new THREE.Group();
  holster.name = "holster";
  holster.position.set(frame.shoulderWidth * 0.42, hipY + 0.01, 0.08);
  holster.rotation.set(0.04, 0.08, -0.25);
  root.add(holster);
  addHolster(holster, materials, heightScale);

  const shoulders = new THREE.Group();
  shoulders.name = "shoulders";
  shoulders.position.set(0, shoulderY, 0.01);
  root.add(shoulders);
  const shoulderBar = createBox(
    "shoulder-bar",
    [frame.shoulderWidth, 0.18 * heightScale, frame.torsoDepth + 0.08],
    accessories.hasPoncho ? materials.coat : materials.shirt
  );
  shoulders.add(shoulderBar);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(headRadius * 0.42, headRadius * 0.48, 0.18 * heightScale, 8),
    materials.skin
  );
  neck.name = "neck";
  neck.position.set(0, shoulderY + 0.17 * heightScale, 0);
  root.add(neck);

  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, headY, 0.02);
  root.add(head);
  addHead(head, materials, enemy, headRadius);

  const hat = new THREE.Group();
  hat.name = "hat";
  hat.position.set(0, headRadius * 0.95, 0);
  head.add(hat);
  addHat(hat, materials, frame, headRadius);

  if (accessories.hasBandana) {
    addBandana(root, materials, shoulderY, headY, heightScale);
  }

  if (accessories.hasBadge) {
    addBadge(root, materials, torsoCenterY, frame.torsoDepth);
  }

  const leftUpperArm = new THREE.Group();
  leftUpperArm.name = "left-upper-arm";
  leftUpperArm.position.set(-frame.shoulderWidth * 0.5, shoulderY - 0.05, 0.02);
  leftUpperArm.rotation.z = 0.28 + frame.hunch * 0.2;
  root.add(leftUpperArm);
  addHangingArm(leftUpperArm, materials, upperArmLength, forearmLength, armRadius, false);

  const rightUpperArm = new THREE.Group();
  rightUpperArm.name = "rightUpperArm";
  rightUpperArm.position.set(frame.shoulderWidth * 0.5, shoulderY - 0.05, 0.02);
  rightUpperArm.rotation.z = -0.2 - frame.hunch * 0.15;
  root.add(rightUpperArm);

  const rightUpperArmMesh = createLimb("right-upper-arm-mesh", upperArmLength, armRadius, materials.coat);
  rightUpperArmMesh.position.y = -upperArmLength * 0.5;
  rightUpperArm.add(rightUpperArmMesh);

  const rightForearm = new THREE.Group();
  rightForearm.name = "rightForearm";
  rightForearm.position.set(0, -upperArmLength, 0);
  rightForearm.rotation.z = -0.16;
  rightUpperArm.add(rightForearm);

  const rightForearmMesh = createLimb("right-forearm-mesh", forearmLength, armRadius * 0.9, materials.coat);
  rightForearmMesh.position.y = -forearmLength * 0.5;
  rightForearm.add(rightForearmMesh);

  const rightHand = new THREE.Group();
  rightHand.name = "rightHand";
  rightHand.position.set(0, -forearmLength - 0.06 * heightScale, 0.02);
  rightForearm.add(rightHand);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.08, 10, 8), materials.skin);
  hand.name = "right-hand-mesh";
  rightHand.add(hand);

  const gun = new THREE.Group();
  gun.name = "gun";
  gun.position.set(0.03, -0.04 * heightScale, 0.12);
  gun.rotation.set(-0.16, 0.04, 0.12);
  rightHand.add(gun);

  const muzzleFlash = addRevolver(gun, materials, heightScale);

  const rig: EnemyRig = {
    root,
    torso,
    shoulders,
    head,
    hat,
    rightUpperArm,
    rightForearm,
    rightHand,
    holster,
    gun,
    muzzleFlash,
    materials,
    basePose: captureEnemyBasePose({
      root,
      torso,
      shoulders,
      head,
      hat,
      rightUpperArm,
      rightForearm,
      rightHand,
      holster,
      gun
    })
  };

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  muzzleFlash.castShadow = false;
  muzzleFlash.receiveShadow = false;

  return rig;
}

function addBoots(root: THREE.Group, materials: ReturnType<typeof createEnemyMaterials>, stanceWidth: number, bootHeight: number): void {
  for (const side of [-1, 1] as const) {
    const boot = createBox("boot", [0.2, bootHeight, 0.34], materials.boot);
    boot.position.set(side * stanceWidth * 0.5, bootHeight * 0.5, 0.03);
    boot.rotation.z = side * 0.05;
    root.add(boot);
  }
}

function addLegs(
  root: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  frame: EnemyDefinition["visual"]["frame"],
  bootHeight: number,
  legLength: number
): void {
  for (const side of [-1, 1] as const) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(frame.legThickness * 0.44, frame.legThickness * 0.52, legLength, 6),
      materials.coat
    );
    leg.name = "leg";
    leg.position.set(side * frame.stanceWidth * 0.5, bootHeight + legLength * 0.5, 0);
    leg.rotation.z = side * 0.05;
    root.add(leg);
  }
}

function addTorso(
  torso: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  enemy: EnemyDefinition,
  torsoHeight: number
): void {
  const { frame, accessories } = enemy.visual;
  const torsoMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(frame.torsoWidth * 0.5, frame.waistWidth * 0.5, torsoHeight, 5),
    materials.coat
  );
  torsoMesh.name = "torso-mesh";
  torsoMesh.scale.z = frame.torsoDepth / Math.max(0.01, frame.torsoWidth);
  torso.add(torsoMesh);

  const shirtFront = createBox("shirt-front", [frame.torsoWidth * 0.38, torsoHeight * 0.82, 0.035], materials.shirt);
  shirtFront.position.set(0, 0.03 * torsoHeight, frame.torsoDepth * 0.5 + 0.018);
  torso.add(shirtFront);

  if (accessories.hasCoat) {
    const panelHeight = torsoHeight * (accessories.hasLongCoat ? 1.35 : 0.92);

    for (const side of [-1, 1] as const) {
      const coatPanel = createBox(
        "coat-panel",
        [frame.torsoWidth * 0.2, panelHeight, 0.045],
        materials.coat
      );
      coatPanel.position.set(side * frame.torsoWidth * 0.22, -panelHeight * 0.12, frame.torsoDepth * 0.52 + 0.04);
      coatPanel.rotation.z = side * 0.03;
      torso.add(coatPanel);
    }
  }

  if (accessories.hasPoncho) {
    const poncho = new THREE.Mesh(
      new THREE.CylinderGeometry(frame.torsoWidth * 0.6, frame.shoulderWidth * 0.66, torsoHeight * 0.72, 5),
      materials.coat
    );
    poncho.name = "poncho";
    poncho.position.y = torsoHeight * 0.08;
    poncho.scale.z = 0.54;
    torso.add(poncho);
  }
}

function addHolster(
  holster: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  heightScale: number
): void {
  const pouch = createBox("holster-pouch", [0.2, 0.34 * heightScale, 0.13], materials.leather);
  pouch.position.y = -0.08 * heightScale;
  holster.add(pouch);

  const strap = createBox("holster-strap", [0.28, 0.045 * heightScale, 0.145], materials.boot);
  strap.position.y = 0.08 * heightScale;
  holster.add(strap);
}

function addHead(
  head: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  enemy: EnemyDefinition,
  headRadius: number
): void {
  const face = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 14, 10), materials.skin);
  face.name = "head-mesh";
  face.scale.set(0.9, 1.08, 0.82);
  head.add(face);

  if (enemy.visual.accessories.hasEyePatch) {
    const patch = createBox("eye-patch", [headRadius * 0.42, headRadius * 0.2, 0.025], materials.mark);
    patch.position.set(-headRadius * 0.28, headRadius * 0.12, headRadius * 0.72);
    head.add(patch);
  }

  if (enemy.visual.accessories.hasScar) {
    const scar = createBox("scar", [headRadius * 0.08, headRadius * 0.56, 0.018], materials.bandana);
    scar.position.set(headRadius * 0.26, 0, headRadius * 0.74);
    scar.rotation.z = -0.46;
    head.add(scar);
  }
}

function addHat(
  hat: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  frame: EnemyDefinition["visual"]["frame"],
  headRadius: number
): void {
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(headRadius * 1.6 * frame.hatBrimScale, headRadius * 1.72 * frame.hatBrimScale, 0.045, 20),
    materials.hat
  );
  brim.name = "hat-brim";
  brim.scale.z = 0.62;
  hat.add(brim);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(headRadius * 0.74 * frame.hatCrownScale, headRadius * 0.92 * frame.hatCrownScale, headRadius * 0.88, 14),
    materials.hat
  );
  crown.name = "hat-crown";
  crown.position.y = headRadius * 0.45;
  crown.scale.z = 0.84;
  hat.add(crown);
}

function addBandana(
  root: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  shoulderY: number,
  headY: number,
  heightScale: number
): void {
  const bandana = new THREE.Mesh(new THREE.ConeGeometry(0.23 * heightScale, 0.28 * heightScale, 4), materials.bandana);
  bandana.name = "bandana";
  bandana.position.set(0, (shoulderY + headY) * 0.5 - 0.08 * heightScale, 0.18);
  bandana.rotation.y = Math.PI * 0.25;
  bandana.rotation.x = Math.PI;
  root.add(bandana);
}

function addBadge(
  root: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  torsoCenterY: number,
  torsoDepth: number
): void {
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.075, 5), materials.badge);
  badge.name = "badge";
  badge.position.set(-0.16, torsoCenterY + 0.18, torsoDepth * 0.55 + 0.04);
  root.add(badge);
}

function addHangingArm(
  upperArm: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  upperArmLength: number,
  forearmLength: number,
  armRadius: number,
  mirrored: boolean
): void {
  const upperMesh = createLimb("upper-arm-mesh", upperArmLength, armRadius, materials.coat);
  upperMesh.position.y = -upperArmLength * 0.5;
  upperArm.add(upperMesh);

  const forearm = new THREE.Group();
  forearm.name = "forearm";
  forearm.position.y = -upperArmLength;
  forearm.rotation.z = mirrored ? 0.06 : -0.06;
  upperArm.add(forearm);

  const forearmMesh = createLimb("forearm-mesh", forearmLength, armRadius * 0.9, materials.coat);
  forearmMesh.position.y = -forearmLength * 0.5;
  forearm.add(forearmMesh);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.05, 10, 8), materials.skin);
  hand.name = "hand";
  hand.position.y = -forearmLength - armRadius * 0.6;
  forearm.add(hand);
}

function addRevolver(
  gun: THREE.Group,
  materials: ReturnType<typeof createEnemyMaterials>,
  heightScale: number
): THREE.Mesh {
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * heightScale, 0.03 * heightScale, 0.34 * heightScale, 10), materials.metal);
  barrel.name = "enemy-gun-barrel";
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.02 * heightScale, 0.18 * heightScale);

  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * heightScale, 0.07 * heightScale, 0.08 * heightScale, 12), materials.metal);
  chamber.name = "enemy-gun-chamber";
  chamber.rotation.x = Math.PI / 2;
  chamber.position.set(0, -0.02 * heightScale, 0.03 * heightScale);

  const grip = createBox("enemy-gun-grip", [0.07 * heightScale, 0.17 * heightScale, 0.055 * heightScale], materials.leather);
  grip.position.set(0.035 * heightScale, -0.12 * heightScale, -0.04 * heightScale);
  grip.rotation.z = -0.32;

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.13 * heightScale, 10, 8),
    new THREE.MeshBasicMaterial({ color: "#ffe071", opacity: 0.88, transparent: true })
  );
  muzzleFlash.name = "enemy-muzzle-flash";
  muzzleFlash.position.set(0, -0.02 * heightScale, 0.38 * heightScale);
  muzzleFlash.visible = false;

  gun.add(barrel, chamber, grip, muzzleFlash);
  return muzzleFlash;
}

function createLimb(
  name: string,
  length: number,
  radius: number,
  material: THREE.Material
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius, length, 7), material);
  mesh.name = name;
  return mesh;
}

function createBox(name: string, size: readonly [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  return mesh;
}
