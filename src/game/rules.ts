import {
  ARENA_HALF_W,
  PLAYER_MAX_Z,
  PLAYER_MIN_Z,
  type PlayerDamageState,
  type PowerupType,
  type SpawnItem,
} from './types';

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clampPlayerPos(x: number, z: number): { x: number; z: number } {
  return {
    x: clamp(x, -ARENA_HALF_W + 1.4, ARENA_HALF_W - 1.4),
    z: clamp(z, PLAYER_MIN_Z, PLAYER_MAX_Z),
  };
}

export function circleHitXZ(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const rr = ar + br;
  return dx * dx + dz * dz < rr * rr;
}

export function buildWaveQueue(
  waveNo: number,
  rng: () => number = Math.random,
): { queue: SpawnItem[]; isBossWave: boolean } {
  if (waveNo > 0 && waveNo % 5 === 0) {
    return {
      queue: [{ type: 'boss', delay: 0 }],
      isBossWave: true,
    };
  }

  const rand = (a: number, b: number) => a + rng() * (b - a);
  const scouts = 4 + Math.floor(waveNo * 1.4);
  const interceptors = waveNo >= 2 ? 1 + Math.floor((waveNo - 2) * 0.8) : 0;
  const cruisers = waveNo >= 3 ? Math.floor((waveNo - 3) / 2) + 1 : 0;

  const queue: SpawnItem[] = [];
  let delay = 0.4;

  for (let i = 0; i < scouts; i++) {
    queue.push({ type: 'scout', delay });
    delay += Math.max(0.18, 0.5 - waveNo * 0.02) * rand(0.8, 1.3);
  }
  for (let i = 0; i < interceptors; i++) {
    queue.push({ type: 'interceptor', delay });
    delay += rand(0.5, 0.9);
  }
  for (let i = 0; i < cruisers; i++) {
    queue.push({ type: 'cruiser', delay });
    delay += rand(0.9, 1.4);
  }

  return { queue, isBossWave: false };
}

export function calculateWaveClearBonus(waveNo: number): number {
  return 150 + waveNo * 50;
}

export function computeBossMaxHp(waveNo: number): number {
  return 90 + waveNo * 26;
}

export function applyDamageRule(state: PlayerDamageState): {
  next: PlayerDamageState;
  outcome: 'ignored' | 'shield_break' | 'damaged' | 'killed';
} {
  if (state.invuln > 0 || !state.alive) {
    return { next: state, outcome: 'ignored' };
  }

  if (state.shield > 0) {
    return {
      next: {
        ...state,
        shield: 0,
        invuln: 0.9,
      },
      outcome: 'shield_break',
    };
  }

  const nextLives = state.lives - 1;
  const alive = nextLives > 0;
  return {
    next: {
      lives: Math.max(0, nextLives),
      shield: 0,
      invuln: 2.0,
      alive,
    },
    outcome: alive ? 'damaged' : 'killed',
  };
}

export function applyPowerupRule(
  type: PowerupType,
  player: {
    weaponLevel: number;
    weaponTimer: number;
    shield: number;
    lives: number;
    maxLives: number;
  },
): {
  weaponLevel: number;
  weaponTimer: number;
  shield: number;
  lives: number;
  maxLives: number;
} {
  if (type === 'weapon') {
    return {
      ...player,
      weaponLevel: Math.min(3, player.weaponLevel + 1),
      weaponTimer: 10,
    };
  }
  if (type === 'shield') {
    return {
      ...player,
      shield: 1,
    };
  }
  return {
    ...player,
    lives: Math.min(player.maxLives, player.lives + 1),
  };
}

export function stepWeaponTimer(
  weaponLevel: number,
  weaponTimer: number,
  dt: number,
): { weaponLevel: number; weaponTimer: number } {
  if (weaponTimer <= 0) {
    return { weaponLevel, weaponTimer: 0 };
  }
  const nextTimer = weaponTimer - dt;
  if (nextTimer <= 0) {
    return { weaponLevel: 1, weaponTimer: 0 };
  }
  return { weaponLevel, weaponTimer: nextTimer };
}
