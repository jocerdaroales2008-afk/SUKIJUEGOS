import { useEffect, useRef } from 'react';
import { drawCircle } from '@/game/render';
import type { BoardSnapshot } from '@/multiplayer/types';

const WIDTH = 420;
const HEIGHT = 600;

interface OpponentBoardProps {
  snapshot: BoardSnapshot | null;
}

export default function OpponentBoard({ snapshot }: OpponentBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#1a1530');
    bg.addColorStop(0.5, '#241a3a');
    bg.addColorStop(1, '#15102a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (!snapshot) return;
    for (const c of snapshot.circles) {
      drawCircle(ctx, { ...c, vx: 0, vy: 0, scale: 1, id: 0, rot: 0, rotV: 0, bornAt: 0 });
    }
  }, [snapshot]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block w-full h-auto" />

      {snapshot?.gameOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <span className="text-white font-bold text-lg">¡Torre desbordada!</span>
        </div>
      )}

      {!snapshot && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/30 text-sm">Esperando datos del rival...</span>
        </div>
      )}
    </div>
  );
}