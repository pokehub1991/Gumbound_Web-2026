import { Container, Graphics } from "pixi.js";

interface DebrisParticle {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
  type: "rock" | "spark" | "dust";
  size: number;
}

export class DestructionParticles {
  private container: Container;
  private particles: DebrisParticle[] = [];

  constructor(container: Container) {
    this.container = container;
  }

  public spawnExplosionDebris(x: number, y: number, bungeRadius: number = 40, damage: number = 200) {
    const magnitude = Math.max(0.5, Math.min(2.5, (bungeRadius / 40) * 0.7 + (damage / 250) * 0.3));

    // 1. Rock & Terrain Rubble Chunks
    const rockColors = [0xc2884a, 0x9e472a, 0x64748b, 0x475569, 0x334155, 0x78716c];
    const rockCount = Math.floor((14 + bungeRadius * 0.6) * Math.min(1.5, magnitude));

    for (let i = 0; i < rockCount; i++) {
      const gfx = new Graphics();
      const color = rockColors[Math.floor(Math.random() * rockColors.length)];
      const size = Math.random() * 4.5 * magnitude + 3.0;

      // Draw irregular polygonal jagged rock fragment
      gfx.beginPath();
      const numVerts = 4 + Math.floor(Math.random() * 3);
      for (let v = 0; v < numVerts; v++) {
        const rad = (v / numVerts) * Math.PI * 2;
        const r = size * (0.65 + Math.random() * 0.7);
        const px = Math.cos(rad) * r;
        const py = Math.sin(rad) * r;
        if (v === 0) gfx.moveTo(px, py);
        else gfx.lineTo(px, py);
      }
      gfx.closePath();
      gfx.fill({ color, alpha: 0.95 });
      gfx.stroke({ width: 0.8, color: 0x1c1917, alpha: 0.7 });

      // Outward explosive trajectory radiating upward from crater
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.85;
      const speed = (Math.random() * 8 + 3.5) * (0.8 + magnitude * 0.4);

      gfx.position.set(x, y);
      this.container.addChild(gfx);

      this.particles.push({
        gfx,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.35,
        life: 0,
        maxLife: Math.random() * 900 + 1600, // 1600 - 2500ms (authentic tumbling debris into abyss)
        type: "rock",
        size,
      });
    }

    // 2. Fiery Sparks & Glowing Embers
    const sparkCount = Math.floor((18 + bungeRadius * 0.7) * magnitude);
    const sparkColors = [0xfef08a, 0xfde047, 0xf97316, 0xef4444];

    for (let i = 0; i < sparkCount; i++) {
      const gfx = new Graphics();
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      const size = Math.random() * 2.5 + 1.5;

      gfx.circle(0, 0, size).fill({ color, alpha: 1.0 });

      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 12 + 5.0) * (0.8 + magnitude * 0.4);

      gfx.position.set(x, y);
      this.container.addChild(gfx);

      this.particles.push({
        gfx,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: 0,
        rotSpeed: 0,
        life: 0,
        maxLife: Math.random() * 320 + 260, // 260 - 580ms
        type: "spark",
        size,
      });
    }

    // 3. Expanding Dust Shockwave Puffs
    const dustCount = Math.floor(6 + magnitude * 4);
    for (let i = 0; i < dustCount; i++) {
      const gfx = new Graphics();
      const radius = Math.random() * 8 + 8;
      gfx.circle(0, 0, radius).fill({ color: 0xd6b485, alpha: 0.35 });

      const angle = (i / dustCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = Math.random() * 3.0 + 1.2;

      gfx.position.set(x, y);
      this.container.addChild(gfx);

      this.particles.push({
        gfx,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        life: 0,
        maxLife: Math.random() * 400 + 550, // 550 - 950ms
        type: "dust",
        size: radius,
      });
    }
  }

