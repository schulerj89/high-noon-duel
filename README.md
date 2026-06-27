# High Noon Duel

High Noon Duel is a stylized browser-based western quick draw game built with Three.js. The core fantasy is a tense one-on-one duel at high noon: wait for the signal, draw fast, aim true, and beat increasingly dangerous enemies.

## Current MVP Scope

- Vite + TypeScript + Three.js project scaffold.
- Procedural low-poly western street scene.
- Intro screen with a Start Duel button.
- Countdown flow: READY -> STEADY -> random pause -> DRAW.
- Early draw resolves as a loss.
- Basic enemy reaction timing with aim-and-fire win/loss resolution.
- Mouse raycast hit zones for torso, head, and gun-hand disarm shots.
- Miss handling with delayed enemy punish shot.
- Result stats for reaction time, shot result, duel result, and style bonuses.
- Procedural first-person revolver, enemy silhouette, buildings, barrels, dust, lighting, and muzzle flashes.

## Planned Iterations

- Move scene construction into dedicated `scene/` modules.
- Add data-driven enemy definitions and a bounty board.
- Add scoring helpers for reaction time, shot quality, and duel grading.
- Add procedural weak spots, fakeouts, enemy tells, and focus mechanics.
- Expand the town with procedural props and stronger feedback.
- Add upgrade shop hooks once the core duel loop feels good.

## Local Development

```bash
npm install
npm run dev
npm run build
```

## Controls

- Mouse move: aim after DRAW.
- Left click or Start Duel button: start the duel from the intro screen.
- Left click before DRAW: early draw loss.
- Left click after DRAW: fire at the reticle.
- Space or Restart Duel button: restart after a completed duel.
- R: restart the duel.
- H: show or hide hitbox debug overlays.
