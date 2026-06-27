import {
  getOwnedUpgradeNames,
  getSelectedTown,
  type PlayerProgression
} from "../game/progression";

export interface SaveManagementOptions {
  progression: PlayerProgression;
  message: string;
  exportText: string;
  onExport: () => void;
  onImport: (json: string) => void;
  onReset: () => void;
}

export function createSaveManagement(options: SaveManagementOptions): HTMLDivElement {
  const section = document.createElement("div");
  section.className = "save-management";

  const heading = document.createElement("div");
  heading.className = "save-heading";

  const title = document.createElement("h2");
  title.textContent = "Save Management";

  const summary = document.createElement("div");
  summary.className = "save-summary";

  for (const [label, value] of getSaveSummaryRows(options.progression)) {
    const row = document.createElement("div");
    row.className = "save-summary-row";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("strong");
    valueEl.textContent = value;

    row.append(labelEl, valueEl);
    summary.append(row);
  }

  heading.append(title, summary);

  const controls = document.createElement("div");
  controls.className = "save-controls";

  const exportButton = document.createElement("button");
  exportButton.className = "board-tab";
  exportButton.type = "button";
  exportButton.textContent = "Export Save";
  exportButton.addEventListener("click", options.onExport);

  const importButton = document.createElement("button");
  importButton.className = "board-tab";
  importButton.type = "button";
  importButton.textContent = "Import Save";

  const resetButton = document.createElement("button");
  resetButton.className = "board-reset";
  resetButton.type = "button";
  resetButton.textContent = "Reset Progress";
  resetButton.addEventListener("click", options.onReset);

  const textArea = document.createElement("textarea");
  textArea.className = "save-json";
  textArea.placeholder = "Paste exported save JSON here.";
  textArea.value = options.exportText;

  importButton.addEventListener("click", () => options.onImport(textArea.value));

  const message = document.createElement("p");
  message.className = "save-message";
  message.textContent = options.message;

  controls.append(exportButton, importButton, resetButton, textArea, message);
  section.append(heading, controls);
  return section;
}

export function getSaveSummaryText(progression: PlayerProgression): string {
  const town = getSelectedTown(progression.campaign);
  return `$${progression.money} - ${progression.duelsWon}W/${progression.duelsLost}L - ${town.name}`;
}

export function getSaveSummaryRows(progression: PlayerProgression): Array<[string, string]> {
  const town = getSelectedTown(progression.campaign);
  const upgrades = getOwnedUpgradeNames(progression.ownedUpgrades);

  return [
    ["Money", `$${progression.money}`],
    ["Record", `${progression.duelsWon}W - ${progression.duelsLost}L`],
    ["Current Town", town.name],
    ["Upgrades", upgrades.length > 0 ? upgrades.join(", ") : "None"]
  ];
}
