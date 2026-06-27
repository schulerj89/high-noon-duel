export interface TitleScreenOptions {
  hasSave: boolean;
  saveSummary: string;
  onContinue: () => void;
  onNewGame: () => void;
  onPracticeRange: () => void;
  onSettings: () => void;
  onCredits: () => void;
}

export function createTitleScreen(options: TitleScreenOptions): HTMLDivElement {
  const screen = document.createElement("div");
  screen.className = "title-screen";

  const copy = document.createElement("div");
  copy.className = "title-copy";

  const title = document.createElement("h1");
  title.textContent = "High Noon Duel";

  const tagline = document.createElement("p");
  tagline.textContent = "Wait. Draw. Survive.";

  const save = document.createElement("small");
  save.textContent = options.hasSave ? options.saveSummary : "No trail started.";

  copy.append(title, tagline, save);

  const actions = document.createElement("div");
  actions.className = "title-actions";

  const continueButton = createTitleButton("Continue", options.onContinue);
  continueButton.disabled = !options.hasSave;

  actions.append(
    continueButton,
    createTitleButton("New Game", options.onNewGame),
    createTitleButton("Practice Range", options.onPracticeRange),
    createTitleButton("Settings", options.onSettings),
    createTitleButton("Credits", options.onCredits)
  );

  screen.append(copy, actions);
  return screen;
}

function createTitleButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "title-button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
