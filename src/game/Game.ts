import * as THREE from "three";
import { AudioManager } from "../audio/AudioManager";
import { DEFAULT_ENEMY, ENEMIES, type EnemyDefinition } from "../data/enemies";
import { UPGRADES, type UpgradeDefinition, type UpgradeId } from "../data/upgrades";
import { GAME_CONFIG } from "./config";
import {
  clearSavedProgression,
  createDefaultProgression,
  derivePlayerStats,
  getOwnedUpgradeNames,
  loadProgression,
  purchaseUpgrade,
  recordDuelResult,
  rememberSelectedEnemy,
  saveProgression,
  type PlayerProgression,
  type PlayerStats
} from "./progression";
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
  type DuelPhase,
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
  bountyBoard: HTMLDivElement;
  actionButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  crosshair: HTMLDivElement;
}

type Vec3Tuple = [number, number, number];
type BoardMode = "bounties" | "shop";
type DuelLossReason = "enemy was faster" | "missed shot";

interface FakeoutWindow {
  startsAt: number;
  endsAt: number;
  intensity: number;
}

interface EnemyMaterials {
  coat: THREE.MeshStandardMaterial;
  shirt: THREE.MeshStandardMaterial;
  hat: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
}

interface PlayerShotTiming {
  beatsEnemy: boolean;
  enemyFiredAt: number;
  luckyCharmTriggered: boolean;
}

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
  private readonly audio = new AudioManager();
  private readonly ui: UiElements;

  private progression: PlayerProgression = loadProgression();
  private playerStats: PlayerStats = derivePlayerStats(this.progression.ownedUpgrades);
  private state: DuelState = createIntroDuelState(performance.now());
  private timing: CountdownTiming = this.createRoundTiming();
  private selectedEnemy: EnemyDefinition = getEnemyById(this.progression.selectedEnemyId);
  private boardMode: BoardMode = "bounties";
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private enemyReactionMs: number = DEFAULT_ENEMY.reactionTimeMs;
  private enemyFireAt: number | null = null;
  private missLossAt: number | null = null;
  private fakeouts: FakeoutWindow[] = [];
  private enemyHasFired = false;
  private duelSettled = false;
  private hitBoxesVisible = false;
  private lastMoneyEarned = 0;
  private lastShopMessage = "";
  private lastLuckyCharmTriggered = false;
  private lastPlayerShotAt: number | null = null;
  private lastEnemyShotAt: number | null = null;
  private lastMissAt: number | null = null;
  private enemyGroup: THREE.Group | null = null;
  private enemyGunArm: THREE.Group | null = null;
  private enemyMaterials: EnemyMaterials | null = null;
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
    this.renderBountyBoard();
    this.bindEvents();
    this.handleResize();
    this.updateOverlay();
    this.updateMuteButton();
    this.playBountyBoardAudio();
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
    window.removeEventListener("pointerdown", this.handleFirstUserInteraction, true);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.ui.actionButton.removeEventListener("click", this.handleRestartButtonClick);
    this.ui.backButton.removeEventListener("click", this.handleBackButtonClick);
    this.ui.muteButton.removeEventListener("click", this.handleMuteButtonClick);
    this.resizeObserver?.disconnect();
    this.audio.stopAll();

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

    this.handleDuelPhaseAudio(previousPhase, this.state.phase);
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
    this.enemyReactionMs = this.selectedEnemy.reactionTimeMs;
    this.enemyFireAt = null;
    this.missLossAt = null;
    this.fakeouts = this.createFakeoutWindows(now, this.state.scheduledDrawAt);
    this.enemyHasFired = false;
    this.duelSettled = false;
    this.lastMoneyEarned = 0;
    this.lastShopMessage = "";
    this.lastLuckyCharmTriggered = false;
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
      this.enemyGroup.position.set(0, 0, -5.7);
      this.enemyGroup.rotation.set(0, 0, 0);
      this.enemyGroup.scale.setScalar(this.selectedEnemy.visual.scale);
    }

    if (this.enemyGunArm) {
      this.enemyGunArm.rotation.z = -0.35;
    }

    if (this.missDustGroup) {
      this.missDustGroup.visible = false;
    }

    this.updateHitZoneScale();
    this.updateHitBoxVisibility();
    this.playDuelStartAudio();
    this.updateOverlay();
  };

  private readonly showBountyBoard = (): void => {
    this.boardMode = "bounties";
    this.state = createIntroDuelState(performance.now());
    this.enemyFireAt = null;
    this.missLossAt = null;
    this.fakeouts = [];
    this.enemyHasFired = false;
    this.lastPlayerShotAt = null;
    this.lastEnemyShotAt = null;
    this.lastMissAt = null;

    if (this.enemyGroup) {
      this.enemyGroup.position.set(0, 0, -5.7);
      this.enemyGroup.rotation.set(0, 0, 0);
    }

    if (this.enemyGunArm) {
      this.enemyGunArm.rotation.z = -0.35;
    }

    this.updateEnemyVisual();
    this.renderBountyBoard();
    this.playBountyBoardAudio();
    this.updateOverlay();
  };

  private selectEnemy(enemy: EnemyDefinition): void {
    this.selectedEnemy = enemy;
    this.progression = rememberSelectedEnemy(this.progression, enemy.id);
    saveProgression(this.progression);
    this.updateEnemyVisual();
    this.renderBountyBoard();
    this.startRound();
  }

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

  private createFakeoutWindows(roundStartedAt: number, scheduledDrawAt: number): FakeoutWindow[] {
    if (this.selectedEnemy.fakeoutChance <= 0 || Math.random() > this.selectedEnemy.fakeoutChance) {
      return [];
    }

    const availableMs = scheduledDrawAt - roundStartedAt - 450;

    if (availableMs <= 500) {
      return [];
    }

    const count = this.selectedEnemy.fakeoutChance > 0.55 ? 2 : 1;
    const windows: FakeoutWindow[] = [];

    for (let i = 0; i < count; i += 1) {
      const startsAt = roundStartedAt + randomRange(450, availableMs);
      windows.push({
        startsAt,
        endsAt: startsAt + randomRange(180, 270),
        intensity: randomRange(0.65, 1)
      });
    }

    return windows.sort((a, b) => a.startsAt - b.startsAt);
  }

  private bindEvents(): void {
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerdown", this.handleFirstUserInteraction, true);
    window.addEventListener("keydown", this.handleKeyDown);
    this.ui.actionButton.addEventListener("click", this.handleRestartButtonClick);
    this.ui.backButton.addEventListener("click", this.handleBackButtonClick);
    this.ui.muteButton.addEventListener("click", this.handleMuteButtonClick);

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.viewport);
  }

  private readonly handleFirstUserInteraction = (): void => {
    this.audio.unlock();
  };

  private readonly handleRestartButtonClick = (): void => {
    this.audio.unlock();
    this.audio.playSfx("buttonClick");
    this.startRound();
  };

  private readonly handleBackButtonClick = (): void => {
    this.audio.unlock();
    this.audio.playSfx("buttonClick");
    this.showBountyBoard();
  };

  private readonly handleMuteButtonClick = (): void => {
    this.audio.unlock();
    const muted = this.audio.toggleMute();

    if (!muted) {
      this.audio.playSfx("buttonClick");
    }

    this.updateMuteButton();
  };

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
    this.audio.unlock();

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

    if (event.code === "KeyM") {
      this.audio.toggleMute();
      this.updateMuteButton();
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
      return;
    }

    if (this.state.phase === "missed" || this.state.phase === "resolved") {
      return;
    }

    const now = performance.now();
    const previousPhase = this.state.phase;
    this.state = advanceDuelState(this.state, now, this.timing);
    this.handleDuelPhaseAudio(previousPhase, this.state.phase);

    if (this.state.phase !== "draw") {
      this.lastPlayerShotAt = now;
      this.showPlayerMuzzleFlash();
      this.audio.playSfx("gunshotPlayer");
      this.state = resolveEarlyDraw(this.state, now);
      this.updateOverlay();
      return;
    }

    this.lastPlayerShotAt = now;
    this.showPlayerMuzzleFlash();
    this.audio.playSfx("gunshotPlayer");

    const hitZone = this.getHitZoneUnderReticle();
    const baseShotScore = scoreHitZone(hitZone);
    const timing = this.evaluatePlayerShotTiming(now);

    if (baseShotScore.shotResult === "miss") {
      this.lastMissAt = now;
      this.showMissDust();
      this.audio.playSfx("dustImpact");
      this.state = recordPlayerMiss(this.state, now, baseShotScore);
      this.missLossAt = getMissPunishFireAt(
        now,
        this.enemyFireAt ?? getEnemyFireAt(this.state.stats.drawAt ?? now, this.enemyReactionMs),
        this.getMissPunishDelayMs()
      );
      this.updateOverlay();
      return;
    }

    if (!timing.beatsEnemy) {
      this.resolveEnemyFire("enemy was faster", timing.enemyFiredAt);
      this.updateOverlay();
      return;
    }

    const shotScore = timing.luckyCharmTriggered
      ? {
          ...baseShotScore,
          styleBonusText: appendResultText(
            baseShotScore.styleBonusText,
            "Lucky Charm saved a near loss."
          )
        }
      : baseShotScore;

    this.lastLuckyCharmTriggered = timing.luckyCharmTriggered;
    this.audio.playSfx("bodyHit");
    this.state = resolvePlayerHit(this.state, now, shotScore, this.enemyReactionMs);

    this.updateOverlay();
  }

  private handleEnemyShot(now: number): void {
    if (this.enemyHasFired) {
      return;
    }

    const enemyResolveAt = this.getEnemyResolveAt();

    if (
      this.state.phase === "draw" &&
      this.enemyFireAt !== null &&
      enemyResolveAt !== null &&
      now >= enemyResolveAt
    ) {
      this.resolveEnemyFire("enemy was faster", this.enemyFireAt);
      return;
    }

    if (this.state.phase === "missed" && this.missLossAt !== null && now >= this.missLossAt) {
      this.resolveEnemyFire("missed shot", this.missLossAt);
    }
  }

  private evaluatePlayerShotTiming(firedAt: number): PlayerShotTiming {
    const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
    const enemyFiredAt = this.enemyFireAt ?? getEnemyFireAt(drawAt, this.enemyReactionMs);
    const effectiveFiredAt = firedAt - this.playerStats.shotTimingBonusMs;
    const guaranteedDeadline = enemyFiredAt + this.playerStats.focusGraceMs;

    if (effectiveFiredAt <= guaranteedDeadline) {
      return {
        beatsEnemy: true,
        enemyFiredAt,
        luckyCharmTriggered: false
      };
    }

    const luckyWindowMs =
      this.playerStats.luckyCharmChance > 0 ? this.playerStats.luckyCharmWindowMs : 0;
    const isBarelyLate = effectiveFiredAt <= guaranteedDeadline + luckyWindowMs;
    const luckyCharmTriggered =
      isBarelyLate && Math.random() < this.playerStats.luckyCharmChance;

    return {
      beatsEnemy: luckyCharmTriggered,
      enemyFiredAt,
      luckyCharmTriggered
    };
  }

  private getEnemyResolveAt(): number | null {
    if (this.enemyFireAt === null) {
      return null;
    }

    const luckyWindowMs =
      this.playerStats.luckyCharmChance > 0 ? this.playerStats.luckyCharmWindowMs : 0;

    return this.enemyFireAt + this.playerStats.focusGraceMs + luckyWindowMs;
  }

  private getMissPunishDelayMs(): number {
    return GAME_CONFIG.timing.missPunishDelayMs + (1 - this.selectedEnemy.accuracy) * 360;
  }

  private resolveEnemyFire(reason: DuelLossReason, firedAt: number): void {
    if (this.enemyHasFired) {
      return;
    }

    this.enemyHasFired = true;
    this.lastEnemyShotAt = performance.now();
    this.audio.playSfx("gunshotEnemy");

    if (reason === "enemy was faster") {
      this.audio.playSfx("bulletWhiz");
    }

    if (this.enemyMuzzleFlash) {
      this.enemyMuzzleFlash.visible = true;
    }

    this.state = resolveEnemyShot(this.state, firedAt, reason);
  }

  private settleDuelResultIfNeeded(): void {
    if (this.duelSettled || this.state.phase !== "resolved" || !this.state.result) {
      return;
    }

    const reward = this.state.result.outcome === "win" ? this.selectedEnemy.reward : 0;
    this.progression = recordDuelResult(
      this.progression,
      this.state.result.outcome,
      reward,
      this.selectedEnemy.id
    );
    this.lastMoneyEarned = reward;
    this.duelSettled = true;
    saveProgression(this.progression);
    this.playDuelResultAudio();
    this.renderBountyBoard();
  }

  private buyUpgrade(upgradeId: UpgradeId): void {
    const result = purchaseUpgrade(this.progression, upgradeId);

    if (result.status === "purchased") {
      this.progression = result.progression;
      this.playerStats = derivePlayerStats(this.progression.ownedUpgrades);
      this.lastShopMessage = `${result.upgrade.name} purchased.`;
      saveProgression(this.progression);
      this.updateHitZoneScale();
      this.updateHitBoxVisibility();
    } else if (result.status === "owned" && result.upgrade) {
      this.lastShopMessage = `${result.upgrade.name} is already owned.`;
    } else if (result.status === "insufficient-funds" && result.upgrade) {
      this.lastShopMessage = `Need $${result.upgrade.cost} for ${result.upgrade.name}.`;
    } else {
      this.lastShopMessage = "Upgrade unavailable.";
    }

    this.renderBountyBoard();
    this.updateOverlay();
  }

  private resetProgression(): void {
    if (!window.confirm("Reset money, upgrades, and duel record?")) {
      return;
    }

    this.audio.playSfx("buttonClick");
    clearSavedProgression();
    this.progression = createDefaultProgression();
    saveProgression(this.progression);
    this.playerStats = derivePlayerStats(this.progression.ownedUpgrades);
    this.selectedEnemy = getEnemyById(this.progression.selectedEnemyId);
    this.boardMode = "bounties";
    this.lastMoneyEarned = 0;
    this.lastShopMessage = "Progress reset.";
    this.updateEnemyVisual();
    this.updateHitZoneScale();
    this.updateHitBoxVisibility();
    this.renderBountyBoard();
    this.updateOverlay();
  }

  private handleDuelPhaseAudio(previousPhase: DuelPhase, nextPhase: DuelPhase): void {
    if (previousPhase === nextPhase) {
      return;
    }

    if (nextPhase === "steady") {
      this.audio.playVoice("steady");
      return;
    }

    if (nextPhase === "draw") {
      this.audio.playVoice("draw");
      this.audio.playSfx("revolverCock");
    }
  }

  private playBountyBoardAudio(): void {
    this.audio.stopMusic("duelTensionLoop", 450);
    this.audio.stopMusic("victorySting", 100);
    this.audio.stopMusic("defeatSting", 100);
    this.audio.playMusic("townWindLoop", {
      loop: true,
      fadeInMs: 500,
      volume: 0.55
    });
    this.audio.playMusic("bountyBoardLoop", {
      loop: true,
      fadeInMs: 500,
      volume: 0.65
    });
    this.audio.playVoice("welcomeBoard");
  }

  private playDuelStartAudio(): void {
    this.audio.stopMusic("bountyBoardLoop", 350);
    this.audio.stopMusic("victorySting", 100);
    this.audio.stopMusic("defeatSting", 100);
    this.audio.playMusic("townWindLoop", {
      loop: true,
      fadeInMs: 300,
      volume: 0.5
    });
    this.audio.playMusic("duelTensionLoop", {
      loop: true,
      fadeInMs: 450,
      volume: 0.72
    });
    this.audio.playVoice("ready");
    this.audio.playSfx("holsterLeather");
  }

  private playDuelResultAudio(): void {
    const result = this.state.result;

    if (!result) {
      return;
    }

    this.audio.stopMusic("duelTensionLoop", 350);

    if (result.outcome === "win") {
      this.audio.playMusic("victorySting", {
        loop: false,
        fadeInMs: 30,
        restart: true,
        volume: 0.95
      });
      this.audio.playVoice(this.getWinVoiceLineId());
      return;
    }

    this.audio.playMusic("defeatSting", {
      loop: false,
      fadeInMs: 30,
      restart: true,
      volume: 0.95
    });

    if (result.reason === "early draw") {
      this.audio.playVoice("tooSoon");
      return;
    }

    if (result.reason === "missed shot") {
      this.audio.playVoice("miss");
      return;
    }

    if (result.reason === "enemy was faster") {
      this.audio.playVoice("enemyFaster");
      return;
    }

    this.audio.playVoice("tryAgainPartner");
  }

  private updateMuteButton(): void {
    const muted = this.audio.isMuted();
    this.ui.muteButton.textContent = muted ? "Audio Off" : "Audio On";
    this.ui.muteButton.setAttribute("aria-pressed", String(muted));
  }

  private getWinVoiceLineId(): "cleanShot" | "disarm" | "headshot" | "bountyClaimed" {
    const shotResult = this.state.result?.stats.shotResult;

    if (shotResult === "head") {
      return "headshot";
    }

    if (shotResult === "disarm") {
      return "disarm";
    }

    if (shotResult === "torso") {
      return "cleanShot";
    }

    return "bountyClaimed";
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
    this.updateHitBoxVisibility();
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
    const now = performance.now();
    const fakeoutIntensity = this.getFakeoutIntensity(now);

    if (this.enemyGunArm) {
      let targetRotation = -0.35;

      if (fakeoutIntensity > 0) {
        targetRotation = THREE.MathUtils.lerp(-0.35, -0.92, fakeoutIntensity);
      }

      if (this.state.phase === "draw" || this.state.phase === "missed") {
        const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
        const elapsed = now - drawAt;
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
      const targetLean =
        this.state.phase === "draw" || this.state.phase === "missed"
          ? this.selectedEnemy.visual.drawLeanDistance
          : 0;

      this.enemyGroup.position.x = THREE.MathUtils.lerp(
        this.enemyGroup.position.x,
        targetLean,
        ease
      );
      this.enemyGroup.rotation.z = THREE.MathUtils.lerp(
        this.enemyGroup.rotation.z,
        targetTilt,
        ease
      );
    }
  }

  private getFakeoutIntensity(now: number): number {
    if (this.state.phase === "draw" || this.state.phase === "missed" || this.state.phase === "resolved") {
      return 0;
    }

    for (const fakeout of this.fakeouts) {
      if (now >= fakeout.startsAt && now <= fakeout.endsAt) {
        const progress = (now - fakeout.startsAt) / (fakeout.endsAt - fakeout.startsAt);
        return Math.sin(progress * Math.PI) * fakeout.intensity;
      }
    }

    return 0;
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
    const coatMaterial = new THREE.MeshStandardMaterial({ color: this.selectedEnemy.visual.coatColor, roughness: 0.82 });
    const shirtMaterial = new THREE.MeshStandardMaterial({ color: this.selectedEnemy.visual.shirtColor, roughness: 0.78 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: this.selectedEnemy.visual.skinColor, roughness: 0.72 });
    const hatMaterial = new THREE.MeshStandardMaterial({ color: this.selectedEnemy.visual.hatColor, roughness: 0.9 });
    this.enemyMaterials = {
      coat: coatMaterial,
      shirt: shirtMaterial,
      hat: hatMaterial,
      skin: skinMaterial
    };

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
    this.updateEnemyVisual();
  }

  private updateEnemyVisual(): void {
    if (this.enemyMaterials) {
      this.enemyMaterials.coat.color.set(this.selectedEnemy.visual.coatColor);
      this.enemyMaterials.shirt.color.set(this.selectedEnemy.visual.shirtColor);
      this.enemyMaterials.hat.color.set(this.selectedEnemy.visual.hatColor);
      this.enemyMaterials.skin.color.set(this.selectedEnemy.visual.skinColor);
    }

    if (this.enemyGroup && this.state.phase === "intro") {
      this.enemyGroup.scale.setScalar(this.selectedEnemy.visual.scale);
    }
  }

  private addHitZones(enemyGroup: THREE.Group, gunArm: THREE.Group): void {
    for (const definition of HIT_ZONE_DEFINITIONS) {
      const mesh = this.createHitZoneMesh(definition);
      const parent = this.getHitZoneParent(definition.parent, enemyGroup, gunArm);

      parent.add(mesh);
      this.hitZoneMeshes.push(mesh);
      this.hitZoneByMesh.set(mesh, definition);
    }

    this.updateHitZoneScale();
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
    const isEagleEyeActive = this.isEagleEyeHighlightActive();

    for (const mesh of this.hitZoneMeshes) {
      const material = mesh.material;
      const opacity = this.hitBoxesVisible ? 0.68 : isEagleEyeActive ? 0.28 : 0;

      if (Array.isArray(material)) {
        for (const item of material) {
          item.opacity = opacity;
        }
      } else {
        material.opacity = opacity;
      }
    }

    this.ui.overlay.classList.toggle("is-hitbox-debug", this.hitBoxesVisible);
  }

  private updateHitZoneScale(): void {
    for (const mesh of this.hitZoneMeshes) {
      mesh.scale.setScalar(this.playerStats.hitZoneScale);
    }
  }

  private isEagleEyeHighlightActive(): boolean {
    if (this.playerStats.hitZoneHighlightMs <= 0 || this.state.phase !== "draw") {
      return false;
    }

    const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
    return performance.now() - drawAt <= this.playerStats.hitZoneHighlightMs;
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
    enemyName.textContent = this.getEnemyBadgeText();
    enemyBadge.append(enemyName);

    const muteButton = document.createElement("button");
    muteButton.className = "mute-button";
    muteButton.type = "button";
    muteButton.textContent = "Audio On";
    muteButton.setAttribute("aria-pressed", "false");

    const topStatus = document.createElement("div");
    topStatus.className = "top-status";
    topStatus.append(enemyBadge, muteButton);

    topBar.append(title, topStatus);

    const bountyBoard = document.createElement("div");
    bountyBoard.className = "bounty-board";

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
    actionButton.textContent = "Restart Duel";

    const backButton = document.createElement("button");
    backButton.className = "duel-button secondary";
    backButton.type = "button";
    backButton.textContent = "Back to Bounty Board";

    const actions = document.createElement("div");
    actions.className = "duel-actions";
    actions.append(actionButton, backButton);

    const crosshair = document.createElement("div");
    crosshair.className = "crosshair";

    overlay.append(topBar, bountyBoard, phaseLabel, detail, stats, result, actions, crosshair);

    return {
      overlay,
      phaseLabel,
      detail,
      stats,
      result,
      enemyName,
      bountyBoard,
      actionButton,
      backButton,
      muteButton,
      crosshair
    };
  }

  private renderBountyBoard(): void {
    this.ui.bountyBoard.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "bounty-heading";

    const title = document.createElement("h1");
    title.textContent = this.boardMode === "shop" ? "Upgrade Shop" : "Bounty Board";

    const copy = document.createElement("p");
    copy.textContent =
      this.boardMode === "shop"
        ? "Buy small edges. None of them replace a clean draw and a steady aim."
        : "Choose a duel. Faster enemies pay better, but their tells are meaner.";

    const boardActions = document.createElement("div");
    boardActions.className = "board-actions";

    const bountyButton = this.createBoardModeButton("Bounties", "bounties");
    const shopButton = this.createBoardModeButton("Shop", "shop");
    const resetButton = document.createElement("button");
    resetButton.className = "board-reset";
    resetButton.type = "button";
    resetButton.textContent = "Reset Progress";
    resetButton.addEventListener("click", () => this.resetProgression());

    boardActions.append(bountyButton, shopButton, resetButton);
    heading.append(title, copy, boardActions);

    const progressSummary = this.createProgressSummary();

    if (this.boardMode === "shop") {
      this.ui.bountyBoard.append(heading, progressSummary, this.createShopList());
      return;
    }

    const list = document.createElement("div");
    list.className = "bounty-list";

    for (const enemy of ENEMIES) {
      const card = document.createElement("button");
      card.className = "bounty-card";
      card.type = "button";
      card.dataset.enemyId = enemy.id;
      card.addEventListener("click", () => {
        this.audio.playSfx("posterPaper");
        this.selectEnemy(enemy);
      });

      const name = document.createElement("strong");
      name.textContent = enemy.name;

      const titleEl = document.createElement("span");
      titleEl.className = "bounty-title";
      titleEl.textContent = enemy.title;

      const meta = document.createElement("span");
      meta.className = "bounty-meta";
      meta.textContent = `${enemy.difficultyHint} - reward $${enemy.reward}`;

      const description = document.createElement("p");
      description.textContent = enemy.description;

      const tell = document.createElement("small");
      tell.textContent = enemy.preferredTell;

      card.append(name, titleEl, meta, description, tell);
      list.append(card);
    }

    this.ui.bountyBoard.append(heading, progressSummary, list);
  }

  private createBoardModeButton(label: string, mode: BoardMode): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "board-tab";
    button.type = "button";
    button.textContent = label;
    button.disabled = this.boardMode === mode;
    button.addEventListener("click", () => {
      this.audio.playSfx("buttonClick");
      this.boardMode = mode;
      this.lastShopMessage = "";
      this.renderBountyBoard();
      this.audio.playVoice(mode === "shop" ? "shopWelcome" : "welcomeBoard");
      this.updateOverlay();
    });

    return button;
  }

  private createProgressSummary(): HTMLDivElement {
    const summary = document.createElement("div");
    summary.className = "progress-summary";

    const money = this.createProgressCard("Money", `$${this.progression.money}`);
    const record = this.createProgressCard(
      "Record",
      `${this.progression.duelsWon}W - ${this.progression.duelsLost}L`
    );
    const ownedNames = getOwnedUpgradeNames(this.progression.ownedUpgrades);
    const owned = this.createProgressCard(
      "Owned Upgrades",
      ownedNames.length > 0 ? ownedNames.join(", ") : "None"
    );
    owned.classList.add("owned-upgrades");

    summary.append(money, record, owned);

    if (this.lastShopMessage) {
      const message = document.createElement("div");
      message.className = "shop-message";
      message.textContent = this.lastShopMessage;
      summary.append(message);
    }

    return summary;
  }

  private createProgressCard(label: string, value: string): HTMLDivElement {
    const card = document.createElement("div");
    card.className = "progress-card";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("strong");
    valueEl.textContent = value;

    card.append(labelEl, valueEl);
    return card;
  }

  private createShopList(): HTMLDivElement {
    const list = document.createElement("div");
    list.className = "shop-list";

    for (const upgrade of UPGRADES) {
      list.append(this.createUpgradeCard(upgrade));
    }

    return list;
  }

  private createUpgradeCard(upgrade: UpgradeDefinition): HTMLButtonElement {
    const owned = this.progression.ownedUpgrades.includes(upgrade.id);
    const canAfford = this.progression.money >= upgrade.cost;
    const card = document.createElement("button");
    card.className = "upgrade-card";
    card.type = "button";
    card.dataset.upgradeId = upgrade.id;
    card.disabled = owned || !canAfford;
    card.addEventListener("click", () => {
      this.audio.playSfx("buttonClick");
      this.buyUpgrade(upgrade.id);
    });

    if (owned) {
      card.classList.add("is-owned");
    } else if (!canAfford) {
      card.classList.add("is-locked");
    }

    const name = document.createElement("strong");
    name.textContent = upgrade.name;

    const cost = document.createElement("span");
    cost.className = "upgrade-cost";
    cost.textContent = owned ? "Owned" : `$${upgrade.cost}`;

    const description = document.createElement("p");
    description.textContent = upgrade.description;

    const effect = document.createElement("small");
    effect.className = "upgrade-effect";
    effect.textContent = upgrade.effectSummary;

    const status = document.createElement("span");
    status.className = "upgrade-status";
    status.textContent = owned ? "Installed" : canAfford ? "Buy" : "Need more money";

    card.append(name, cost, description, effect, status);
    return card;
  }

  private updateOverlay(): void {
    this.settleDuelResultIfNeeded();
    const isBoard = this.state.phase === "intro";

    this.ui.enemyName.textContent = this.getEnemyBadgeText();
    this.ui.bountyBoard.hidden = !isBoard;
    this.ui.phaseLabel.hidden = isBoard;
    this.ui.detail.hidden = isBoard;
    this.ui.phaseLabel.textContent = this.getPhaseText();
    this.ui.phaseLabel.dataset.phase = this.state.result?.outcome ?? this.state.phase;
    this.ui.detail.textContent = this.getDetailText();
    this.ui.result.textContent = this.getResultText();
    this.ui.actionButton.hidden = this.state.phase !== "resolved";
    this.ui.backButton.hidden = this.state.phase !== "resolved";
    this.ui.crosshair.classList.toggle("is-visible", this.state.phase === "draw");
    this.ui.crosshair.classList.toggle("is-hot", this.state.phase === "draw");
    this.viewport.classList.toggle("is-aiming", this.state.phase === "draw");
    this.renderStats();
  }

  private getEnemyBadgeText(): string {
    return `${this.selectedEnemy.name} - $${this.selectedEnemy.reward}`;
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
        return "BOUNTY BOARD";
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
      return `Choose ${this.selectedEnemy.name}.`;
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

  private getUpgradeHelpText(): string {
    if (!this.state.result) {
      return "";
    }

    if (this.lastLuckyCharmTriggered) {
      return "Lucky Charm saved a near loss.";
    }

    const parts: string[] = [];
    const shotResult = this.state.result.stats.shotResult;
    const playerShotResolved =
      shotResult === "torso" || shotResult === "head" || shotResult === "disarm";

    if (playerShotResolved && this.playerStats.shotTimingBonusMs > 0) {
      parts.push(`shot -${Math.round(this.playerStats.shotTimingBonusMs)} ms`);
    }

    if (playerShotResolved && this.playerStats.focusGraceMs > 0) {
      parts.push(`focus +${Math.round(this.playerStats.focusGraceMs)} ms`);
    }

    if (playerShotResolved && this.playerStats.hitZoneScale > 1) {
      const bonus = Math.round((this.playerStats.hitZoneScale - 1) * 100);
      parts.push(`aim +${bonus}%`);
    }

    if (this.playerStats.hitZoneHighlightMs > 0) {
      parts.push("Eagle Eye highlight");
    }

    return parts.join(", ");
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
      ["Enemy Reaction", formatDuration(stats.enemyReactionTimeMs)],
      ["Money Earned", `$${this.lastMoneyEarned}`],
      ["Money", `$${this.progression.money}`]
    ];

    if (stats.styleBonusText) {
      rows.push(["Style Bonus", stats.styleBonusText]);
    }

    const upgradeHelp = this.getUpgradeHelpText();

    if (upgradeHelp) {
      rows.push(["Upgrade Help", upgradeHelp]);
    }

    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "stat-row";

      if (label === "Style Bonus" || label === "Upgrade Help") {
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

function getEnemyById(enemyId: string): EnemyDefinition {
  return ENEMIES.find((enemy) => enemy.id === enemyId) ?? DEFAULT_ENEMY;
}

function appendResultText(currentText: string | undefined, nextText: string): string {
  return currentText ? `${currentText} ${nextText}` : nextText;
}
