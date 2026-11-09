import { Container, Graphics } from "pixi.js";

interface FloatingMote {
  x: number;
  y: number;
  baseX: number;
  vx: number;
  vy: number;
  size: number;
  maxLife: number;
  life: number;
  swayPhase: number;
  swaySpeed: number;
  swayAmp: number;
  color: number;
  coreColor: number;
  type: "diamond" | "orb" | "spark";
}

interface ExpandingRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  fadeSpeed: number;
  growthSpeed: number;
  color: number;
  delay: number;
}

/**
 * FloatingParticlePowerupEntity
 * 
 * Brand new, modern, fluid floating particle powerup effect.
 * - Fluid floating motes with smooth sine-sway floating upward.
 * - Soft quadratic and cubic alpha fading (zero abrupt cutoffs).
 * - Glowing diamond stars, luminous floating orbs, and soft ground aura rings.
 * - Optimized vector rendering with additive blending.
 */
export class FloatingParticlePowerupEntity extends Container {
  private gfx: Graphics;
  private glowGfx: Graphics;
  private isDestroyed: boolean = false;

  private motes: FloatingMote[] = [];
  private rings: ExpandingRing[] = [];
  private age: number = 0;
  private totalDuration: number = 780; // ms

  constructor(x: number, y: number, itemType: "dual" | "teleport" = "dual") {
    super();
    this.position.set(x, y);

    this.glowGfx = new Graphics();
    this.glowGfx.blendMode = "add";
    this.addChild(this.glowGfx);

    this.gfx = new Graphics();
    this.gfx.blendMode = "add";
    this.addChild(this.gfx);

    this.initEffect(itemType);
  }

