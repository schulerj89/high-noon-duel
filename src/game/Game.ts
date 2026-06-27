import * as THREE from "three";
import { AudioManager } from "../audio/AudioManager";
import type { VoiceAudioId } from "../audio/audioManifest";
import { DevPanel, type CopyBalanceReportResult, type DevPanelSnapshot } from "../debug/DevPanel";
import {
  applyPlayerStatsTuning,
  clearTuningOverrides,
  createDefaultTuningOverrides,
  getDrawPauseMaxMs,
  getDrawPauseMinMs,
  getEnemyTuning,
  loadTuningOverrides,
  saveTuningOverrides,
  type EffectiveEnemyTuning,
  type TuningOverrides
} from "../debug/tuning";
import {
  createBalanceReport,
  getPlaytestSummary,
  loadTelemetry,
  recordDuelStarted,
  recordTelemetryDuelResult,
  saveTelemetry,
  type PlaytestTelemetry
} from "../debug/telemetry";
import {
  BOUNTY_CONTRACTS,
  getDefaultBountyContract,
  getDuelModifier,
  type BountyContractDefinition,
  type DuelModifierDefinition
} from "../data/duelModifiers";
import {
  CONDITIONS,
  type ConditionDefinition,
  type ConditionId
} from "../data/conditions";
import { DEFAULT_ENEMY, ENEMIES, type EnemyDefinition } from "../data/enemies";
import { getEnemyBehavior } from "../data/enemyBehaviors";
import { UPGRADES, type UpgradeDefinition, type UpgradeId } from "../data/upgrades";
import { getCameraPresentation } from "../scene/cameraPresentation";
import {
  applyEnvironmentVariant,
  createDustStormParticles
} from "../scene/applyEnvironmentVariant";
import { createEnemy } from "../scene/createEnemy";
import { updateEnemyMaterials } from "../scene/enemyMaterials";
import { resetEnemyRigPose, type EnemyRig } from "../scene/enemyRig";
import { GAME_CONFIG } from "./config";
import {
  deriveDuelRules,
  isWinningShotAllowed,
  type DuelRules
} from "./duelRules";
import {
  createEmptyBehaviorTimeline,
  createEnemyBehaviorTimeline,
  getActiveFakeoutEvent,
  getBehaviorHitZoneScaleMultiplier,
  getBehaviorInfluence,
  hasAimDisruptionStartedBefore,
  hasFakeoutStartedBefore,
  type EnemyBehaviorTimeline
} from "./enemyBehavior";
import {
  clearSavedProgression,
  createDefaultProgression,
  derivePlayerStats,
  formatConditionDuration,
  getActiveConditionDefinitions,
  getOwnedUpgradeNames,
  loadProgression,
  purchaseUpgrade,
  repairCondition,
  rememberSelectedEnemy,
  saveProgression,
  settleDuelProgression,
  type ConditionChange,
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
  type DuelStats,
  type DuelState,
  formatDuration,
  recordPlayerMiss,
  resolveEarlyDraw,
  resolveEnemyShot,
  resolvePlayerHit,
  resolvePlayerMiss,
  resolveRuleViolation,
  startDuel
} from "./state";
import type { DrawAnimationStyle } from "./tells";

interface UiElements {
  overlay: HTMLDivElement;
  phaseLabel: HTMLDivElement;
  detail: HTMLDivElement;
  subtitle: HTMLDivElement;
  subtitleSpeaker: HTMLSpanElement;
  subtitleLine: HTMLSpanElement;
  stats: HTMLDivElement;
  result: HTMLDivElement;
  rewardToast: HTMLDivElement;
  enemyName: HTMLSpanElement;
  bountyBoard: HTMLDivElement;
  actionButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  audioSettingsButton: HTMLButtonElement;
  audioSettingsPanel: HTMLDivElement;
  masterVolumeInput: HTMLInputElement;
  masterVolumeValue: HTMLSpanElement;
  musicVolumeInput: HTMLInputElement;
  musicVolumeValue: HTMLSpanElement;
  sfxVolumeInput: HTMLInputElement;
  sfxVolumeValue: HTMLSpanElement;
  voiceVolumeInput: HTMLInputElement;
  voiceVolumeValue: HTMLSpanElement;
  crosshair: HTMLDivElement;
}

interface VolumeControlElements {
  row: HTMLLabelElement;
  input: HTMLInputElement;
  value: HTMLSpanElement;
}

type Vec3Tuple = [number, number, number];
type BoardMode = "bounties" | "shop";
type DuelLossReason = "enemy was faster" | "missed shot";

interface PlayerShotTiming {
  beatsEnemy: boolean;
  enemyFiredAt: number;
  luckyCharmTriggered: boolean;
}

interface SubtitleState {
  speaker: string;
  line: string;
  expiresAt: number;
  tone: "neutral" | "enemy" | "result";
}

type EnemyDialogueKind = "intro" | "fakeout" | "lose" | "win";

