import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { WeatherType, getWeatherColumnWidth } from "./WeatherManager.js";

interface ColumnConfig {
  type: WeatherType;
  x: number;
  width?: number;
  mapHeight?: number;
}

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  orbitAngle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  color: number;
  life?: number;
  maxLife?: number;
  rotation?: number;
  rotSpeed?: number;
  isDebris?: boolean;
  shape?: number;
}

interface LightningSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isFork?: boolean;
}

const RANDOM_ICONS = [
  "/sprites/weather/weather_3_active.png", // Sun
  "/sprites/weather/weather_4_active.png", // Lightning
  "/sprites/weather/weather_7_active.png", // Mirror
  "/sprites/weather/weather_8_active.png", // Tornado
  "/sprites/weather/weather_5_active.png", // Black
];

/**
 * WeatherColumnEntity
 * 
 * 100% NATIVE, PROCEDURAL PIXIJS WEATHER EFFECT ENGINE.
 * Built with authentic GunBound dimensions and visual polish:
 * - Reduced, authentic sleek widths (Tornado: 54px, Sun: 42px, Lightning: 36px, Mirror: 28px, Black: 36px, Random: 38px).
 * - Full vertical height (-2200 to 2200) for all weathers (eliminating top cutoffs), except Mirror (ground wall 50 to 750).
 * - Tornado: Volumetric swirling cloud funnel with dense vapor bands, white core, dust & debris particles.
 * - Sun: Golden god-rays, amber radiant beam, incandescent white filament core, solar photons.
 * - Lightning: Continuous fluid 60 FPS electric thunderstorm, multi-channel plasma coronas.
 * - Mirror: Crystalline ground barrier without scanline artifacts.
 * - Black: Cosmic gravitational dark matter pillar with event horizon.
 * - Random: Energy conduit with cascading authentic weather sprites flowing at a calm 34px/s.
 */
export class WeatherColumnEntity extends Container {
  public weatherType: WeatherType;
  public columnX: number;
  public columnWidth: number;
  public isDestroyed: boolean = false;

  private columnGfx: Graphics;
  private fxGfx: Graphics;
  private randomIconContainer?: Container;
  private randomSprites: Sprite[] = [];

  private time: number = 0;

  // Particle systems
  private particles: WeatherParticle[] = [];
  private maxParticles: number = 45;

  // Fluid procedural lightning
  private lightningChannels: LightningSegment[][] = [];
  private lightningTimer: number = 0;

  // Lifecycle
  private isFadingOut: boolean = false;
  private fadeTimer: number = 1.0;

  // Vertical spans: full celestial height (-2200 to 2200), except mirror (50 to 750)
  public readonly startY: number;
  public readonly endY: number;

  constructor(config: ColumnConfig) {
    super();

    this.weatherType = config.type;
    this.columnX = config.x;
    this.columnWidth = config.width || getWeatherColumnWidth(config.type);

    // Full celestial height (-2200 to 2200) for ALL columns (including Mirror) to guarantee 0 vertical cut-offs
    this.startY = -2200;
    this.endY = 2200;

    this.x = this.columnX;
    this.y = 0;
    this.alpha = 0; // Smooth fade-in

    this.columnGfx = new Graphics();
    this.addChild(this.columnGfx);

    this.fxGfx = new Graphics();
    this.addChild(this.fxGfx);

    if (this.weatherType === "sun" || this.weatherType === "lightning" || this.weatherType === "mirror") {
      this.columnGfx.blendMode = "add";
      this.fxGfx.blendMode = "add";
    }

    // Initialize Random Icon Container and sprite pool
    if (this.weatherType === "random") {
      this.randomIconContainer = new Container();
      this.addChild(this.randomIconContainer);

      for (let i = 0; i < 16; i++) {
        const spr = new Sprite();
        spr.anchor.set(0.5, 0.5);
        spr.width = 18;
        spr.height = 18;
        spr.visible = false;
        this.randomIconContainer.addChild(spr);
        this.randomSprites.push(spr);
      }
    }

    this.initParticles();
    this.initLightning();
  }

