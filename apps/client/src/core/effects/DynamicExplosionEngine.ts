import { Container, Graphics } from "pixi.js";

interface DynamicSpark {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  width: number;
  colors: number[];
}

interface DynamicParticle {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  initialSize: number;
  initialAlpha: number;
  rotSpeed?: number;
  type: "debris" | "smoke";
}

interface FireballLobe {
  gfx: Graphics;
  offsetX: number;
  offsetY: number;
  maxRadius: number;
  expansionSpeed: number;
}

function lerpColor(c1: number, c2: number, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * clampedT);
  const g = Math.round(g1 + (g2 - g1) * clampedT);
  const b = Math.round(b1 + (b2 - b1) * clampedT);
  return (r << 16) | (g << 8) | b;
}

const MANTLE_GRADIENT: Array<{ t: number; color: number }> = [
  { t: 0.00, color: 0xfef08a }, // Flash pale yellow
  { t: 0.15, color: 0xfde047 }, // Sunburst yellow
  { t: 0.35, color: 0xf97316 }, // Fiery orange
  { t: 0.58, color: 0xe11d48 }, // Crimson flame
  { t: 0.78, color: 0x881337 }, // Deep ember wine
  { t: 1.00, color: 0x334155 }, // Soft atmospheric soot
];

const CORE_GRADIENT: Array<{ t: number; color: number }> = [
  { t: 0.00, color: 0xffffff }, // Incandescent white
  { t: 0.22, color: 0xfffbeb }, // Warm white
  { t: 0.45, color: 0xfde047 }, // Golden core
  { t: 0.68, color: 0xf59e0b }, // Molten amber
  { t: 0.88, color: 0xd97706 }, // Deep red-amber
  { t: 1.00, color: 0x1e293b }, // Cooling charcoal
];

function sampleColorGradient(palette: Array<{ t: number; color: number }>, t: number): number {
  if (t <= palette[0].t) return palette[0].color;
  if (t >= palette[palette.length - 1].t) return palette[palette.length - 1].color;
  for (let i = 0; i < palette.length - 1; i++) {
    const p1 = palette[i];
    const p2 = palette[i + 1];
    if (t >= p1.t && t <= p2.t) {
      const segT = (t - p1.t) / (p2.t - p1.t);
      return lerpColor(p1.color, p2.color, segT);
    }
  }
  return palette[palette.length - 1].color;
}

interface ActiveDynamicExplosion {
  container: Container;
  fireballGroup: Container;
  lobes: FireballLobe[];
  shockwaveRing: Graphics;
  sparks: DynamicSpark[];
  particles: DynamicParticle[];
  elapsed: number;
  maxDuration: number;
  fireballDuration: number;
  shockwaveDuration: number;
  turnAdvanceMs: number;
  hasTriggeredComplete: boolean;
  baseRadius: number;
  powerScale: number;
  shotType: number;
  onComplete?: () => void;
}

export class DynamicExplosionEngine {
  private static instance: DynamicExplosionEngine | null = null;
  public static isDynamicEnabled: boolean = true;

  private parentContainer: Container;
  private activeExplosions: ActiveDynamicExplosion[] = [];

  constructor(parentContainer: Container) {
    this.parentContainer = parentContainer;
    DynamicExplosionEngine.instance = this;
  }

  public static getInstance(): DynamicExplosionEngine | null {
    return DynamicExplosionEngine.instance;
  }

