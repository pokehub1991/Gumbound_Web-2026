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

interface ActiveDynamicExplosion {
  container: Container;
  fireballGroup: Container;
  lobes: FireballLobe[];
  shockwaveRing: Graphics;
  sparks: DynamicSpark[];
  particles: DynamicParticle[];
  elapsed: number;
  maxDuration: number;
  baseRadius: number;
  powerScale: number;
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
   * Spawn a massive, high-energy procedural dynamic explosion matching the GunBound sprite silhouette.
   */
  public triggerExplosion(
    x: number,
    y: number,
    radius: number = 44,
    damage: number = 200,
    onComplete?: () => void
  ) {
    const explosionGroup = new Container();
    explosionGroup.position.set(x, y);
    this.parentContainer.addChild(explosionGroup);

    const powerScale = Math.max(1.0, Math.min(2.8, (radius / 36) * 0.75 + (damage / 180) * 0.35));
    const effectiveRadius = radius * (1.35 + powerScale * 0.32); // 70px - 105px radius (140 - 210px diameter!)

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
      maxRadius: effectiveRadius * 1.05,
      expansionSpeed: 1.0,
    });

    // 10 Radial billowing plume lobes forming the iconic GunBound jagged mushroom silhouette
    const lobeCount = 10;
    for (let i = 0; i < lobeCount; i++) {
      const angle = (i / lobeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = effectiveRadius * (0.38 + Math.random() * 0.3);
      const lobeGfx = new Graphics();
      fireballGroup.addChild(lobeGfx);

      lobes.push({
        gfx: lobeGfx,
        offsetX: Math.cos(angle) * dist,
        offsetY: Math.sin(angle) * dist - 6, // Slight upward thermal bias
        maxRadius: effectiveRadius * (0.62 + Math.random() * 0.38),
        expansionSpeed: 0.85 + Math.random() * 0.35,
      });
    }

    // 2. Expanding Double Shockwave Ring
    const shockwaveRing = new Graphics();
    explosionGroup.addChild(shockwaveRing);

    // 3. Dense High-Velocity Directional Spark Tracers (Streak lines)
    const sparks: DynamicSpark[] = [];
    const sparkCount = Math.floor(65 + powerScale * 35); // 70 - 130 fiery sparks!
    const sparkColors = [0xffffff, 0xfef08a, 0xfde047, 0xf97316, 0xef4444, 0xb91c1c];

    for (let i = 0; i < sparkCount; i++) {
      const gfx = new Graphics();
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 16 + 7.0) * (0.85 + powerScale * 0.3);
      const width = Math.random() * 2.2 + 1.4;

      explosionGroup.addChild(gfx);

      sparks.push({
        gfx,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // Upward burst bias
        gravity: 0.24,
        drag: 0.94,
        life: 0,
        maxLife: Math.random() * 360 + 440, // 440 - 800ms
        width,
        colors: sparkColors,
      });
    }

    // 4. Heavy Jagged Terrain Crater Rubble Chunks
    const particles: DynamicParticle[] = [];
    const rubbleCount = Math.floor(20 + powerScale * 14);
    const rubbleColors = [0x78716c, 0xa8a29e, 0x57534e, 0xd97706, 0x92400e, 0x451a03];

    for (let i = 0; i < rubbleCount; i++) {
      const gfx = new Graphics();
      const color = rubbleColors[Math.floor(Math.random() * rubbleColors.length)];
      const size = (Math.random() * 5.5 + 3.0) * powerScale;

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
      gfx.stroke({ width: 1.0, color: 0x1c1917, alpha: 0.9 });

      // Expelled upward and outward in explosive spray
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const speed = (Math.random() * 12 + 4.5) * powerScale;

      explosionGroup.addChild(gfx);

      particles.push({
        gfx,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.38,
        drag: 0.98,
        life: 0,
        maxLife: Math.random() * 650 + 850,
        initialSize: size,
        rotSpeed: (Math.random() - 0.5) * 0.45,
        type: "debris",
      });
    }

    // 5. Volumetric Billowing Smoke Clouds
    const smokeCount = 18;
    for (let i = 0; i < smokeCount; i++) {
      const gfx = new Graphics();
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 0.8;
      const size = Math.random() * 18 + 16;

      gfx.circle(0, 0, size).fill({ color: 0x334155, alpha: 0.5 });
      explosionGroup.addChild(gfx);

      particles.push({
        gfx,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2, // Natural thermal updraft
        gravity: -0.07, // Floats upward
        drag: 0.92,
        life: 0,
        maxLife: Math.random() * 500 + 850,
        initialSize: size,
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
      maxDuration: 1150,
      baseRadius: effectiveRadius,
      powerScale,
      onComplete,
    });
  }

  public update(dtMs: number) {
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const exp = this.activeExplosions[i];
      exp.elapsed += dtMs;
      const progress = exp.elapsed / exp.maxDuration;

      // -------------------------------------------------------------
      // 1. Update Volumetric Billowing Fireball Lobes (0 to 720ms)
      // -------------------------------------------------------------
      const fireballDuration = 720;
      if (exp.elapsed < fireballDuration) {
        const fbNorm = exp.elapsed / fireballDuration; // 0 -> 1

        for (const lobe of exp.lobes) {
          lobe.gfx.clear();

          // Phase 1: Rapid outward expansion (0 -> 210ms)
          // Phase 2: Rolling and billowing (210ms -> 480ms)
          // Phase 3: Dissolving to smoke & embers (480ms -> 720ms)
          let currentR: number;
          if (exp.elapsed < 210) {
            const expandP = exp.elapsed / 210;
            currentR = lobe.maxRadius * Math.sin((expandP * Math.PI) / 2);
          } else {
            const rollP = (exp.elapsed - 210) / (fireballDuration - 210);
            currentR = lobe.maxRadius * (1.0 + rollP * 0.25); // Billows slightly larger
          }

          const alpha = Math.max(0, 1 - Math.pow(fbNorm, 1.6));

          // Multi-layer volumetric color gradations matching GunBound explosion frames
          if (fbNorm < 0.22) {
            // Ultra-hot initial flash: blinding incandescent white core + bright yellow aura
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 1.05).fill({ color: 0xfde047, alpha: alpha * 0.95 });
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 0.75).fill({ color: 0xffffff, alpha: alpha * 0.98 });
          } else if (fbNorm < 0.55) {
            // Churning dense fireball: crimson outline + fiery orange mantle + golden core
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR).fill({ color: 0xe11d48, alpha: alpha * 0.88 });
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 0.78).fill({ color: 0xf97316, alpha: alpha * 0.94 });
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 0.48).fill({ color: 0xfde047, alpha: alpha * 0.98 });
          } else {
            // Cooling smoke & embers: dark volcanic soot + deep red embers
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR).fill({ color: 0x1e293b, alpha: alpha * 0.70 });
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 0.65).fill({ color: 0x991b1b, alpha: alpha * 0.60 });
            lobe.gfx.circle(lobe.offsetX, lobe.offsetY, currentR * 0.35).fill({ color: 0xd97706, alpha: alpha * 0.65 });
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
      const shockwaveDuration = 380;
      if (exp.elapsed < shockwaveDuration) {
        const swProgress = exp.elapsed / shockwaveDuration;
        const swRadius = exp.baseRadius * 1.85 * Math.pow(swProgress, 0.65);
        const swAlpha = Math.max(0, (1 - swProgress) * 0.9);

        exp.shockwaveRing.clear();
        // Primary shockwave
        exp.shockwaveRing.circle(0, 0, swRadius).stroke({
          width: Math.max(1, 3.8 * (1 - swProgress)),
          color: 0xfef08a,
          alpha: swAlpha,
        });
        // Secondary kinetic wave
        exp.shockwaveRing.circle(0, 0, swRadius * 0.86).stroke({
          width: Math.max(1, 2.0 * (1 - swProgress)),
          color: 0xffffff,
          alpha: swAlpha * 0.75,
        });
      } else {
        exp.shockwaveRing.clear();
      }

      // -------------------------------------------------------------
      // 3. Update High-Velocity Spark Tracers (Streak lines)
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

        const fade = Math.max(0, 1 - Math.pow(sRatio, 1.3));
        const cIdx = Math.min(s.colors.length - 1, Math.floor(sRatio * s.colors.length));
        const color = s.colors[cIdx];

        // Draw directional spark streak
        s.gfx.clear();
        const streakLength = Math.max(2.5, Math.hypot(s.vx, s.vy) * 2.2);
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
      // 4. Update Rubble Debris & Volumetric Smoke Particles
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
          p.gfx.alpha = Math.max(0, 1 - pLifeRatio * 0.85);
          if (p.rotSpeed) p.gfx.rotation += p.rotSpeed;
        } else if (p.type === "smoke") {
          // Smoke billows and rises smoothly
          const scale = 1.0 + pLifeRatio * 2.4;
          p.gfx.scale.set(scale);
          p.gfx.alpha = Math.max(0, (1 - pLifeRatio) * 0.38);
        }
      }

      // -------------------------------------------------------------
      // 5. Completion & Cleanup
      // -------------------------------------------------------------
      if (progress >= 1.0 || (exp.sparks.length === 0 && exp.particles.length === 0 && exp.elapsed >= fireballDuration)) {
        if (exp.onComplete) {
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
