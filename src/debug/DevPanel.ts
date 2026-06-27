import type { DuelPhase } from "../game/state";
import type { EffectiveEnemyTuning, TuningOverrides } from "./tuning";
import { setEnemyTuningValue, setGlobalTuningValue } from "./tuning";
import type { PlaytestSummary } from "./telemetry";

type ForcePhase = Extract<DuelPhase, "ready" | "steady" | "draw">;
type NumberControlId =
  | "reactionTimeMs"
  | "accuracy"
  | "fakeoutChance"
  | "drawPauseMinMs"
  | "drawPauseMaxMs"
  | "playerShotTimingBonusMs"
  | "focusGraceMs"
  | "hitZoneScaleMultiplier"
  | "reticleSwayMultiplier";
type DevActionId =
  | "restart"
  | "force-ready"
  | "force-steady"
  | "force-draw"
  | "force-win"
  | "force-loss"
  | "reset-tuning"
  | "copy-report";

export interface DevPanelSnapshot {
  selectedEnemyId: string;
  selectedEnemyName: string;
  phase: DuelPhase;
  tuning: TuningOverrides;
  effectiveEnemy: EffectiveEnemyTuning;
  drawPauseMinMs: number;
  drawPauseMaxMs: number;
  playerShotTimingBonusMs: number;
  focusGraceMs: number;
  hitZoneScaleMultiplier: number;
  reticleSwayMultiplier: number;
  playtestSummary: PlaytestSummary;
}

export interface CopyBalanceReportResult {
  copied: boolean;
  json: string;
}

export interface DevPanelActions {
  onTuningChange: (overrides: TuningOverrides) => void;
  onRestartDuel: () => void;
  onForcePhase: (phase: ForcePhase) => void;
  onForcePlayerWin: () => void;
  onForcePlayerLoss: () => void;
  onResetTuning: () => void;
  onCopyBalanceReport: () => Promise<CopyBalanceReportResult>;
}

interface NumberControl {
  input: HTMLInputElement;
  valueLabel: HTMLSpanElement;
  readValue: (snapshot: DevPanelSnapshot) => number;
}

export class DevPanel {
  public readonly element: HTMLDivElement;

  private readonly controls = new Map<NumberControlId, NumberControl>();
  private readonly enemyLabel: HTMLDivElement;
  private readonly phaseLabel: HTMLDivElement;
  private readonly telemetryLabel: HTMLDivElement;
  private readonly copyStatus: HTMLDivElement;
  private readonly reportFallback: HTMLTextAreaElement;
  private snapshot: DevPanelSnapshot | null = null;

  public constructor(private readonly actions: DevPanelActions) {
    this.element = document.createElement("div");
    this.element.className = "dev-panel";
    this.element.hidden = true;
    this.element.addEventListener("pointerdown", stopEvent);
    this.element.addEventListener("click", stopEvent);
    this.element.addEventListener("keydown", stopEvent);

    const header = document.createElement("div");
    header.className = "dev-panel-header";

    const title = document.createElement("strong");
    title.textContent = "Duel Tuning";

    const hint = document.createElement("span");
    hint.textContent = "` / F2";

    header.append(title, hint);

    this.enemyLabel = document.createElement("div");
    this.enemyLabel.className = "dev-panel-readout";

    this.phaseLabel = document.createElement("div");
    this.phaseLabel.className = "dev-panel-readout";

    this.telemetryLabel = document.createElement("div");
    this.telemetryLabel.className = "dev-panel-readout";

    const controls = document.createElement("div");
    controls.className = "dev-panel-controls";
    controls.append(
      this.createNumberControl("Reaction ms", "reactionTimeMs", 120, 1600, 10),
      this.createNumberControl("Accuracy", "accuracy", 0, 1, 0.01),
      this.createNumberControl("Fakeout", "fakeoutChance", 0, 1, 0.01),
      this.createNumberControl("Draw min", "drawPauseMinMs", 100, 4000, 25),
      this.createNumberControl("Draw max", "drawPauseMaxMs", 100, 5000, 25),
      this.createNumberControl("Player grace", "playerShotTimingBonusMs", 0, 500, 5),
      this.createNumberControl("Focus grace", "focusGraceMs", 0, 500, 5),
      this.createNumberControl("Hitbox scale", "hitZoneScaleMultiplier", 0.5, 2, 0.01),
      this.createNumberControl("Reticle sway (reserved)", "reticleSwayMultiplier", 0, 2, 0.01)
    );

    const buttons = document.createElement("div");
    buttons.className = "dev-panel-buttons";
    buttons.append(
      this.createButton("Restart duel", "restart", () => this.actions.onRestartDuel()),
      this.createButton("Force READY", "force-ready", () => this.actions.onForcePhase("ready")),
      this.createButton("Force STEADY", "force-steady", () => this.actions.onForcePhase("steady")),
      this.createButton("Force DRAW", "force-draw", () => this.actions.onForcePhase("draw")),
      this.createButton("Force win", "force-win", () => this.actions.onForcePlayerWin()),
      this.createButton("Force loss", "force-loss", () => this.actions.onForcePlayerLoss()),
      this.createButton("Reset tuning", "reset-tuning", () => this.actions.onResetTuning()),
      this.createButton("Copy report", "copy-report", () => {
        void this.copyBalanceReport();
      })
    );

    this.copyStatus = document.createElement("div");
    this.copyStatus.className = "dev-panel-copy-status";

    this.reportFallback = document.createElement("textarea");
    this.reportFallback.className = "dev-panel-report";
    this.reportFallback.readOnly = true;
    this.reportFallback.hidden = true;

    this.element.append(
      header,
      this.enemyLabel,
      this.phaseLabel,
      this.telemetryLabel,
      controls,
      buttons,
      this.copyStatus,
      this.reportFallback
    );
  }

