import type { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
}

function HeartSocket({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M12 20.5c-.3 0-.6-.1-.8-.3C7.2 16.9 3 13.4 3 8.8 3 5.8 5.3 3.5 8.2 3.5c1.6 0 3.1.8 3.8 2 .7-1.2 2.2-2 3.8-2 2.9 0 5.2 2.3 5.2 5.3 0 4.6-4.2 8.1-8.2 11.4-.2.2-.5.3-.8.3z"
        fill={filled ? '#ff4769' : 'rgba(12, 20, 42, 0.7)'}
        stroke={filled ? '#ffd1dc' : 'rgba(255, 105, 135, 0.45)'}
        strokeWidth="1.8"
      />
      {filled && (
        <path
          d="M6.8 8.3c.3-1.4 1.3-2.3 2.5-2.5"
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 9.5h4.2L14 4.5v15l-5.8-5H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M17.5 9l4 6m0-6l-4 6"
          fill="none"
          stroke="#ff5a6e"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M17.5 8.5a5 5 0 0 1 0 7m2.5-9.5a8.5 8.5 0 0 1 0 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

export function GameHud({
  hud,
  onStart,
  onPause,
  onResume,
  onReturnTitle,
  onToggleMute,
}: GameHudProps) {
  const weaponPct = Math.max(0, Math.min(100, (hud.weaponTimer / 10) * 100));
  const bossPct = Math.max(
    0,
    Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100),
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none font-mono text-sky-100">
      {/* ================= TITLE SCREEN ================= */}
      {hud.phase === 'title' && (
        <div className="pointer-events-none flex h-full w-full flex-col justify-between p-4 sm:p-8 lg:p-12">
          <div className="hidden sm:block" />

          <div className="pointer-events-auto my-auto max-h-[84vh] max-w-md overflow-y-auto rounded-lg border border-sky-400/25 bg-[#050b1c]/85 p-5 shadow-[0_0_45px_rgba(20,110,220,0.28)] sm:p-7">
            {/* Custom SVG Title Emblem */}
            <svg
              viewBox="0 0 360 112"
              className="mb-3 w-full max-w-[320px]"
              role="img"
              aria-label="Galactic Defender 3D"
            >
              <defs>
                <linearGradient id="gdTitleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#7df9ff" />
                  <stop offset="100%" stopColor="#2d7dff" />
                </linearGradient>
              </defs>
              <path
                d="M12 22 L46 22 L56 12 L304 12 L314 22 L348 22"
                fill="none"
                stroke="rgba(125,249,255,0.45)"
                strokeWidth="1.5"
              />
              <polygon
                points="180,4 190,15 180,22 170,15"
                fill="#7df9ff"
              />
              <text
                x="180"
                y="62"
                textAnchor="middle"
                fill="url(#gdTitleGrad)"
                fontSize="38"
                fontWeight="900"
                letterSpacing="4"
                fontFamily="Courier New, monospace"
              >
                GALACTIC
              </text>
              <text
                x="180"
                y="98"
                textAnchor="middle"
                fill="#59b4ff"
                fontSize="30"
                fontWeight="800"
                letterSpacing="5"
                fontFamily="Courier New, monospace"
              >
                DEFENDER 3D
              </text>
            </svg>

            <div className="mb-5 flex items-baseline justify-between border-y border-sky-400/20 py-2.5 text-xs">
              <div>
                <span className="block text-[10px] tracking-widest text-sky-300/70">
                  HIGH SCORE
                </span>
                <span
                  className="text-lg font-bold tracking-wider text-amber-300 tabular-nums"
                  data-testid="title-highscore"
                >
                  {String(hud.highScore).padStart(6, '0')}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] tracking-widest text-sky-300/70">
                  WAVE TERBAIK
                </span>
                <span className="text-lg font-bold tracking-wider text-cyan-300 tabular-nums">
                  {String(hud.bestWave).padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="flex-1 cursor-pointer rounded border-2 border-cyan-300/80 bg-cyan-500/20 px-5 py-3 text-base font-bold tracking-[0.18em] text-cyan-50 shadow-[0_0_24px_rgba(56,217,255,0.3)] transition hover:bg-cyan-400/30 active:scale-[0.98]"
              >
                MULAI MAIN
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded border border-sky-400/35 bg-sky-950/60 text-sky-200 transition hover:border-cyan-300"
              >
                <VolumeIcon muted={hud.muted} />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold tracking-wider">
              <span className="text-sky-400">[W] WEAPON</span>
              <span className="text-emerald-400">[S] SHIELD</span>
              <span className="text-rose-400">[H] REPAIR</span>
            </div>
          </div>

          <p className="text-center text-[11px] tracking-[0.2em] text-sky-200/70">
            WASD / PANAH GERAK · DRAG LAYAR · AUTO-FIRE · P PAUSE · M MUTE · SPASI MULAI
          </p>
        </div>
      )}

      {/* ================= PLAYING HUD ================= */}
      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <>
          {/* Top-left vitality & wave cluster */}
          <div className="fixed left-4 top-4 flex flex-col gap-2 sm:left-6 sm:top-5">
            <div className="flex items-center gap-1.5 rounded border border-sky-400/25 bg-[#050b1c]/80 px-3 py-1.5">
              {Array.from({ length: hud.maxLives }).map((_, i) => (
                <HeartSocket key={i} filled={i < hud.lives} />
              ))}
            </div>

            <div className="flex items-center gap-3 px-1">
              <span
                className="text-xs font-bold tracking-[0.2em] text-cyan-300 tabular-nums"
                data-testid="hud-wave"
              >
                WAVE {String(hud.wave).padStart(2, '0')}
              </span>
              {hud.shield > 0 && (
                <span className="text-[11px] font-bold tracking-widest text-emerald-400">
                  SHIELD ON
                </span>
              )}
            </div>

            {hud.weaponLevel > 1 && (
              <div className="w-36 rounded border border-sky-400/25 bg-[#050b1c]/80 px-2.5 py-1.5">
                <div className="mb-1 flex justify-between text-[10px] font-bold tracking-wider text-sky-200">
                  <span>WEAPON LV{hud.weaponLevel}</span>
                  <span className="tabular-nums">
                    {hud.weaponTimer.toFixed(1)}s
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-900">
                  <div
                    className={`h-full transition-[width] duration-75 ${
                      hud.weaponLevel === 3 ? 'bg-fuchsia-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${weaponPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Top-right score & utility controls */}
          <div className="fixed right-4 top-4 flex items-start gap-3 sm:right-6 sm:top-5">
            <div className="rounded border border-sky-400/25 bg-[#050b1c]/80 px-3.5 py-1.5 text-right">
              <div className="text-[10px] font-bold tracking-[0.22em] text-sky-300/75">
                SKOR
              </div>
              <div
                className="text-2xl font-black leading-tight tracking-wider text-cyan-50 tabular-nums"
                data-testid="hud-score"
              >
                {String(hud.score).padStart(6, '0')}
              </div>
              <div className="text-[10px] tracking-widest text-sky-300/65 tabular-nums">
                HI {String(hud.highScore).padStart(6, '0')}
              </div>
            </div>

            <div className="pointer-events-auto flex flex-col gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (hud.phase === 'paused') onResume();
                  else onPause();
                }}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded border border-sky-400/35 bg-[#050b1c]/85 text-sky-200 transition hover:border-cyan-300"
              >
                <PauseIcon />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded border border-sky-400/35 bg-[#050b1c]/85 text-sky-200 transition hover:border-cyan-300"
              >
                <VolumeIcon muted={hud.muted} />
              </button>
            </div>
          </div>

          {/* Top-center Boss Dreadnought HP bar */}
          {hud.bossActive && (
            <div className="fixed left-1/2 top-4 w-[min(400px,42vw)] -translate-x-1/2 rounded border border-rose-400/45 bg-[#12040a]/85 px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-widest text-rose-200">
                <span>BOSS DREADNOUGHT</span>
                <span className="tabular-nums">
                  {hud.bossHp} / {hud.bossMaxHp}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-sm bg-rose-950/90">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300 transition-[width] duration-100"
                  style={{ width: `${bossPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Wave / Boss announcement banner */}
          {hud.bannerTitle && hud.phase === 'playing' && (
            <div className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-md border border-cyan-300/35 bg-[#040918]/80 px-8 py-4 text-center">
              <div
                className={`text-3xl font-black tracking-[0.22em] sm:text-4xl ${
                  hud.bannerType === 'boss' ? 'text-rose-400' : 'text-cyan-300'
                }`}
              >
                {hud.bannerTitle}
              </div>
              <div className="mt-1 text-xs font-bold tracking-[0.26em] text-sky-200">
                {hud.bannerSub}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= PAUSE MODAL ================= */}
      {hud.phase === 'paused' && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[#020510]/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-cyan-400/35 bg-[#060d20]/95 p-6 text-center shadow-[0_0_45px_rgba(30,130,240,0.3)]">
            <h2 className="mb-2 text-3xl font-black tracking-[0.24em] text-cyan-300">
              PAUSED
            </h2>
            <p className="mb-6 text-xs tracking-wider text-sky-200/80">
              Tekan P atau ESC untuk melanjutkan
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="cursor-pointer rounded border border-cyan-300/80 bg-cyan-500/20 py-2.5 text-sm font-bold tracking-[0.18em] text-cyan-50 transition hover:bg-cyan-400/30"
              >
                LANJUTKAN
              </button>
              <button
                type="button"
                onClick={onStart}
                className="cursor-pointer rounded border border-sky-400/35 bg-sky-950/60 py-2.5 text-sm font-bold tracking-[0.16em] text-sky-200 transition hover:border-cyan-300"
              >
                MULAI ULANG
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="cursor-pointer rounded border border-sky-400/20 bg-transparent py-2 text-xs font-bold tracking-[0.16em] text-sky-300/80 transition hover:text-sky-100"
              >
                LAYAR UTAMA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= GAME OVER MODAL ================= */}
      {hud.phase === 'gameover' && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[#05020a]/75 p-4">
          <div className="w-full max-w-md rounded-lg border border-rose-400/40 bg-[#080918]/95 p-7 text-center shadow-[0_0_55px_rgba(220,40,80,0.3)]">
            <h2 className="text-4xl font-black tracking-[0.2em] text-rose-400">
              GAME OVER
            </h2>
            {hud.newRecord && (
              <div className="mt-2 text-xs font-bold tracking-[0.22em] text-amber-300">
                NEW HIGH SCORE
              </div>
            )}

            <div className="my-5 grid grid-cols-3 gap-2 rounded border border-sky-400/25 bg-[#040712]/80 p-4">
              <div>
                <span className="block text-[10px] tracking-widest text-sky-300/70">
                  SKOR AKHIR
                </span>
                <span className="mt-1 block text-lg font-black text-cyan-50 tabular-nums">
                  {String(hud.score).padStart(6, '0')}
                </span>
              </div>
              <div>
                <span className="block text-[10px] tracking-widest text-sky-300/70">
                  WAVE
                </span>
                <span className="mt-1 block text-lg font-black text-cyan-300 tabular-nums">
                  {String(hud.wave).padStart(2, '0')}
                </span>
              </div>
              <div>
                <span className="block text-[10px] tracking-widest text-sky-300/70">
                  HIGH SCORE
                </span>
                <span className="mt-1 block text-lg font-black text-amber-300 tabular-nums">
                  {String(hud.highScore).padStart(6, '0')}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="cursor-pointer rounded border-2 border-cyan-300/85 bg-cyan-500/25 py-3 text-sm font-bold tracking-[0.2em] text-cyan-50 transition hover:bg-cyan-400/35"
              >
                MAIN LAGI
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="cursor-pointer rounded border border-sky-400/25 bg-transparent py-2 text-xs font-bold tracking-[0.16em] text-sky-300/80 transition hover:text-sky-100"
              >
                LAYAR UTAMA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
