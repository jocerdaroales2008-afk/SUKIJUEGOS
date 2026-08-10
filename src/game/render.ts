import { TIERS } from './tiers';
import type { Circle, Particle, FloatingScore } from './physics';

export interface RenderState {
  circles: Circle[];
  particles: Particle[];
  floatingScores: FloatingScore[];
  aimX: number;
  aimY: number;
  dangerY: number;
  width: number;
  height: number;
  shake: number;
  dangerLevel: number; // 0..1 how close to game over
  currentTier: number;
  canDrop: boolean;
  dropCooldown: number; // 0..1
}

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + (255 - r) * percent)));
  g = Math.max(0, Math.min(255, Math.round(g + (255 - g) * percent)));
  b = Math.max(0, Math.min(255, Math.round(b + (255 - b) * percent)));
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.round(r * (1 - percent)));
  g = Math.max(0, Math.round(g * (1 - percent)));
  b = Math.max(0, Math.round(b * (1 - percent)));
  return `rgb(${r},${g},${b})`;
}

export function drawCircle(ctx: CanvasRenderingContext2D, c: Circle) {
  const t = TIERS[c.tier];
  const r = t.radius * c.scale;
  if (r < 0.5) return;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rot);

  // soft shadow
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(2, r * 0.25, r * 0.92, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // glow ring for big tiers
  if (c.tier >= 6) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = t.glow;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // main body radial gradient
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, shadeColor(t.color, 0.35));
  grad.addColorStop(0.7, t.color);
  grad.addColorStop(1, darkenColor(t.color, 0.22));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // rim
  ctx.lineWidth = Math.max(1.5, r * 0.04);
  ctx.strokeStyle = darkenColor(t.color, 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  // glossy highlight
  ctx.save();
  ctx.globalAlpha = 0.55;
  const hl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.55);
  hl.addColorStop(0, 'rgba(255,255,255,0.9)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.45, r * 0.3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // small specular dot
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(-r * 0.42, -r * 0.48, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, s: RenderState) {
  const { width, height } = s;
  ctx.save();

  // screen shake
  if (s.shake > 0.1) {
    const sx = (Math.random() - 0.5) * s.shake;
    const sy = (Math.random() - 0.5) * s.shake;
    ctx.translate(sx, sy);
  }

  // clear
  ctx.clearRect(-20, -20, width + 40, height + 40);

  // background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#1a1530');
  bg.addColorStop(0.5, '#241a3a');
  bg.addColorStop(1, '#15102a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // subtle grid dots
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffffff';
  for (let x = 20; x < width; x += 40) {
    for (let y = 20; y < height; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // play area side walls glow
  ctx.save();
  ctx.globalAlpha = 0.5;
  const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
  wallGrad.addColorStop(0, 'rgba(120,180,255,0.0)');
  wallGrad.addColorStop(1, 'rgba(120,180,255,0.15)');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, 4, height);
  ctx.fillRect(width - 4, 0, 4, height);
  ctx.restore();

  // danger line
  const dangerAlpha = 0.25 + s.dangerLevel * 0.6;
  ctx.save();
  ctx.strokeStyle = `rgba(255, ${Math.round(120 - s.dangerLevel * 80)}, ${Math.round(120 - s.dangerLevel * 80)}, ${dangerAlpha})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, s.dangerY);
  ctx.lineTo(width, s.dangerY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // particles
  for (const p of s.particles) {
    const a = 1 - p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // circles
  for (const c of s.circles) {
    drawCircle(ctx, c);
  }

  // floating scores
  for (const f of s.floatingScores) {
    const a = 1 - f.life / f.maxLife;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(`+${f.value}`, f.x, f.y);
    ctx.restore();
  }

  // aim guide
  if (s.canDrop) {
    const t = TIERS[s.currentTier];
    const r = t.radius;
    // preview circle at aim position
    ctx.save();
    ctx.globalAlpha = 0.5 + s.dropCooldown * 0.5;
    drawCircle(ctx, {
      x: s.aimX,
      y: s.aimY,
      vx: 0,
      vy: 0,
      tier: s.currentTier,
      scale: 1,
      id: -1,
      rot: 0,
      rotV: 0,
      bornAt: 0,
    });
    ctx.restore();

    // dotted drop line
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(s.aimX, s.aimY + r);
    ctx.lineTo(s.aimX, height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else {
    // cooldown indicator
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.aimX, s.aimY, TIERS[s.currentTier].radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.dropCooldown);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
