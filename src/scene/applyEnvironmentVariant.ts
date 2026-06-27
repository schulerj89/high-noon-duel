import * as THREE from "three";
import type { EnvironmentVariantId } from "../data/duelModifiers";

export interface EnvironmentVariantTargets {
  scene: THREE.Scene;
  hemisphereLight: THREE.HemisphereLight | null;
  sunLight: THREE.DirectionalLight | null;
  sunDisc: THREE.Mesh | null;
  groundMaterial: THREE.MeshStandardMaterial | null;
  streetMaterial: THREE.MeshStandardMaterial | null;
  dustStormGroup: THREE.Group | null;
}

interface EnvironmentVariantConfig {
  skyColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunDiscColor: string;
  groundColor: string;
  streetColor: string;
  dustVisible: boolean;
}

const VARIANT_CONFIG: Record<EnvironmentVariantId, EnvironmentVariantConfig> = {
  highNoon: {
    skyColor: "#78b9d7",
    fogColor: "#d99b58",
    fogNear: 9,
    fogFar: 21,
    hemiSky: "#ffe7ba",
    hemiGround: "#70492c",
    hemiIntensity: 1.6,
    sunColor: "#fff4d0",
    sunIntensity: 3.2,
    sunDiscColor: "#ffe2a0",
    groundColor: "#c98542",
    streetColor: "#8b5a37",
    dustVisible: false
  },
  sunsetGlare: {
    skyColor: "#e88f63",
    fogColor: "#b86445",
    fogNear: 7,
    fogFar: 18,
    hemiSky: "#ffd6a0",
    hemiGround: "#5b2c27",
    hemiIntensity: 1.45,
    sunColor: "#ffb36d",
    sunIntensity: 3.8,
    sunDiscColor: "#ffbf5c",
    groundColor: "#b66e3e",
    streetColor: "#734832",
    dustVisible: false
  },
  dustStorm: {
    skyColor: "#c29a67",
    fogColor: "#d0a261",
    fogNear: 4,
    fogFar: 13,
    hemiSky: "#f2c37b",
    hemiGround: "#8a5b35",
    hemiIntensity: 1.35,
    sunColor: "#ffd08a",
    sunIntensity: 2.25,
    sunDiscColor: "#f2b75f",
    groundColor: "#ba7b42",
    streetColor: "#7a5135",
    dustVisible: true
  },
  longDistance: {
    skyColor: "#83bdd5",
    fogColor: "#c98953",
    fogNear: 12,
    fogFar: 28,
    hemiSky: "#ffe9bd",
    hemiGround: "#68442a",
    hemiIntensity: 1.5,
    sunColor: "#fff0c8",
    sunIntensity: 3,
    sunDiscColor: "#ffe2a0",
    groundColor: "#c98542",
    streetColor: "#805335",
    dustVisible: false
  }
};

export function createDustStormParticles(): THREE.Group {
  const group = new THREE.Group();
  group.name = "dust-storm-particles";
  group.visible = false;

  const material = new THREE.MeshBasicMaterial({
    color: "#e5b369",
    depthWrite: false,
    opacity: 0.26,
    transparent: true
  });

  for (let i = 0; i < 54; i += 1) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.045 + (i % 5) * 0.012, 8, 6),
      material
    );
    const row = i % 9;
    const column = Math.floor(i / 9);
    particle.position.set(
      -2.6 + row * 0.65 + ((column % 2) * 0.18),
      0.45 + (i % 6) * 0.22,
      -2.6 - column * 0.86
    );
    particle.scale.set(1.8, 0.55, 0.8);
    group.add(particle);
  }

  return group;
}

export function applyEnvironmentVariant(
  variantId: EnvironmentVariantId,
  targets: EnvironmentVariantTargets
): void {
  const config = VARIANT_CONFIG[variantId];

  targets.scene.background = new THREE.Color(config.skyColor);
  targets.scene.fog = new THREE.Fog(config.fogColor, config.fogNear, config.fogFar);

  if (targets.hemisphereLight) {
    targets.hemisphereLight.color.set(config.hemiSky);
    targets.hemisphereLight.groundColor.set(config.hemiGround);
    targets.hemisphereLight.intensity = config.hemiIntensity;
  }

  if (targets.sunLight) {
    targets.sunLight.color.set(config.sunColor);
    targets.sunLight.intensity = config.sunIntensity;
  }

  if (targets.sunDisc) {
    const material = targets.sunDisc.material;

    if (material instanceof THREE.MeshBasicMaterial) {
      material.color.set(config.sunDiscColor);
    }
  }

  targets.groundMaterial?.color.set(config.groundColor);
  targets.streetMaterial?.color.set(config.streetColor);

  if (targets.dustStormGroup) {
    targets.dustStormGroup.visible = config.dustVisible;
  }
}
