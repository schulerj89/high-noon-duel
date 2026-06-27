import type { GameSettings } from "../game/settings";
import { createSaveManagement, type SaveManagementOptions } from "./saveManagement";

export interface SettingsMenuOptions {
  settings: GameSettings;
  saveManagement: SaveManagementOptions;
  onBack: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
}

export function createSettingsMenu(options: SettingsMenuOptions): HTMLDivElement {
  const screen = document.createElement("div");
  screen.className = "settings-screen";

  const heading = document.createElement("div");
  heading.className = "settings-heading";

  const title = document.createElement("h1");
  title.textContent = "Settings";

  const copy = document.createElement("p");
  copy.textContent = "Tune audio, accessibility, and save data.";

  const back = document.createElement("button");
  back.className = "board-tab";
  back.type = "button";
  back.textContent = "Back";
  back.addEventListener("click", options.onBack);

  heading.append(title, copy, back);

  const grid = document.createElement("div");
  grid.className = "settings-grid";

  grid.append(
    createSettingsSection("Audio", [
      createRangeSetting("Master Volume", options.settings.masterVolume, 0, 1, 0.01, (value) =>
        options.onSettingsChange({ masterVolume: value })
      ),
      createRangeSetting("Music Volume", options.settings.musicVolume, 0, 1, 0.01, (value) =>
        options.onSettingsChange({ musicVolume: value })
      ),
      createRangeSetting("SFX Volume", options.settings.sfxVolume, 0, 1, 0.01, (value) =>
        options.onSettingsChange({ sfxVolume: value })
      ),
      createRangeSetting("Voice Volume", options.settings.voiceVolume, 0, 1, 0.01, (value) =>
        options.onSettingsChange({ voiceVolume: value })
      ),
      createToggleSetting("Mute", options.settings.muted, (checked) =>
        options.onSettingsChange({ muted: checked })
      )
    ]),
    createSettingsSection("Accessibility", [
      createRangeSetting("Camera Shake", options.settings.cameraShakeAmount, 0, 1.5, 0.05, (value) =>
        options.onSettingsChange({ cameraShakeAmount: value })
      ),
      createRangeSetting("Screen Flash", options.settings.screenFlashAmount, 0, 1, 0.05, (value) =>
        options.onSettingsChange({ screenFlashAmount: value })
      ),
      createRangeSetting("Reticle Size", options.settings.reticleSize, 0.65, 1.75, 0.05, (value) =>
        options.onSettingsChange({ reticleSize: value })
      ),
      createRangeSetting("Reticle Opacity", options.settings.reticleOpacity, 0.25, 1, 0.05, (value) =>
        options.onSettingsChange({ reticleOpacity: value })
      ),
      createToggleSetting("Subtitles", options.settings.subtitlesEnabled, (checked) =>
        options.onSettingsChange({ subtitlesEnabled: checked })
      ),
      createToggleSetting("Reduced Motion", options.settings.reducedMotion, (checked) =>
        options.onSettingsChange({ reducedMotion: checked })
      ),
      createToggleSetting("Show Reaction Time", options.settings.showReactionTime, (checked) =>
        options.onSettingsChange({ showReactionTime: checked })
      ),
      createToggleSetting("Difficulty Assist", options.settings.difficultyAssist, (checked) =>
        options.onSettingsChange({ difficultyAssist: checked })
      )
    ])
  );

  screen.append(heading, grid, createSaveManagement(options.saveManagement));
  return screen;
}

function createSettingsSection(titleText: string, rows: HTMLElement[]): HTMLFieldSetElement {
  const section = document.createElement("fieldset");
  section.className = "settings-section";

  const legend = document.createElement("legend");
  legend.textContent = titleText;

  section.append(legend, ...rows);
  return section;
}

function createRangeSetting(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void
): HTMLLabelElement {
  const row = document.createElement("label");
  row.className = "settings-row";

  const labelText = document.createElement("span");
  labelText.textContent = label;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  const valueText = document.createElement("strong");
  valueText.textContent = formatSettingValue(value, max <= 1.75);

  input.addEventListener("input", () => {
    const nextValue = Number(input.value);
    valueText.textContent = formatSettingValue(nextValue, max <= 1.75);
    onChange(nextValue);
  });

  row.append(labelText, input, valueText);
  return row;
}

function createToggleSetting(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void
): HTMLLabelElement {
  const row = document.createElement("label");
  row.className = "settings-row is-toggle";

  const labelText = document.createElement("span");
  labelText.textContent = label;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));

  const valueText = document.createElement("strong");
  valueText.textContent = checked ? "On" : "Off";
  input.addEventListener("change", () => {
    valueText.textContent = input.checked ? "On" : "Off";
  });

  row.append(labelText, input, valueText);
  return row;
}

function formatSettingValue(value: number, asPercent: boolean): string {
  return asPercent ? `${Math.round(value * 100)}%` : value.toFixed(2);
}
