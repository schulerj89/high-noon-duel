import * as THREE from "three";
import type { DuelPhase } from "../game/state";
import type { EnvironmentVariantId } from "../data/duelModifiers";

export interface AtmosphereParticles {
  root: THREE.Group;
  dustStormGroup: THREE.Group;
  dustMotes: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  debris: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  tumbleweed: THREE.Group;
}

export interface AtmosphereUpdateInput {
  now: number;
  delta: number;
  phase: DuelPhase;
  variantId: EnvironmentVariantId;
  lowDetail: boolean;
  reducedMotion: boolean;
}

export function createAtmosphereParticles(options: { lowDetail: boolean }): AtmosphereParticles {
  const root = new THREE.Group();
  root.name = "atmosphere-particles";
  const dustMotes = createPointCloud("dust-motes", options.lowDetail ? 36 : 95, "#e8c47d", 0.035, 0.24);
  const debris = createPointCloud("wind-debris", options.lowDetail ? 10 : 34, "#9b6c3b", 0.026, 0.34);
  const dustStormGroup = createDustStormParticles(options);
  const tumbleweed = createTumbleweed();

  root.add(dustMotes, debris, dustStormGroup, tumbleweed);
  return {
    root,
    dustStormGroup,
    dustMotes,
    debris,
    tumbleweed
  };
}

export function createDustStormParticles(options: { lowDetail?: boolean } = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = "dust-storm-particles";
  group.visible = false;
  const count = options.lowDetail ? 48 : 120;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const row = i % 14;
    const column = Math.floor(i / 14);
    positions[i * 3] = -4.4 + row * 0.68 + ((column % 2) * 0.18);
    positions[i * 3 + 1] = 0.42 + (i % 8) * 0.19;
    positions[i * 3 + 2] = -2.4 - column * 0.72;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: "#e5b369",
    depthWrite: false,
    opacity: 0.42,
    size: 0.12,
    transparent: true
  });
  group.add(new THREE.Points(geometry, material));
  return group;
}

export function updateAtmosphereParticles(
  particles: AtmosphereParticles,
  input: AtmosphereUpdateInput
): void {
  const critical = input.phase === "ready" || input.phase === "steady" || input.phase === "draw";
  const motion = input.reducedMotion ? 0.18 : 1;
  const dustActive = !input.lowDetail;
  const dustMaterial = particles.dustMotes.material;
  const debrisMaterial = particles.debris.material;

  particles.dustMotes.visible = dustActive;
  dustMaterial.opacity = critical ? 0.08 : input.variantId === "dustStorm" ? 0.34 : 0.2;
  debrisMaterial.opacity = critical || input.lowDetail ? 0 : 0.3;

  particles.dustMotes.position.x = Math.sin(input.now * 0.00032) * 0.12 * motion;
  particles.dustMotes.position.z = Math.sin(input.now * 0.00041) * 0.08 * motion;
  particles.debris.position.x = ((input.now * 0.00045) % 2 - 1) * 2.4 * motion;
  particles.debris.position.z = Math.sin(input.now * 0.00027) * 0.24 * motion;

  updateTumbleweed(particles.tumbleweed, input, critical);

  if (particles.dustStormGroup.visible) {
    particles.dustStormGroup.position.x = Math.sin(input.now * 0.0007) * 0.16 * motion;
    particles.dustStormGroup.position.z = Math.sin(input.now * 0.0005) * 0.08 * motion;
    particles.dustStormGroup.rotation.y = Math.sin(input.now * 0.00035) * 0.025 * motion;
  }
}

function createPointCloud(
  name: string,
  count: number,
  color: string,
  size: number,
  opacity: number
): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = -4.2 + ((i * 1.91) % 8.4);
    positions[i * 3 + 1] = 0.35 + ((i * 0.47) % 2.0);
    positions[i * 3 + 2] = -1.5 - ((i * 0.73) % 8.5);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    depthWrite: false,
    opacity,
    size,
    transparent: true
  });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  return points;
}

function createTumbleweed(): THREE.Group {
  const tumbleweed = new THREE.Group();
  tumbleweed.name = "tumbleweed";
  const material = new THREE.MeshStandardMaterial({ color: "#9a6b3a", roughness: 1 });

  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 12), material);
    ring.rotation.set(i * 0.7, i * 0.5, i * 0.9);
    ring.castShadow = true;
    tumbleweed.add(ring);
  }

  tumbleweed.position.set(-5.2, 0.22, -5.7);
  tumbleweed.visible = false;
  return tumbleweed;
}

function updateTumbleweed(
  tumbleweed: THREE.Group,
  input: AtmosphereUpdateInput,
  critical: boolean
): void {
  const active = !input.lowDetail && !input.reducedMotion && !critical;
  tumbleweed.visible = active;

  if (!active) {
    return;
  }

  const loopMs = input.variantId === "dustStorm" ? 12500 : 18500;
  const progress = (input.now % loopMs) / loopMs;
  tumbleweed.position.x = -5.4 + progress * 10.8;
  tumbleweed.position.z = -5.2 + Math.sin(progress * Math.PI * 2) * 0.6;
  tumbleweed.rotation.x += input.delta * 3.1;
  tumbleweed.rotation.z += input.delta * 2.4;
}
