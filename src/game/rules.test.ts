import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDamageRule,
  applyPowerupRule,
  buildWaveQueue,
  calculateWaveClearBonus,
  circleHitXZ,
  clampPlayerPos,
  computeBossMaxHp,
  stepWeaponTimer,
} from './rules';
import { ARENA_HALF_W, PLAYER_MAX_Z, PLAYER_MIN_Z } from './types';

test('clampPlayerPos keeps player within landscape arena bounds', () => {
  const clamped = clampPlayerPos(999, -999);
  assert.ok(clamped.x <= ARENA_HALF_W - 1.4);
  assert.equal(clamped.z, PLAYER_MIN_Z);

  const clampedNeg = clampPlayerPos(-999, 999);
  assert.ok(clampedNeg.x >= -ARENA_HALF_W + 1.4);
  assert.equal(clampedNeg.z, PLAYER_MAX_Z);
});

test('circleHitXZ detects overlap and misses accurately', () => {
  assert.equal(circleHitXZ(0, 0, 1, 1.5, 0, 1), true);
  assert.equal(circleHitXZ(0, 0, 1, 2.1, 0, 1), false);
});

test('buildWaveQueue schedules boss on every 5th wave and scales regular waves', () => {
  const w1 = buildWaveQueue(1, () => 0.5);
  assert.equal(w1.isBossWave, false);
  assert.equal(w1.queue.filter((s) => s.type === 'scout').length, 5);
  assert.equal(w1.queue.filter((s) => s.type === 'interceptor').length, 0);

  const w3 = buildWaveQueue(3, () => 0.5);
  assert.equal(w3.isBossWave, false);
  assert.ok(w3.queue.some((s) => s.type === 'cruiser'));

  const w5 = buildWaveQueue(5, () => 0.5);
  assert.equal(w5.isBossWave, true);
  assert.deepEqual(w5.queue, [{ type: 'boss', delay: 0 }]);
  assert.equal(computeBossMaxHp(5), 220);
});

test('calculateWaveClearBonus scales with wave number', () => {
  assert.equal(calculateWaveClearBonus(1), 200);
  assert.equal(calculateWaveClearBonus(5), 400);
});

test('applyDamageRule absorbs hit with shield first, then reduces lives', () => {
  const shielded = applyDamageRule({
    lives: 3,
    shield: 1,
    invuln: 0,
    alive: true,
  });
  assert.equal(shielded.outcome, 'shield_break');
  assert.equal(shielded.next.shield, 0);
  assert.equal(shielded.next.lives, 3);
  assert.ok(shielded.next.invuln > 0);

  const invulnHit = applyDamageRule(shielded.next);
  assert.equal(invulnHit.outcome, 'ignored');

  const lethal = applyDamageRule({
    lives: 1,
    shield: 0,
    invuln: 0,
    alive: true,
  });
  assert.equal(lethal.outcome, 'killed');
  assert.equal(lethal.next.lives, 0);
  assert.equal(lethal.next.alive, false);
});

test('applyPowerupRule and stepWeaponTimer handle upgrades, cap, and expiration', () => {
  let p = { weaponLevel: 1, weaponTimer: 0, shield: 0, lives: 3, maxLives: 5 };
  p = applyPowerupRule('weapon', p);
  assert.equal(p.weaponLevel, 2);
  assert.equal(p.weaponTimer, 10);

  p = applyPowerupRule('weapon', p);
  p = applyPowerupRule('weapon', p);
  assert.equal(p.weaponLevel, 3);

  p = applyPowerupRule('shield', p);
  assert.equal(p.shield, 1);

  p = applyPowerupRule('health', { ...p, lives: 5 });
  assert.equal(p.lives, 5);

  const expired = stepWeaponTimer(3, 0.2, 0.5);
  assert.equal(expired.weaponLevel, 1);
  assert.equal(expired.weaponTimer, 0);
});
