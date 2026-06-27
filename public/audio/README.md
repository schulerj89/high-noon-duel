# High Noon Duel Audio

Place generated or recorded audio files in this folder. The game looks for these files by exact filename and continues without crashing when files are missing.

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

- `sfx-gunshot-player.mp3`
- `sfx-gunshot-enemy.mp3`
- `sfx-revolver-cock.mp3`
- `sfx-holster-leather.mp3`
- `sfx-bullet-whiz.mp3`
- `sfx-dust-impact.mp3`
- `sfx-body-hit.mp3`
- `sfx-poster-paper.mp3`
- `sfx-button-click.mp3`

## Music and Ambience

- `music-bounty-board-loop.mp3`
- `music-town-wind-loop.mp3`
- `music-duel-tension-loop.mp3`
- `music-victory-sting.mp3`
- `music-defeat-sting.mp3`

Audio playback reacts to game state changes only. Duel timing is controlled by gameplay state, not by audio duration or playback latency.