  private initEffect(itemType: "dual" | "teleport") {
    const isDual = itemType === "dual";

    // Palette: Radiant Gold / Amber for Dual; Celestial Sky / Cyan for Teleport
    const palette = isDual
      ? [0xffffff, 0xfef08a, 0xfacc15, 0xf59e0b, 0xfde047]
      : [0xffffff, 0xe0f2fe, 0x7dd3fc, 0x38bdf8, 0x60a5fa];

    const coreColor = 0xffffff;

    // 1. Soft ground expansion rings
    this.rings = [
      {
        radius: 6,
        maxRadius: 42,
        alpha: 0.85,
        fadeSpeed: 0.042,
        growthSpeed: 1.8,
        color: isDual ? 0xfacc15 : 0x38bdf8,
        delay: 0,
      },
      {
        radius: 4,
        maxRadius: 50,
        alpha: 0.70,
        fadeSpeed: 0.034,
        growthSpeed: 1.5,
        color: isDual ? 0xfef08a : 0xbae6fd,
        delay: 5,
      },
    ];

    // 2. Spawn 36 fluid floating motes with staggered lifetimes and ascending physics
    this.motes = [];
    const count = 38;

    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 44;
      const offsetY = 6 + Math.random() * 10;
      const typeChoice: "diamond" | "orb" | "spark" =
        Math.random() > 0.65 ? "diamond" : Math.random() > 0.35 ? "orb" : "spark";

      this.motes.push({
        x: offsetX,
        y: offsetY,
        baseX: offsetX,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(1.6 + Math.random() * 2.8), // Upward floating velocity
        size: 1.8 + Math.random() * 2.6,
        maxLife: 32 + Math.floor(Math.random() * 24),
        life: Math.floor(Math.random() * 10), // slight stagger on start
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.06 + Math.random() * 0.08,
        swayAmp: 2.5 + Math.random() * 4.5,
        color: palette[Math.floor(Math.random() * palette.length)],
        coreColor,
        type: typeChoice,
      });
    }
  }

  public update(dt: number) {
    if (this.isDestroyed) return;

    this.age += dt * 16.666;
    const progress = Math.min(1.0, this.age / this.totalDuration);

    this.gfx.clear();
    this.glowGfx.clear();

    // 1. Soft radial background flare at vehicle center (gentle dissipation)
    const flareAlpha = Math.max(0, Math.sin(progress * Math.PI) * 0.45);
    if (flareAlpha > 0.01) {
      const flareRadius = 24 + progress * 16;
      this.glowGfx.circle(0, -12, flareRadius);
      this.glowGfx.fill({ color: 0xffffff, alpha: flareAlpha * 0.4 });
      this.glowGfx.circle(0, -12, flareRadius * 1.5);
      this.glowGfx.fill({ color: 0xfacc15, alpha: flareAlpha * 0.2 });
    }

    // 2. Ground rings radiating along vehicle base
    for (const ring of this.rings) {
      if (ring.delay > 0) {
        ring.delay -= dt;
        continue;
      }
      ring.radius += (ring.maxRadius - ring.radius) * 0.10 * dt + ring.growthSpeed * dt;
      ring.alpha -= ring.fadeSpeed * dt;

      if (ring.alpha > 0.02) {
        // Main ellipse ring
        this.gfx.ellipse(0, 8, ring.radius, ring.radius * 0.38);
        this.gfx.stroke({ width: 2.0, color: ring.color, alpha: ring.alpha });
        // Core thin bright wire
        this.gfx.ellipse(0, 8, ring.radius * 0.85, ring.radius * 0.32);
        this.gfx.stroke({ width: 1.0, color: 0xffffff, alpha: ring.alpha * 0.85 });
      }
    }

    // 3. Fluid floating motes with smooth sine sway and graceful fading
    let aliveCount = 0;

    for (const m of this.motes) {
      m.life += dt;
      if (m.life >= m.maxLife) continue;

      aliveCount++;
      const t = m.life / m.maxLife;

      // Smooth horizontal sine sway
      m.swayPhase += m.swaySpeed * dt;
      m.x = m.baseX + Math.sin(m.swayPhase) * m.swayAmp;

      // Upward smooth decelerating drift
      m.vy *= Math.pow(0.975, dt);
      m.y += m.vy * dt;

      // Smooth envelope: fast ease-in (0 -> 0.15) and silky cubic ease-out (0.15 -> 1.0)
      let alpha: number;
      if (t < 0.18) {
        alpha = t / 0.18;
      } else {
        const fadeProgress = (t - 0.18) / 0.82;
        alpha = Math.max(0, 1.0 - fadeProgress * fadeProgress);
      }

      // Size subtly shrinks as it dissolves into air
      const currentSize = Math.max(0.6, m.size * (1.0 - t * 0.35));

      if (alpha <= 0.01) continue;

      if (m.type === "diamond") {
        // 4-point cardinal star / diamond glint
        const s = currentSize * 1.6;
        this.gfx.beginPath();
        this.gfx.moveTo(m.x, m.y - s);
        this.gfx.lineTo(m.x + s * 0.45, m.y);
        this.gfx.lineTo(m.x, m.y + s);
        this.gfx.lineTo(m.x - s * 0.45, m.y);
        this.gfx.closePath();
        this.gfx.fill({ color: m.color, alpha: alpha * 0.85 });

        // Bright white center spark
        this.gfx.circle(m.x, m.y, s * 0.28);
        this.gfx.fill({ color: m.coreColor, alpha });
      } else if (m.type === "spark") {
        // Subtle vertical energy spark
        this.gfx.roundRect(m.x - 1.0, m.y - currentSize, 2.0, currentSize * 2.0, 1.0);
        this.gfx.fill({ color: m.color, alpha: alpha * 0.90 });
        this.gfx.circle(m.x, m.y, 0.9).fill({ color: 0xffffff, alpha });
      } else {
        // Luminous circular orb with translucent corona
        this.gfx.circle(m.x, m.y, currentSize * 1.4);
        this.gfx.fill({ color: m.color, alpha: alpha * 0.40 });
        this.gfx.circle(m.x, m.y, currentSize);
        this.gfx.fill({ color: m.color, alpha: alpha * 0.80 });
        this.gfx.circle(m.x, m.y, currentSize * 0.45);
        this.gfx.fill({ color: m.coreColor, alpha });
      }
    }

    if (this.age >= this.totalDuration || aliveCount === 0) {
      this.cleanup();
    }
  }

  public isFinished(): boolean {
    return this.isDestroyed;
  }

  public cleanup() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.motes = [];
    this.rings = [];
    this.gfx.clear();
    this.glowGfx.clear();
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.destroy({ children: true });
  }
}
