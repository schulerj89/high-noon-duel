# Bounty Portraits

These portraits are GPT Image 2 generated bitmap assets for the bounty board. They are intentionally image-only portraits; poster text such as WANTED, enemy name, reward, difficulty, and description is rendered by the game UI from `src/data/enemies.ts`.

The game also keeps data-driven procedural portrait settings in `src/data/enemies.ts` and renders a CSS silhouette fallback if one of these image files is missing.

Current files:

- `billy-the-shaky.webp`
- `red-eye-ramos.webp`
- `marshal-graves.webp`
- `dust-widow.webp`
- `the-black-hat.webp`

The source prompts asked for low-poly western wanted-poster portrait art with no text, labels, watermark, UI frame, or full poster copy.
