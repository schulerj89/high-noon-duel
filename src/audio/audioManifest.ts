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
    gunshotPlayer: "/audio/sfx-gunshot-player.wav",
    gunshotEnemy: "/audio/sfx-gunshot-enemy.wav",
    revolverCock: "/audio/sfx-revolver-cock.wav",
    holsterLeather: "/audio/sfx-holster-leather.wav",
    bulletWhiz: "/audio/sfx-bullet-whiz.wav",
    dustImpact: "/audio/sfx-dust-impact.wav",
    bodyHit: "/audio/sfx-body-hit.wav",
    posterPaper: "/audio/sfx-poster-paper.wav",
    buttonClick: "/audio/sfx-button-click.wav"
  },
  music: {
    bountyBoardLoop: "/audio/music/crossing-the-divide.mp3",
    townWindLoop: "/audio/music-town-wind-loop.wav",
    duelTensionLoop: "/audio/music/smoking-gun.mp3",
    victorySting: "/audio/music/cowboy-sting.mp3",
    defeatSting: "/audio/music/western-streets.mp3"
  }
};