  /**
   * Spawn a dynamic procedural explosion calibrated by shot type & magnitude:
   * - Tiro 1 (Suave, shotType = 0): Compact blast, light smoke, soft quick fade.
   * - Tiro 2 (Fuerte, shotType = 1): Energetic fiery burst, dense smoke billows, glowing sparks.
   * - Tiro 3 / SS (Superfuerte, shotType = 2): Massive thermonuclear flash, heavy shockwave, lingering billowing mushroom smoke & violent sparks.
   */
  public triggerExplosion(
    x: number,
    y: number,
    radius: number = 44,
    damage: number = 200,
    onComplete?: () => void,
    shotType: number = 0
  ) {
    const explosionGroup = new Container();
    explosionGroup.position.set(x, y);
    this.parentContainer.addChild(explosionGroup);

    // Dynamic calibration based on shotType: 0 = Shot 1, 1 = Shot 2, 2 = SS
    let powerScale = 0.75;
    let effectiveRadius = 24;
    let fireballDuration = 520;
    let shockwaveDuration = 260;
    let maxDuration = 1400;
    let turnAdvanceMs = 450;
    let sparkCount = 14;
    let rubbleCount = 6;
    let smokeCount = 7;
    let smokeMaxLifeBase = 1200;
    let smokeAlphaBase = 0.35;
    let smokeColors = [0x64748b, 0x94a3b8]; // Gentle slate gray

    if (shotType === 2 || damage >= 380) {
      // ============================================================
      // TIRO 3 / SS: SUPERFUERTE
      // ============================================================
      powerScale = 1.65;
      effectiveRadius = Math.max(46, Math.min(54, radius * 1.15));
      fireballDuration = 1250;
      shockwaveDuration = 520;
      maxDuration = 3200;
      turnAdvanceMs = 850;
      sparkCount = 42;
      rubbleCount = 16;
      smokeCount = 18;
      smokeMaxLifeBase = 2600;
      smokeAlphaBase = 0.65;
      smokeColors = [0x0f172a, 0x1e293b, 0x334155]; // Volcanic heavy soot
    } else if (shotType === 1 || damage >= 220) {
      // ============================================================
      // TIRO 2: FUERTE
      // ============================================================
      powerScale = 1.15;
      effectiveRadius = Math.max(32, Math.min(38, radius * 0.85));
      fireballDuration = 920;
      shockwaveDuration = 380;
      maxDuration = 2400;
      turnAdvanceMs = 620;
      sparkCount = 26;
      rubbleCount = 10;
      smokeCount = 12;
      smokeMaxLifeBase = 1950;
      smokeAlphaBase = 0.50;
      smokeColors = [0x1e293b, 0x334155, 0x475569]; // Dense combat smoke
    } else {
      // ============================================================
      // TIRO 1: SUAVE
      // ============================================================
      powerScale = 0.75;
      effectiveRadius = Math.max(22, Math.min(27, radius * 0.62));
      fireballDuration = 680;
      shockwaveDuration = 280;
      maxDuration = 1800;
      turnAdvanceMs = 480;
      sparkCount = 14;
      rubbleCount = 5;
      smokeCount = 7;
      smokeMaxLifeBase = 1500;
      smokeAlphaBase = 0.35;
      smokeColors = [0x475569, 0x64748b];
    }

    // 1. Fireball Group (Multi-lobed billowing cauliflower flame clouds)
    const fireballGroup = new Container();
    explosionGroup.addChild(fireballGroup);

    const lobes: FireballLobe[] = [];
    // Center primary core fireball
    const centerGfx = new Graphics();
    fireballGroup.addChild(centerGfx);
    lobes.push({
      gfx: centerGfx,
      offsetX: 0,
      offsetY: 0,
      maxRadius: effectiveRadius * 1.0,
      expansionSpeed: 1.0,
    });

    // Radial billowing plume lobes forming the iconic GunBound jagged silhouette
    const lobeCount = shotType === 2 ? 10 : 8;
    for (let i = 0; i < lobeCount; i++) {
      const angle = (i / lobeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = effectiveRadius * (0.35 + Math.random() * 0.22);
      const lobeGfx = new Graphics();
      fireballGroup.addChild(lobeGfx);

      lobes.push({
        gfx: lobeGfx,
        offsetX: Math.cos(angle) * dist,
        offsetY: Math.sin(angle) * dist - (shotType === 2 ? 5 : 3), // Thermal upward bias
        maxRadius: effectiveRadius * (0.55 + Math.random() * 0.25),
        expansionSpeed: 0.85 + Math.random() * 0.35,
      });
    }

    // 2. Expanding Double Shockwave Ring
    const shockwaveRing = new Graphics();
    explosionGroup.addChild(shockwaveRing);

    // 3. Dense High-Velocity Directional Spark Tracers
    const sparks: DynamicSpark[] = [];
    const sparkColors =
      shotType === 2
        ? [0xffffff, 0xfef08a, 0xfde047, 0xf97316, 0xef4444, 0xb91c1c]
        : shotType === 1
        ? [0xffffff, 0xfde047, 0xf97316, 0xef4444]
        : [0xffffff, 0xfef08a, 0xfde047, 0xf97316];

    for (let i = 0; i < sparkCount; i++) {
      const gfx = new Graphics();
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 6.0 + 2.5) * powerScale;
      const width = Math.random() * 1.4 + 0.9 * powerScale;

      explosionGroup.addChild(gfx);

      sparks.push({
        gfx,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (0.6 + powerScale * 0.4),
        gravity: 0.16 + powerScale * 0.06,
        drag: 0.95,
        life: 0,
        maxLife: Math.random() * 300 + 400 * powerScale,
        width,
        colors: sparkColors,
      });
    }

    // 4. Terrain Crater Rubble Chunks
    const particles: DynamicParticle[] = [];
    const rubbleColors = [0x78716c, 0xa8a29e, 0x57534e, 0xd97706, 0x92400e, 0x451a03];

    for (let i = 0; i < rubbleCount; i++) {
      const gfx = new Graphics();
      const color = rubbleColors[Math.floor(Math.random() * rubbleColors.length)];
      const size = (Math.random() * 2.2 + 1.4) * powerScale;

      gfx.beginPath();
      const verts = 5 + Math.floor(Math.random() * 3);
      for (let v = 0; v < verts; v++) {
        const rad = (v / verts) * Math.PI * 2;
        const r = size * (0.65 + Math.random() * 0.7);
        const px = Math.cos(rad) * r;
        const py = Math.sin(rad) * r;
        if (v === 0) gfx.moveTo(px, py);
        else gfx.lineTo(px, py);
      }
      gfx.closePath();
      gfx.fill({ color, alpha: 0.95 });
      gfx.stroke({ width: 0.8, color: 0x1c1917, alpha: 0.9 });

      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const speed = (Math.random() * 4.8 + 2.2) * powerScale;

      explosionGroup.addChild(gfx);

      particles.push({
        gfx,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.28,
        drag: 0.98,
        life: 0,
        maxLife: Math.random() * 400 + 500 * powerScale,
        initialSize: size,
        initialAlpha: 0.95,
        rotSpeed: (Math.random() - 0.5) * 0.4,
        type: "debris",
      });
    }

    // 5. Volumetric Billowing Smoke Clouds with gentle lingering fade
    for (let i = 0; i < smokeCount; i++) {
      const gfx = new Graphics();
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 1.6 + 0.5) * powerScale;
      const size = (Math.random() * 8 + 6) * powerScale;
      const color = smokeColors[Math.floor(Math.random() * smokeColors.length)];
      const initialAlpha = (smokeAlphaBase + (Math.random() - 0.5) * 0.1);

      gfx.circle(0, 0, size).fill({ color, alpha: initialAlpha });
      explosionGroup.addChild(gfx);

      particles.push({
        gfx,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (0.5 + powerScale * 0.3), // Natural thermal updraft
        gravity: -0.04, // Softly floats upward
        drag: 0.93,
        life: 0,
        maxLife: smokeMaxLifeBase + Math.random() * 400,
        initialSize: size,
        initialAlpha,
        type: "smoke",
      });
    }

