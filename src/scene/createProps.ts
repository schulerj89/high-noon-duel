import * as THREE from "three";

export type BuildingKind = "saloon" | "sheriff" | "store" | "stable" | "hotel";

export interface BuildingSpec {
  kind: BuildingKind;
  label: string;
  side: -1 | 1;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
}

export interface PropMaterials {
  wood: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  paper: THREE.MeshStandardMaterial;
  signFace: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  cactus: THREE.MeshStandardMaterial;
  lantern: THREE.MeshBasicMaterial;
}

export interface BuildingFacade {
  root: THREE.Group;
  signPivot: THREE.Group;
}

export function createBox(
  size: readonly [number, number, number],
  material: THREE.Material,
  position: readonly [number, number, number]
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createBuildingFacade(
  spec: BuildingSpec,
  materials: PropMaterials
): BuildingFacade {
  const root = new THREE.Group();
  root.name = `${spec.kind}-facade`;
  const x = spec.side * 3.9;
  const sideTowardStreet = -spec.side;
  const paint = new THREE.MeshStandardMaterial({
    color: spec.color,
    map: materials.wood.map,
    roughness: 0.86
  });

  root.add(createBox([spec.width, spec.height, spec.depth], paint, [x, spec.height / 2, spec.z]));
  root.add(
    createBox(
      [spec.width + 0.26, 0.18, spec.depth + 0.18],
      materials.darkWood,
      [x, spec.height + 0.09, spec.z]
    )
  );
  root.add(
    createBox(
      [0.16, 0.72, Math.min(0.52, spec.depth * 0.28)],
      materials.darkWood,
      [x + sideTowardStreet * (spec.width * 0.5 + 0.08), 0.48, spec.z]
    )
  );

  const windowMaterial = new THREE.MeshBasicMaterial({ color: "#1d201f" });
  for (const offsetZ of [-0.38, 0.38]) {
    const window = createBox(
      [0.06, 0.5, 0.32],
      windowMaterial,
      [x + sideTowardStreet * (spec.width * 0.5 + 0.09), 1.28, spec.z + offsetZ]
    );
    root.add(window);
  }

  addPorchPosts(root, spec, materials);
  addWantedPosters(root, spec, materials);

  const signPivot = createHangingSign(spec, materials);
  root.add(signPivot);

  if (spec.kind === "sheriff") {
    root.add(createBadge(spec, materials));
  }

  return { root, signPivot };
}

export function createWaterTower(materials: PropMaterials): THREE.Group {
  const tower = new THREE.Group();
  tower.name = "water-tower";
  const legMaterial = materials.darkWood;
  const tankMaterial = new THREE.MeshStandardMaterial({ color: "#5f4638", roughness: 0.9 });
  const x = 5.3;
  const z = -9.6;

  for (const [dx, dz] of [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32]
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 2.35, 6), legMaterial);
    leg.position.set(x + dx, 1.18, z + dz);
    leg.rotation.z = dx * 0.1;
    leg.castShadow = true;
    tower.add(leg);
  }

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.86, 14), tankMaterial);
  tank.position.set(x, 2.55, z);
  tank.rotation.z = Math.PI / 2;
  tank.castShadow = true;
  tank.receiveShadow = true;
  tower.add(tank);

  const cap = createBox([1.28, 0.12, 1.28], materials.darkWood, [x, 3.06, z]);
  tower.add(cap);
  return tower;
}

export function createHitchingPost(x: number, z: number, materials: PropMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = "hitching-post";

  for (const dx of [-0.55, 0.55]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.68, 6), materials.darkWood);
    post.position.set(x + dx, 0.34, z);
    post.castShadow = true;
    group.add(post);
  }

  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.18, 6), materials.darkWood);
  rail.position.set(x, 0.62, z);
  rail.rotation.z = Math.PI / 2;
  rail.castShadow = true;
  group.add(rail);
  return group;
}

export function createWagonWheel(
  position: readonly [number, number, number],
  materials: PropMaterials
): THREE.Group {
  const wheel = new THREE.Group();
  wheel.name = "wagon-wheel";

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 18), materials.darkWood);
  rim.position.set(position[0], position[1], position[2]);
  rim.rotation.y = Math.PI / 2;
  rim.castShadow = true;
  wheel.add(rim);

  for (let i = 0; i < 6; i += 1) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 6), materials.wood);
    spoke.position.copy(rim.position);
    spoke.rotation.y = Math.PI / 2;
    spoke.rotation.z = (Math.PI / 6) * i;
    spoke.castShadow = true;
    wheel.add(spoke);
  }

  return wheel;
}

