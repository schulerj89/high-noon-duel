export interface DuelTimingConfig {
  readyDurationMs: number;
  steadyDurationMs: number;
  drawPauseMinMs: number;
  drawPauseMaxMs: number;
  muzzleFlashMs: number;
  missPunishDelayMs: number;
}

export interface CameraConfig {
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
  fov: number;
}

export interface GameConfig {
  timing: DuelTimingConfig;
  camera: CameraConfig;
}

export const GAME_CONFIG = {
  timing: {
    readyDurationMs: 900,
    steadyDurationMs: 900,
    drawPauseMinMs: 700,
    drawPauseMaxMs: 2000,
    muzzleFlashMs: 85,
    missPunishDelayMs: 320
  },
  camera: {
    position: [0, 2.15, 6.2],
    lookAt: [0, 1.25, -5],
    fov: 46
  }
} satisfies GameConfig;
