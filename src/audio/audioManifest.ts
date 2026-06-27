export type VoiceAudioId =
  | "ready"
  | "steady"
  | "draw"
  | "tooSoon"
  | "cleanShot"
  | "miss"
  | "enemyFaster"
  | "bountyClaimed"
  | "tryAgainPartner"
  | "disarm"
  | "headshot"
  | "welcomeBoard"
  | "shopWelcome";

export type SfxAudioId =
  | "gunshotPlayer"
  | "gunshotEnemy"
  | "revolverCock"
  | "holsterLeather"
  | "bulletWhiz"
  | "dustImpact"
  | "bodyHit"
  | "posterPaper"
  | "buttonClick";

export type MusicAudioId =
  | "bountyBoardLoop"
  | "townWindLoop"
  | "duelTensionLoop"
  | "victorySting"
  | "defeatSting";

export interface AudioManifest {
  voice: Record<VoiceAudioId, string>;
  sfx: Record<SfxAudioId, string>;
  music: Record<MusicAudioId, string>;
}

export const AUDIO_MANIFEST: AudioManifest = {
  voice: {
    ready: "/audio/voice/ready.mp3",
    steady: "/audio/voice/steady.mp3",
    draw: "/audio/voice/draw.mp3",
    tooSoon: "/audio/voice/tooSoon.mp3",
    cleanShot: "/audio/voice/cleanShot.mp3",
    miss: "/audio/voice/miss.mp3",
    enemyFaster: "/audio/voice/enemyFaster.mp3",
    bountyClaimed: "/audio/voice/bountyClaimed.mp3",
    tryAgainPartner: "/audio/voice/tryAgainPartner.mp3",
    disarm: "/audio/voice/disarm.mp3",
    headshot: "/audio/voice/headshot.mp3",
    welcomeBoard: "/audio/voice/welcomeBoard.mp3",
    shopWelcome: "/audio/voice/shopWelcome.mp3"
  },
  sfx: {
    gunshotPlayer: "/audio/sfx-gunshot-player.mp3",
    gunshotEnemy: "/audio/sfx-gunshot-enemy.mp3",
    revolverCock: "/audio/sfx-revolver-cock.mp3",
    holsterLeather: "/audio/sfx-holster-leather.mp3",
    bulletWhiz: "/audio/sfx-bullet-whiz.mp3",
    dustImpact: "/audio/sfx-dust-impact.mp3",
    bodyHit: "/audio/sfx-body-hit.mp3",
    posterPaper: "/audio/sfx-poster-paper.mp3",
    buttonClick: "/audio/sfx-button-click.mp3"
  },
  music: {
    bountyBoardLoop: "/audio/music-bounty-board-loop.mp3",
    townWindLoop: "/audio/music-town-wind-loop.mp3",
    duelTensionLoop: "/audio/music-duel-tension-loop.mp3",
    victorySting: "/audio/music-victory-sting.mp3",
    defeatSting: "/audio/music-defeat-sting.mp3"
  }
};
