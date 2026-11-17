/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GalacticEngine } from './game/engine';
import type { HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  score: 0,
  highScore: 0,
  bestWave: 0,
  wave: 0,
  lives: 3,
  maxLives: 5,
  weaponLevel: 1,
  weaponTimer: 0,
  shield: 0,
  muted: false,
  newRecord: false,
  bossActive: false,
  bossHp: 0,
  bossMaxHp: 1,
  bannerTitle: '',
  bannerSub: '',
  bannerType: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GalacticEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GalacticEngine(container, (snap) => {
      setHud(snap);
    });
    engineRef.current = engine;

    // Expose safe debug hooks on window for automated verification
    (
      window as unknown as {
        __galacticEngine?: GalacticEngine;
      }
    ).__galacticEngine = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#040714]">
      <div
        ref={mountRef}
        className="h-full w-full touch-none"
        aria-label="Galactic Defender 3D Arena"
      />
      <GameHud
        hud={hud}
        onStart={() => engineRef.current?.startGame()}
        onPause={() => engineRef.current?.pauseGame()}
        onResume={() => engineRef.current?.resumeGame()}
        onReturnTitle={() => engineRef.current?.returnToTitle()}
        onToggleMute={() => engineRef.current?.toggleMute()}
      />
    </main>
  );
}
