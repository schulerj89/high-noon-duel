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
  sunDiscPosition: readonly [number, number, number];
  sunDiscScale: number;
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
    sunDiscPosition: [-5.5, 5.6, -9],
    sunDiscScale: 1,
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
    sunDiscPosition: [-5.9, 2.9, -8.7],
    sunDiscScale: 1.3,
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
    sunDiscPosition: [-4.9, 4.1, -9.3],
    sunDiscScale: 0.82,
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
    sunDiscPosition: [-5.2, 5.2, -11],
    sunDiscScale: 0.9,
    groundColor: "#c98542",
    streetColor: "#805335",
    dustVisible: false
  }
};

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

    targets.sunDisc.position.set(
      config.sunDiscPosition[0],
      config.sunDiscPosition[1],
      config.sunDiscPosition[2]
    );
    targets.sunDisc.scale.setScalar(config.sunDiscScale);
  }

  targets.groundMaterial?.color.set(config.groundColor);
  targets.streetMaterial?.color.set(config.streetColor);

  if (targets.dustStormGroup) {
    targets.dustStormGroup.visible = config.dustVisible;
  }
}
