import * as THREE from "three";
import type { EnemyMaterials } from "./enemyMaterials";

export const ENEMY_ANCHOR_NAMES = [
  "root",
  "torso",
  "shoulders",
  "head",
  "hat",
  "rightUpperArm",
  "rightForearm",
  "rightHand",
  "holster",
  "gun"
] as const;

export type EnemyAnchorName = (typeof ENEMY_ANCHOR_NAMES)[number];

export interface EnemyPartPose {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}

export type EnemyBasePose = Record<EnemyAnchorName, EnemyPartPose>;

export interface EnemyRigAnchors {
  root: THREE.Group;
  torso: THREE.Group;
  shoulders: THREE.Group;
  head: THREE.Group;
  hat: THREE.Group;
  rightUpperArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  holster: THREE.Group;
  gun: THREE.Group;
}

export interface EnemyRig extends EnemyRigAnchors {
  muzzleFlash: THREE.Mesh;
  materials: EnemyMaterials;
  basePose: EnemyBasePose;
}

export function captureEnemyBasePose(anchors: EnemyRigAnchors): EnemyBasePose {
  return Object.fromEntries(
    ENEMY_ANCHOR_NAMES.map((name) => [name, capturePose(anchors[name])])
  ) as EnemyBasePose;
}

export function resetEnemyRigPose(rig: EnemyRig): void {
  for (const name of ENEMY_ANCHOR_NAMES) {
    applyPose(rig[name], rig.basePose[name]);
  }

  rig.muzzleFlash.visible = false;
}

function capturePose(group: THREE.Group): EnemyPartPose {
  return {
    position: group.position.toArray() as [number, number, number],
    rotation: [group.rotation.x, group.rotation.y, group.rotation.z],
    scale: group.scale.toArray() as [number, number, number]
  };
}

function applyPose(group: THREE.Group, pose: EnemyPartPose): void {
  group.position.set(pose.position[0], pose.position[1], pose.position[2]);
  group.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
  group.scale.set(pose.scale[0], pose.scale[1], pose.scale[2]);
}
