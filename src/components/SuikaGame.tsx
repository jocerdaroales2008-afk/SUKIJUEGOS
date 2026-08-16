import { useCallback, useEffect, useRef, useState } from 'react';
import { PhysicsEngine } from '@/game/physics';
import { TIERS } from '@/game/tiers';
import { render } from '@/game/render';
import type { BoardSnapshot } from '@/multiplayer/types';

const GAME_WIDTH = 420;
const GAME_HEIGHT = 600;
const DANGER_Y = 90;
const AIM_Y = 50;
const DROP_COOLDOWN = 0.28;
const SNAPSHOT_INTERVAL = 0.15;

function randomSpawnTier(): number {
  const r = Math.random();
  if (r < 0.5) return 0;
  if (r < 0.8) return 1;
  if (r < 0.95) return 2;
  return 3;
}

interface PlayerBoardProps {
  active: boolean;
  onScoreChange: (score: number) => void;
  onGameOverChange: (over: boolean) => void;
  onSnapshot: (snapshot: BoardSnapshot) => void;
  resetSignal: number;
}

export default function PlayerBoard({
  active,
  onScoreChange,
  onGameOverChange,
  onSnapshot,
  resetSignal,
}: PlayerBoardProps) {
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
  const activeRef = useRef<boolean>(active);
  const snapshotAccumRef = useRef<number>(0);

  const [nextTier, setNextTier] = useState(1);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

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
        onMerge: () => {},
        onGameOver: () => {
          gameOverRef.current = true;
          setGameOver(true);
          onGameOverChange(true);
        },
      }
    );
    engineRef.current = engine;
    currentTierRef.current = randomSpawnTier();
    nextTierRef.current = randomSpawnTier();
    setNextTier(nextTierRef.current);
    scoreRef.current = 0;
    gameOverRef.current = false;
    setGameOver(false);
    onScoreChange(0);
    onGameOverChange(false);
    dropCooldownRef.current = 0;
    aimXRef.current = GAME_WIDTH / 2;

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
          onScoreChange(scoreRef.current);
        }
      } else {
        engine.step(dt);
      }

      snapshotAccumRef.current += dt;
      if (snapshotAccumRef.current >= SNAPSHOT_INTERVAL) {
        snapshotAccumRef.current = 0;
        onSnapshot({
          circles: engine.circles.map((c) => ({ x: c.x, y: c.y, tier: c.tier })),
          score: scoreRef.current,
          gameOver: gameOverRef.current,
        });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const canDrop = dropCooldownRef.current <= 0 && !gameOverRef.current && activeRef.current;
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
  }, [resetSignal]);

  const handleMove = useCallback((clientX: number) => {
    if (!activeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = GAME_WIDTH / rect.width;
    const x = (clientX - rect.left) * scale;
    const t = TIERS[currentTierRef.current];
    aimXRef.current = Math.max(t.radius, Math.min(GAME_WIDTH - t.radius, x));
  }, []);

  const handleDrop = useCallback(() => {
    if (!activeRef.current || gameOverRef.current || dropCooldownRef.current > 0) return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.spawn(aimXRef.current, currentTierRef.current);
    currentTierRef.current = nextTierRef.current;
    nextTierRef.current = randomSpawnTier();
    setNextTier(nextTierRef.current);
    dropCooldownRef.current = DROP_COOLDOWN;
  }, []);

  return (
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

      {!active && !gameOver && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-white/60 text-sm font-semibold">Esperando inicio...</span>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <span className="text-white font-bold text-lg">¡Torre desbordada!</span>
        </div>
      )}
    </div>
  );
}
