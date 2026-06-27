import * as THREE from "three";
import { GAME_CONFIG } from "./config";
import {
  formatShotResult,
  getEnemyFireAt,
  getMissPunishFireAt,
  HIT_ZONE_DEFINITIONS,
  scoreHitZone,
  type HitZoneDefinition,
  type HitZoneParent
} from "./scoring";
import {
  advanceDuelState,
  createIntroDuelState,
  type CountdownTiming,
  type DuelState,
  formatDuration,
  recordPlayerMiss,
  resolveEarlyDraw,
  resolveEnemyShot,
  resolvePlayerHit,
  startDuel
} from "./state";

interface UiElements {
  overlay: HTMLDivElement;
  phaseLabel: HTMLDivElement;
  detail: HTMLDivElement;
  stats: HTMLDivElement;
  result: HTMLDivElement;
  enemyName: HTMLSpanElement;
  actionButton: HTMLButtonElement;
  crosshair: HTMLDivElement;
}

type Vec3Tuple = [number, number, number];

export class Game {
  private readonly root: HTMLElement;
  private readonly viewport: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly hitZoneMeshes: THREE.Mesh[] = [];
  private readonly hitZoneByMesh = new Map<THREE.Object3D, HitZoneDefinition>();
  private readonly ui: UiElements;

  private state: DuelState = createIntroDuelState(performance.now());
  private timing: CountdownTiming = this.createRoundTiming();
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private enemyReactionMs = GAME_CONFIG.enemy.reactionTimeMs;
  private enemyFireAt: number | null = null;
  private missLossAt: number | null = null;
  private enemyHasFired = false;
  private hitBoxesVisible = false;
  private lastPlayerShotAt: number | null = null;
  private lastEnemyShotAt: number | null = null;
  private lastMissAt: number | null = null;
  private enemyGroup: THREE.Group | null = null;
  private enemyGunArm: THREE.Group | null = null;
  private gunGroup: THREE.Group | null = null;
  private muzzleFlash: THREE.Mesh | null = null;
  private enemyMuzzleFlash: THREE.Mesh | null = null;
  private missDustGroup: THREE.Group | null = null;
  private missDustMaterial: THREE.MeshBasicMaterial | null = null;

  public constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = "";

