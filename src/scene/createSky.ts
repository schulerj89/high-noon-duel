import * as THREE from "three";
import type { EnvironmentVariantId } from "../data/duelModifiers";

export interface SkyBackdrop {
  root: THREE.Group;
  celestialDisc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  mesaMaterial: THREE.MeshBasicMaterial;
  hazeMaterial: THREE.MeshBasicMaterial;
}

const MESA_COLORS: Record<EnvironmentVariantId, string> = {
  highNoon: "#9b6744",
  sunsetGlare: "#7f4034",
  dustStorm: "#a16f42",
  longDistance: "#8e6546"
};

export function createSkyBackdrop(): SkyBackdrop {
  const root = new THREE.Group();
  root.name = "procedural-sky-backdrop";

  const celestialDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 32),
    new THREE.MeshBasicMaterial({ color: "#ffe2a0", depthWrite: false })
  );
  celestialDisc.position.set(-5.5, 5.6, -9);
  root.add(celestialDisc);

  const mesaMaterial = new THREE.MeshBasicMaterial({
    color: MESA_COLORS.highNoon,
    fog: true,
    opacity: 0.72,
    transparent: true
  });
  const mesaShapes = [
    [-5.6, 0.42, -12.8, 2.6, 1.05],
    [-2.8, 0.52, -13.6, 3.2, 1.38],
    [1.1, 0.46, -13.1, 2.8, 1.18],
    [4.6, 0.38, -12.5, 3.1, 0.96]
  ] as const;

  for (const [x, y, z, width, height] of mesaShapes) {
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.24), mesaMaterial);
    mesa.position.set(x, y, z);
    root.add(mesa);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.74, height * 0.22, 0.26), mesaMaterial);
    cap.position.set(x + width * 0.08, y + height * 0.58, z + 0.02);
    root.add(cap);
  }

  const hazeMaterial = new THREE.MeshBasicMaterial({
    color: "#f0bd74",
    depthWrite: false,
    opacity: 0.08,
    transparent: true
  });

  for (let i = 0; i < 3; i += 1) {
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 0.72), hazeMaterial);
    haze.position.set(-2 + i * 2.1, 1.1 + i * 0.2, -8.2 - i * 1.6);
    root.add(haze);
  }

  return {
    root,
    celestialDisc,
    mesaMaterial,
    hazeMaterial
  };
}

export function updateSkyBackdrop(
  sky: SkyBackdrop,
  input: {
    now: number;
    variantId: EnvironmentVariantId;
    reducedMotion: boolean;
  }
): void {
  sky.mesaMaterial.color.set(MESA_COLORS[input.variantId]);
  const hazeBase =
    input.variantId === "dustStorm" ? 0.18 : input.variantId === "sunsetGlare" ? 0.12 : 0.06;
  const shimmer = input.reducedMotion ? 0 : Math.sin(input.now * 0.0011) * 0.025;
  sky.hazeMaterial.opacity = Math.max(0, hazeBase + shimmer);
  sky.celestialDisc.lookAt(0, 1.4, -2);
}
