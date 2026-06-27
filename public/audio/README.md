# High Noon Duel Audio

Place generated or recorded audio files in this folder. The game looks for these files by exact filename and continues without crashing when files are missing.

Run `npm run generate:audio` to regenerate the local placeholder SFX and town wind ambience WAV file. Voice files are generated separately because they use the optional ElevenLabs developer workflow.

Music tracks are sourced MP3 files. See `CREDITS.md` for attribution and license details.

## Voice

Generated ElevenLabs voice files should be placed in `public/audio/voice/`.

- `voice/ready.mp3`
- `voice/steady.mp3`
- `voice/draw.mp3`
- `voice/tooSoon.mp3`
- `voice/cleanShot.mp3`
- `voice/miss.mp3`
- `voice/enemyFaster.mp3`
- `voice/bountyClaimed.mp3`
- `voice/tryAgainPartner.mp3`
- `voice/disarm.mp3`
- `voice/headshot.mp3`
- `voice/welcomeBoard.mp3`
- `voice/shopWelcome.mp3`

## SFX

- `sfx-gunshot-player.wav`
- `sfx-gunshot-enemy.wav`
- `sfx-revolver-cock.wav`
- `sfx-holster-leather.wav`
- `sfx-bullet-whiz.wav`
- `sfx-dust-impact.wav`
- `sfx-body-hit.wav`
- `sfx-poster-paper.wav`
- `sfx-button-click.wav`

## Music and Ambience

- `music/crossing-the-divide.mp3`
- `music-town-wind-loop.wav`
- `music/smoking-gun.mp3`
- `music/cowboy-sting.mp3`
- `music/western-streets.mp3`

Audio playback reacts to game state changes only. Duel timing is controlled by gameplay state, not by audio duration or playback latency.