  public toggle(): void {
    this.setVisible(this.element.hidden);
  }

  public setVisible(visible: boolean): void {
    this.element.hidden = !visible;

    if (visible && this.snapshot) {
      this.update(this.snapshot);
    }
  }

  public update(snapshot: DevPanelSnapshot): void {
    this.snapshot = snapshot;

    if (this.element.hidden) {
      return;
    }

    this.enemyLabel.textContent =
      `${snapshot.selectedEnemyName} | reaction ${Math.round(snapshot.effectiveEnemy.reactionTimeMs)} ms | ` +
      `accuracy ${formatDecimal(snapshot.effectiveEnemy.accuracy)} | fakeout ${formatPercent(snapshot.effectiveEnemy.fakeoutChance)}`;
    this.phaseLabel.textContent =
      `Phase ${snapshot.phase.toUpperCase()} | draw ${Math.round(snapshot.drawPauseMinMs)}-${Math.round(snapshot.drawPauseMaxMs)} ms`;
    this.telemetryLabel.textContent =
      `Playtest ${snapshot.playtestSummary.wins}W-${snapshot.playtestSummary.losses}L | ` +
      `WR ${formatPercent(snapshot.playtestSummary.winRate)} | ` +
      `avg ${formatMs(snapshot.playtestSummary.averageReactionTimeMs)}`;

    for (const control of this.controls.values()) {
      const value = control.readValue(snapshot);
      control.valueLabel.textContent = formatControlValue(value);

      if (document.activeElement !== control.input) {
        control.input.value = String(value);
      }
    }
  }

  private createNumberControl(
    label: string,
    id: NumberControlId,
    min: number,
    max: number,
    step: number
  ): HTMLLabelElement {
    const row = document.createElement("label");
    row.className = "dev-control";
    row.dataset.control = id;

    const labelText = document.createElement("span");
    labelText.textContent = label;

    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener("input", () => this.handleNumberInput(id, input));

    const valueLabel = document.createElement("strong");

    row.append(labelText, input, valueLabel);
    this.controls.set(id, {
      input,
      valueLabel,
      readValue: (snapshot) => readControlValue(snapshot, id)
    });

    return row;
  }

  private createButton(label: string, actionId: DevActionId, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = actionId;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  private handleNumberInput(id: NumberControlId, input: HTMLInputElement): void {
    if (!this.snapshot) {
      return;
    }

    const value = Number(input.value);

    if (!Number.isFinite(value)) {
      return;
    }

    if (id === "reactionTimeMs" || id === "accuracy" || id === "fakeoutChance") {
      this.actions.onTuningChange(
        setEnemyTuningValue(this.snapshot.tuning, this.snapshot.selectedEnemyId, id, value)
      );
      return;
    }

    this.actions.onTuningChange(setGlobalTuningValue(this.snapshot.tuning, id, value));
  }

  private async copyBalanceReport(): Promise<void> {
    const result = await this.actions.onCopyBalanceReport();

    this.copyStatus.textContent = result.copied
      ? "Balance report copied."
      : "Clipboard unavailable. JSON shown below.";
    this.reportFallback.hidden = result.copied;
    this.reportFallback.value = result.copied ? "" : result.json;
  }
}

function readControlValue(snapshot: DevPanelSnapshot, id: NumberControlId): number {
  switch (id) {
    case "reactionTimeMs":
      return snapshot.effectiveEnemy.reactionTimeMs;
    case "accuracy":
      return snapshot.effectiveEnemy.accuracy;
    case "fakeoutChance":
      return snapshot.effectiveEnemy.fakeoutChance;
    case "drawPauseMinMs":
      return snapshot.drawPauseMinMs;
    case "drawPauseMaxMs":
      return snapshot.drawPauseMaxMs;
    case "playerShotTimingBonusMs":
      return snapshot.playerShotTimingBonusMs;
    case "focusGraceMs":
      return snapshot.focusGraceMs;
    case "hitZoneScaleMultiplier":
      return snapshot.hitZoneScaleMultiplier;
    case "reticleSwayMultiplier":
      return snapshot.reticleSwayMultiplier;
  }
}

function stopEvent(event: Event): void {
  if (
    event instanceof KeyboardEvent &&
    (event.code === "Backquote" || event.code === "F2")
  ) {
    return;
  }

  event.stopPropagation();
}

function formatPercent(value: number | null): string {
  return value === null ? "--" : `${Math.round(value * 100)}%`;
}

function formatMs(value: number | null): string {
  return value === null ? "--" : `${Math.round(value)} ms`;
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

function formatControlValue(value: number): string {
  return Math.abs(value) < 10 && !Number.isInteger(value)
    ? value.toFixed(2)
    : String(Math.round(value));
}
