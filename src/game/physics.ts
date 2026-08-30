import { TIERS, MAX_TIER } from './tiers';

export interface Circle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tier: number;
  // visual-only: scale animates from 0 -> 1 on spawn/merge
  scale: number;
  // merge flag
  merging?: boolean;
  // unique id for tracking
  id: number;
  // rotation for subtle visual
  rot: number;
  rotV: number;
  // pop animation timestamp
  bornAt: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingScore {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface PhysicsConfig {
  width: number;
  height: number;
  gravity: number;
  restitution: number;
  wallFriction: number;
  groundFriction: number;
  // y position of the danger line (top)
  dangerY: number;
  // y position where the player aims from
  aimY: number;
}

export interface PhysicsCallbacks {
  onMerge: (tier: number, x: number, y: number) => void;
  onGameOver: () => void;
}

let nextId = 1;

export class PhysicsEngine {
  circles: Circle[] = [];
  particles: Particle[] = [];
  floatingScores: FloatingScore[] = [];
  cfg: PhysicsConfig;
  cb: PhysicsCallbacks;
  gameOver = false;
  // how long the danger line has been breached (ms)
  dangerAccum = 0;
  // shake amount
  shake = 0;

  constructor(cfg: PhysicsConfig, cb: PhysicsCallbacks) {
    this.cfg = cfg;
    this.cb = cb;
  }

  reset() {
    this.circles = [];
    this.particles = [];
    this.floatingScores = [];
    this.gameOver = false;
    this.dangerAccum = 0;
    this.shake = 0;
  }

  spawn(x: number, tier: number): Circle {
    const t = TIERS[tier];
    const c: Circle = {
      x,
      y: this.cfg.aimY + t.radius,
      vx: 0,
      vy: 0,
      tier,
      scale: 0.2,
      id: nextId++,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.05,
      bornAt: performance.now(),
    };
    this.circles.push(c);
    return c;
  }

  private addMergeParticles(x: number, y: number, color: string, radius: number) {
    const count = Math.min(24, 8 + Math.floor(radius / 4));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private addFloatingScore(x: number, y: number, value: number, color: string) {
    this.floatingScores.push({
      x,
      y,
      value,
      life: 0,
      maxLife: 1.0,
      color,
    });
  }

  // returns score gained this step
  step(dt: number): number {
    if (this.gameOver) return 0;
    dt = Math.min(dt, 1 / 30); // clamp
    let scoreGained = 0;

    const g = this.cfg.gravity;
    const W = this.cfg.width;
    const H = this.cfg.height;

    // integrate
    for (const c of this.circles) {
      if (c.merging) continue;
      const t = TIERS[c.tier];
      c.vy += g * dt;
      c.x += c.vx * dt * 60;
      c.y += c.vy * dt * 60;
      c.rot += c.rotV * dt * 60;
      // scale ease toward 1
      c.scale += (1 - c.scale) * Math.min(1, dt * 12);

      // walls
      if (c.x - t.radius < 0) {
        c.x = t.radius;
        c.vx = -c.vx * this.cfg.restitution;
        c.vx *= this.cfg.wallFriction;
      } else if (c.x + t.radius > W) {
        c.x = W - t.radius;
        c.vx = -c.vx * this.cfg.restitution;
        c.vx *= this.cfg.wallFriction;
      }
      // floor
      if (c.y + t.radius > H) {
        c.y = H - t.radius;
        c.vy = -c.vy * this.cfg.restitution;
        c.vx *= this.cfg.groundFriction;
        c.vy *= this.cfg.groundFriction;
        if (Math.abs(c.vy) < 0.4) c.vy = 0;
      }
    }

    // resolve collisions (multiple iterations for stability)
    const iterations = 3;
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < this.circles.length; i++) {
        const a = this.circles[i];
        if (a.merging) continue;
        const ta = TIERS[a.tier];
        for (let j = i + 1; j < this.circles.length; j++) {
          const b = this.circles[j];
          if (b.merging) continue;
          const tb = TIERS[b.tier];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = ta.radius + tb.radius;
          if (dist < minDist && dist > 0.0001) {
            // merge check
            if (a.tier === b.tier && a.tier < MAX_TIER && iter === 0) {
              this.merge(a, b);
              scoreGained += TIERS[a.tier + 1].points;
              break;
            }
            // positional correction
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const total = ta.radius + tb.radius;
            const aRatio = tb.radius / total;
            const bRatio = ta.radius / total;
            a.x -= nx * overlap * aRatio;
            a.y -= ny * overlap * aRatio;
            b.x += nx * overlap * bRatio;
            b.y += ny * overlap * bRatio;

            // velocity exchange (simple elastic-ish)
            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal < 0) {
              const e = this.cfg.restitution;
              const ma = ta.radius * ta.radius;
              const mb = tb.radius * tb.radius;
              const jImp = (-(1 + e) * velAlongNormal) / (1 / ma + 1 / mb);
              const ix = jImp * nx;
              const iy = jImp * ny;
              a.vx -= ix / ma;
              a.vy -= iy / ma;
              b.vx += ix / mb;
              b.vy += iy / mb;
              // tangential friction
              a.vx *= 0.99;
              b.vx *= 0.99;
            }
          }
        }
      }
    }

    // remove merged
    if (this.circles.some((c) => c.merging)) {
      this.circles = this.circles.filter((c) => !c.merging);
    }

    // particles
    for (const p of this.particles) {
      p.life += dt;
      p.vy += g * 0.3 * dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vx *= 0.98;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);

    // floating scores
    for (const f of this.floatingScores) {
      f.life += dt;
      f.y -= 40 * dt;
    }
    this.floatingScores = this.floatingScores.filter((f) => f.life < f.maxLife);

    // shake decay
    this.shake *= Math.pow(0.001, dt);

    // danger line check
    let breached = false;
    for (const c of this.circles) {
      const t = TIERS[c.tier];
      // only count settled circles (not freshly dropped)
      if (performance.now() - c.bornAt < 1500) continue;
      if (c.y - t.radius < this.cfg.dangerY) {
        breached = true;
        break;
      }
    }
    if (breached) {
      this.dangerAccum += dt;
      if (this.dangerAccum > 1.2) {
        this.gameOver = true;
        this.cb.onGameOver();
      }
    } else {
      this.dangerAccum = Math.max(0, this.dangerAccum - dt * 2);
    }

    return scoreGained;
  }

  private merge(a: Circle, b: Circle) {
    const newTier = a.tier + 1;
    const nt = TIERS[newTier];
    const nx = (a.x + b.x) / 2;
    const ny = (a.y + b.y) / 2;
    a.merging = true;
    b.merging = true;
    const merged: Circle = {
      x: nx,
      y: ny,
      vx: (a.vx + b.vx) / 2,
      vy: (a.vy + b.vy) / 2 - 1,
      tier: newTier,
      scale: 0.4,
      id: nextId++,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.04,
      bornAt: performance.now(),
    };
    this.circles.push(merged);
    this.addMergeParticles(nx, ny, nt.color, nt.radius);
    this.addFloatingScore(nx, ny, nt.points, nt.color);
    this.shake = Math.min(8, this.shake + nt.radius * 0.06);
    this.cb.onMerge(newTier, nx, ny);
  }
}