    this.viewport = document.createElement("div");
    this.viewport.className = "game-viewport";

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#78b9d7");
    this.scene.fog = new THREE.Fog("#d99b58", 9, 21);

    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.camera.fov,
      1,
      0.1,
      80
    );
    this.scene.add(this.camera);

    this.viewport.append(this.renderer.domElement);
    this.ui = this.createOverlay();
    this.viewport.append(this.ui.overlay);
    this.root.append(this.viewport);

    this.buildScene();
    this.bindEvents();
    this.handleResize();
    this.updateOverlay();
  }

  public start(): void {
    this.clock.start();
    this.animationFrameId = window.requestAnimationFrame(this.tick);
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.ui.actionButton.removeEventListener("click", this.startRound);
    this.resizeObserver?.disconnect();

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const material = object.material;

        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      }
    });

    this.renderer.dispose();
    this.root.innerHTML = "";
  }

  private readonly tick = (): void => {
    const delta = this.clock.getDelta();
    const now = performance.now();
    const previousPhase = this.state.phase;

    this.state = advanceDuelState(this.state, now, this.timing);

    if (previousPhase !== "draw" && this.state.phase === "draw") {
      this.enemyFireAt = getEnemyFireAt(
        this.state.stats.drawAt ?? this.state.scheduledDrawAt,
        this.enemyReactionMs
      );
    }

    this.handleEnemyShot(now);
    this.updateScene(now, delta);
    this.updateOverlay();
    this.renderer.render(this.scene, this.camera);

    this.animationFrameId = window.requestAnimationFrame(this.tick);
  };

  private readonly startRound = (): void => {
    const now = performance.now();
    this.timing = this.createRoundTiming();
    this.state = startDuel(now, this.timing);
    this.enemyReactionMs = GAME_CONFIG.enemy.reactionTimeMs;
    this.enemyFireAt = null;
    this.missLossAt = null;
    this.enemyHasFired = false;
    this.lastPlayerShotAt = null;
    this.lastEnemyShotAt = null;
    this.lastMissAt = null;

    if (this.muzzleFlash) {
      this.muzzleFlash.visible = false;
    }

    if (this.enemyMuzzleFlash) {
      this.enemyMuzzleFlash.visible = false;
    }

    if (this.enemyGroup) {
      this.enemyGroup.rotation.set(0, 0, 0);
    }

    if (this.enemyGunArm) {
      this.enemyGunArm.rotation.z = -0.35;
    }

    if (this.missDustGroup) {
      this.missDustGroup.visible = false;
    }

    this.updateOverlay();
  };

  private createRoundTiming(): CountdownTiming {
    return {
      readyDurationMs: GAME_CONFIG.timing.readyDurationMs,
      steadyDurationMs: GAME_CONFIG.timing.steadyDurationMs,
      drawPauseMs: randomRange(
        GAME_CONFIG.timing.drawPauseMinMs,
        GAME_CONFIG.timing.drawPauseMaxMs
      )
    };
  }

  private bindEvents(): void {
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("keydown", this.handleKeyDown);
    this.ui.actionButton.addEventListener("click", this.startRound);

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.viewport);
  }

  private readonly handleResize = (): void => {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.updatePointerFromEvent(event);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    this.updatePointerFromEvent(event);
    this.handlePlayerInput();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      event.preventDefault();
      this.ui.crosshair.style.left = "50%";
      this.ui.crosshair.style.top = "50%";

      if (this.state.phase === "resolved") {
        this.startRound();
      } else if (this.state.phase === "intro") {
        this.startRound();
      }
    }

    if (event.code === "KeyR") {
      this.startRound();
    }

    if (event.code === "KeyH") {
      this.hitBoxesVisible = !this.hitBoxesVisible;
      this.updateHitBoxVisibility();
    }
  };

  private updatePointerFromEvent(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    this.pointer.set(x * 2 - 1, -(y * 2 - 1));
    this.ui.crosshair.style.left = `${x * 100}%`;
    this.ui.crosshair.style.top = `${y * 100}%`;
  }

  private handlePlayerInput(): void {
    if (this.state.phase === "intro") {
      this.startRound();
      return;
    }

    if (this.state.phase === "missed" || this.state.phase === "resolved") {
      return;
    }

    const now = performance.now();
    this.state = advanceDuelState(this.state, now, this.timing);

    if (this.state.phase !== "draw") {
      this.lastPlayerShotAt = now;
      this.showPlayerMuzzleFlash();
      this.state = resolveEarlyDraw(this.state, now);
      this.updateOverlay();
      return;
    }

    if (this.enemyFireAt !== null && now >= this.enemyFireAt) {
      this.resolveEnemyFire("enemy was faster", this.enemyFireAt);
      this.updateOverlay();
      return;
    }

    this.lastPlayerShotAt = now;
    this.showPlayerMuzzleFlash();

    const hitZone = this.getHitZoneUnderReticle();
    const shotScore = scoreHitZone(hitZone);

    if (shotScore.shotResult === "miss") {
      this.lastMissAt = now;
      this.showMissDust();
      this.state = recordPlayerMiss(this.state, now, shotScore);
      this.missLossAt = getMissPunishFireAt(
        now,
        this.enemyFireAt ?? getEnemyFireAt(this.state.stats.drawAt ?? now, this.enemyReactionMs),
        GAME_CONFIG.timing.missPunishDelayMs
      );
      this.updateOverlay();
      return;
    }

    this.state = resolvePlayerHit(this.state, now, shotScore, this.enemyReactionMs);

    this.updateOverlay();
  }

  private handleEnemyShot(now: number): void {
    if (this.enemyHasFired) {
      return;
    }

    if (this.state.phase === "draw" && this.enemyFireAt !== null && now >= this.enemyFireAt) {
      this.resolveEnemyFire("enemy was faster", this.enemyFireAt);
      return;
    }

    if (this.state.phase === "missed" && this.missLossAt !== null && now >= this.missLossAt) {
      this.resolveEnemyFire("missed shot", this.missLossAt);
    }
  }

  private resolveEnemyFire(reason: "enemy was faster" | "missed shot", firedAt: number): void {
    if (this.enemyHasFired) {
      return;
    }

    this.enemyHasFired = true;
    this.lastEnemyShotAt = firedAt;

    if (this.enemyMuzzleFlash) {
      this.enemyMuzzleFlash.visible = true;
    }

    this.state = resolveEnemyShot(this.state, firedAt, reason);
  }

  private showPlayerMuzzleFlash(): void {
    if (this.muzzleFlash) {
      this.muzzleFlash.visible = true;
    }
  }

  private getHitZoneUnderReticle(): HitZoneDefinition | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitZoneMeshes, false);
    const hitZones = hits
      .map((hit) => {
        const hitZone = this.hitZoneByMesh.get(hit.object);
        return hitZone ? { distance: hit.distance, hitZone } : null;
      })
      .filter((item): item is { distance: number; hitZone: HitZoneDefinition } => item !== null)
      .sort((a, b) => b.hitZone.priority - a.hitZone.priority || a.distance - b.distance);

    return hitZones[0]?.hitZone ?? null;
  }

  private showMissDust(): void {
    if (!this.missDustGroup || !this.missDustMaterial) {
      return;
    }

    this.missDustGroup.position.set(
      THREE.MathUtils.clamp(this.pointer.x * 0.85, -0.95, 0.95),
      0.92 + THREE.MathUtils.clamp(this.pointer.y * 0.35, -0.22, 0.28),
      -5.9
    );
    this.missDustGroup.scale.setScalar(0.55);
    this.missDustGroup.visible = true;
    this.missDustMaterial.opacity = 0.72;
  }

  private updateScene(now: number, delta: number): void {
    this.updateCamera(now);
    this.updateEnemyPose(delta);
    this.updateGunPose(now);
    this.updateFlash(this.muzzleFlash, this.lastPlayerShotAt, now);
    this.updateFlash(this.enemyMuzzleFlash, this.lastEnemyShotAt, now);
    this.updateMissDust(now);
  }

  private updateCamera(now: number): void {
    const [baseX, baseY, baseZ] = GAME_CONFIG.camera.position;
    const shakeWindowMs = 130;
    const lastShotAt = Math.max(this.lastPlayerShotAt ?? 0, this.lastEnemyShotAt ?? 0);
    const shotAge = lastShotAt > 0 ? now - lastShotAt : Number.POSITIVE_INFINITY;
    const shake = shotAge < shakeWindowMs ? (1 - shotAge / shakeWindowMs) * 0.035 : 0;

    this.camera.position.set(
      baseX + Math.sin(now * 0.07) * shake,
      baseY + Math.cos(now * 0.09) * shake,
      baseZ
    );
    this.camera.lookAt(...GAME_CONFIG.camera.lookAt);
  }

  private updateEnemyPose(delta: number): void {
    const ease = 1 - Math.exp(-delta * 12);

    if (this.enemyGunArm) {
      let targetRotation = -0.35;

      if (this.state.phase === "draw" || this.state.phase === "missed") {
        const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
        const elapsed = performance.now() - drawAt;
        const drawProgress = THREE.MathUtils.clamp(elapsed / Math.max(1, this.enemyReactionMs), 0, 1);
        targetRotation = THREE.MathUtils.lerp(-0.35, -1.42, drawProgress);
      }

      if (this.enemyHasFired || this.state.phase === "missed" || this.state.result?.outcome === "loss") {
        targetRotation = -1.42;
      }

      this.enemyGunArm.rotation.z = THREE.MathUtils.lerp(
        this.enemyGunArm.rotation.z,
        targetRotation,
        ease
      );
    }

    if (this.enemyGroup) {
      const playerWon = this.state.result?.outcome === "win";
      const targetTilt = playerWon ? -0.18 : 0;
      this.enemyGroup.rotation.z = THREE.MathUtils.lerp(
        this.enemyGroup.rotation.z,
        targetTilt,
        ease
      );
    }
  }

  private updateGunPose(now: number): void {
    if (!this.gunGroup) {
      return;
    }

    const isDrawPhase = this.state.phase === "draw";
    const isPlayerWin = this.state.result?.outcome === "win";
    const baseY = isDrawPhase || isPlayerWin ? -0.42 : -0.62;
    const recoilAge = this.lastPlayerShotAt === null ? Number.POSITIVE_INFINITY : now - this.lastPlayerShotAt;
    const recoil = recoilAge < 170 ? 1 - recoilAge / 170 : 0;

    this.gunGroup.position.set(0.38, baseY + recoil * 0.08, -1.1);
    this.gunGroup.rotation.set(-0.08 - recoil * 0.32, -0.28, -0.08);
  }

  private updateFlash(mesh: THREE.Mesh | null, firedAt: number | null, now: number): void {
    if (!mesh || firedAt === null) {
      return;
    }

    const age = now - firedAt;
    const visible = age >= 0 && age <= GAME_CONFIG.timing.muzzleFlashMs;
    mesh.visible = visible;

    if (visible) {
      const scale = 1 + (1 - age / GAME_CONFIG.timing.muzzleFlashMs) * 0.9;
      mesh.scale.setScalar(scale);
    }
  }

  private updateMissDust(now: number): void {
    if (!this.missDustGroup || !this.missDustMaterial || this.lastMissAt === null) {
      return;
    }

    const age = now - this.lastMissAt;
    const durationMs = 520;

    if (age < 0 || age > durationMs) {
      this.missDustGroup.visible = false;
      this.missDustMaterial.opacity = 0;
      return;
    }

    const progress = age / durationMs;
    this.missDustGroup.visible = true;
    this.missDustGroup.scale.setScalar(0.55 + progress * 1.25);
    this.missDustMaterial.opacity = (1 - progress) * 0.72;
  }

  private buildScene(): void {
    this.addLighting();
    this.addGround();
    this.addTown();
    this.addEnemy();
    this.addGun();
    this.addMissDust();
  }

  private addLighting(): void {
    const hemiLight = new THREE.HemisphereLight("#ffe7ba", "#70492c", 1.6);
    this.scene.add(hemiLight);

    const sun = new THREE.DirectionalLight("#fff4d0", 3.2);
    sun.position.set(-5, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 30;
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    this.scene.add(sun);

    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 32),
      new THREE.MeshBasicMaterial({ color: "#ffe2a0" })
    );
    sunDisc.position.set(-5.5, 5.6, -9);
    sunDisc.lookAt(this.camera.position);
    this.scene.add(sunDisc);
  }

  private addGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 26),
      new THREE.MeshStandardMaterial({ color: "#c98542", roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -4;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const street = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 22),
      new THREE.MeshStandardMaterial({ color: "#8b5a37", roughness: 1 })
    );
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, 0.012, -4.5);
    street.receiveShadow = true;
    this.scene.add(street);

    const dustPuffs = new THREE.Group();
    const dustMaterial = new THREE.MeshStandardMaterial({ color: "#e7b96b", roughness: 1 });

    for (let i = 0; i < 26; i += 1) {
      const dust = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (i % 3) * 0.01, 8, 6), dustMaterial);
      dust.position.set(((i * 1.37) % 8) - 4, 0.04, -1.5 - i * 0.34);
      dust.scale.y = 0.45;
      dustPuffs.add(dust);
    }

    this.scene.add(dustPuffs);
  }

  private addTown(): void {
    const boardwalkMaterial = new THREE.MeshStandardMaterial({ color: "#744b2b", roughness: 0.9 });

    for (const side of [-1, 1]) {
      const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 16), boardwalkMaterial);
      boardwalk.position.set(side * 3.05, 0.08, -4.8);
      boardwalk.receiveShadow = true;
      boardwalk.castShadow = true;
      this.scene.add(boardwalk);
    }

    const buildings = [
      { side: -1, z: -7.3, width: 1.3, height: 2.7, depth: 2.1, color: "#9f3f35" },
      { side: -1, z: -4.9, width: 1.25, height: 2.15, depth: 1.7, color: "#dfb35f" },
      { side: -1, z: -2.5, width: 1.4, height: 2.4, depth: 2.2, color: "#6c7e68" },
      { side: 1, z: -7.8, width: 1.35, height: 2.35, depth: 2.0, color: "#3e6d88" },
      { side: 1, z: -5.2, width: 1.3, height: 2.65, depth: 2.4, color: "#b6583f" },
      { side: 1, z: -2.8, width: 1.2, height: 2.05, depth: 1.8, color: "#c7954f" }
    ];

    for (const building of buildings) {
      const x = building.side * 3.85;
      const body = this.createBox(
        [building.width, building.height, building.depth],
        building.color,
        [x, building.height / 2, building.z]
      );
      this.scene.add(body);

      const roof = this.createBox(
        [building.width + 0.24, 0.18, building.depth + 0.2],
        "#4c2e26",
        [x, building.height + 0.08, building.z]
      );
      this.scene.add(roof);

      const sign = this.createBox(
        [0.12, 0.42, Math.min(1.25, building.depth * 0.7)],
        "#f2ca72",
        [building.side * 3.12, building.height * 0.67, building.z]
      );
      this.scene.add(sign);

      const awning = this.createBox(
        [0.2, 0.12, Math.min(1.55, building.depth * 0.8)],
        "#334b5c",
        [building.side * 2.95, 1.2, building.z]
      );
      this.scene.add(awning);
    }

    this.addBarrels(-2.55, -3.7);
    this.addBarrels(2.55, -6.4);
  }

  private addBarrels(x: number, z: number): void {
    const barrelMaterial = new THREE.MeshStandardMaterial({ color: "#7a3f24", roughness: 0.85 });
    const bandMaterial = new THREE.MeshStandardMaterial({ color: "#2a2522", roughness: 0.6 });

    for (let i = 0; i < 3; i += 1) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.62, 12), barrelMaterial);
      barrel.position.set(x + i * 0.24, 0.31, z + (i % 2) * 0.28);
      barrel.castShadow = true;
      barrel.receiveShadow = true;
      this.scene.add(barrel);

      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.285, 0.06, 12), bandMaterial);
      band.position.copy(barrel.position);
      band.position.y += 0.14;
      band.castShadow = true;
      this.scene.add(band);
    }
  }

  private addEnemy(): void {
    const group = new THREE.Group();
    group.position.set(0, 0, -5.7);

    const bootMaterial = new THREE.MeshStandardMaterial({ color: "#1f1b1a", roughness: 0.8 });
    const coatMaterial = new THREE.MeshStandardMaterial({ color: "#4b2d2a", roughness: 0.82 });
    const shirtMaterial = new THREE.MeshStandardMaterial({ color: "#d2a76a", roughness: 0.78 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: "#b98055", roughness: 0.72 });
    const hatMaterial = new THREE.MeshStandardMaterial({ color: "#322520", roughness: 0.9 });

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), bootMaterial);
    leftLeg.position.set(-0.18, 0.45, 0);
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    group.add(leftLeg, rightLeg);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.0, 0.32), coatMaterial);
    torso.position.set(0, 1.18, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.84, 0.34), shirtMaterial);
    shirt.position.set(0, 1.18, 0.03);
    group.add(shirt);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), skinMaterial);
    head.position.set(0, 1.92, 0);
    head.castShadow = true;
    group.add(head);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.07, 20), hatMaterial);
    brim.position.set(0, 2.14, 0);
    brim.castShadow = true;
    group.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.29, 0.26, 16), hatMaterial);
    crown.position.set(0, 2.28, 0);
    crown.castShadow = true;
    group.add(crown);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.16), coatMaterial);
    leftArm.position.set(-0.56, 1.16, 0);
    leftArm.rotation.z = 0.28;
    leftArm.castShadow = true;
    group.add(leftArm);

    const gunArm = new THREE.Group();
    gunArm.position.set(0.55, 1.48, 0.02);
    gunArm.rotation.z = -0.35;

    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.16), coatMaterial);
    armMesh.position.set(0, -0.36, 0);
    armMesh.castShadow = true;
    gunArm.add(armMesh);

    const enemyGun = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.1), bootMaterial);
    enemyGun.position.set(0.02, -0.76, 0.02);
    enemyGun.castShadow = true;
    gunArm.add(enemyGun);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshBasicMaterial({ color: "#ffe071", transparent: true, opacity: 0.88 })
    );
    flash.position.set(0.03, -0.96, 0.06);
    flash.visible = false;
    gunArm.add(flash);

    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.14), bootMaterial);
    holster.position.set(0.47, 0.82, 0.08);
    holster.rotation.z = -0.22;
    group.add(holster);

    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    group.add(gunArm);
    this.addHitZones(group, gunArm);
    this.scene.add(group);
    this.enemyGroup = group;
    this.enemyGunArm = gunArm;
    this.enemyMuzzleFlash = flash;
  }

  private addHitZones(enemyGroup: THREE.Group, gunArm: THREE.Group): void {
    for (const definition of HIT_ZONE_DEFINITIONS) {
      const mesh = this.createHitZoneMesh(definition);
      const parent = this.getHitZoneParent(definition.parent, enemyGroup, gunArm);

      parent.add(mesh);
      this.hitZoneMeshes.push(mesh);
      this.hitZoneByMesh.set(mesh, definition);
    }

    this.updateHitBoxVisibility();
  }

  private createHitZoneMesh(definition: HitZoneDefinition): THREE.Mesh {
    const geometry =
      definition.shape === "sphere"
        ? new THREE.SphereGeometry(definition.size[0], 16, 12)
        : new THREE.BoxGeometry(definition.size[0], definition.size[1], definition.size[2]);
    const material = new THREE.MeshBasicMaterial({
      color: definition.color,
      depthTest: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
      wireframe: true
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(definition.position[0], definition.position[1], definition.position[2]);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    return mesh;
  }

  private getHitZoneParent(
    parent: HitZoneParent,
    enemyGroup: THREE.Group,
    gunArm: THREE.Group
  ): THREE.Group {
    return parent === "gunArm" ? gunArm : enemyGroup;
  }

  private updateHitBoxVisibility(): void {
    for (const mesh of this.hitZoneMeshes) {
      const material = mesh.material;

      if (Array.isArray(material)) {
        for (const item of material) {
          item.opacity = this.hitBoxesVisible ? 0.68 : 0;
        }
      } else {
        material.opacity = this.hitBoxesVisible ? 0.68 : 0;
      }
    }

    this.ui.overlay.classList.toggle("is-hitbox-debug", this.hitBoxesVisible);
  }

  private addMissDust(): void {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: "#f0c06c",
      depthWrite: false,
      opacity: 0,
      transparent: true
    });

    for (let i = 0; i < 7; i += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08 + i * 0.01, 8, 6), material);
      const angle = (i / 7) * Math.PI * 2;
      puff.position.set(Math.cos(angle) * 0.14, Math.sin(angle) * 0.08, (i % 3) * 0.03);
      puff.scale.y = 0.55;
      group.add(puff);
    }

    group.position.set(0.45, 1.0, -5.9);
    group.visible = false;
    this.scene.add(group);
    this.missDustGroup = group;
    this.missDustMaterial = material;
  }

  private addGun(): void {
    const group = new THREE.Group();
    group.position.set(0.38, -0.62, -1.1);
    group.rotation.set(-0.08, -0.28, -0.08);

    const metal = new THREE.MeshStandardMaterial({ color: "#2a3034", metalness: 0.45, roughness: 0.38 });
    const grip = new THREE.MeshStandardMaterial({ color: "#6c3425", roughness: 0.7 });

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.58, 12), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.34);

    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 16), metal);
    chamber.rotation.x = Math.PI / 2;
    chamber.position.set(0, 0, -0.08);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.12), grip);
    handle.position.set(0.05, -0.26, 0.04);
    handle.rotation.z = -0.28;

    const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 12), metal);
    trigger.position.set(0, -0.13, -0.02);
    trigger.rotation.x = Math.PI / 2;

    const flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.24, 12),
      new THREE.MeshBasicMaterial({ color: "#ffd35c", transparent: true, opacity: 0.92 })
    );
    flash.rotation.x = -Math.PI / 2;
    flash.position.set(0, 0.02, -0.68);
    flash.visible = false;

    group.add(barrel, chamber, handle, trigger, flash);
    this.camera.add(group);
    this.gunGroup = group;
    this.muzzleFlash = flash;
  }

  private createBox(size: Vec3Tuple, color: string, position: Vec3Tuple): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
    );
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createOverlay(): UiElements {
    const overlay = document.createElement("div");
    overlay.className = "duel-overlay";

    const topBar = document.createElement("div");
    topBar.className = "top-bar";

    const title = document.createElement("div");
    title.className = "game-title";
    title.textContent = "High Noon Duel";

    const enemyBadge = document.createElement("div");
    enemyBadge.className = "enemy-badge";
    enemyBadge.textContent = "Wanted: ";

    const enemyName = document.createElement("span");
    enemyName.textContent = `${GAME_CONFIG.enemy.name} - $${GAME_CONFIG.enemy.reward}`;
    enemyBadge.append(enemyName);

    topBar.append(title, enemyBadge);

    const phaseLabel = document.createElement("div");
    phaseLabel.className = "phase-label";

    const detail = document.createElement("div");
    detail.className = "phase-detail";

    const stats = document.createElement("div");
    stats.className = "stats-panel";

    const result = document.createElement("div");
    result.className = "result-copy";

    const actionButton = document.createElement("button");
    actionButton.className = "duel-button";
    actionButton.type = "button";
    actionButton.textContent = "Start Duel";

    const crosshair = document.createElement("div");
    crosshair.className = "crosshair";

    overlay.append(topBar, phaseLabel, detail, stats, result, actionButton, crosshair);

    return {
      overlay,
      phaseLabel,
      detail,
      stats,
      result,
      enemyName,
      actionButton,
      crosshair
    };
  }

  private updateOverlay(): void {
    this.ui.enemyName.textContent = `${GAME_CONFIG.enemy.name} - $${GAME_CONFIG.enemy.reward}`;
    this.ui.phaseLabel.textContent = this.getPhaseText();
    this.ui.phaseLabel.dataset.phase = this.state.result?.outcome ?? this.state.phase;
    this.ui.detail.textContent = this.getDetailText();
    this.ui.result.textContent = this.getResultText();
    this.ui.actionButton.hidden =
      this.state.phase !== "intro" && this.state.phase !== "resolved";
    this.ui.actionButton.textContent =
      this.state.phase === "resolved" ? "Restart Duel" : "Start Duel";
    this.ui.crosshair.classList.toggle("is-visible", this.state.phase === "draw");
    this.ui.crosshair.classList.toggle("is-hot", this.state.phase === "draw");
    this.viewport.classList.toggle("is-aiming", this.state.phase === "draw");
    this.renderStats();
  }

  private getPhaseText(): string {
    if (this.state.result?.outcome === "win") {
      return "WON";
    }

    if (this.state.result?.outcome === "loss") {
      return "LOST";
    }

    switch (this.state.phase) {
      case "intro":
        return "HIGH NOON";
      case "ready":
        return "READY";
      case "steady":
        return "STEADY";
      case "waiting":
        return "...";
      case "draw":
        return "DRAW";
      case "missed":
        return "MISS";
      case "resolved":
        return "";
    }
  }

  private getDetailText(): string {
    if (this.state.phase === "intro") {
      return `Face ${GAME_CONFIG.enemy.name}.`;
    }

    if (this.state.phase === "draw") {
      return "Aim and click.";
    }

    if (this.state.phase === "missed") {
      return "Missed.";
    }

    if (this.state.phase === "resolved") {
      return this.getOutcomeLine();
    }

    return "";
  }

  private getOutcomeLine(): string {
    const result = this.state.result;

    if (!result) {
      return "";
    }

    if (result.stats.shotResult === "head") {
      return "Head shot.";
    }

    if (result.stats.shotResult === "disarm") {
      return "Disarmed.";
    }

    if (result.stats.shotResult === "torso") {
      return "Clean shot.";
    }

    if (result.reason === "early draw") {
      return "Too soon.";
    }

    if (result.reason === "missed shot") {
      return "Missed shot.";
    }

    return "Enemy was faster.";
  }

  private getResultText(): string {
    if (!this.state.result) {
      return "";
    }

    const styleBonus = this.state.result.stats.styleBonusText;

    if (styleBonus) {
      return styleBonus;
    }

    return `Reason: ${this.state.result.reason}.`;
  }

  private renderStats(): void {
    this.ui.stats.replaceChildren();

    if (this.state.phase !== "resolved" || !this.state.result) {
      return;
    }

    const stats = this.state.result.stats;
    const rows: Array<[string, string]> = [
      ["Duel Result", this.state.result.outcome.toUpperCase()],
      ["Shot Result", formatShotResult(stats.shotResult)],
      ["Reaction Time", formatDuration(stats.playerReactionTimeMs)],
      ["Enemy Reaction", formatDuration(stats.enemyReactionTimeMs)]
    ];

    if (stats.styleBonusText) {
      rows.push(["Style Bonus", stats.styleBonusText]);
    }

    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "stat-row";

      if (label === "Style Bonus") {
        row.classList.add("is-wide");
      }

      const labelEl = document.createElement("span");
      labelEl.textContent = label;

      const valueEl = document.createElement("strong");
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      this.ui.stats.append(row);
    }
  }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
