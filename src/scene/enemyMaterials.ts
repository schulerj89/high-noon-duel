import * as THREE from "three";
import type { EnemyDefinition } from "../data/enemies";

export interface EnemyMaterials {
  coat: THREE.MeshStandardMaterial;
  shirt: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  hat: THREE.MeshStandardMaterial;
  boot: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  bandana: THREE.MeshStandardMaterial;
  badge: THREE.MeshStandardMaterial;
  mark: THREE.MeshStandardMaterial;
}

export function createEnemyMaterials(enemy: EnemyDefinition): EnemyMaterials {
  return {
    coat: new THREE.MeshStandardMaterial({
      color: enemy.visual.coatColor,
      roughness: 0.86
    }),
    shirt: new THREE.MeshStandardMaterial({
      color: enemy.visual.shirtColor,
      roughness: 0.78
    }),
    skin: new THREE.MeshStandardMaterial({
      color: enemy.visual.skinColor,
      roughness: 0.7
    }),
    hat: new THREE.MeshStandardMaterial({
      color: enemy.visual.hatColor,
      roughness: 0.92
    }),
    boot: new THREE.MeshStandardMaterial({
      color: "#1e1916",
      roughness: 0.82
    }),
    leather: new THREE.MeshStandardMaterial({
      color: "#5a2f1e",
      roughness: 0.78
    }),
    metal: new THREE.MeshStandardMaterial({
      color: "#30363a",
      metalness: 0.35,
      roughness: 0.42
    }),
    bandana: new THREE.MeshStandardMaterial({
      color: enemy.portrait.palette.accent,
      roughness: 0.82
    }),
    badge: new THREE.MeshStandardMaterial({
      color: "#d6ae4d",
      metalness: 0.2,
      roughness: 0.4
    }),
    mark: new THREE.MeshStandardMaterial({
      color: "#18110f",
      roughness: 0.72
    })
  };
}

export function updateEnemyMaterials(materials: EnemyMaterials, enemy: EnemyDefinition): void {
  materials.coat.color.set(enemy.visual.coatColor);
  materials.shirt.color.set(enemy.visual.shirtColor);
  materials.skin.color.set(enemy.visual.skinColor);
  materials.hat.color.set(enemy.visual.hatColor);
  materials.bandana.color.set(enemy.portrait.palette.accent);
}
