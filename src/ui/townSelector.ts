import { TOWNS } from "../data/towns";
import {
  getTownBossStatusText,
  getTownLockText,
  getTownProgress,
  isTownCompleted,
  isTownUnlocked,
  type CampaignState
} from "../game/campaign";

export interface TownSelectorOptions {
  campaign: CampaignState;
  onSelectTown: (townId: string) => void;
}

export function createTownSelector(options: TownSelectorOptions): HTMLDivElement {
  const selector = document.createElement("div");
  selector.className = "town-selector";

  const heading = document.createElement("div");
  heading.className = "town-selector-heading";

  const label = document.createElement("span");
  label.textContent = "Trail Map";

  const current = document.createElement("strong");
  const currentTown = TOWNS.find((town) => town.id === options.campaign.selectedTownId) ?? TOWNS[0];
  current.textContent = currentTown.name;

  heading.append(label, current);
  selector.append(heading);

  const list = document.createElement("div");
  list.className = "town-list";

  for (const town of TOWNS) {
    const unlocked = isTownUnlocked(options.campaign, town.id);
    const completed = isTownCompleted(options.campaign, town.id);
    const progress = getTownProgress(options.campaign, town.id);
    const button = document.createElement("button");
    button.className = "town-card";
    button.type = "button";
    button.disabled = !unlocked || town.id === options.campaign.selectedTownId;
    button.dataset.townId = town.id;
    button.classList.toggle("is-selected", town.id === options.campaign.selectedTownId);
    button.classList.toggle("is-locked", !unlocked);
    button.classList.toggle("is-complete", completed);
    button.addEventListener("click", () => options.onSelectTown(town.id));

    const name = document.createElement("strong");
    name.textContent = town.name;

    const description = document.createElement("span");
    description.className = "town-description";
    description.textContent = unlocked ? town.description : getTownLockText(options.campaign, town);

    const stats = document.createElement("small");
    stats.textContent = unlocked
      ? `${progress.bountiesWon} wins / ${progress.reputation} rep - ${getTownBossStatusText(options.campaign, town)}`
      : "Locked";

    button.append(name, description, stats);
    list.append(button);
  }

  selector.append(list);
  return selector;
}