const VOICE_SUBTITLES = {
  ready: "Ready...",
  steady: "Steady...",
  draw: "Draw!",
  tooSoon: "Too soon, partner.",
  cleanShot: "Clean shot.",
  miss: "You missed!",
  enemyFaster: "He beat you to the iron.",
  bountyClaimed: "Bounty claimed.",
  tryAgainPartner: "Try again, partner.",
  disarm: "Disarmed!",
  headshot: "Dead center.",
  welcomeBoard: "Pick your bounty.",
  shopWelcome: "Spend wisely."
} satisfies Record<VoiceAudioId, string>;

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
  private readonly devPanel: DevPanel | null;

  private progression: PlayerProgression = loadProgression();
  private tuning: TuningOverrides = loadTuningOverrides();
  private telemetry: PlaytestTelemetry = loadTelemetry();
  private playerStats: PlayerStats = this.createPlayerStats();
  private state: DuelState = createIntroDuelState(performance.now());
  private timing: CountdownTiming = this.createRoundTiming();
  private selectedContract: BountyContractDefinition = getDefaultBountyContract(
    this.progression.selectedEnemyId
  );
  private selectedEnemy: EnemyDefinition = getEnemyById(this.selectedContract.enemyId);
  private selectedModifier: DuelModifierDefinition = getDuelModifier(
    this.selectedContract.modifierId
  );
  private boardMode: BoardMode = "bounties";
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private enemyReactionMs: number = DEFAULT_ENEMY.reactionTimeMs;
  private enemyFireAt: number | null = null;
  private missLossAt: number | null = null;
  private behaviorTimeline: EnemyBehaviorTimeline = createEmptyBehaviorTimeline(
    getEnemyBehavior(this.selectedEnemy.id),
    performance.now()
  );
  private spokenBehaviorEventIds = new Set<string>();
  private enemyHasFired = false;
  private duelSettled = false;
  private hitBoxesVisible = false;
  private lastMoneyEarned = 0;
  private lastShopMessage = "";
  private lastConditionChanges: ConditionChange[] = [];
  private lastLuckyCharmTriggered = false;
  private lastPlayerShotAt: number | null = null;
  private lastEnemyShotAt: number | null = null;
  private lastMissAt: number | null = null;
  private hitPauseStartedAt: number | null = null;
  private hitPauseUntil = 0;
  private rewardToastText = "";
  private rewardToastUntil = 0;
  private subtitle: SubtitleState | null = null;
  private readonly queuedSubtitleTimers = new Set<number>();
  private enemyRig: EnemyRig | null = null;
  private gunGroup: THREE.Group | null = null;
  private muzzleFlash: THREE.Mesh | null = null;
  private enemyMuzzleFlash: THREE.Mesh | null = null;
  private missDustGroup: THREE.Group | null = null;
  private missDustMaterial: THREE.MeshBasicMaterial | null = null;
  private hemisphereLight: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private sunDisc: THREE.Mesh | null = null;
  private groundMaterial: THREE.MeshStandardMaterial | null = null;
  private streetMaterial: THREE.MeshStandardMaterial | null = null;
  private dustStormGroup: THREE.Group | null = null;

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
    this.devPanel = this.createDevPanel();

    if (this.devPanel) {
      this.viewport.append(this.devPanel.element);
    }

    this.root.append(this.viewport);

    this.buildScene();
    this.renderBountyBoard();
    this.bindEvents();
    this.handleResize();
    this.updateOverlay();
    this.updateMuteButton();
    this.updateAudioSettingsControls();
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
    this.ui.audioSettingsButton.removeEventListener("click", this.handleAudioSettingsButtonClick);
    this.ui.masterVolumeInput.removeEventListener("input", this.handleMasterVolumeInput);
    this.ui.musicVolumeInput.removeEventListener("input", this.handleMusicVolumeInput);
    this.ui.sfxVolumeInput.removeEventListener("input", this.handleSfxVolumeInput);
    this.ui.voiceVolumeInput.removeEventListener("input", this.handleVoiceVolumeInput);
    this.clearQueuedSubtitles();
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
    const hitPauseActive = now < this.hitPauseUntil;
    const visualNow = hitPauseActive && this.hitPauseStartedAt !== null ? this.hitPauseStartedAt : now;
    const visualDelta = hitPauseActive ? 0 : delta;
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
    this.updateScene(visualNow, visualDelta);
    this.updateOverlay(now);
    this.renderer.render(this.scene, this.camera);

    this.animationFrameId = window.requestAnimationFrame(this.tick);
  };

  private readonly startRound = (): void => {
    const now = performance.now();
    this.applyCurrentEnvironment();
    this.timing = this.createRoundTiming();
    this.state = startDuel(now, this.timing);
    this.enemyReactionMs = this.getEffectiveEnemyTuning().reactionTimeMs;
    this.enemyFireAt = null;
    this.missLossAt = null;
    this.behaviorTimeline = this.createBehaviorTimeline(now, this.state.scheduledDrawAt);
    this.spokenBehaviorEventIds.clear();
    this.enemyHasFired = false;
    this.duelSettled = false;
    this.lastMoneyEarned = 0;
    this.lastShopMessage = "";
    this.lastConditionChanges = [];
    this.lastLuckyCharmTriggered = false;
    this.lastPlayerShotAt = null;
    this.lastEnemyShotAt = null;
    this.lastMissAt = null;
    this.hitPauseStartedAt = null;
    this.hitPauseUntil = 0;
    this.rewardToastText = "";
    this.rewardToastUntil = 0;
    this.clearQueuedSubtitles();
    this.clearSubtitle();

    if (this.muzzleFlash) {
      this.muzzleFlash.visible = false;
    }

    if (this.enemyRig) {
      resetEnemyRigPose(this.enemyRig);
    }

    if (this.missDustGroup) {
      this.missDustGroup.visible = false;
    }

    this.updateHitZoneScale();
    this.updateHitBoxVisibility();
    this.telemetry = recordDuelStarted(
      this.telemetry,
      this.selectedEnemy,
      this.selectedModifier.id
    );
    saveTelemetry(this.telemetry);
    this.playDuelStartAudio();
    this.updateOverlay(now);
  };

  private readonly showBountyBoard = (): void => {
    this.boardMode = "bounties";
    this.state = createIntroDuelState(performance.now());
    this.enemyFireAt = null;
    this.missLossAt = null;
    this.behaviorTimeline = createEmptyBehaviorTimeline(getEnemyBehavior(this.selectedEnemy.id), performance.now());
    this.spokenBehaviorEventIds.clear();
    this.enemyHasFired = false;
    this.lastPlayerShotAt = null;
    this.lastEnemyShotAt = null;
    this.lastMissAt = null;
    this.hitPauseStartedAt = null;
    this.hitPauseUntil = 0;
    this.rewardToastText = "";
    this.rewardToastUntil = 0;
    this.clearQueuedSubtitles();
    this.clearSubtitle();

    if (this.enemyRig) {
      resetEnemyRigPose(this.enemyRig);
    }

    this.updateEnemyVisual();
    this.renderBountyBoard();
    this.playBountyBoardAudio();
    this.updateOverlay(performance.now());
  };

  private selectBountyContract(contract: BountyContractDefinition): void {
    this.selectedContract = contract;
    this.selectedEnemy = getEnemyById(contract.enemyId);
    this.selectedModifier = getDuelModifier(contract.modifierId);
    this.progression = rememberSelectedEnemy(this.progression, this.selectedEnemy.id);
    saveProgression(this.progression);
    this.rebuildEnemy();
    this.renderBountyBoard();
    this.applyCurrentEnvironment();
    this.startRound();
  }

  private createRoundTiming(): CountdownTiming {
    const drawPauseMinMs = getDrawPauseMinMs(
      GAME_CONFIG.timing.drawPauseMinMs,
      this.tuning
    );
    const drawPauseMaxMs = getDrawPauseMaxMs(
      GAME_CONFIG.timing.drawPauseMaxMs,
      this.tuning
    );

    return {
      standoffDurationMs: GAME_CONFIG.timing.standoffDurationMs,
      readyDurationMs: GAME_CONFIG.timing.readyDurationMs,
      steadyDurationMs: GAME_CONFIG.timing.steadyDurationMs,
      drawPauseMs: randomRange(drawPauseMinMs, drawPauseMaxMs)
    };
  }

  private createPlayerStats(): PlayerStats {
    return applyPlayerStatsTuning(
      derivePlayerStats(this.progression.ownedUpgrades, this.progression.activeConditions),
      this.tuning
    );
  }

  private getEffectiveEnemyTuning(): EffectiveEnemyTuning {
    return getEnemyTuning(this.selectedEnemy, this.tuning);
  }

  private getDuelRules(): DuelRules {
    return deriveDuelRules(this.selectedEnemy, this.selectedModifier, this.playerStats);
  }

  private getModifierStats(): Partial<DuelStats> {
    const rules = this.getDuelRules();

    return {
      modifierId: rules.modifierId,
      modifierName: rules.modifierName,
      modifierRewardMultiplier: rules.rewardMultiplier,
      modifierResultText: rules.modifierResultText
    };
  }

  private createBehaviorTimeline(roundStartedAt: number, scheduledDrawAt: number): EnemyBehaviorTimeline {
    return createEnemyBehaviorTimeline({
      behavior: getEnemyBehavior(this.selectedEnemy.id),
      roundStartedAt,
      fakeoutStartsAt: roundStartedAt + this.timing.standoffDurationMs,
      scheduledDrawAt,
      fakeoutChance: this.getEffectiveEnemyTuning().fakeoutChance
    });
  }

  private bindEvents(): void {
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerdown", this.handleFirstUserInteraction, true);
    window.addEventListener("keydown", this.handleKeyDown);
    this.ui.actionButton.addEventListener("click", this.handleRestartButtonClick);
    this.ui.backButton.addEventListener("click", this.handleBackButtonClick);
    this.ui.muteButton.addEventListener("click", this.handleMuteButtonClick);
    this.ui.audioSettingsButton.addEventListener("click", this.handleAudioSettingsButtonClick);
    this.ui.masterVolumeInput.addEventListener("input", this.handleMasterVolumeInput);
    this.ui.musicVolumeInput.addEventListener("input", this.handleMusicVolumeInput);
    this.ui.sfxVolumeInput.addEventListener("input", this.handleSfxVolumeInput);
    this.ui.voiceVolumeInput.addEventListener("input", this.handleVoiceVolumeInput);

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.viewport);
  }

  private createDevPanel(): DevPanel | null {
    if (!import.meta.env.DEV) {
      return null;
    }

    return new DevPanel({
      onTuningChange: (overrides) => this.applyTuningOverrides(overrides),
      onRestartDuel: () => this.startRound(),
      onForcePhase: (phase) => this.forceDuelPhase(phase),
      onForcePlayerWin: () => this.forcePlayerWin(),
      onForcePlayerLoss: () => this.forcePlayerLoss(),
      onResetTuning: () => this.resetTuningOverrides(),
      onCopyBalanceReport: () => this.copyBalanceReport()
    });
  }

  private applyTuningOverrides(overrides: TuningOverrides): void {
    this.tuning = overrides;
    saveTuningOverrides(this.tuning);
    this.playerStats = this.createPlayerStats();
    this.enemyReactionMs = this.getEffectiveEnemyTuning().reactionTimeMs;

    if (this.state.phase === "draw") {
      const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
      this.enemyFireAt = getEnemyFireAt(drawAt, this.enemyReactionMs);
    }

    this.updateHitZoneScale();
    this.updateHitBoxVisibility();
    this.updateOverlay();
  }

  private resetTuningOverrides(): void {
    clearTuningOverrides();
    this.applyTuningOverrides(createDefaultTuningOverrides());
  }

  private forceDuelPhase(phase: "ready" | "steady" | "draw"): void {
    const now = performance.now();
    this.timing = this.createRoundTiming();
    this.clearQueuedSubtitles();
    this.clearSubtitle();
    this.duelSettled = false;
    this.enemyHasFired = false;
    this.enemyReactionMs = this.getEffectiveEnemyTuning().reactionTimeMs;
    this.enemyFireAt = null;
    this.missLossAt = null;
    this.lastPlayerShotAt = null;
    this.lastEnemyShotAt = null;
    this.lastMissAt = null;

    if (phase === "ready") {
      this.state = {
        phase,
        roundStartedAt: now - this.timing.standoffDurationMs,
        phaseStartedAt: now,
        scheduledDrawAt:
          now +
          this.timing.readyDurationMs +
          this.timing.steadyDurationMs +
          this.timing.drawPauseMs,
        stats: {}
      };
    } else if (phase === "steady") {
      this.state = {
        phase,
        roundStartedAt:
          now - this.timing.standoffDurationMs - this.timing.readyDurationMs,
        phaseStartedAt: now,
        scheduledDrawAt: now + this.timing.steadyDurationMs + this.timing.drawPauseMs,
        stats: {}
      };
    } else {
      this.state = {
        phase,
        roundStartedAt:
          now -
          this.timing.standoffDurationMs -
          this.timing.readyDurationMs -
          this.timing.steadyDurationMs,
        phaseStartedAt: now,
        scheduledDrawAt: now,
        stats: {
          drawAt: now
        }
      };
      this.enemyFireAt = getEnemyFireAt(now, this.enemyReactionMs);
    }

    this.behaviorTimeline = this.createBehaviorTimeline(this.state.roundStartedAt, this.state.scheduledDrawAt);
    this.spokenBehaviorEventIds.clear();
    this.updateOverlay(now);
  }

  private forcePlayerWin(): void {
    const now = performance.now();
    const drawState = this.createForcedDrawState(now);
    this.duelSettled = false;
    this.enemyHasFired = false;
    this.lastPlayerShotAt = now;
    this.showPlayerMuzzleFlash();
    this.audio.playSfx("bodyHit");
    this.hitPauseStartedAt = now;
    this.hitPauseUntil = now + GAME_CONFIG.timing.hitPauseMs;
    this.state = resolvePlayerHit(
      drawState,
      now,
      { shotResult: "torso" },
      this.enemyReactionMs,
      this.getPlayerShotBehaviorStats(now, "hit")
    );
    this.updateOverlay(now);
  }

  private forcePlayerLoss(): void {
    const now = performance.now();
    const drawState = this.createForcedDrawState(now);
    this.duelSettled = false;
    this.enemyHasFired = true;
    this.lastEnemyShotAt = now;
    this.audio.playSfx("gunshotEnemy");

    if (this.enemyMuzzleFlash) {
      this.enemyMuzzleFlash.visible = true;
    }

    this.state = resolveEnemyShot(
      drawState,
      now,
      "enemy was faster",
      this.getEnemyWinBehaviorStats(now)
    );
    this.updateOverlay(now);
  }

  private createForcedDrawState(now: number): DuelState {
    const drawAt = this.state.stats.drawAt ?? now;
    this.enemyReactionMs = this.getEffectiveEnemyTuning().reactionTimeMs;
    this.enemyFireAt = getEnemyFireAt(drawAt, this.enemyReactionMs);
    this.behaviorTimeline = this.createBehaviorTimeline(this.state.roundStartedAt, drawAt);
    this.spokenBehaviorEventIds.clear();

    return {
      ...this.state,
      phase: "draw",
      phaseStartedAt: drawAt,
      scheduledDrawAt: drawAt,
      stats: {
        ...this.state.stats,
        drawAt
      },
      result: undefined
    };
  }

  private async copyBalanceReport(): Promise<CopyBalanceReportResult> {
    const report = createBalanceReport(
      this.telemetry,
      this.tuning,
      this.progression.ownedUpgrades
    );
    const json = JSON.stringify(report, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      return { copied: true, json };
    } catch {
      return { copied: false, json };
    }
  }

  private updateDevPanel(): void {
    this.devPanel?.update(this.createDevPanelSnapshot());
  }

  private createDevPanelSnapshot(): DevPanelSnapshot {
    const effectiveEnemy = this.getEffectiveEnemyTuning();

    return {
      selectedEnemyId: this.selectedEnemy.id,
      selectedEnemyName: this.selectedEnemy.name,
      phase: this.state.phase,
      tuning: this.tuning,
      effectiveEnemy,
      drawPauseMinMs: getDrawPauseMinMs(GAME_CONFIG.timing.drawPauseMinMs, this.tuning),
      drawPauseMaxMs: getDrawPauseMaxMs(GAME_CONFIG.timing.drawPauseMaxMs, this.tuning),
      playerShotTimingBonusMs: this.tuning.playerShotTimingBonusMs ?? 0,
      focusGraceMs: this.tuning.focusGraceMs ?? 0,
      hitZoneScaleMultiplier: this.tuning.hitZoneScaleMultiplier ?? 1,
      reticleSwayMultiplier: this.tuning.reticleSwayMultiplier ?? 1,
      playtestSummary: getPlaytestSummary(this.telemetry, this.selectedEnemy.id)
    };
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

  private readonly handleAudioSettingsButtonClick = (): void => {
    this.audio.unlock();
    this.audio.playSfx("buttonClick");
    this.setAudioSettingsVisible(this.ui.audioSettingsPanel.hidden);
  };

  private readonly handleMasterVolumeInput = (): void => {
    this.audio.setMasterVolume(this.readSliderVolume(this.ui.masterVolumeInput));
    this.updateAudioSettingsControls();
  };

  private readonly handleMusicVolumeInput = (): void => {
    this.audio.setMusicVolume(this.readSliderVolume(this.ui.musicVolumeInput));
    this.updateAudioSettingsControls();
  };

  private readonly handleSfxVolumeInput = (): void => {
    this.audio.setSfxVolume(this.readSliderVolume(this.ui.sfxVolumeInput));
    this.updateAudioSettingsControls();
  };

  private readonly handleVoiceVolumeInput = (): void => {
    this.audio.setVoiceVolume(this.readSliderVolume(this.ui.voiceVolumeInput));
    this.updateAudioSettingsControls();
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

    if (event.code === "Backquote" || event.code === "F2") {
      event.preventDefault();
      this.devPanel?.toggle();
      this.updateDevPanel();
      return;
    }

    if (isEditableEventTarget(event.target)) {
      return;
    }

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
      this.state = resolveEarlyDraw(this.state, now, this.getEarlyDrawBehaviorStats(now));
      this.updateOverlay();
      return;
    }

    this.lastPlayerShotAt = now;
    this.showPlayerMuzzleFlash();
    this.audio.playSfx("gunshotPlayer");

    const hitZone = this.getHitZoneUnderReticle();
    const baseShotScore = scoreHitZone(hitZone);
    const timing = this.evaluatePlayerShotTiming(now);
    const rules = this.getDuelRules();

    if (baseShotScore.shotResult === "miss") {
      this.lastMissAt = now;
      this.showMissDust();
      this.audio.playSfx("dustImpact");
      this.showSubtitle({
        speaker: "Announcer",
        line: "Shot wide.",
        durationMs: 900,
        tone: "result"
      });

      if (rules.missInstantLoss) {
        this.state = resolvePlayerMiss(
          this.state,
          now,
          baseShotScore,
          this.getPlayerShotBehaviorStats(now, "miss")
        );
        this.updateOverlay();
        return;
      }

      this.state = recordPlayerMiss(
        this.state,
        now,
        baseShotScore,
        this.getPlayerShotBehaviorStats(now, "miss")
      );
      this.missLossAt = getMissPunishFireAt(
        now,
        this.enemyFireAt ?? getEnemyFireAt(this.state.stats.drawAt ?? now, this.enemyReactionMs),
        this.getMissPunishDelayMs()
      );
      this.updateOverlay();
      return;
    }

    if (!isWinningShotAllowed(baseShotScore.shotResult, rules)) {
      this.state = resolveRuleViolation(
        this.state,
        now,
        baseShotScore,
        {
          ...this.getPlayerShotBehaviorStats(now, "hit"),
          behaviorResultText: rules.ruleViolationText ?? rules.modifierResultText
        }
      );
      this.showSubtitle({
        speaker: "Announcer",
        line: rules.ruleViolationText ?? "Bounty terms broken.",
        durationMs: 1300,
        tone: "result"
      });
      this.updateOverlay();
      return;
    }

    if (!timing.beatsEnemy) {
      this.resolveEnemyFire("enemy was faster", timing.enemyFiredAt, this.getEnemyWinBehaviorStats(now));
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
    this.hitPauseStartedAt = now;
    this.hitPauseUntil = now + GAME_CONFIG.timing.hitPauseMs;
    this.state = resolvePlayerHit(
      this.state,
      now,
      shotScore,
      this.enemyReactionMs,
      this.getPlayerShotBehaviorStats(now, "hit")
    );

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
      this.resolveEnemyFire("enemy was faster", this.enemyFireAt, this.getEnemyWinBehaviorStats(now));
      return;
    }

    if (this.state.phase === "missed" && this.missLossAt !== null && now >= this.missLossAt) {
      this.resolveEnemyFire("missed shot", this.missLossAt, this.getEnemyWinBehaviorStats(now));
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
    return Math.max(
      120,
      GAME_CONFIG.timing.missPunishDelayMs +
        (1 - this.getEffectiveEnemyTuning().accuracy) * 360 -
        this.playerStats.missRecoveryPenaltyMs
    );
  }

  private getEarlyDrawBehaviorStats(now: number): Partial<DuelStats> {
    const firedDuringFakeout = getActiveFakeoutEvent(this.behaviorTimeline, now) !== null;

    return {
      ...this.getModifierStats(),
      firedDuringFakeout,
      behaviorResultText: firedDuringFakeout
        ? this.behaviorTimeline.behavior.resultText.fellForFakeout
        : undefined
    };
  }

  private getPlayerShotBehaviorStats(
    now: number,
    shotOutcome: "hit" | "miss"
  ): Partial<DuelStats> {
    const waitedOutFakeout = hasFakeoutStartedBefore(this.behaviorTimeline, now);
    const aimDisrupted = hasAimDisruptionStartedBefore(this.behaviorTimeline, now);
    const rules = this.getDuelRules();
    const behaviorText = this.getBehaviorResultText({
      waitedOutFakeout,
      aimDisrupted,
      shotOutcome
    });

    return {
      ...this.getModifierStats(),
      waitedOutFakeout,
      aimDisrupted,
      behaviorResultText:
        shotOutcome === "miss" && rules.missInstantLoss && rules.modifierResultText
          ? rules.modifierResultText
          : behaviorText
    };
  }

  private getEnemyWinBehaviorStats(now: number): Partial<DuelStats> {
    const waitedOutFakeout =
      this.state.stats.waitedOutFakeout ?? hasFakeoutStartedBefore(this.behaviorTimeline, now);
    const aimDisrupted =
      this.state.stats.aimDisrupted ?? hasAimDisruptionStartedBefore(this.behaviorTimeline, now);

    return {
      ...this.getModifierStats(),
      waitedOutFakeout,
      aimDisrupted,
      behaviorResultText:
        this.state.stats.behaviorResultText ??
        (aimDisrupted
          ? this.behaviorTimeline.behavior.resultText.aimDisrupted
          : this.behaviorTimeline.behavior.resultText.cleanDraw)
    };
  }

  private getBehaviorResultText(input: {
    waitedOutFakeout: boolean;
    aimDisrupted: boolean;
    shotOutcome: "hit" | "miss";
  }): string {
    const resultText = this.behaviorTimeline.behavior.resultText;

    if (input.shotOutcome === "miss" && input.aimDisrupted) {
      return resultText.aimDisrupted;
    }

    if (input.waitedOutFakeout) {
      return resultText.waitedOutFakeout;
    }

    return resultText.cleanDraw;
  }

  private resolveEnemyFire(
    reason: DuelLossReason,
    firedAt: number,
    extraStats: Partial<DuelStats> = {}
  ): void {
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

    this.state = resolveEnemyShot(this.state, firedAt, reason, extraStats);
  }

  private settleDuelResultIfNeeded(): void {
    if (this.duelSettled || this.state.phase !== "resolved" || !this.state.result) {
      return;
    }

    const reward = this.state.result.outcome === "win" ? this.getDuelRules().reward : 0;
    const progressionResult = settleDuelProgression(this.progression, {
      result: this.state.result,
      reward,
      selectedEnemyId: this.selectedEnemy.id,
      modifierId: this.selectedModifier.id
    });

    this.progression = progressionResult.progression;
    this.lastConditionChanges = progressionResult.conditionChanges;
    this.playerStats = this.createPlayerStats();
    this.lastMoneyEarned = reward;
    this.duelSettled = true;
    this.telemetry = recordTelemetryDuelResult(this.telemetry, {
      enemy: this.selectedEnemy,
      result: this.state.result,
      ownedUpgrades: this.progression.ownedUpgrades
    });
    saveProgression(this.progression);
    saveTelemetry(this.telemetry);
    this.updateHitZoneScale();
    this.updateHitBoxVisibility();

    if (reward > 0) {
      this.showRewardToast(reward);
    }

    this.playDuelResultAudio();
    this.renderBountyBoard();
  }

  private buyUpgrade(upgradeId: UpgradeId): void {
    const result = purchaseUpgrade(this.progression, upgradeId);

    if (result.status === "purchased") {
      this.progression = result.progression;
      this.playerStats = this.createPlayerStats();
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

  private repairActiveCondition(conditionId: ConditionId): void {
    const result = repairCondition(this.progression, conditionId);

    if (result.status === "repaired") {
      this.progression = result.progression;
      this.playerStats = this.createPlayerStats();
      this.lastConditionChanges = [result.change];
      this.lastShopMessage = `${result.condition.name} repaired for $${result.condition.repairCost}.`;
      saveProgression(this.progression);
      this.updateHitZoneScale();
      this.updateHitBoxVisibility();
    } else if (result.status === "insufficient-funds" && result.condition) {
      this.lastShopMessage = `Need $${result.condition.repairCost} to repair ${result.condition.name}.`;
    } else if (result.status === "not-repairable" && result.condition) {
      this.lastShopMessage = `${result.condition.name} will pass after more duels.`;
    } else if (result.status === "not-active" && result.condition) {
      this.lastShopMessage = `${result.condition.name} is not active.`;
    } else {
      this.lastShopMessage = "Repair unavailable.";
    }

    this.renderBountyBoard();
    this.updateOverlay();
  }

  private resetProgression(): void {
    if (!window.confirm("Reset money, upgrades, conditions, and duel record?")) {
      return;
    }

    this.audio.playSfx("buttonClick");
    clearSavedProgression();
    this.progression = createDefaultProgression();
    saveProgression(this.progression);
    this.playerStats = this.createPlayerStats();
    this.selectedContract = getDefaultBountyContract(this.progression.selectedEnemyId);
    this.selectedEnemy = getEnemyById(this.selectedContract.enemyId);
    this.selectedModifier = getDuelModifier(this.selectedContract.modifierId);
    this.boardMode = "bounties";
    this.lastMoneyEarned = 0;
    this.lastShopMessage = "Progress reset.";
    this.lastConditionChanges = [];
    this.rebuildEnemy();
    this.renderBountyBoard();
    this.applyCurrentEnvironment();
    this.updateOverlay();
  }

  private handleDuelPhaseAudio(previousPhase: DuelPhase, nextPhase: DuelPhase): void {
    if (previousPhase === nextPhase) {
      return;
    }

    if (nextPhase === "ready") {
      this.playVoiceWithSubtitle("ready");
      return;
    }

    if (nextPhase === "steady") {
      this.playVoiceWithSubtitle("steady");
      return;
    }

    if (nextPhase === "draw") {
      this.playVoiceWithSubtitle("draw", { durationMs: 850 });
      this.audio.playSfx("revolverCock");
    }
  }

  private playBountyBoardAudio(): void {
    this.audio.stopMusic("duelTensionLoop", 450);
    this.audio.stopMusic("victorySting", 100);
    this.audio.stopMusic("defeatSting", 100);
    this.audio.playMusic("bountyBoardLoop", {
      loop: true,
      fadeInMs: 500,
      volume: 1
    });
    this.playVoiceWithSubtitle("welcomeBoard", { speaker: "Bounty Board", durationMs: 1500 });
  }

  private playDuelStartAudio(): void {
    this.audio.stopMusic("bountyBoardLoop", 350);
    this.audio.stopMusic("victorySting", 100);
    this.audio.stopMusic("defeatSting", 100);
    this.audio.playMusic("duelTensionLoop", {
      loop: true,
      fadeInMs: 450,
      volume: 1
    });
    this.audio.playSfx("holsterLeather");
    this.playEnemyDialogue("intro", { durationMs: GAME_CONFIG.timing.standoffDurationMs + 250 });
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
      this.playVoiceWithSubtitle(this.getWinVoiceLineId(), { durationMs: 1450 });
      this.queueEnemyDialogue("lose", 850);
      return;
    }

    this.audio.playMusic("defeatSting", {
      loop: false,
      fadeInMs: 30,
      restart: true,
      volume: 0.95
    });

    if (result.reason === "early draw") {
      this.playVoiceWithSubtitle("tooSoon", { durationMs: 1400 });
      this.queueEnemyDialogue("win", 850);
      return;
    }

    if (result.reason === "missed shot") {
      this.playVoiceWithSubtitle("miss", { durationMs: 1300 });
      this.queueEnemyDialogue("win", 850);
      return;
    }

    if (result.reason === "enemy was faster") {
      this.playVoiceWithSubtitle("enemyFaster", { durationMs: 1500 });
      this.queueEnemyDialogue("win", 850);
      return;
    }

    this.playVoiceWithSubtitle("tryAgainPartner", { durationMs: 1400 });
    this.queueEnemyDialogue("win", 850);
  }

  private playVoiceWithSubtitle(
    id: VoiceAudioId,
    options: { speaker?: string; durationMs?: number } = {}
  ): void {
    this.audio.playVoice(id);
    this.showSubtitle({
      speaker: options.speaker ?? "Announcer",
      line: VOICE_SUBTITLES[id],
      durationMs: options.durationMs ?? 1200,
      tone: "result"
    });
  }

  private playEnemyDialogue(
    kind: EnemyDialogueKind,
    options: { durationMs?: number } = {}
  ): void {
    const lines = this.getEnemyDialogueLines(kind);

    if (lines.length === 0) {
      return;
    }

    const lineIndex = Math.floor(Math.random() * lines.length);
    const line = lines[lineIndex];
    const audioId = `${this.selectedEnemy.id}-${kind}-${lineIndex + 1}`;
    const audioUrl = `/audio/voice/enemies/${audioId}.mp3`;

    this.audio.playVoiceFile(audioId, audioUrl);
    this.showSubtitle({
      speaker: this.selectedEnemy.name,
      line,
      durationMs: options.durationMs ?? 1600,
      tone: "enemy"
    });
  }

  private queueEnemyDialogue(kind: EnemyDialogueKind, delayMs: number): void {
    if (this.getEnemyDialogueLines(kind).length === 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      this.queuedSubtitleTimers.delete(timerId);

      if (this.state.phase === "resolved") {
        this.playEnemyDialogue(kind, { durationMs: 1900 });
      }
    }, delayMs);

    this.queuedSubtitleTimers.add(timerId);
  }

  private getEnemyDialogueLines(kind: EnemyDialogueKind): readonly string[] {
    switch (kind) {
      case "intro":
        return this.selectedEnemy.dialogue.introLines;
      case "fakeout":
        return this.selectedEnemy.dialogue.fakeoutLines ?? [];
      case "lose":
        return this.selectedEnemy.dialogue.loseLines ?? [];
      case "win":
        return this.selectedEnemy.dialogue.winLines ?? [];
    }
  }

  private showSubtitle(input: {
    speaker: string;
    line: string;
    durationMs: number;
    tone: SubtitleState["tone"];
  }): void {
    this.subtitle = {
      speaker: input.speaker,
      line: input.line,
      tone: input.tone,
      expiresAt: performance.now() + input.durationMs
    };
    this.updateSubtitle(performance.now());
  }

  private clearSubtitle(): void {
    this.subtitle = null;
    this.updateSubtitle(performance.now());
  }

  private clearQueuedSubtitles(): void {
    for (const timerId of this.queuedSubtitleTimers) {
      window.clearTimeout(timerId);
    }

    this.queuedSubtitleTimers.clear();
  }

  private updateSubtitle(now: number): void {
    if (this.subtitle && now >= this.subtitle.expiresAt) {
      this.subtitle = null;
    }

    const subtitle = this.subtitle;
    this.ui.subtitle.hidden = subtitle === null;
    this.ui.subtitle.classList.toggle("is-visible", subtitle !== null);

    if (!subtitle) {
      this.ui.subtitleSpeaker.textContent = "";
      this.ui.subtitleLine.textContent = "";
      this.ui.subtitle.dataset.tone = "neutral";
      return;
    }

    this.ui.subtitleSpeaker.textContent = `${subtitle.speaker}:`;
    this.ui.subtitleLine.textContent = subtitle.line;
    this.ui.subtitle.dataset.tone = subtitle.tone;
  }

  private showRewardToast(reward: number): void {
    this.rewardToastText = `+$${reward} bounty claimed`;
    this.rewardToastUntil = performance.now() + 1700;
    this.updateRewardToast(performance.now());
  }

  private updateRewardToast(now: number): void {
    const visible = this.rewardToastText !== "" && now < this.rewardToastUntil;

    this.ui.rewardToast.hidden = !visible;
    this.ui.rewardToast.classList.toggle("is-visible", visible);

    if (visible) {
      this.ui.rewardToast.textContent = this.rewardToastText;
      return;
    }

    this.ui.rewardToast.textContent = "";
  }

  private updateMuteButton(): void {
    const muted = this.audio.isMuted();
    this.ui.muteButton.textContent = muted ? "Audio Off" : "Audio On";
    this.ui.muteButton.setAttribute("aria-pressed", String(muted));
  }

  private updateAudioSettingsControls(): void {
    const preferences = this.audio.getPreferences();

    this.setVolumeControlValue(this.ui.masterVolumeInput, this.ui.masterVolumeValue, preferences.masterVolume);
    this.setVolumeControlValue(this.ui.musicVolumeInput, this.ui.musicVolumeValue, preferences.musicVolume);
    this.setVolumeControlValue(this.ui.sfxVolumeInput, this.ui.sfxVolumeValue, preferences.sfxVolume);
    this.setVolumeControlValue(this.ui.voiceVolumeInput, this.ui.voiceVolumeValue, preferences.voiceVolume);
  }

  private setVolumeControlValue(
    input: HTMLInputElement,
    valueLabel: HTMLSpanElement,
    value: number
  ): void {
    const percent = Math.round(value * 100);

    input.value = String(percent);
    valueLabel.textContent = `${percent}%`;
  }

  private readSliderVolume(input: HTMLInputElement): number {
    const value = Number(input.value);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value / 100)) : 0;
  }

  private setAudioSettingsVisible(visible: boolean): void {
    this.ui.audioSettingsPanel.hidden = !visible;
    this.ui.audioSettingsButton.setAttribute("aria-expanded", String(visible));
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
    this.missDustGroup.scale.setScalar(0.7);
    this.missDustGroup.visible = true;
    this.missDustMaterial.opacity = 0.82;
  }

  private updateScene(now: number, delta: number): void {
    this.updateCamera(now);
    this.updateEnemyPose(delta);
    this.updateFakeoutDialogue(now);
    this.updateGunPose(now);
    this.updateFlash(this.muzzleFlash, this.lastPlayerShotAt, now);
    this.updateFlash(this.enemyMuzzleFlash, this.lastEnemyShotAt, now);
    this.updateMissDust(now);
    this.updateEnvironmentEffects(now);
    this.updateHitZoneScale();
    this.updateHitBoxVisibility();
  }

  private updateEnvironmentEffects(now: number): void {
    if (!this.dustStormGroup || !this.dustStormGroup.visible) {
      return;
    }

    this.dustStormGroup.position.x = Math.sin(now * 0.0007) * 0.16;
    this.dustStormGroup.position.z = Math.sin(now * 0.0005) * 0.08;
    this.dustStormGroup.rotation.y = Math.sin(now * 0.00035) * 0.025;
  }

  private updateFakeoutDialogue(now: number): void {
    if (this.state.phase === "draw" || this.state.phase === "missed" || this.state.phase === "resolved") {
      return;
    }

    const fakeout = getActiveFakeoutEvent(this.behaviorTimeline, now);

    if (!fakeout || this.spokenBehaviorEventIds.has(fakeout.id)) {
      return;
    }

    this.spokenBehaviorEventIds.add(fakeout.id);

    if (fakeout.subtitleLine) {
      this.showSubtitle({
        speaker: this.selectedEnemy.name,
        line: fakeout.subtitleLine,
        durationMs: 1100,
        tone: "enemy"
      });
      return;
    }

    this.playEnemyDialogue("fakeout", { durationMs: 1200 });
  }

  private updateCamera(now: number): void {
    const [baseX, baseY, baseZ] = GAME_CONFIG.camera.position;
    const rules = this.getDuelRules();
    const lastShotAt = Math.max(this.lastPlayerShotAt ?? 0, this.lastEnemyShotAt ?? 0);
    const presentation = getCameraPresentation({
      phase: this.state.phase,
      outcome: this.state.result?.outcome,
      now,
      roundStartedAt: this.state.roundStartedAt,
      scheduledDrawAt: this.state.scheduledDrawAt,
      lastShotAt: lastShotAt > 0 ? lastShotAt : undefined,
      hitPauseActive: now < this.hitPauseUntil
    });
    const shakeAge = lastShotAt > 0 ? now - lastShotAt : Number.POSITIVE_INFINITY;
    const shakeMultiplier =
      shakeAge >= 0 && shakeAge <= 220 ? this.playerStats.cameraShakeMultiplier : 1;

    this.camera.position.set(
      baseX + presentation.positionOffset[0] * shakeMultiplier,
      baseY + presentation.positionOffset[1] * shakeMultiplier,
      baseZ + presentation.positionOffset[2] + rules.cameraDistanceOffsetZ
    );
    this.camera.fov = GAME_CONFIG.camera.fov + presentation.fovOffset + rules.cameraFovOffset;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(
      GAME_CONFIG.camera.lookAt[0] + presentation.lookAtOffset[0],
      GAME_CONFIG.camera.lookAt[1] + presentation.lookAtOffset[1],
      GAME_CONFIG.camera.lookAt[2] + presentation.lookAtOffset[2] + rules.enemyDistanceOffsetZ * 0.18
    );
  }

  private updateEnemyPose(delta: number): void {
    if (!this.enemyRig) {
      return;
    }

    const rig = this.enemyRig;
    const ease = 1 - Math.exp(-delta * 12);
    const now = performance.now();
    const motion = this.selectedEnemy.visual.motion;
    const base = rig.basePose;
    const isEnemyDrawing = this.state.phase === "draw" || this.state.phase === "missed";
    const playerWon = this.state.result?.outcome === "win";
    const playerLost = this.state.result?.outcome === "loss";
    const disarmed = playerWon && this.state.result?.stats.shotResult === "disarm";
    const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
    const drawElapsed = Math.max(0, now - drawAt);
    const drawProgress = isEnemyDrawing
      ? THREE.MathUtils.clamp(drawElapsed / Math.max(1, this.enemyReactionMs), 0, 1)
      : 0;
    const idlePhase = now * 0.004;
    const idleEnabled = this.state.phase !== "resolved" || playerWon;
    const behaviorInfluence = getBehaviorInfluence(this.behaviorTimeline, now, idleEnabled);
    const tell = behaviorInfluence.intensities;
    const stillness = THREE.MathUtils.clamp(Math.abs(tell.stillness), 0, 1);
    const idleSway = idleEnabled ? Math.sin(idlePhase) * motion.idleSway * (1 - stillness * 0.9) : 0;
    const idleLeanOffset = (tell.leanRight - tell.leanLeft) * 0.08;
    const targetLean =
      (isEnemyDrawing ? this.selectedEnemy.visual.drawLeanDistance : 0) +
      behaviorInfluence.leanOffset +
      idleLeanOffset;
    const rootSlump = playerWon ? motion.hitSlump : 0;

    rig.root.position.x = THREE.MathUtils.lerp(
      rig.root.position.x,
      base.root.position[0] + targetLean + idleSway,
      ease
    );
    rig.root.position.y = THREE.MathUtils.lerp(
      rig.root.position.y,
      base.root.position[1] - rootSlump * 0.1,
      ease
    );
    rig.root.position.z = THREE.MathUtils.lerp(
      rig.root.position.z,
      base.root.position[2] + this.getDuelRules().enemyDistanceOffsetZ,
      ease
    );
    rig.root.rotation.y = THREE.MathUtils.lerp(
      rig.root.rotation.y,
      base.root.rotation[1] + tell.coatShift * 0.08,
      ease
    );
    rig.root.rotation.z = THREE.MathUtils.lerp(
      rig.root.rotation.z,
      base.root.rotation[2] - rootSlump + (tell.leanLeft - tell.leanRight) * 0.06,
      ease
    );

    rig.torso.rotation.x = THREE.MathUtils.lerp(
      rig.torso.rotation.x,
      base.torso.rotation[0] + (playerWon ? 0.28 : 0),
      ease
    );
    rig.head.rotation.x = THREE.MathUtils.lerp(
      rig.head.rotation.x,
      base.head.rotation[0] - (playerWon ? 0.18 : 0),
      ease
    );
    rig.head.rotation.y = THREE.MathUtils.lerp(
      rig.head.rotation.y,
      base.head.rotation[1] + tell.eyeGlance * 0.24,
      ease
    );
    rig.shoulders.rotation.z = THREE.MathUtils.lerp(
      rig.shoulders.rotation.z,
      base.shoulders.rotation[2] -
        (behaviorInfluence.fakeoutIntensity + Math.abs(tell.shoulderDrop)) * motion.shoulderTwitch,
      ease
    );

    let upperArmTarget = base.rightUpperArm.rotation[2];
    let forearmTarget = base.rightForearm.rotation[2];
    let handTargetX = base.rightHand.position[0];
    let handTargetZ = base.rightHand.position[2];
    let handTwistTarget = base.rightHand.rotation[2];
    let gunKickTarget = base.gun.rotation[0];
    const handTell = tell.handTwitch;
    const holsterTap = Math.max(0, tell.holsterTap);
    const fakeoutIntensity = behaviorInfluence.fakeoutIntensity;
    const realDrawTellIntensity = behaviorInfluence.realDrawTellIntensity;

    if (
      fakeoutIntensity > 0 ||
      realDrawTellIntensity > 0 ||
      Math.abs(handTell) > 0.01 ||
      holsterTap > 0.01
    ) {
      const twitch =
        Math.sin(now * 0.08) *
        motion.handTwitch *
        (fakeoutIntensity + realDrawTellIntensity + Math.abs(handTell));
      upperArmTarget -= motion.shoulderTwitch * (fakeoutIntensity + realDrawTellIntensity * 0.55);
      forearmTarget -=
        0.35 * fakeoutIntensity +
        0.22 * realDrawTellIntensity +
        0.18 * holsterTap +
        motion.handTwitch;
      handTargetX += twitch + handTell * 0.05;
      handTargetZ += 0.05 * fakeoutIntensity;
      handTargetZ += 0.07 * holsterTap + 0.04 * realDrawTellIntensity;
      handTwistTarget += 0.18 * realDrawTellIntensity;
    }

    if (isEnemyDrawing) {
      const drawTarget = getDrawPoseTarget(
        this.behaviorTimeline.behavior.drawAnimation.style,
        this.behaviorTimeline.behavior.drawAnimation.commitment
      );
      upperArmTarget = THREE.MathUtils.lerp(
        base.rightUpperArm.rotation[2],
        drawTarget.upperArmZ,
        drawProgress
      );
      forearmTarget = THREE.MathUtils.lerp(
        base.rightForearm.rotation[2],
        drawTarget.forearmZ,
        drawProgress
      );
      handTargetX += drawTarget.handOffsetX * drawProgress;
      handTargetZ += drawTarget.handForward * drawProgress;
    }

    if (this.enemyHasFired || playerLost) {
      upperArmTarget = -0.55;
      forearmTarget = -1.18;
      gunKickTarget = base.gun.rotation[0] - 0.18;
    }

    if (disarmed) {
      upperArmTarget = base.rightUpperArm.rotation[2] + 0.32;
      forearmTarget = base.rightForearm.rotation[2] + motion.disarmJerk;
      handTargetX += 0.2;
      handTargetZ -= 0.18;
      handTwistTarget += 0.75;
      gunKickTarget += 0.7;
    } else if (playerWon) {
      forearmTarget = base.rightForearm.rotation[2] + motion.disarmJerk * 0.2;
    }

    rig.rightUpperArm.rotation.z = THREE.MathUtils.lerp(rig.rightUpperArm.rotation.z, upperArmTarget, ease);
    rig.rightForearm.rotation.z = THREE.MathUtils.lerp(rig.rightForearm.rotation.z, forearmTarget, ease);
    rig.rightHand.position.x = THREE.MathUtils.lerp(rig.rightHand.position.x, handTargetX, ease);
    rig.rightHand.position.z = THREE.MathUtils.lerp(rig.rightHand.position.z, handTargetZ, ease);
    rig.rightHand.rotation.z = THREE.MathUtils.lerp(rig.rightHand.rotation.z, handTwistTarget, ease);
    rig.gun.rotation.x = THREE.MathUtils.lerp(rig.gun.rotation.x, gunKickTarget, ease);
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
      const flashProgress = 1 - age / GAME_CONFIG.timing.muzzleFlashMs;
      const scale = 1 + flashProgress * 1.55;
      mesh.scale.setScalar(scale);

      const material = mesh.material;
      const opacity = 0.35 + flashProgress * 0.65;

      if (Array.isArray(material)) {
        for (const item of material) {
          item.opacity = opacity;
        }
      } else {
        material.opacity = opacity;
      }
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
    this.missDustGroup.scale.setScalar(0.7 + progress * 1.65);
    this.missDustMaterial.opacity = (1 - progress) * 0.82;
  }

  private buildScene(): void {
    this.addLighting();
    this.addGround();
    this.addTown();
    this.addEnemy();
    this.addGun();
    this.addMissDust();
    this.addEnvironmentEffects();
    this.applyCurrentEnvironment();
  }

  private addLighting(): void {
    const hemiLight = new THREE.HemisphereLight("#ffe7ba", "#70492c", 1.6);
    this.scene.add(hemiLight);
    this.hemisphereLight = hemiLight;

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
    this.sunLight = sun;

    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 32),
      new THREE.MeshBasicMaterial({ color: "#ffe2a0" })
    );
    sunDisc.position.set(-5.5, 5.6, -9);
    sunDisc.lookAt(this.camera.position);
    this.scene.add(sunDisc);
    this.sunDisc = sunDisc;
  }

  private addGround(): void {
    const groundMaterial = new THREE.MeshStandardMaterial({ color: "#c98542", roughness: 0.95 });
    const streetMaterial = new THREE.MeshStandardMaterial({ color: "#8b5a37", roughness: 1 });
    this.groundMaterial = groundMaterial;
    this.streetMaterial = streetMaterial;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 26),
      groundMaterial
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -4;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const street = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 22),
      streetMaterial
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

  private addEnvironmentEffects(): void {
    const dustStormGroup = createDustStormParticles();
    this.scene.add(dustStormGroup);
    this.dustStormGroup = dustStormGroup;
  }

  private applyCurrentEnvironment(): void {
    const rules = this.getDuelRules();

    applyEnvironmentVariant(rules.environmentVariant, {
      scene: this.scene,
      hemisphereLight: this.hemisphereLight,
      sunLight: this.sunLight,
      sunDisc: this.sunDisc,
      groundMaterial: this.groundMaterial,
      streetMaterial: this.streetMaterial,
      dustStormGroup: this.dustStormGroup
    });

    this.viewport.dataset.environment = rules.environmentVariant;
    this.viewport.dataset.modifier = rules.modifierId;
    this.updateEnemyVisual();
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
    const rig = createEnemy(this.selectedEnemy);

    this.enemyRig = rig;
    this.enemyMuzzleFlash = rig.muzzleFlash;
    this.addHitZones(rig);
    this.scene.add(rig.root);
    this.updateEnemyVisual();
  }

  private updateEnemyVisual(): void {
    if (!this.enemyRig) {
      return;
    }

    updateEnemyMaterials(this.enemyRig.materials, this.selectedEnemy);

    if (this.state.phase === "intro") {
      this.enemyRig.root.scale.setScalar(this.selectedEnemy.visual.scale);
    }
  }

  private rebuildEnemy(): void {
    this.clearHitZones();

    if (this.enemyRig) {
      this.scene.remove(this.enemyRig.root);
      this.disposeObject(this.enemyRig.root);
    }

    this.enemyRig = null;
    this.enemyMuzzleFlash = null;
    this.addEnemy();
  }

  private clearHitZones(): void {
    for (const mesh of this.hitZoneMeshes) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      this.disposeMaterial(mesh.material);
    }

    this.hitZoneMeshes.length = 0;
    this.hitZoneByMesh.clear();
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        this.disposeMaterial(child.material);
      }
    });
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      for (const item of material) {
        item.dispose();
      }
      return;
    }

    material.dispose();
  }

  private addHitZones(rig: EnemyRig): void {
    for (const definition of HIT_ZONE_DEFINITIONS) {
      const mesh = this.createHitZoneMesh(definition);
      const parent = this.getHitZoneParent(definition.parent, rig);

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
    rig: EnemyRig
  ): THREE.Group {
    switch (parent) {
      case "torso":
        return rig.torso;
      case "head":
        return rig.head;
      case "rightHand":
        return rig.rightHand;
    }
  }

  private updateHitBoxVisibility(): void {
    const isEagleEyeActive = this.isEagleEyeHighlightActive();
    const rules = this.getDuelRules();
    const canShowHitZones =
      !rules.hideHitZonesUnlessEagleEye ||
      (rules.eagleEyeCanRevealHitZones && isEagleEyeActive);

    for (const mesh of this.hitZoneMeshes) {
      const material = mesh.material;
      const opacity = canShowHitZones
        ? this.hitBoxesVisible
          ? 0.68
          : isEagleEyeActive
            ? 0.28
            : 0
        : 0;

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
    const behaviorScale = getBehaviorHitZoneScaleMultiplier(
      this.behaviorTimeline,
      performance.now()
    );
    const rules = this.getDuelRules();

    for (const mesh of this.hitZoneMeshes) {
      mesh.scale.setScalar(
        this.playerStats.hitZoneScale * behaviorScale * rules.hitZoneScaleMultiplier
      );
    }
  }

  private isEagleEyeHighlightActive(): boolean {
    if (this.playerStats.hitZoneHighlightMs <= 0 || this.state.phase !== "draw") {
      return false;
    }

    const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
    return performance.now() - drawAt <= this.playerStats.hitZoneHighlightMs;
  }

  private isReticleReady(now = performance.now()): boolean {
    if (this.playerStats.reticleDelayMs <= 0 || this.state.phase !== "draw") {
      return true;
    }

    const drawAt = this.state.stats.drawAt ?? this.state.scheduledDrawAt;
    return now - drawAt >= this.playerStats.reticleDelayMs;
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

    const audioSettingsButton = document.createElement("button");
    audioSettingsButton.className = "audio-settings-button";
    audioSettingsButton.type = "button";
    audioSettingsButton.textContent = "Volume";
    audioSettingsButton.setAttribute("aria-expanded", "false");

    const audioSettingsPanel = document.createElement("div");
    audioSettingsPanel.className = "audio-settings-panel";
    audioSettingsPanel.hidden = true;

    const audioPreferences = this.audio.getPreferences();
    const masterVolume = this.createVolumeControl("Master", audioPreferences.masterVolume);
    const musicVolume = this.createVolumeControl("Music", audioPreferences.musicVolume);
    const sfxVolume = this.createVolumeControl("SFX", audioPreferences.sfxVolume);
    const voiceVolume = this.createVolumeControl("Voice", audioPreferences.voiceVolume);
    audioSettingsPanel.append(
      masterVolume.row,
      musicVolume.row,
      sfxVolume.row,
      voiceVolume.row
    );

    const audioControls = document.createElement("div");
    audioControls.className = "audio-controls";
    audioControls.append(muteButton, audioSettingsButton, audioSettingsPanel);

    const topStatus = document.createElement("div");
    topStatus.className = "top-status";
    topStatus.append(enemyBadge, audioControls);

    topBar.append(title, topStatus);

    const bountyBoard = document.createElement("div");
    bountyBoard.className = "bounty-board";

    const phaseLabel = document.createElement("div");
    phaseLabel.className = "phase-label";

    const detail = document.createElement("div");
    detail.className = "phase-detail";

    const subtitle = document.createElement("div");
    subtitle.className = "subtitle-strip";
    subtitle.hidden = true;

    const subtitleSpeaker = document.createElement("span");
    subtitleSpeaker.className = "subtitle-speaker";

    const subtitleLine = document.createElement("span");
    subtitleLine.className = "subtitle-line";

    subtitle.append(subtitleSpeaker, subtitleLine);

    const stats = document.createElement("div");
    stats.className = "stats-panel";

    const result = document.createElement("div");
    result.className = "result-copy";

    const rewardToast = document.createElement("div");
    rewardToast.className = "reward-toast";
    rewardToast.hidden = true;

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

    overlay.append(
      topBar,
      bountyBoard,
      phaseLabel,
      detail,
      subtitle,
      stats,
      result,
      actions,
      rewardToast,
      crosshair
    );

    return {
      overlay,
      phaseLabel,
      detail,
      subtitle,
      subtitleSpeaker,
      subtitleLine,
      stats,
      result,
      rewardToast,
      enemyName,
      bountyBoard,
      actionButton,
      backButton,
      muteButton,
      audioSettingsButton,
      audioSettingsPanel,
      masterVolumeInput: masterVolume.input,
      masterVolumeValue: masterVolume.value,
      musicVolumeInput: musicVolume.input,
      musicVolumeValue: musicVolume.value,
      sfxVolumeInput: sfxVolume.input,
      sfxVolumeValue: sfxVolume.value,
      voiceVolumeInput: voiceVolume.input,
      voiceVolumeValue: voiceVolume.value,
      crosshair
    };
  }

  private createVolumeControl(label: string, value: number): VolumeControlElements {
    const row = document.createElement("label");
    row.className = "volume-control";

    const labelText = document.createElement("span");
    labelText.className = "volume-label";
    labelText.textContent = label;

    const input = document.createElement("input");
    input.className = "volume-slider";
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(Math.round(value * 100));

    const valueText = document.createElement("span");
    valueText.className = "volume-value";
    valueText.textContent = `${Math.round(value * 100)}%`;

    row.append(labelText, input, valueText);

    return {
      row,
      input,
      value: valueText
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

    for (const contract of BOUNTY_CONTRACTS) {
      list.append(this.createBountyPoster(contract));
    }

    this.ui.bountyBoard.append(heading, progressSummary, list);
  }

  private createBountyPoster(contract: BountyContractDefinition): HTMLButtonElement {
    const enemy = getEnemyById(contract.enemyId);
    const modifier = getDuelModifier(contract.modifierId);
    const rules = deriveDuelRules(enemy, modifier, this.playerStats);
    const card = document.createElement("button");
    card.className = "bounty-card";
    card.type = "button";
    card.dataset.enemyId = enemy.id;
    card.dataset.contractId = contract.id;
    card.dataset.modifierId = modifier.id;
    card.style.setProperty("--poster-rotate", `${enemy.portrait.boardRotationDeg}deg`);
    card.style.setProperty("--poster-offset-y", `${enemy.portrait.boardOffsetY}px`);
    card.style.setProperty("--poster-paper", enemy.portrait.palette.paperTint);
    card.style.setProperty("--poster-ink", enemy.portrait.palette.ink);
    card.style.setProperty("--poster-shadow", enemy.portrait.palette.shadow);
    card.style.setProperty("--poster-accent", enemy.portrait.palette.accent);
    card.classList.toggle("is-selected", contract.id === this.selectedContract.id);
    card.setAttribute(
      "aria-label",
      `Wanted poster for ${enemy.name}, ${enemy.title}, ${modifier.name}, reward $${rules.reward}`
    );
    card.addEventListener("click", () => {
      this.audio.playSfx("posterPaper");
      this.selectBountyContract(contract);
    });

    const pin = document.createElement("span");
    pin.className = "poster-pin";

    const wanted = document.createElement("span");
    wanted.className = "poster-wanted";
    wanted.textContent = "WANTED";

    const portrait = this.createEnemyPortrait(enemy);

    const name = document.createElement("strong");
    name.className = "poster-name";
    name.textContent = enemy.name;

    const titleEl = document.createElement("span");
    titleEl.className = "bounty-title";
    titleEl.textContent = enemy.title;

    const meta = document.createElement("span");
    meta.className = "bounty-meta";
    meta.textContent = `${enemy.difficultyHint} - reward $${rules.reward}`;

    const modifierEl = document.createElement("span");
    modifierEl.className = "poster-modifier";
    modifierEl.textContent =
      `${modifier.name} - ${modifier.difficulty} - x${modifier.rewardMultiplier.toFixed(2)}`;

    const description = document.createElement("p");
    description.className = "poster-description";
    description.textContent = enemy.description;

    const modifierDescription = document.createElement("p");
    modifierDescription.className = "poster-modifier-description";
    modifierDescription.textContent = modifier.description;

    const tell = document.createElement("small");
    tell.className = "poster-tell";
    tell.textContent = enemy.preferredTell;

    card.append(
      pin,
      wanted,
      portrait,
      name,
      titleEl,
      meta,
      modifierEl,
      description,
      modifierDescription,
      tell
    );
    return card;
  }

  private createEnemyPortrait(enemy: EnemyDefinition): HTMLSpanElement {
    const portrait = document.createElement("span");
    portrait.className = "poster-portrait";
    portrait.style.setProperty("--portrait-ink", enemy.portrait.palette.ink);
    portrait.style.setProperty("--portrait-shadow", enemy.portrait.palette.shadow);
    portrait.style.setProperty("--portrait-accent", enemy.portrait.palette.accent);
    portrait.style.setProperty("--portrait-hat", enemy.portrait.palette.hat);
    portrait.style.setProperty("--portrait-coat", enemy.portrait.palette.coat);
    portrait.style.setProperty("--portrait-skin", enemy.portrait.palette.skin);

    const fallback = this.createProceduralPortrait(enemy);

    const image = document.createElement("img");
    image.className = "poster-portrait-image";
    image.src = enemy.portrait.imageUrl;
    image.alt = `${enemy.name} portrait`;
    image.decoding = "async";
    image.loading = "eager";
    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
        portrait.classList.add("is-fallback-active");
      },
      { once: true }
    );

    portrait.append(fallback, image);
    return portrait;
  }

  private createProceduralPortrait(enemy: EnemyDefinition): HTMLSpanElement {
    const fallback = document.createElement("span");
    fallback.className = "poster-portrait-fallback";
    fallback.dataset.hat = enemy.portrait.procedural.hatType;
    fallback.dataset.body = enemy.portrait.procedural.bodyShape;
    fallback.dataset.face = enemy.portrait.procedural.faceShape;
    fallback.setAttribute("aria-hidden", "true");

    const parts = [
      "portrait-halo",
      "portrait-body",
      "portrait-coat",
      "portrait-poncho",
      "portrait-neck",
      "portrait-face",
      "portrait-eyes",
      "portrait-bandana",
      "portrait-scar",
      "portrait-eye-patch",
      "portrait-hat"
    ];

    for (const className of parts) {
      const part = document.createElement("span");
      part.className = className;

      if (className === "portrait-coat") {
        part.hidden = !enemy.portrait.procedural.hasCoat;
      }

      if (className === "portrait-poncho") {
        part.hidden = !enemy.portrait.procedural.hasPoncho;
      }

      if (className === "portrait-bandana") {
        part.hidden = !enemy.portrait.procedural.hasBandana;
      }

      if (className === "portrait-scar") {
        part.hidden = !enemy.portrait.procedural.hasScar;
      }

      if (className === "portrait-eye-patch") {
        part.hidden = !enemy.portrait.procedural.hasEyePatch;
      }

      fallback.append(part);
    }

    return fallback;
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
      this.playVoiceWithSubtitle(mode === "shop" ? "shopWelcome" : "welcomeBoard", {
        speaker: mode === "shop" ? "Shopkeeper" : "Bounty Board",
        durationMs: 1500
      });
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
    const conditions = this.createProgressCard("Conditions", this.getActiveConditionSummaryText());
    conditions.classList.add("active-conditions");

    summary.append(money, record, owned, conditions);

    const conditionMessage = this.getConditionChangeSummaryText();

    if (this.lastShopMessage || conditionMessage) {
      const message = document.createElement("div");
      message.className = "shop-message";
      message.textContent = [this.lastShopMessage, conditionMessage]
        .filter((text) => text.length > 0)
        .join(" ");
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

  private getActiveConditionSummaryText(): string {
    if (this.progression.activeConditions.length === 0) {
      return "None";
    }

    return this.progression.activeConditions
      .map((active) => {
        const condition = CONDITIONS.find((item) => item.id === active.id);
        return condition
          ? `${condition.name} (${formatConditionDuration(active)})`
          : undefined;
      })
      .filter((text): text is string => text !== undefined)
      .join(", ");
  }

  private getConditionChangeSummaryText(): string {
    return this.lastConditionChanges.map((change) => change.message).join(" ");
  }

  private createShopList(): HTMLDivElement {
    const list = document.createElement("div");
    list.className = "shop-list";

    for (const upgrade of UPGRADES) {
      list.append(this.createUpgradeCard(upgrade));
    }

    for (const condition of getActiveConditionDefinitions(this.progression.activeConditions)) {
      if (condition.repairCost !== undefined) {
        list.append(this.createRepairCard(condition));
      }
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

  private createRepairCard(condition: ConditionDefinition): HTMLButtonElement {
    const active = this.progression.activeConditions.find((item) => item.id === condition.id);
    const repairCost = condition.repairCost ?? 0;
    const canAfford = this.progression.money >= repairCost;
    const card = document.createElement("button");
    card.className = "upgrade-card repair-card";
    card.type = "button";
    card.dataset.conditionId = condition.id;
    card.disabled = !canAfford;
    card.addEventListener("click", () => {
      this.audio.playSfx("buttonClick");
      this.repairActiveCondition(condition.id);
    });

    if (!canAfford) {
      card.classList.add("is-locked");
    }

    const name = document.createElement("strong");
    name.textContent = `${condition.repairType === "gunsmith" ? "Gunsmith" : "Doctor"}: ${condition.name}`;

    const cost = document.createElement("span");
    cost.className = "upgrade-cost";
    cost.textContent = `$${repairCost}`;

    const description = document.createElement("p");
    description.textContent = `${condition.uiText} ${
      active ? `Remaining: ${formatConditionDuration(active)}.` : ""
    }`;

    const effect = document.createElement("small");
    effect.className = "upgrade-effect";
    effect.textContent = condition.effectSummary;

    const status = document.createElement("span");
    status.className = "upgrade-status";
    status.textContent = canAfford ? "Repair" : "Need more money";

    card.append(name, cost, description, effect, status);
    return card;
  }

  private updateOverlay(now = performance.now()): void {
    this.settleDuelResultIfNeeded();
    const isBoard = this.state.phase === "intro";
    const isWin = this.state.result?.outcome === "win";
    const isLoss = this.state.result?.outcome === "loss";
    const shotResult = this.state.result?.stats.shotResult;
    const resultText = this.getResultText();
    const rules = this.getDuelRules();
    const showReticle = this.state.phase === "draw" && rules.showReticle && this.isReticleReady(now);

    this.ui.enemyName.textContent = this.getEnemyBadgeText();
    this.ui.bountyBoard.hidden = !isBoard;
    this.ui.phaseLabel.hidden = isBoard;
    this.ui.detail.hidden = isBoard;
    this.ui.phaseLabel.textContent = this.getPhaseText();
    this.ui.phaseLabel.dataset.phase = this.state.result?.outcome ?? this.state.phase;
    this.ui.detail.dataset.tone = isLoss ? "loss" : isWin ? "win" : "neutral";
    this.ui.detail.textContent = this.getDetailText();
    this.ui.result.textContent = resultText;
    this.ui.result.classList.toggle("is-visible", resultText !== "");
    this.ui.result.classList.toggle("is-win", isWin);
    this.ui.result.classList.toggle("is-loss", isLoss);
    this.ui.result.classList.toggle("is-disarm", shotResult === "disarm");
    this.ui.actionButton.hidden = this.state.phase !== "resolved";
    this.ui.backButton.hidden = this.state.phase !== "resolved";
    this.ui.crosshair.classList.toggle("is-visible", showReticle);
    this.ui.crosshair.classList.toggle("is-hot", showReticle);
    this.viewport.classList.toggle("is-aiming", this.state.phase === "draw");
    this.viewport.classList.toggle("is-dueling", !isBoard);
    this.viewport.classList.toggle("is-hit-pause", now < this.hitPauseUntil);
    this.updateSubtitle(now);
    this.updateRewardToast(now);
    this.renderStats();
    this.updateDevPanel();
  }

  private getEnemyBadgeText(): string {
    const rules = this.getDuelRules();
    return `${this.selectedEnemy.name} - ${rules.modifierName} - $${rules.reward}`;
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
      case "standoff":
        return "STANDOFF";
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
      if (this.getDuelRules().showReticle && !this.isReticleReady()) {
        return "Clear your sight.";
      }

      return this.getDuelRules().showReticle ? "Aim and click." : "Point shoot. No reticle.";
    }

    if (this.state.phase === "standoff") {
      return "Hold until the signal.";
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

    if (result.reason === "rule violation") {
      return "Bounty terms broken.";
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

    if (this.state.result.stats.behaviorResultText) {
      return this.state.result.stats.behaviorResultText;
    }

    if (this.state.result.stats.modifierResultText) {
      return this.state.result.stats.modifierResultText;
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

  private getConditionEffectText(): string {
    return getActiveConditionDefinitions(this.progression.activeConditions)
      .map((condition) => `${condition.name}: ${condition.effectSummary}`)
      .join(", ");
  }

  private renderStats(): void {
    this.ui.stats.replaceChildren();

    if (this.state.phase !== "resolved" || !this.state.result) {
      return;
    }

    const stats = this.state.result.stats;
    const rows: Array<[string, string]> = [
      ["Duel Result", this.state.result.outcome.toUpperCase()],
      ["Modifier", stats.modifierName ?? this.selectedModifier.name],
      ["Shot Result", formatShotResult(stats.shotResult)],
      ["Reaction Time", formatDuration(stats.playerReactionTimeMs)],
      ["Enemy Reaction", formatDuration(stats.enemyReactionTimeMs)],
      ["Money Earned", `$${this.lastMoneyEarned}`],
      ["Money", `$${this.progression.money}`]
    ];

    if (stats.modifierRewardMultiplier !== undefined && stats.modifierRewardMultiplier !== 1) {
      rows.push(["Reward Multiplier", `x${stats.modifierRewardMultiplier.toFixed(2)}`]);
    }

    if (stats.modifierResultText) {
      rows.push(["Modifier Effect", stats.modifierResultText]);
    }

    const conditionChangeText = this.getConditionChangeSummaryText();

    if (conditionChangeText) {
      rows.push(["Consequence", conditionChangeText]);
    }

    const conditionEffectText = this.getConditionEffectText();

    if (conditionEffectText) {
      rows.push(["Active Conditions", conditionEffectText]);
    }

    if (stats.styleBonusText) {
      rows.push(["Style Bonus", stats.styleBonusText]);
    }

    if (stats.behaviorResultText) {
      rows.push(["Behavior", stats.behaviorResultText]);
    }

    if (stats.firedDuringFakeout) {
      rows.push(["Fakeout", "Fired during fakeout"]);
    } else if (stats.waitedOutFakeout) {
      rows.push(["Fakeout", "Waited it out"]);
    }

    const upgradeHelp = this.getUpgradeHelpText();

    if (upgradeHelp) {
      rows.push(["Upgrade Help", upgradeHelp]);
    }

    const playtestSummary = getPlaytestSummary(this.telemetry, this.selectedEnemy.id);
    rows.push([
      "Playtest",
      `${playtestSummary.wins}W-${playtestSummary.losses}L / ${Math.round(playtestSummary.winRate * 100)}%`
    ]);

    if (playtestSummary.averageReactionTimeMs !== null) {
      rows.push(["Avg Reaction", formatDuration(playtestSummary.averageReactionTimeMs)]);
    }

    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "stat-row";

      if (
        label === "Style Bonus" ||
        label === "Behavior" ||
        label === "Modifier Effect" ||
        label === "Consequence" ||
        label === "Active Conditions" ||
        label === "Upgrade Help" ||
        label === "Playtest"
      ) {
        row.classList.add("is-wide");
      }

      if (label === "Money Earned" && this.lastMoneyEarned > 0) {
        row.classList.add("is-reward");
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

function getDrawPoseTarget(
  style: DrawAnimationStyle,
  commitment: number
): {
  upperArmZ: number;
  forearmZ: number;
  handForward: number;
  handOffsetX: number;
} {
  const clampedCommitment = THREE.MathUtils.clamp(commitment, 0.65, 1.25);
  const targets: Record<DrawAnimationStyle, {
    upperArmZ: number;
    forearmZ: number;
    handForward: number;
    handOffsetX: number;
  }> = {
    obviousReach: {
      upperArmZ: -0.72,
      forearmZ: -1.32,
      handForward: 0.18,
      handOffsetX: -0.03
    },
    baitedReach: {
      upperArmZ: -0.62,
      forearmZ: -1.2,
      handForward: 0.14,
      handOffsetX: 0.04
    },
    cleanDraw: {
      upperArmZ: -0.55,
      forearmZ: -1.18,
      handForward: 0.12,
      handOffsetX: 0
    },
    sideStepDraw: {
      upperArmZ: -0.64,
      forearmZ: -1.24,
      handForward: 0.15,
      handOffsetX: -0.02
    },
    snapDraw: {
      upperArmZ: -0.48,
      forearmZ: -1.34,
      handForward: 0.1,
      handOffsetX: 0.03
    }
  };
  const target = targets[style];

  return {
    upperArmZ: target.upperArmZ * clampedCommitment,
    forearmZ: target.forearmZ * clampedCommitment,
    handForward: target.handForward * clampedCommitment,
    handOffsetX: target.handOffsetX * clampedCommitment
  };
}

function getEnemyById(enemyId: string): EnemyDefinition {
  return ENEMIES.find((enemy) => enemy.id === enemyId) ?? DEFAULT_ENEMY;
}

function appendResultText(currentText: string | undefined, nextText: string): string {
  return currentText ? `${currentText} ${nextText}` : nextText;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
