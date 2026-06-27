import { PRACTICE_MODES, type PracticeModeDefinition } from "../data/practiceModes";
import {
  formatPracticeBest,
  type PracticeBests
} from "../game/practice";

export interface PracticeMenuOptions {
  bests: PracticeBests;
  onSelectMode: (mode: PracticeModeDefinition) => void;
}

export function createPracticeMenu(options: PracticeMenuOptions): HTMLDivElement {
  const list = document.createElement("div");
  list.className = "practice-list";

  for (const mode of PRACTICE_MODES) {
    const card = document.createElement("button");
    card.className = "practice-card";
    card.type = "button";
    card.dataset.practiceModeId = mode.id;
    card.addEventListener("click", () => options.onSelectMode(mode));

    const name = document.createElement("strong");
    name.textContent = mode.name;

    const subtitle = document.createElement("span");
    subtitle.className = "practice-subtitle";
    subtitle.textContent = mode.subtitle;

    const description = document.createElement("p");
    description.textContent = mode.description;

    const goal = document.createElement("small");
    goal.className = "practice-goal";
    goal.textContent = mode.goalText;

    const best = document.createElement("span");
    best.className = "practice-best";
    best.textContent = `Best: ${formatPracticeBest(mode, options.bests[mode.id])}`;

    card.append(name, subtitle, description, goal, best);
    list.append(card);
  }

  return list;
}
