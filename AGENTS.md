# AGENTS.md — High Noon Duel

## Project Premise

High Noon Duel is a stylized browser-based western quick draw game built with Three.js. The core fantasy is a tense one-on-one duel at high noon: wait for the signal, draw fast, aim true, and beat increasingly dangerous enemies.

The game should begin simple:
- A western street standoff.
- A countdown: READY → STEADY → random pause → DRAW.
- Drawing early is a foul.
- After DRAW, the player must draw, aim, and fire before the enemy.
- The enemy has configurable reaction timing and accuracy.
- The result screen shows reaction time, shot timing, hit/miss, and win/loss.

Long-term direction:
- Data-driven enemies.
- Procedural western environments.
- Bounty board progression.
- Upgrade shop.
- Skill-based mechanics such as focus, weak spots, fakeouts, and enemy tells.

## Technical Direction

- Use Vite + TypeScript + Three.js.
- Prefer small, readable modules over large monolithic files.
- Keep gameplay logic data-driven where practical.
- Avoid external art/audio assets until the core loop is fun.
- Use procedural primitives for buildings, barrels, hats, guns, targets, dust, and environmental details.
- Keep all game constants in clear config files.
- Maintain a clear game state machine.

## Coding Rules

- Use TypeScript types/interfaces for game state, enemies, upgrades, and input.
- Avoid `any` unless there is a clear reason.
- Prefer pure functions for timing, scoring, and duel outcome calculations.
- Keep Three.js scene setup separate from duel state logic.
- Keep UI overlay logic separate from 3D scene construction.
- Every iteration should leave the game runnable with `npm run dev`.
- Before finishing a task, run:
  - npm install if dependencies changed
  - npm run build
- Fix TypeScript/build errors before stopping.

## Gameplay Design Rules

- Preserve tension. The player should not be able to memorize exact countdown timing.
- The DRAW moment should use a random pause after STEADY.
- Early input before DRAW should be punished.
- Losing should feel fair and explainable.
- Winning should show useful stats.
- New mechanics should build on the core duel loop instead of turning the game into a generic shooter.
- Favor readable silhouettes and strong feedback over realistic graphics.

## Visual Style

- Low-poly/stylized western.
- Warm desert lighting.
- Simple saloon street.
- Procedural enemy silhouette with hat, torso, arms, and holster.
- Procedural revolver visible near the bottom of the screen.
- Add polish through camera movement, muzzle flash, dust, shadows, and UI timing before adding complex assets.

## Suggested Folder Direction

src/
  main.ts
  styles.css
  game/
    Game.ts
    state.ts
    config.ts
    input.ts
    scoring.ts
  scene/
    createScene.ts
    createTown.ts
    createEnemy.ts
    createGun.ts
    effects.ts
  ui/
    overlay.ts
  data/
    enemies.ts
    upgrades.ts

## Development Style

Work in small, reviewable increments.
For each task:
1. Briefly inspect the existing code.
2. Make the smallest coherent implementation.
3. Keep names clear and game-specific.
4. Run the build.
5. Summarize what changed and what should be tested manually.