export function createLantern(
  position: readonly [number, number, number],
  materials: PropMaterials
): THREE.Group {
  const lantern = new THREE.Group();
  lantern.name = "lantern";

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), materials.lantern);
  body.position.set(position[0], position[1], position[2]);
  lantern.add(body);

  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.008, 6, 10), materials.metal);
  frame.position.set(position[0], position[1] + 0.12, position[2]);
  frame.rotation.x = Math.PI / 2;
  lantern.add(frame);

  const light = new THREE.PointLight("#ffbd6e", 0.35, 2.5);
  light.position.set(position[0], position[1], position[2]);
  lantern.add(light);
  return lantern;
}

export function createCactusCluster(
  position: readonly [number, number, number],
  materials: PropMaterials
): THREE.Group {
  const group = new THREE.Group();
  group.name = "cactus-cluster";
  const [x, y, z] = position;

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.92, 8), materials.cactus);
  trunk.position.set(x, y + 0.46, z);
  trunk.castShadow = true;
  group.add(trunk);

  for (const side of [-1, 1] as const) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.42, 8), materials.cactus);
    arm.position.set(x + side * 0.12, y + 0.58, z);
    arm.rotation.z = side * 0.7;
    arm.castShadow = true;
    group.add(arm);
  }

  return group;
}

export function createBarrelInstances(
  placements: readonly THREE.Vector3[],
  material: THREE.Material,
  bandMaterial: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  group.name = "barrel-instances";
  const barrelMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.58, 12),
    material,
    placements.length
  );
  const bandMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.225, 0.265, 0.05, 12),
    bandMaterial,
    placements.length * 2
  );
  const matrix = new THREE.Matrix4();

  placements.forEach((placement, index) => {
    matrix.makeTranslation(placement.x, placement.y, placement.z);
    barrelMesh.setMatrixAt(index, matrix);
    matrix.makeTranslation(placement.x, placement.y - 0.16, placement.z);
    bandMesh.setMatrixAt(index * 2, matrix);
    matrix.makeTranslation(placement.x, placement.y + 0.16, placement.z);
    bandMesh.setMatrixAt(index * 2 + 1, matrix);
  });

  barrelMesh.castShadow = true;
  barrelMesh.receiveShadow = true;
  bandMesh.castShadow = true;
  group.add(barrelMesh, bandMesh);
  return group;
}

export function createCrateInstances(
  placements: readonly THREE.Vector3[],
  material: THREE.Material
): THREE.InstancedMesh {
  const crates = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), material, placements.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  placements.forEach((placement, index) => {
    quaternion.setFromEuler(new THREE.Euler(0, (index % 4) * 0.17, 0));
    scale.setScalar(0.82 + (index % 3) * 0.09);
    matrix.compose(placement, quaternion, scale);
    crates.setMatrixAt(index, matrix);
  });

  crates.castShadow = true;
  crates.receiveShadow = true;
  return crates;
}

function addPorchPosts(root: THREE.Group, spec: BuildingSpec, materials: PropMaterials): void {
  const x = spec.side * 3.05;
  for (const dz of [-spec.depth * 0.36, spec.depth * 0.36]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1.4, 6), materials.darkWood);
    post.position.set(x, 0.7, spec.z + dz);
    post.castShadow = true;
    root.add(post);
  }
}

function addWantedPosters(root: THREE.Group, spec: BuildingSpec, materials: PropMaterials): void {
  const x = spec.side * 3.02;
  const sideRotation = spec.side > 0 ? Math.PI / 2 : -Math.PI / 2;

  for (let i = 0; i < 2; i += 1) {
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.34), materials.paper);
    poster.name = "wanted-poster";
    poster.position.set(x, 1.34 + i * 0.18, spec.z - 0.36 + i * 0.62);
    poster.rotation.y = sideRotation;
    root.add(poster);
  }
}

function createHangingSign(spec: BuildingSpec, materials: PropMaterials): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = `${spec.kind}-sign-pivot`;
  const signMaterial = createSignMaterial(spec.label, materials.signFace.color.getHexString());
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.9), signMaterial);
  const x = spec.side * 2.96;
  const y = spec.height * 0.72;

  pivot.position.set(x, y, spec.z);
  sign.position.set(0, -0.08, 0);
  sign.castShadow = true;
  sign.receiveShadow = true;

  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 6), materials.metal);
  bracket.rotation.x = Math.PI / 2;
  bracket.position.set(0.02 * -spec.side, 0.21, 0);
  bracket.castShadow = true;

  pivot.add(bracket, sign);
  return pivot;
}

function createSignMaterial(label: string, accentHex: string): THREE.MeshStandardMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create sign texture context.");
  }

  context.fillStyle = `#${accentHex}`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(55, 31, 18, 0.72)";
  context.lineWidth = 8;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = "#2f1d12";
  context.font = "bold 28px serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: texture,
    roughness: 0.9
  });
}

function createBadge(spec: BuildingSpec, materials: PropMaterials): THREE.Mesh {
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.12, 5), materials.lantern);
  badge.position.set(spec.side * 3.0, 1.72, spec.z + 0.46);
  badge.rotation.y = spec.side > 0 ? Math.PI / 2 : -Math.PI / 2;
  return badge;
}
