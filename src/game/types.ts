export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type EnemyType = 'scout' | 'interceptor' | 'cruiser' | 'boss';

export type PowerupType = 'weapon' | 'shield' | 'health';

export const ARENA_HALF_W = 19;
export const PLAYER_MIN_Z = -4;
export const PLAYER_MAX_Z = 10;
export const ENEMY_SPAWN_Z = -56;
export const ENEMY_DESPAWN_Z = 18;
export const BULLET_DESPAWN_MIN_Z = -64;
export const BULLET_DESPAWN_MAX_Z = 20;

export interface SpawnItem {
  type: EnemyType;
  delay: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  bestWave: number;
  wave: number;
  lives: number;
  maxLives: number;
  weaponLevel: number;
  weaponTimer: number;
  shield: number;
  muted: boolean;
  newRecord: boolean;
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bannerTitle: string;
  bannerSub: string;
  bannerType: 'wave' | 'boss' | null;
}

export interface PlayerDamageState {
  lives: number;
  shield: number;
  invuln: number;
  alive: boolean;
}
