import { Container, Graphics } from "pixi.js";

interface DebrisParticle {
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  rotation: number;
  vRot: number;
  life: number;
  maxLife: number;
}

export class TerrainDebrisManager extends Container {
  private particles: DebrisParticle[] = [];

  constructor() {
    super();
  }

  public spawnSplash(
    cx: number,
    cy: number,
    radius: number = 28,
    primaryColor: number = 0x593a1d,
    grassColor: number = 0x4da333
  ) {
    const count = 14 + Math.floor(Math.random() * 8); // 14 to 21 pieces per impact
    const colors = [
      primaryColor,
      0x734d26, // Lighter soil
      0x3e2712, // Dark earth
      0x64748b, // Slate rock
      0x475569, // Gray stone
      grassColor, // Grass chunk
    ];

    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 5 + Math.random() * 9; // 5px to 14px size

      // Generate irregular organic rock / chunk polygon
      const numPts = 4 + Math.floor(Math.random() * 3); // 4 to 6 vertices
      const polyPts: number[] = [];
      for (let p = 0; p < numPts; p++) {
        const ang = (p / numPts) * Math.PI * 2;
        const rad = size * (0.65 + Math.random() * 0.45);
        polyPts.push(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }

      g.poly(polyPts);
      g.fill({ color });
      g.stroke({ width: 1.5, color: 0x1c1917, alpha: 0.85 }); // Authentic dark crust border

      // Explosive upward/outward ejection angle (-160 to -20 deg)
      const ejectAngle = (-160 + Math.random() * 140) * (Math.PI / 180);
      const ejectSpeed = 5.0 + Math.random() * 8.5; // 5 to 13.5 px/frame

      const spawnOffsetX = (Math.random() - 0.5) * (radius * 0.8);
      const spawnOffsetY = (Math.random() - 0.3) * (radius * 0.5);

      const px = cx + spawnOffsetX;
      const py = cy + spawnOffsetY;

      g.x = px;
      g.y = py;
      this.addChild(g);

      const maxLife = 40 + Math.floor(Math.random() * 25);
      this.particles.push({
        graphics: g,
        x: px,
        y: py,
        vx: Math.cos(ejectAngle) * ejectSpeed,
        vy: Math.sin(ejectAngle) * ejectSpeed,
        gravity: 0.36 + Math.random() * 0.08,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.28,
        life: 0,
        maxLife,
      });
    }
  }

  public update(dt: number = 1) {
    const clampedDt = Math.max(0.5, Math.min(2.0, dt));

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += clampedDt;

      // Ballistic motion
      p.vy += p.gravity * clampedDt;
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
      p.rotation += p.vRot * clampedDt;

      p.graphics.x = p.x;
      p.graphics.y = p.y;
      p.graphics.rotation = p.rotation;

      // Smooth fade out towards end of lifespan
      const remaining = p.maxLife - p.life;
      if (remaining < 15) {
        p.graphics.alpha = Math.max(0, remaining / 15);
      }

      if (p.life >= p.maxLife) {
        this.removeChild(p.graphics);
        p.graphics.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  public clearAll() {
    for (const p of this.particles) {
      this.removeChild(p.graphics);
      p.graphics.destroy();
    }
    this.particles = [];
  }
}

