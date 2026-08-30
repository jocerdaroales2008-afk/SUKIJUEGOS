import { useCallback, useEffect, useRef, useState } from 'react';
import { PhysicsEngine } from '@/game/physics';
import { TIERS, SPAWNABLE_TIERS } from '@/game/tiers';
import { render } from '@/game/render';

const GAME_WIDTH = 420;
const GAME_HEIGHT = 600;
const DANGER_Y = 90;
const AIM_Y = 50;
const DROP_COOLDOWN = 0.28; // seconds between drops

const HIGH_SCORE_KEY = 'suika-merge-highscore';

function randomSpawnTier(): number {
  // weighted toward smaller tiers
  const r = Math.random();
  if (r < 0.5) return 0;
  if (r < 0.8) return 1;
  if (r < 0.95) return 2;
  return 3;
}

export default function SuikaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const aimXRef = useRef<number>(GAME_WIDTH / 2);
  const dropCooldownRef = useRef<number>(0);
  const currentTierRef = useRef<number>(0);
  const nextTierRef = useRef<number>(1);
  const scoreRef = useRef<number>(0);
  const gameOverRef = useRef<boolean>(false);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [nextTier, setNextTier] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // load high score
  useEffect(() => {
    const stored = localStorage.getItem(HIGH_SCORE_KEY);
    if (stored) setHighScore(parseInt(stored, 10) || 0);
  }, []);

  // init engine
  useEffect(() => {
    const engine = new PhysicsEngine(
      {
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        gravity: 0.55,
        restitution: 0.25,
        wallFriction: 0.96,
        groundFriction: 0.92,
        dangerY: DANGER_Y,
        aimY: AIM_Y,
      },
      {
        onMerge: (_tier, _x, _y) => {},
        onGameOver: () => {
          gameOverRef.current = true;
          setGameOver(true);
          setHighScore((prev) => {
            const cur = scoreRef.current;
            if (cur > prev) {
              localStorage.setItem(HIGH_SCORE_KEY, String(cur));
              return cur;
            }
            return prev;
          });
        },
      }
    );
    engineRef.current = engine;
    currentTierRef.current = randomSpawnTier();
    nextTierRef.current = randomSpawnTier();
    setNextTier(nextTierRef.current);

    lastTimeRef.current = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 1 / 20);
      lastTimeRef.current = now;

      if (dropCooldownRef.current > 0) {
        dropCooldownRef.current = Math.max(0, dropCooldownRef.current - dt);
      }

      if (!gameOverRef.current) {
        const gained = engine.step(dt);
        if (gained > 0) {
          scoreRef.current += gained;
          setScore(scoreRef.current);
        }
      } else {
        // keep particles animating
        engine.step(dt);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const canDrop = dropCooldownRef.current <= 0 && !gameOverRef.current;
          const cooldownProgress = canDrop ? 1 : 1 - dropCooldownRef.current / DROP_COOLDOWN;
          render(ctx, {
            circles: engine.circles,
            particles: engine.particles,
            floatingScores: engine.floatingScores,
            aimX: aimXRef.current,
            aimY: AIM_Y,
            dangerY: DANGER_Y,
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            shake: engine.shake,
            dangerLevel: Math.min(1, engine.dangerAccum / 1.2),
            currentTier: currentTierRef.current,
            canDrop,
            dropCooldown: cooldownProgress,
          });
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [resetKey]);

  const handleMove = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = GAME_WIDTH / rect.width;
    const x = (clientX - rect.left) * scale;
    const t = TIERS[currentTierRef.current];
    aimXRef.current = Math.max(t.radius, Math.min(GAME_WIDTH - t.radius, x));
  }, []);

  const handleDrop = useCallback(() => {
    if (gameOverRef.current || dropCooldownRef.current > 0) return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.spawn(aimXRef.current, currentTierRef.current);
    currentTierRef.current = nextTierRef.current;
    nextTierRef.current = randomSpawnTier();
    setNextTier(nextTierRef.current);
    dropCooldownRef.current = DROP_COOLDOWN;
  }, []);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    gameOverRef.current = false;
    setScore(0);
    setGameOver(false);
    dropCooldownRef.current = 0;
    currentTierRef.current = randomSpawnTier();
    nextTierRef.current = randomSpawnTier();
    setNextTier(nextTierRef.current);
    aimXRef.current = GAME_WIDTH / 2;
    setResetKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f0a1f] via-[#1a1230] to-[#0a0815] flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Suika Merge</h1>
            <p className="text-xs text-white/40">Drop &amp; fuse the fruits</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-white/5 backdrop-blur rounded-2xl px-4 py-2 border border-white/10 text-center min-w-[88px]">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Score</div>
              <div className="text-xl font-bold text-white tabular-nums">{score.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl px-4 py-2 border border-white/10 text-center min-w-[88px]">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Best</div>
              <div className="text-xl font-bold text-amber-300 tabular-nums">{highScore.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Game area */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="block w-full h-auto cursor-pointer touch-none"
            onMouseMove={(e) => handleMove(e.clientX)}
            onMouseDown={(e) => {
              handleMove(e.clientX);
              handleDrop();
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) handleMove(e.touches[0].clientX);
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) handleMove(e.touches[0].clientX);
            }}
            onTouchEnd={(e) => {
              handleDrop();
              e.preventDefault();
            }}
          />

          {/* Next preview - top right */}
          <div className="absolute top-3 right-3 bg-black/40 backdrop-blur rounded-2xl px-3 py-2 border border-white/10 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-white/50">Next</span>
            <div
              className="rounded-full border"
              style={{
                width: 26,
                height: 26,
                background: `radial-gradient(circle at 35% 35%, ${TIERS[nextTier].glow}, ${TIERS[nextTier].color} 70%, ${TIERS[nextTier].shade})`,
                borderColor: TIERS[nextTier].shade,
              }}
            />
          </div>

          {/* Game Over overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-[fadeIn_0.3s_ease]">
              <div className="text-center px-8">
                <div className="text-4xl font-black text-white mb-1 tracking-tight">Game Over</div>
                <p className="text-white/50 text-sm mb-5">The fruits crossed the line!</p>
                <div className="flex gap-3 justify-center mb-6">
                  <div className="bg-white/5 rounded-2xl px-5 py-3 border border-white/10">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Score</div>
                    <div className="text-2xl font-bold text-white tabular-nums">{score.toLocaleString()}</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl px-5 py-3 border border-white/10">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Best</div>
                    <div className="text-2xl font-bold text-amber-300 tabular-nums">{highScore.toLocaleString()}</div>
                  </div>
                </div>
                {score >= highScore && score > 0 && (
                  <div className="text-amber-300 text-sm font-semibold mb-4">New record!</div>
                )}
                <button
                  onClick={restart}
                  className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-bold px-8 py-3 rounded-2xl shadow-lg shadow-orange-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-white/30 text-xs mt-4">
          Move to aim &middot; Click or tap to drop
        </p>
      </div>
    </div>
  );
}