    this.activeExplosions.push({
      container: explosionGroup,
      fireballGroup,
      lobes,
      shockwaveRing,
      sparks,
      particles,
      elapsed: 0,
      maxDuration,
      fireballDuration,
      shockwaveDuration,
      turnAdvanceMs,
      hasTriggeredComplete: false,
      baseRadius: effectiveRadius,
      powerScale,
      shotType,
      onComplete,
    });
  }

  public update(dtMs: number) {
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const exp = this.activeExplosions[i];
      exp.elapsed += dtMs;
      const progress = exp.elapsed / exp.maxDuration;

      // Trigger turn advancement smoothly at peak impact without waiting for lingering smoke
      if (!exp.hasTriggeredComplete && exp.elapsed >= exp.turnAdvanceMs) {
        exp.hasTriggeredComplete = true;
        if (exp.onComplete) {
          exp.onComplete();
        }
      }

      // -------------------------------------------------------------
      // 1. Update Volumetric Billowing Fireball Lobes
      // -------------------------------------------------------------
      if (exp.elapsed < exp.fireballDuration) {
        const fbNorm = exp.elapsed / exp.fireballDuration; // 0 -> 1

        for (const lobe of exp.lobes) {
          lobe.gfx.clear();

          const expandDuration = exp.fireballDuration * 0.28;
          let currentR: number;
          if (exp.elapsed < expandDuration) {
            const expandP = exp.elapsed / expandDuration;
            currentR = lobe.maxRadius * Math.sin((expandP * Math.PI) / 2);
          } else {
            const rollP = (exp.elapsed - expandDuration) / (exp.fireballDuration - expandDuration);
            currentR = lobe.maxRadius * (1.0 + rollP * 0.32); // Billows slightly larger
          }

          // Slow, gentle cubic-exponential fade-out matching authentic visual smoke
          const alpha = Math.max(0, Math.pow(1 - fbNorm, 1.55));

          // Continuous RGB color interpolation (Zero abrupt steps or layer pops!)
          const mantleColor = sampleColorGradient(MANTLE_GRADIENT, fbNorm);
          const coreColor = sampleColorGradient(CORE_GRADIENT, fbNorm);

          // Layer 1: Soft atmospheric thermal glow (outer halo)
          lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 1.10)
            .fill({ color: mantleColor, alpha: alpha * 0.38 });

          // Layer 2: Primary churning flame mantle
          lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR)
            .fill({ color: mantleColor, alpha: alpha * 0.82 });

          // Layer 3: High-temperature combustion core (smoothly transitions into molten amber)
          if (fbNorm < 0.85) {
            const coreAlpha = alpha * Math.max(0, 1 - fbNorm / 0.85);
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 0.62)
              .fill({ color: coreColor, alpha: coreAlpha * 0.92 });
          }

          // Layer 4: Incandescent flash hotspot (intense blinding flash during first ~25%)
          if (fbNorm < 0.26) {
            const flashAlpha = alpha * (1 - fbNorm / 0.26);
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 0.38)
              .fill({ color: 0xffffff, alpha: flashAlpha * 0.98 });
          }
        }
      } else {
        for (const lobe of exp.lobes) {
          lobe.gfx.clear();
        }
      }

      // -------------------------------------------------------------
      // 2. Update Double Kinetic Shockwave Ring
      // -------------------------------------------------------------
      if (exp.elapsed < exp.shockwaveDuration) {
        const swProgress = exp.elapsed / exp.shockwaveDuration;
        const swRadius = exp.baseRadius * 1.35 * Math.pow(swProgress, 0.65);
        const swAlpha = Math.max(0, (1 - swProgress) * 0.9);

        exp.shockwaveRing.clear();
        // Primary shockwave
        exp.shockwaveRing.circle(0, 0, swRadius).stroke({
          width: Math.max(1, 2.2 * (1 - swProgress)),
          color: 0xfef08a,
          alpha: swAlpha,
        });
        // Secondary kinetic wave
        exp.shockwaveRing.circle(0, 0, swRadius * 0.86).stroke({
          width: Math.max(1, 1.4 * (1 - swProgress)),
          color: 0xffffff,
          alpha: swAlpha * 0.75,
        });
      } else {
        exp.shockwaveRing.clear();
      }

      // -------------------------------------------------------------
      // 3. Update High-Velocity Spark Tracers (Streak lines with soft easing)
      // -------------------------------------------------------------
      for (let sIdx = exp.sparks.length - 1; sIdx >= 0; sIdx--) {
        const s = exp.sparks[sIdx];
        s.life += dtMs;
        const sRatio = s.life / s.maxLife;

        if (sRatio >= 1.0) {
          exp.container.removeChild(s.gfx);
          s.gfx.destroy();
          exp.sparks.splice(sIdx, 1);
          continue;
        }

        s.vx *= s.drag;
        s.vy = s.vy * s.drag + s.gravity;
        s.x += s.vx;
        s.y += s.vy;

        // Soft exponential fade out
        const fade = Math.max(0, Math.pow(1 - sRatio, 1.5));
        const cIdx = Math.min(s.colors.length - 1, Math.floor(sRatio * s.colors.length));
        const color = s.colors[cIdx];

        // Draw directional spark streak
        s.gfx.clear();
        const streakLength = Math.max(2.0, Math.hypot(s.vx, s.vy) * 2.0);
        const tailX = s.x - (s.vx / (Math.hypot(s.vx, s.vy) || 1)) * streakLength;
        const tailY = s.y - (s.vy / (Math.hypot(s.vx, s.vy) || 1)) * streakLength;

        s.gfx.beginPath();
        s.gfx.moveTo(tailX, tailY);
        s.gfx.lineTo(s.x, s.y);
        s.gfx.stroke({ width: s.width * (1 - sRatio * 0.5), color, alpha: fade });

        // Glowing spark head
        s.gfx.circle(s.x, s.y, s.width * 0.8).fill({ color: 0xffffff, alpha: fade });
      }

      // -------------------------------------------------------------
      // 4. Update Rubble Debris & Volumetric Smoke Particles (Gentle Lingering)
      // -------------------------------------------------------------
      for (let pIdx = exp.particles.length - 1; pIdx >= 0; pIdx--) {
        const p = exp.particles[pIdx];
        p.life += dtMs;
        const pLifeRatio = p.life / p.maxLife;

        if (pLifeRatio >= 1.0) {
          exp.container.removeChild(p.gfx);
          p.gfx.destroy();
          exp.particles.splice(pIdx, 1);
          continue;
        }

        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.gfx.position.set(p.x, p.y);

        if (p.type === "debris") {
          p.gfx.alpha = Math.max(0, (1 - pLifeRatio) * p.initialAlpha);
          if (p.rotSpeed) p.gfx.rotation += p.rotSpeed;
        } else if (p.type === "smoke") {
          // Volumetric smoke gently billows, expands and lingers with soft exponential decay
          const scale = 1.0 + Math.pow(pLifeRatio, 0.65) * 2.4;
          p.gfx.scale.set(scale);
          p.gfx.alpha = Math.max(0, Math.pow(1 - pLifeRatio, 1.35) * p.initialAlpha);
        }
      }

      // -------------------------------------------------------------
      // 5. Completion & Cleanup
      // -------------------------------------------------------------
      const allParticlesDone = exp.sparks.length === 0 && exp.particles.length === 0;
      if (progress >= 1.0 || (allParticlesDone && exp.elapsed >= exp.fireballDuration)) {
        if (!exp.hasTriggeredComplete && exp.onComplete) {
          exp.onComplete();
        }
        this.parentContainer.removeChild(exp.container);
        exp.container.destroy({ children: true });
        this.activeExplosions.splice(i, 1);
      }
    }
  }

  public clear() {
    for (const exp of this.activeExplosions) {
      this.parentContainer.removeChild(exp.container);
      exp.container.destroy({ children: true });
    }
    this.activeExplosions = [];
  }
}