  private initParticles() {
    this.particles = [];
    const count = this.weatherType === "tornado" ? 95 : this.weatherType === "lightning" ? 65 : this.weatherType === "mirror" ? 80 : this.maxParticles;
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  private createParticle(randomY: boolean = false): WeatherParticle {
    const yRange = this.endY - this.startY;
    const y = randomY ? this.startY + Math.random() * yRange : this.weatherType === "sun" ? this.startY + Math.random() * 200 : this.endY - Math.random() * 200;

    switch (this.weatherType) {
      case "tornado": {
        const isDebris = Math.random() > 0.45; // 55% authentic debris & rocks, 45% ice-blue wind vapor
        if (isDebris) {
          // Authentic tumbling debris: slate rocks, mud clods, terracotta fragments, leaves, metal scraps
          const debrisPalette = [
            0x1e293b, 0x334155, 0x475569, // Dark slate rock
            0x78350f, 0x92400e, 0x451a03, // Dirt / earth clods
            0xb45309, 0xd97706,           // Terracotta / autumn leaf flakes
            0x64748b, 0x94a3b8            // Scrap metal plates
          ];
          const color = debrisPalette[Math.floor(Math.random() * debrisPalette.length)];
          const orbitRadius = 6 + Math.random() * (this.columnWidth * 0.45);
          return {
            x: 0,
            y: randomY ? this.startY + Math.random() * yRange : this.endY - Math.random() * 200,
            vx: 0,
            vy: -(4.8 + Math.random() * 6.2), // High-speed upward vortex suction
            size: 3.2 + Math.random() * 4.2, // Substantial rock / chunk size
            alpha: 0,
            maxAlpha: 0.75 + Math.random() * 0.25,
            orbitAngle: Math.random() * Math.PI * 2,
            orbitRadius,
            orbitSpeed: (0.14 + Math.random() * 0.20) * (Math.random() > 0.5 ? 1 : -1),
            color,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (0.12 + Math.random() * 0.22) * (Math.random() > 0.5 ? 1 : -1),
            isDebris: true,
            shape: Math.floor(Math.random() * 3),
          };
        } else {
          // Atmospheric ice-blue & white cloud vapor dust (authentic GunBound palette)
          const vaporPalette = [0xffffff, 0xf0f9ff, 0xbae6fd, 0x7dd3fc, 0x38bdf8, 0x0284c7];
          const color = vaporPalette[Math.floor(Math.random() * vaporPalette.length)];
          const orbitRadius = 4 + Math.random() * (this.columnWidth * 0.46);
          return {
            x: 0,
            y,
            vx: 0,
            vy: -(4.0 + Math.random() * 5.0),
            size: 1.8 + Math.random() * 2.6,
            alpha: 0,
            maxAlpha: 0.60 + Math.random() * 0.35,
            orbitAngle: Math.random() * Math.PI * 2,
            orbitRadius,
            orbitSpeed: (0.12 + Math.random() * 0.16) * (Math.random() > 0.5 ? 1 : -1),
            color,
            isDebris: false,
          };
        }
      }
      case "sun": {
        return {
          x: (Math.random() - 0.5) * (this.columnWidth * 0.8),
          y: randomY ? y : this.startY + Math.random() * 200,
          vx: (Math.random() - 0.5) * 0.6,
          vy: 2.2 + Math.random() * 3.0, // Descending solar photons
          size: 2.0 + Math.random() * 3.0,
          alpha: 0,
          maxAlpha: 0.65 + Math.random() * 0.35,
          color: Math.random() > 0.5 ? 0xfef08a : 0xfacc15,
        };
      }
      case "lightning": {
        const sparkPalette = [0xffffff, 0x67e8f9, 0x38bdf8, 0x93c5fd, 0xe0e7ff];
        return {
          x: (Math.random() - 0.5) * (this.columnWidth * 0.85),
          y,
          vx: (Math.random() - 0.5) * 7.5,
          vy: (Math.random() - 0.5) * 6.0,
          size: 1.5 + Math.random() * 2.2,
          alpha: 0,
          maxAlpha: 0.85 + Math.random() * 0.15,
          color: sparkPalette[Math.floor(Math.random() * sparkPalette.length)],
          life: 0,
          maxLife: 15 + Math.random() * 20,
        };
      }
      case "mirror": {
        // Radiates from inside outward horizontally like reflective planar energy waves
        const dir = Math.random() > 0.5 ? 1 : -1;
        const mirrorPalette = [0xffffff, 0xfdba74, 0xfed7aa, 0xfb923c, 0xfef08a, 0x67e8f9];
        return {
          x: (Math.random() - 0.5) * 4, // Starts directly at center reflective spine
          y: randomY ? this.startY + Math.random() * yRange : this.startY + Math.random() * yRange,
          vx: dir * (3.0 + Math.random() * 4.5), // Rapid horizontal burst outward left/right!
          vy: (Math.random() - 0.5) * 0.4, // Bare minimal vertical drift
          size: 1.8 + Math.random() * 2.8,
          alpha: 0,
          maxAlpha: 0.85 + Math.random() * 0.15,
          life: 0,
          maxLife: 18 + Math.random() * 22,
          color: mirrorPalette[Math.floor(Math.random() * mirrorPalette.length)],
        };
      }
      case "black": {
        const orbitRadius = 10 + Math.random() * (this.columnWidth * 0.50);
        return {
          x: 0,
          y,
          vx: 0,
          vy: (Math.random() - 0.5) * 2.0,
          size: 2.0 + Math.random() * 3.0,
          alpha: 0,
          maxAlpha: 0.55 + Math.random() * 0.4,
          orbitAngle: Math.random() * Math.PI * 2,
          orbitRadius,
          orbitSpeed: 0.06 + Math.random() * 0.08,
          color: Math.random() > 0.5 ? 0xa855f7 : 0x581c87,
        };
      }
      case "random": {
        return {
          x: (Math.random() - 0.5) * (this.columnWidth * 0.7),
          y,
          vx: (Math.random() - 0.5) * 0.8,
          vy: 1.5 + Math.random() * 2.0,
          size: 2.0 + Math.random() * 2.5,
          alpha: 0,
          maxAlpha: 0.6 + Math.random() * 0.3,
          color: Math.random() > 0.5 ? 0xf97316 : 0x38bdf8,
        };
      }
      default:
        return { x: 0, y: 0, vx: 0, vy: 0, size: 2, alpha: 0.5, maxAlpha: 0.5, color: 0xffffff };
    }
  }

  private initLightning() {
    this.lightningChannels = [];
    if (this.weatherType === "lightning") {
      for (let i = 0; i < 3; i++) {
        this.lightningChannels.push(this.generateLightningPath());
      }
    }
  }

  private generateLightningPath(): LightningSegment[] {
    const segments: LightningSegment[] = [];
    const maxDeviation = this.columnWidth * 0.40; // ~15px horizontal span across widened 38px column
    let curX = (Math.random() - 0.5) * (this.columnWidth * 0.35);
    let curY = this.startY;
    const targetY = this.endY;

    while (curY < targetY) {
      const stepY = 18 + Math.random() * 24; // Sharp electric discharge zigzags
      const nextY = Math.min(targetY, curY + stepY);

      // Strong restoring pull towards center line (0) to maintain channel integrity
      const pull = -curX * 0.45;
      const jitter = (Math.random() - 0.5) * 12;
      const nextX = Math.max(-maxDeviation, Math.min(maxDeviation, curX + pull + jitter));

      segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

      // High-voltage branch fork crackling outward
      if (Math.random() > 0.74) {
        const forkDir = curX < 0 ? 1 : -1;
        const forkX = nextX + forkDir * (5 + Math.random() * 10);
        const forkY = nextY + 8 + Math.random() * 16;
        segments.push({
          x1: nextX,
          y1: nextY,
          x2: Math.max(-maxDeviation * 1.25, Math.min(maxDeviation * 1.25, forkX)),
          y2: forkY,
          isFork: true,
        });
      }

      curX = nextX;
      curY = nextY;
    }
    return segments;
  }

  public update(dt: number) {
    if (this.isDestroyed) return;

    this.time += dt * 0.05;

    // Smooth fade in / fade out
    if (this.isFadingOut) {
      this.fadeTimer -= dt * 0.08;
      this.alpha = Math.max(0, this.fadeTimer * 0.95);
      if (this.fadeTimer <= 0) {
        this.cleanup();
        return;
      }
    } else if (this.alpha < 0.95) {
      this.alpha = Math.min(0.95, this.alpha + dt * 0.06);
    }

    // Atmospheric sway for tornado
    if (this.weatherType === "tornado") {
      this.x = this.columnX + Math.sin(this.time * 2.2) * 8;
    } else {
      this.x = this.columnX;
    }

    // Render 100% native graphics
    this.renderColumn();
    this.updateParticles();
  }

  private renderColumn() {
    this.columnGfx.clear();
    const w = this.columnWidth;
    const sY = this.startY;
    const eY = this.endY;
    const h = eY - sY;

    switch (this.weatherType) {
      case "tornado": {
        // Volumetric 3D cyclone funnel with authentic ice-blue & white tones, dynamic wide eye & helical ribbons
        const steps = 110;
        const stepH = h / steps;

        // 1. Broad outer atmospheric mist cone with subtle organic pulse
        const mistPulse = 0.9 + Math.sin(this.time * 4) * 0.1;
        this.columnGfx.rect(-w * 0.52, sY, w * 1.04, h).fill({ color: 0x38bdf8, alpha: 0.12 * mistPulse });
        this.columnGfx.rect(-w * 0.32, sY, w * 0.64, h).fill({ color: 0x0284c7, alpha: 0.16 * mistPulse });

        // 2. Dense interlocking helical cloud ribbons creating substantial volumetric 3D body
        for (let r = 0; r < 8; r++) {
          const ribbonPalette = [0xffffff, 0xbae6fd, 0x7dd3fc, 0x38bdf8, 0x0284c7, 0xf0f9ff, 0x38bdf8, 0xbae6fd];
          const ribbonCol = ribbonPalette[r % ribbonPalette.length];
          const ribbonAlpha = 0.40 + Math.sin(this.time * 5 + r * 0.8) * 0.18;
          const phaseOffset = r * (Math.PI / 4);

          let prevX = Math.sin(this.time * 6.5 + sY * 0.007 + phaseOffset) * (w * 0.44);
          let prevY = sY;

          for (let s = 1; s <= steps; s++) {
            const nextY = sY + s * stepH;
            const nextX = Math.sin(this.time * 6.5 + nextY * 0.007 + phaseOffset) * (w * 0.44);
            this.columnGfx.moveTo(prevX, prevY).lineTo(nextX, nextY)
              .stroke({ width: r === 0 ? 6.5 : r === 1 ? 5.2 : 3.8, color: ribbonCol, alpha: ribbonAlpha });
            prevX = nextX;
            prevY = nextY;
          }
        }

        // 3. Dynamic Volumetric Eye of the Tornado (widened dynamic vertical spine)
        for (let s = 1; s <= steps; s++) {
          const y1 = sY + (s - 1) * stepH;
          const y2 = sY + s * stepH;
          const eyeSway1 = Math.sin(this.time * 5.5 + y1 * 0.006) * (w * 0.15);
          const eyeSway2 = Math.sin(this.time * 5.5 + y2 * 0.006) * (w * 0.15);

          const eyePulse = Math.sin(this.time * 7 + y1 * 0.012);
          const dynamicEyeW = 7.5 + eyePulse * 3.2 + Math.cos(this.time * 11 + y1 * 0.02) * 1.8;

          // Outer eye cyan sheath
          this.columnGfx.moveTo(eyeSway1, y1).lineTo(eyeSway2, y2)
            .stroke({ width: dynamicEyeW + 6.0, color: 0x38bdf8, alpha: 0.35 + eyePulse * 0.12 });

          // Condensed ice-blue vortex eye core
          this.columnGfx.moveTo(eyeSway1, y1).lineTo(eyeSway2, y2)
            .stroke({ width: dynamicEyeW, color: 0xbae6fd, alpha: 0.72 });

          // Incandescent pure white center filament
          this.columnGfx.moveTo(eyeSway1, y1).lineTo(eyeSway2, y2)
            .stroke({ width: Math.max(3.0, dynamicEyeW * 0.42), color: 0xffffff, alpha: 0.95 });
        }

        // 4. Sweeping horizontal wind vortex rings
        const ringSpacing = 65;
        const ringScroll = (this.time * 150) % ringSpacing;
        for (let ringY = sY - ringSpacing; ringY <= eY + ringSpacing; ringY += ringSpacing) {
          const y = ringY + ringScroll;
          if (y < sY || y > eY) continue;
          const sway = Math.sin(this.time * 5.5 + y * 0.006) * (w * 0.15);
          this.columnGfx.ellipse(sway, y, w * 0.46, 5.2)
            .stroke({ width: 2.2, color: 0xbae6fd, alpha: 0.65 });
          this.columnGfx.ellipse(sway, y, w * 0.26, 3.2)
            .stroke({ width: 1.6, color: 0xffffff, alpha: 0.80 });
        }
        break;
      }

      case "sun": {
        const pulse = 0.85 + Math.sin(this.time * 3) * 0.15;
        // Outer divine god-ray aura (sleek width)
        this.columnGfx.rect(-w * 0.50, sY, w, h).fill({ color: 0xfef08a, alpha: 0.16 * pulse });
        // Secondary radiant solar beam
        this.columnGfx.rect(-w * 0.28, sY, w * 0.56, h).fill({ color: 0xfde047, alpha: 0.35 * pulse });
        // Incandescent white-hot core
        this.columnGfx.rect(-w * 0.12, sY, w * 0.24, h).fill({ color: 0xffffff, alpha: 0.80 * pulse });
        break;
      }

      case "lightning": {
        this.lightningTimer += 16.66;
        if (this.lightningTimer >= 45) { // Rapid electric discharge pulse
          this.lightningTimer = 0;
          if (this.lightningChannels.length < 3) {
            this.initLightning();
          } else {
            // Regenerate random channels for erratic, realistic thunder strikes
            const replaceIdx = Math.floor(Math.random() * this.lightningChannels.length);
            this.lightningChannels[replaceIdx] = this.generateLightningPath();
            if (Math.random() > 0.5) {
              const otherIdx = (replaceIdx + 1) % this.lightningChannels.length;
              this.lightningChannels[otherIdx] = this.generateLightningPath();
            }
          }
        }

        // 1. Sleek central ambient electric plasma beam aura (~38px width)
        const plasmaPulse = 0.85 + Math.sin(this.time * 8) * 0.15;
        this.columnGfx.rect(-w * 0.46, sY, w * 0.92, h).fill({ color: 0x1d4ed8, alpha: 0.16 * plasmaPulse });
        this.columnGfx.rect(-w * 0.28, sY, w * 0.56, h).fill({ color: 0x0284c7, alpha: 0.24 * plasmaPulse });
        this.columnGfx.rect(-w * 0.12, sY, w * 0.24, h).fill({ color: 0x67e8f9, alpha: 0.36 * plasmaPulse });

        // 2. Render all active branching lightning channels with intense cores
        for (let cIdx = 0; cIdx < this.lightningChannels.length; cIdx++) {
          const channel = this.lightningChannels[cIdx];
          const channelAlpha = 0.78 + (cIdx === 0 ? 0.22 : Math.sin(this.time * 12 + cIdx) * 0.20);

          for (const seg of channel) {
            const jx = (Math.random() - 0.5) * 1.2;

            // Outer electric deep blue/cyan corona
            this.columnGfx.moveTo(seg.x1 + jx, seg.y1).lineTo(seg.x2 + jx, seg.y2)
              .stroke({ width: seg.isFork ? 2.8 : 5.2, color: 0x0284c7, alpha: channelAlpha * 0.55 });

            // Mid vibrant electric cyan stroke
            this.columnGfx.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2)
              .stroke({ width: seg.isFork ? 1.6 : 3.2, color: 0x38bdf8, alpha: channelAlpha * 0.85 });

            // Incandescent pure white core
            this.columnGfx.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2)
              .stroke({ width: seg.isFork ? 0.9 : 1.8, color: 0xffffff, alpha: channelAlpha });

            // Vertex spark hotspots at sharp discharge bends
            if (!seg.isFork && Math.random() > 0.82) {
              this.columnGfx.circle(seg.x1, seg.y1, 2.5).fill({ color: 0xffffff, alpha: 0.95 });
              this.columnGfx.circle(seg.x1, seg.y1, 4.0).stroke({ width: 1.0, color: 0x67e8f9, alpha: 0.65 });
            }
          }
        }
        break;
      }

      case "mirror": {
        // Crystalline reflective energy wall spanning celestial sky to abyss
        const filamentPulse = 0.85 + Math.sin(this.time * 4) * 0.15;
        // Outer radiant amber glow
        this.columnGfx.rect(-w * 0.5, sY, w, h).fill({ color: 0xfb923c, alpha: 0.22 });
        // Polished vertical crystal border rails
        this.columnGfx.moveTo(-w * 0.5, sY).lineTo(-w * 0.5, eY).stroke({ width: 2.2, color: 0xfdba74, alpha: 0.88 });
        this.columnGfx.moveTo(w * 0.5, sY).lineTo(w * 0.5, eY).stroke({ width: 2.2, color: 0xfdba74, alpha: 0.88 });
        // Inner intense prismatic core filament
        this.columnGfx.moveTo(0, sY).lineTo(0, eY).stroke({ width: 2.4, color: 0xffffff, alpha: 0.92 * filamentPulse });

        // Crystalline diagonal light reflections traversing the barrier
        const shimmerSpacing = 280;
        const shimmerScroll = (this.time * 160) % shimmerSpacing;
        for (let base = sY - shimmerSpacing; base <= eY + shimmerSpacing; base += shimmerSpacing) {
          const sy = base + shimmerScroll;
          if (sy < sY || sy > eY) continue;
          this.columnGfx.moveTo(-w * 0.45, sy)
            .lineTo(w * 0.45, sy - 35)
            .stroke({ width: 1.5, color: 0xffffff, alpha: 0.65 });
        }
        break;
      }

      case "black": {
        const pulse = 0.85 + Math.sin(this.time * 2.5) * 0.15;
        // Deep obsidian void column
        this.columnGfx.rect(-w * 0.32, sY, w * 0.64, h).fill({ color: 0x090314, alpha: 0.92 });
        // Gravitational event horizon aura
        this.columnGfx.rect(-w * 0.50, sY, w, h).fill({ color: 0x581c87, alpha: 0.25 * pulse });
        // Core dark distortion line
        this.columnGfx.moveTo(0, sY).lineTo(0, eY).stroke({ width: 2.5, color: 0xc084fc, alpha: 0.75 * pulse });
        break;
      }

      case "random": {
        const pulse = 0.85 + Math.sin(this.time * 3) * 0.15;
        // Conduit background
        this.columnGfx.rect(-w * 0.5, sY, w, h).fill({ color: 0x070d1c, alpha: 0.52 });
        // Glowing neon energy rail borders
        this.columnGfx.moveTo(-w * 0.5, sY).lineTo(-w * 0.5, eY).stroke({ width: 2.0, color: 0xf97316, alpha: 0.85 * pulse });
        this.columnGfx.moveTo(w * 0.5, sY).lineTo(w * 0.5, eY).stroke({ width: 2.0, color: 0xf97316, alpha: 0.85 * pulse });
        // Core subtle energy stream
        this.columnGfx.rect(-w * 0.12, sY, w * 0.24, h).fill({ color: 0xf97316, alpha: 0.12 * pulse });

        // Draw cascading weather badges smoothly descending at 34px/s
        const cycleHeight = 700;
        const scrollOffset = (this.time * 34) % cycleHeight;
        const itemSpacing = 140;

        let spriteIdx = 0;

        for (let base = sY - cycleHeight; base <= eY + cycleHeight; base += cycleHeight) {
          for (let i = 0; i < 5; i++) {
            const orbY = base + i * itemSpacing + scrollOffset;
            if (orbY < sY || orbY > eY) continue;

            const orbConf = [
              { color: 0xfacc15, textureIdx: 0 }, // Sun
              { color: 0x60a5fa, textureIdx: 1 }, // Lightning
              { color: 0xfb923c, textureIdx: 2 }, // Mirror
              { color: 0x34d399, textureIdx: 3 }, // Tornado
              { color: 0xc084fc, textureIdx: 4 }, // Black
            ][i];

            // Outer glowing badge disc
            this.columnGfx.circle(0, orbY, 14).fill({ color: 0x080e1c, alpha: 0.95 });
            this.columnGfx.circle(0, orbY, 14).stroke({ width: 2.0, color: orbConf.color, alpha: 0.95 });

            // Place authentic weather icon sprite from pool
            if (spriteIdx < this.randomSprites.length) {
              const spr = this.randomSprites[spriteIdx];
              spr.texture = Texture.from(RANDOM_ICONS[orbConf.textureIdx]);
              spr.position.set(0, orbY);
              spr.visible = true;
              spriteIdx++;
            }
          }
        }

        // Hide any remaining unused sprites
        for (let s = spriteIdx; s < this.randomSprites.length; s++) {
          this.randomSprites[s].visible = false;
        }
        break;
      }
    }
  }

  private updateParticles() {
    this.fxGfx.clear();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.orbitAngle !== undefined && p.orbitRadius !== undefined && p.orbitSpeed !== undefined) {
        p.orbitAngle += p.orbitSpeed;
        p.x = Math.cos(p.orbitAngle) * p.orbitRadius;
        p.y += p.vy;

        // Inward suction for black void
        if (this.weatherType === "black") {
          p.orbitRadius = Math.max(3, p.orbitRadius - 0.25);
        }
      } else {
        p.x += p.vx;
        p.y += p.vy;
      }

      // Smooth fade in / out
      if (p.alpha < p.maxAlpha) {
        p.alpha = Math.min(p.maxAlpha, p.alpha + 0.05);
      }

      // Recycle when off vertical bounds
      if (p.y < this.startY - 50 || p.y > this.endY + 50) {
        this.particles[i] = this.createParticle(false);
        continue;
      }

      if (this.weatherType === "mirror") {
        if (p.life !== undefined && p.maxLife !== undefined) {
          p.life++;
          if (p.life >= p.maxLife || Math.abs(p.x) > this.columnWidth * 0.95) {
            this.particles[i] = this.createParticle(false);
            continue;
          }
          const fade = 1 - (p.life / p.maxLife);
          p.alpha = fade * p.maxAlpha;
        }

        // Radiating horizontal energy wave ray / streak from inside outward
        const tailLen = Math.abs(p.vx) * 2.8;
        const tailX = p.vx > 0 ? p.x - tailLen : p.x + tailLen;
        this.fxGfx.moveTo(p.x, p.y).lineTo(tailX, p.y + (Math.random() - 0.5) * 1.2)
          .stroke({ width: p.size, color: p.color, alpha: p.alpha });
        // Glowing spark head
        this.fxGfx.circle(p.x, p.y, p.size * 0.75).fill({ color: 0xffffff, alpha: p.alpha });
      } else if (this.weatherType === "tornado") {
        if (p.isDebris) {
          // Dynamic tumbling debris chunks (slate rock, mud, terracotta, leaves, metal scrap)
          if (p.rotation !== undefined && p.rotSpeed !== undefined) {
            p.rotation += p.rotSpeed;
          }
          // 3D orbital shading: in front of vortex = brighter & larger, behind = shaded
          const inFront = Math.sin(p.orbitAngle || 0) > 0;
          const depthAlpha = inFront ? p.alpha : p.alpha * 0.55;
          const s = (inFront ? 1.15 : 0.85) * (p.size * 0.5);
          const rot = p.rotation || 0;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);

          // Draw angular tumbling polygonal shard
          const p1x = p.x + (-s * cos - -s * sin);
          const p1y = p.y + (-s * sin + -s * cos);
          const p2x = p.x + (s * cos - -s * 0.4 * sin);
          const p2y = p.y + (s * sin + -s * 0.4 * cos);
          const p3x = p.x + (s * 0.6 * cos - s * sin);
          const p3y = p.y + (s * 0.6 * sin + s * cos);
          const p4x = p.x + (-s * 0.8 * cos - s * 0.6 * sin);
          const p4y = p.y + (-s * 0.8 * sin + s * 0.6 * cos);

          this.fxGfx.poly([p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y]).fill({ color: p.color, alpha: depthAlpha });
          if (inFront) {
            this.fxGfx.poly([p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y])
              .stroke({ width: 0.8, color: 0x94a3b8, alpha: depthAlpha * 0.6 });
          }
        } else {
          // Volumetric ice-blue & white cloud dust
          this.fxGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
        }
      } else if (this.weatherType === "lightning") {
        if (p.life !== undefined && p.maxLife !== undefined) {
          p.life++;
          if (p.life >= p.maxLife) {
            this.particles[i] = this.createParticle(false);
            continue;
          }
        }
        // Sharp high-voltage discharge spark with needle tail
        this.fxGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
        const jx = (Math.random() - 0.5) * 5.5;
        const jy = (Math.random() - 0.5) * 5.5;
        this.fxGfx.moveTo(p.x, p.y).lineTo(p.x + jx, p.y + jy)
          .stroke({ width: 1.4, color: 0xffffff, alpha: p.alpha * 0.90 });
      } else {
        this.fxGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
      }
    }
  }

  public fadeOut() {
    this.isFadingOut = true;
  }

  public cleanup() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.parent) {
      this.parent.removeChild(this);
    }
    if (this.randomSprites.length > 0) {
      for (const spr of this.randomSprites) {
        spr.destroy();
      }
      this.randomSprites = [];
    }
    if (this.randomIconContainer) {
      this.randomIconContainer.destroy({ children: true });
    }
    this.columnGfx.destroy();
    this.fxGfx.destroy();
    this.destroy({ children: true });
  }
}