  public spawnMuzzleBlast(x: number, y: number, angleDeg: number, shotType: number = 0) {
    const rad = (angleDeg * Math.PI) / 180;
    const powerScale = shotType === 2 ? 1.75 : shotType === 1 ? 1.3 : 1.0;

    // 1. Instant Flash Core (conical blast centered on muzzle)
    const flashGfx = new Graphics();
    const flashLen = 20 * powerScale;
    const flashWidth = 12 * powerScale;
    const fx1 = Math.cos(rad) * flashLen;
    const fy1 = Math.sin(rad) * flashLen;
    const perpX = -Math.sin(rad) * (flashWidth / 2);
    const perpY = Math.cos(rad) * (flashWidth / 2);

    flashGfx.poly([
      { x: 0, y: 0 },
      { x: fx1 + perpX, y: fy1 + perpY },
      { x: fx1 * 1.2, y: fy1 * 1.2 },
      { x: fx1 - perpX, y: fy1 - perpY },
    ]);
    flashGfx.fill({ color: shotType === 2 ? 0x93c5fd : 0xfef08a, alpha: 0.95 });
    flashGfx.position.set(x, y);
    this.container.addChild(flashGfx);

    this.particles.push({
      gfx: flashGfx,
      x,
      y,
      vx: 0,
      vy: 0,
      rotation: 0,
      rotSpeed: 0,
      life: 0,
      maxLife: 80,
      type: "spark",
      size: flashLen,
    });

    // 2. High-speed forward muzzle sparks
    const sparkCount = shotType === 2 ? 10 : shotType === 1 ? 7 : 5;
    const sparkColors = shotType === 2 ? [0x93c5fd, 0x60a5fa, 0xffffff] : [0xfef08a, 0xfde047, 0xf97316];

    for (let i = 0; i < sparkCount; i++) {
      const gfx = new Graphics();
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      const size = (Math.random() * 2.0 + 1.2) * powerScale;
      gfx.circle(0, 0, size).fill({ color, alpha: 1.0 });

      // Forward cone (+- 22 degrees from trajectory angle)
      const spread = (Math.random() - 0.5) * 0.4;
      const spd = (Math.random() * 8 + 4) * powerScale;
      const sAngle = rad + spread;

      gfx.position.set(x, y);
      this.container.addChild(gfx);

      this.particles.push({
        gfx,
        x,
        y,
        vx: Math.cos(sAngle) * spd,
        vy: Math.sin(sAngle) * spd,
        rotation: 0,
        rotSpeed: 0,
        life: 0,
        maxLife: Math.random() * 120 + 100, // 100 - 220ms
        type: "spark",
        size,
      });
    }

    // 3. Muzzle smoke puff
    const smokeCount = shotType === 2 ? 5 : shotType === 1 ? 4 : 3;
    for (let i = 0; i < smokeCount; i++) {
      const gfx = new Graphics();
      const radius = (Math.random() * 5 + 4) * powerScale;
      gfx.circle(0, 0, radius).fill({ color: 0xe2e8f0, alpha: 0.45 });

      const spread = (Math.random() - 0.5) * 0.5;
      const spd = (Math.random() * 2.0 + 0.8) * powerScale;
      const sAngle = rad + spread;

      gfx.position.set(x, y);
      this.container.addChild(gfx);

      this.particles.push({
        gfx,
        x,
        y,
        vx: Math.cos(sAngle) * spd,
        vy: Math.sin(sAngle) * spd - 0.25,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        life: 0,
        maxLife: Math.random() * 200 + 180, // 180 - 380ms
        type: "dust",
        size: radius,
      });
    }
  }

  public update(dt: number) {
    const dtMs = dt * 16.66;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dtMs;

      if (p.life >= p.maxLife) {
        this.container.removeChild(p.gfx);
        p.gfx.destroy();
        this.particles.splice(i, 1);
        continue;
      }

      const lifeProgress = p.life / p.maxLife;

      if (p.type === "rock") {
        // Gravity & air drag on rocks (falls further before fading)
        p.vy += 0.44 * dt;
        p.vx *= Math.pow(0.988, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;

        p.gfx.position.set(p.x, p.y);
        p.gfx.rotation = p.rotation;

        if (lifeProgress > 0.82) {
          p.gfx.alpha = 1.0 - (lifeProgress - 0.82) / 0.18;
        }
      } else if (p.type === "spark") {
        // High drag on sparks, gravity
        p.vy += 0.15 * dt;
        p.vx *= Math.pow(0.92, dt);
        p.vy *= Math.pow(0.92, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.gfx.position.set(p.x, p.y);
        p.gfx.alpha = Math.max(0, 1.0 - lifeProgress * 1.1);
        const scale = Math.max(0.2, 1.0 - lifeProgress * 0.7);
        p.gfx.scale.set(scale);
      } else if (p.type === "dust") {
        // Dust expands and fades
        p.vx *= Math.pow(0.95, dt);
        p.vy *= Math.pow(0.95, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.gfx.position.set(p.x, p.y);
        const scale = 1.0 + lifeProgress * 1.8;
        p.gfx.scale.set(scale);
        p.gfx.alpha = Math.max(0, 0.35 * (1.0 - lifeProgress));
      }
    }
  }

  public clear() {
    for (const p of this.particles) {
      this.container.removeChild(p.gfx);
      p.gfx.destroy();
    }
    this.particles = [];
  }
}
