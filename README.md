# High Noon Duel

High Noon Duel is a stylized browser-based western quick draw game built with Three.js. The core fantasy is a tense one-on-one duel at high noon: wait for the signal, draw fast, aim true, and beat increasingly dangerous enemies.

## Current MVP Scope

- Vite + TypeScript + Three.js project scaffold.
- Procedural low-poly western street scene.
- Bounty board with five selectable enemies.
- Countdown flow: READY -> STEADY -> random pause -> DRAW.
- Early draw resolves as a loss.
- Basic enemy reaction timing with aim-and-fire win/loss resolution.
- Enemy-driven reaction time, accuracy, fakeout chance, reward, and visual styling.
- Local progression with money, duel record, owned upgrades, and localStorage persistence.
- Simple upgrade shop with five data-driven upgrades.
- Local audio manager with optional files from `public/audio` and graceful missing-file handling.
- Mouse raycast hit zones for torso, head, and gun-hand disarm shots.
- Miss handling with delayed enemy punish shot.
- Result stats for reaction time, shot result, duel result, money earned, current money, and style bonuses.
- Procedural first-person revolver, enemy silhouette, buildings, barrels, dust, lighting, and muzzle flashes.

## Planned Iterations

- Move scene construction into dedicated `scene/` modules.
- Add scoring helpers for reaction time, shot quality, and duel grading.
- Add procedural weak spots, fakeouts, enemy tells, and focus mechanics.
- Expand progression with enemy unlocks, bounty tiers, and tuned economy pacing.
- Expand the town with procedural props and stronger feedback.
- Add sound, screenshake polish, and animation timing once the loop feels good.

## Local Development

```bash
npm install
npm run dev
npm run build
```

## Voice Generation

Voiceover generation is an optional local developer workflow. It is not browser code, and `ELEVENLABS_API_KEY` must never be committed or exposed to Vite.

Create local environment variables with either approach:

```bash
cp .env.example .env
```

Then set `ELEVENLABS_API_KEY` in `.env`, or export variables in your shell. The defaults are:

```bash
ELEVENLABS_VOICE_ID=ruirxsoakN0GWmGNIo04
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

With the local Windows secret broker:

```bash
agent-secret with ELEVENLABS_API_KEY -- node scripts/generate-voiceovers.mjs
```

Useful options:

```bash
node scripts/generate-voiceovers.mjs --only draw
node scripts/generate-voiceovers.mjs --force
```

The script reads `scripts/voice-lines.json`, skips existing files by default, and writes generated MP3 files to `public/audio/voice/`.

## Controls

- Mouse move: aim after DRAW.
- Click a bounty card: start a duel against that enemy.
- Shop button: open the upgrade shop from the bounty board.
- Bounties button: return to bounty selection from the shop.
- Reset Progress button: clears saved money, record, and upgrades after confirmation.
- Audio On/Off button: mute or unmute local audio.
- Space: start the currently selected bounty or restart after a completed duel.
- Left click before DRAW: early draw loss.
- Left click after DRAW: fire at the reticle.
- Restart Duel button: retry the selected enemy.
- Back to Bounty Board button: choose another enemy.
- R: restart the duel.
- H: show or hide hitbox debug overlays.
- M: mute or unmute audio.
