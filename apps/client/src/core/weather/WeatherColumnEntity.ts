import { Container, Graphics, Sprite, Texture, TilingSprite, Assets, Rectangle } from "pixi.js";
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

/**
 * WeatherColumnEntity
 * 
 * Authentic GunBound Procedural & Sprite Weather Engine.
 * Features:
 * - Sunforce: Uses authentic GunBound sprites (sunforce.png beam, sunforce2.png sparkling stars, forcetip.png animated chevrons) with fluid multi-speed animation.
 * - Tornado: Volumetric swirling cloud funnel with dense vapor bands, white core, dust & debris particles.
 * - Lightning: Continuous fluid 60 FPS electric thunderstorm across widened 52px column with 5 simultaneous plasma channels.
 * - Mirror: Crystalline reflective barrier with planar light streaks.
 * - Black: Cosmic gravitational dark matter pillar with event horizon.
 */
export class WeatherColumnEntity extends Container {
  public weatherType: WeatherType;
  public columnX: number;
  public columnWidth: number;
  public isDestroyed: boolean = false;

  private columnGfx: Graphics;
  private fxGfx: Graphics;

  // Authentic GunBound Sunforce Sprite Layers
  private sunTiling1?: TilingSprite;
  private sunTiling2?: TilingSprite;
  private sunTipSprites: Sprite[] = [];
  private sunTipTextures: Texture[] = [];
  private sunTipTimer: number = 0;

  // Authentic GunBound Mirror Sprite Layer
  private mirrorTiling?: TilingSprite;

  // Authentic GunBound Random Weather Sprite Layer
  private randomTiling?: TilingSprite;
  private randomIconContainer?: Container;
  public randomSprites: Array<{ sprite: Sprite; weatherType: WeatherType; baseOffset: number }> = [];

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

  // Vertical spans: full celestial height (-2200 to 2200) to eliminate cutoffs
  public readonly startY: number;
  public readonly endY: number;

  constructor(config: ColumnConfig) {
    super();

    this.weatherType = config.type;
    this.columnX = config.x;
    this.columnWidth = config.width || getWeatherColumnWidth(config.type);

    this.startY = -2200;
    this.endY = 2200;

    this.x = this.columnX;
    this.y = 0;
    this.alpha = 0; // Smooth fade-in

    this.columnGfx = new Graphics();
    this.addChild(this.columnGfx);

    this.fxGfx = new Graphics();
    this.addChild(this.fxGfx);

    if (this.weatherType === "sun" || this.weatherType === "lightning" || this.weatherType === "mirror" || this.weatherType === "random") {
      this.columnGfx.blendMode = "add";
      this.fxGfx.blendMode = "add";
    }

    if (this.weatherType === "sun") {
      this.initSunforce();
    } else if (this.weatherType === "mirror") {
      this.initMirror();
    } else if (this.weatherType === "random") {
      this.initRandom();
    }

    this.initParticles();
    this.initLightning();
  }

  private async initSunforce() {
    try {
      const [tex1, tex2, tipBase] = await Promise.all([
        Assets.load<Texture>("/sprites/weather/sunforce.png"),
        Assets.load<Texture>("/sprites/weather/sunforce2.png"),
        Assets.load<Texture>("/sprites/weather/forcetip.png"),
      ]);

      if (this.isDestroyed) return;

      const totalH = this.endY - this.startY; // 4400px full celestial span

      // Layer 1: Base authentic GunBound column beam: slow, calm downward vertical scroll
      this.sunTiling1 = new TilingSprite({
        texture: tex1,
        width: 128,
        height: totalH,
      });
      this.sunTiling1.anchor.set(0.5, 0);
      this.sunTiling1.position.set(0, this.startY);
      this.sunTiling1.scale.set(0.68, 1.0); // Ancho ligeramente reducido a pedido del usuario (~48px haz activo)
      this.sunTiling1.blendMode = "add";
      this.sunTiling1.alpha = 0.90;
      this.addChildAt(this.sunTiling1, 0);

      // Layer 2: Authentic sparkle/star overlay layer: faster scroll with subtle breathing pulse
      this.sunTiling2 = new TilingSprite({
        texture: tex2,
        width: 128,
        height: totalH,
      });
      this.sunTiling2.anchor.set(0.5, 0);
      this.sunTiling2.position.set(0, this.startY);
      this.sunTiling2.scale.set(0.68, 1.0); // Ancho ligeramente reducido coordinado
      this.sunTiling2.blendMode = "add";
      this.sunTiling2.alpha = 0.78;
      this.addChildAt(this.sunTiling2, 1);

      // Layer 3: Slice 5 animated force-tip chevrons from forcetip.png (125x25 -> 5 frames of 25x25)
      this.sunTipTextures = [];
      for (let f = 0; f < 5; f++) {
        const frameRect = new Rectangle(f * 25, 0, 25, 25);
        const frameTex = new Texture({ source: tipBase.source, frame: frameRect });
        this.sunTipTextures.push(frameTex);
      }

      // Cascading downward force tip indicators flowing inside the beam
      const tipCount = 14;
      for (let i = 0; i < tipCount; i++) {
        const spr = new Sprite(this.sunTipTextures[0]);
        spr.anchor.set(0.5, 0.5);
        spr.scale.set(0.72, 0.72); // Proporcional al ancho refinado del rayo
        spr.blendMode = "add";
        spr.alpha = 0.85;
        this.addChild(spr);
        this.sunTipSprites.push(spr);
      }
    } catch (e) {
      console.warn("[WeatherColumnEntity] Error loading sunforce sprites:", e);
    }
  }

  private async initMirror() {
    try {
      const tex = await Assets.load<Texture>("/sprites/weather/mirrorforce.png");
      if (this.isDestroyed) return;

      const totalH = this.endY - this.startY;
      this.mirrorTiling = new TilingSprite({
        texture: tex,
        width: 128,
        height: totalH,
      });
      this.mirrorTiling.anchor.set(0.5, 0);
      this.mirrorTiling.position.set(0, this.startY);
      this.mirrorTiling.scale.set(0.52, 1.0); // Ajuste proporcional a los 32px de ancho del espejo
      this.mirrorTiling.blendMode = "add";
      this.mirrorTiling.alpha = 0.85;
      this.addChildAt(this.mirrorTiling, 0);
    } catch (e) {
      console.warn("[WeatherColumnEntity] Error loading mirrorforce sprite:", e);
    }
  }

  private async initRandom() {
    try {
      const totalH = this.endY - this.startY;

      // 1. Authentic GunBound randomforce.png background conduit
      const conduitTex = await Assets.load<Texture>("/sprites/weather/randomforce.png");
      if (this.isDestroyed) return;

      this.randomTiling = new TilingSprite({
        texture: conduitTex,
        width: 128,
        height: totalH,
      });
      this.randomTiling.anchor.set(0.5, 0);
      this.randomTiling.position.set(0, this.startY);
      this.randomTiling.scale.set(0.58, 1.0);
      this.randomTiling.blendMode = "add";
      this.randomTiling.alpha = 0.75;
      this.addChildAt(this.randomTiling, 0);

      // 2. Cascading authentic GunBound weather item sprites flowing inside the column
      this.randomIconContainer = new Container();
      this.addChild(this.randomIconContainer);

      const itemsDef: Array<{ type: WeatherType; path: string }> = [
        { type: "sun", path: "/sprites/weather/weather_3_active.png" },
        { type: "lightning", path: "/sprites/weather/weather_4_active.png" },
        { type: "mirror", path: "/sprites/weather/weather_7_active.png" },
        { type: "tornado", path: "/sprites/weather/weather_8_active.png" },
        { type: "black", path: "/sprites/weather/weather_5_active.png" },
      ];

      const loadedTextures = await Promise.all(
        itemsDef.map((it) => Assets.load<Texture>(it.path))
      );

      if (this.isDestroyed || !this.randomIconContainer) return;

      const spacing = 180;
      const count = Math.ceil(totalH / spacing);

      for (let i = 0; i < count; i++) {
        const itemIdx = i % itemsDef.length;
        const tex = loadedTextures[itemIdx];
        const spr = new Sprite(tex);
        spr.anchor.set(0.5, 0.5);
        spr.scale.set(0.82, 0.82);
        spr.alpha = 0.95;
        this.randomIconContainer.addChild(spr);

        this.randomSprites.push({
          sprite: spr,
          weatherType: itemsDef[itemIdx].type,
          baseOffset: i * spacing,
        });
      }
    } catch (e) {
      console.warn("[WeatherColumnEntity] Error loading randomforce sprites:", e);
    }
  }

  private initParticles() {
    this.particles = [];
    const count = this.weatherType === "tornado" ? 95 : this.weatherType === "lightning" ? 90 : this.weatherType === "sun" ? 75 : this.weatherType === "mirror" ? 80 : this.maxParticles;
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  private createParticle(randomY: boolean = false): WeatherParticle {
    const yRange = this.endY - this.startY;
    const y = randomY ? this.startY + Math.random() * yRange : this.weatherType === "sun" ? this.endY - Math.random() * 200 : this.endY - Math.random() * 200;

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
        // Radiant solar energy power particles ascending along the pillar with soft dissipation
        const isSparks = Math.random() > 0.45;
        const sunPalette = [0xffffff, 0xfef08a, 0xfde047, 0xfacc15, 0xf59e0b];
        const color = sunPalette[Math.floor(Math.random() * sunPalette.length)];
        return {
          x: (Math.random() - 0.5) * (this.columnWidth * 0.95),
          y: randomY ? this.startY + Math.random() * yRange : this.startY + Math.random() * yRange,
          vx: (Math.random() - 0.5) * 1.4,
          vy: -(2.8 + Math.random() * 4.2), // Ascending stream of radiant solar power
          size: isSparks ? 1.6 + Math.random() * 2.2 : 2.8 + Math.random() * 3.6,
          alpha: 0,
          maxAlpha: 0.75 + Math.random() * 0.25,
          color,
          life: 0,
          maxLife: 35 + Math.random() * 45,
        };
      }
      case "lightning": {
        // High-voltage crackling plasma discharge sparks with needle tails
        const sparkPalette = [0xffffff, 0x67e8f9, 0x38bdf8, 0x93c5fd, 0xe0e7ff, 0x0284c7];
        return {
          x: (Math.random() - 0.5) * (this.columnWidth * 0.95),
          y,
          vx: (Math.random() - 0.5) * 11.0, // High-speed horizontal crackling discharge across widened 52px column
          vy: (Math.random() - 0.5) * 8.0,
          size: 1.6 + Math.random() * 2.8,
          alpha: 0,
          maxAlpha: 0.90 + Math.random() * 0.10,
          color: sparkPalette[Math.floor(Math.random() * sparkPalette.length)],
          life: 0,
          maxLife: 16 + Math.random() * 24,
        };
      }
      case "mirror": {
        // Authentic GunBound reflective crystal prism shards & diamond glints
        const isDiamond = Math.random() > 0.40;
        const mirrorPalette = [0xffffff, 0xe0f2fe, 0xbae6fd, 0x7dd3fc, 0x38bdf8, 0xfef08a, 0xfdba74];
        const color = mirrorPalette[Math.floor(Math.random() * mirrorPalette.length)];
        return {
          x: (Math.random() - 0.5) * (this.columnWidth * 0.85),
          y: randomY ? this.startY + Math.random() * yRange : this.startY + Math.random() * yRange,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(1.4 + Math.random() * 2.2), // Suave ascenso brillante de polvo cristalino
          size: isDiamond ? 2.8 + Math.random() * 2.6 : 1.4 + Math.random() * 2.0,
          alpha: 0,
          maxAlpha: 0.80 + Math.random() * 0.20,
          life: 0,
          maxLife: 30 + Math.random() * 35,
          color,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.08,
          shape: isDiamond ? 1 : 0, // 1 = diamante reflectante prismático, 0 = mota de cristal suave
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
        const rainbowColors = [0x38bdf8, 0xa855f7, 0xfacc15, 0x4ade80, 0xfb923c, 0xffffff];
        return {
          x: (Math.random() - 0.5) * (this.columnWidth * 0.85),
          y: randomY ? this.startY + Math.random() * yRange : this.startY + Math.random() * yRange,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -(1.6 + Math.random() * 2.5),
          size: 1.8 + Math.random() * 2.2,
          alpha: 0,
          maxAlpha: 0.85,
          color: rainbowColors[Math.floor(Math.random() * rainbowColors.length)],
          life: 0,
          maxLife: 35 + Math.random() * 30,
        };
      }
      default:
        return { x: 0, y: 0, vx: 0, vy: 0, size: 2, alpha: 0.5, maxAlpha: 0.5, color: 0xffffff };
    }
  }

  private initLightning() {
    this.lightningChannels = [];
    if (this.weatherType === "lightning") {
      // 5 continuous fluid multi-channel electric lightning bolts
      for (let i = 0; i < 5; i++) {
        this.lightningChannels.push(this.generateLightningPath());
      }
    }
  }

  private generateLightningPath(): LightningSegment[] {
    const segments: LightningSegment[] = [];
    const maxDeviation = this.columnWidth * 0.48; // ~25px horizontal span across widened 52px column
    let curX = (Math.random() - 0.5) * (this.columnWidth * 0.40);
    let curY = this.startY;
    const targetY = this.endY;

    while (curY < targetY) {
      const stepY = 16 + Math.random() * 22; // Sharp electric discharge zigzags
      const nextY = Math.min(targetY, curY + stepY);

      // Restoring pull towards center line to maintain electric plasma column integrity
      const pull = -curX * 0.40;
      const jitter = (Math.random() - 0.5) * 16;
      const nextX = Math.max(-maxDeviation, Math.min(maxDeviation, curX + pull + jitter));

      segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

      // High-voltage branch fork crackling outward
      if (Math.random() > 0.68) {
        const forkDir = curX < 0 ? 1 : -1;
        const forkX = nextX + forkDir * (6 + Math.random() * 14);
        const forkY = nextY + 6 + Math.random() * 18;
        segments.push({
          x1: nextX,
          y1: nextY,
          x2: Math.max(-maxDeviation * 1.3, Math.min(maxDeviation * 1.3, forkX)),
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

    // Authentic Sunforce multi-speed fluid animation
    if (this.weatherType === "sun") {
      // Background beam scrolls downward slowly and majestically
      if (this.sunTiling1) {
        this.sunTiling1.tilePosition.y += dt * 0.70;
        this.sunTiling1.alpha = 0.85 + Math.sin(this.time * 2.2) * 0.10;
      }
      // Sparkling star dust overlay scrolls downward at a faster, lively speed
      if (this.sunTiling2) {
        this.sunTiling2.tilePosition.y += dt * 1.55;
        this.sunTiling2.alpha = 0.78 + Math.sin(this.time * 3.8) * 0.18;
      }
      // Force tip chevrons cascade downwards and cycle through 5 animation frames
      if (this.sunTipTextures.length > 0 && this.sunTipSprites.length > 0) {
        this.sunTipTimer += dt * 10;
        const currentFrame = Math.floor(this.sunTipTimer) % this.sunTipTextures.length;
        const cycleHeight = 900;
        const tipSpacing = cycleHeight / this.sunTipSprites.length;
        const offset = (this.time * 110) % cycleHeight;

        for (let i = 0; i < this.sunTipSprites.length; i++) {
          const spr = this.sunTipSprites[i];
          spr.texture = this.sunTipTextures[currentFrame];
          const yPos = this.startY + ((i * tipSpacing + offset) % (this.endY - this.startY));
          spr.position.set(0, yPos);
          spr.alpha = 0.75 + Math.sin(this.time * 4.0 + i) * 0.20;
        }
      }
    }

    // Authentic Mirror crystalline dust shimmer animation
    if (this.weatherType === "mirror" && this.mirrorTiling) {
      this.mirrorTiling.tilePosition.y -= dt * 0.95;
      this.mirrorTiling.alpha = 0.80 + Math.sin(this.time * 3.2) * 0.15;
    }

    // Authentic Random Weather: icons descend smoothly at a gentle 28px/s
    if (this.weatherType === "random") {
      if (this.randomTiling) {
        this.randomTiling.tilePosition.y += dt * 0.85;
        this.randomTiling.alpha = 0.75 + Math.sin(this.time * 2.8) * 0.12;
      }
      if (this.randomSprites.length > 0) {
        const totalSpan = this.endY - this.startY;
        const scrollOffset = (this.time * 28) % totalSpan;
        for (const item of this.randomSprites) {
          const yPos = this.startY + ((item.baseOffset + scrollOffset) % totalSpan);
          item.sprite.position.set(0, yPos);
          item.sprite.alpha = 0.88 + Math.sin(this.time * 3.5 + item.baseOffset * 0.02) * 0.12;
        }
      }
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
        // Soft golden ambient glow backing the authentic GunBound sprite beam
        const pulse = 0.88 + Math.sin(this.time * 3.0) * 0.12;
        // Soft outer ambient warmth
        this.columnGfx.rect(-w * 0.55, sY, w * 1.10, h).fill({ color: 0xfef08a, alpha: 0.08 * pulse });
        this.columnGfx.rect(-w * 0.35, sY, w * 0.70, h).fill({ color: 0xfacc15, alpha: 0.16 * pulse });
        // Core warm golden glow
        this.columnGfx.rect(-w * 0.18, sY, w * 0.36, h).fill({ color: 0xf59e0b, alpha: 0.24 * pulse });
        // Incandescent pure white energetic filament core
        this.columnGfx.moveTo(0, sY).lineTo(0, eY).stroke({ width: 1.5, color: 0xffffff, alpha: 0.75 * pulse });
        break;
      }

      case "lightning": {
        this.lightningTimer += 16.66;
        if (this.lightningTimer >= 40) { // Rapid high-frequency electric discharge pulse
          this.lightningTimer = 0;
          if (this.lightningChannels.length < 5) {
            this.initLightning();
          } else {
            // Regenerate random channels for erratic, realistic thunderstorm strikes
            const replaceIdx = Math.floor(Math.random() * this.lightningChannels.length);
            this.lightningChannels[replaceIdx] = this.generateLightningPath();
            if (Math.random() > 0.4) {
              const otherIdx = (replaceIdx + 1) % this.lightningChannels.length;
              this.lightningChannels[otherIdx] = this.generateLightningPath();
            }
          }
        }

        // 1. Amplified ambient electric plasma beam aura (~52px width with multi-stage glow)
        const plasmaPulse = 0.85 + Math.sin(this.time * 8.5) * 0.15;
        this.columnGfx.rect(-w * 0.50, sY, w, h).fill({ color: 0x1d4ed8, alpha: 0.18 * plasmaPulse });
        this.columnGfx.rect(-w * 0.35, sY, w * 0.70, h).fill({ color: 0x0284c7, alpha: 0.26 * plasmaPulse });
        this.columnGfx.rect(-w * 0.18, sY, w * 0.36, h).fill({ color: 0x67e8f9, alpha: 0.38 * plasmaPulse });

        // 2. Render all 5 active branching lightning channels with intense plasma cores
        for (let cIdx = 0; cIdx < this.lightningChannels.length; cIdx++) {
          const channel = this.lightningChannels[cIdx];
          const channelAlpha = 0.82 + (cIdx === 0 ? 0.18 : Math.sin(this.time * 14 + cIdx * 1.2) * 0.18);

          for (const seg of channel) {
            const jx = (Math.random() - 0.5) * 1.5;

            // Outer electric deep blue/cyan corona
            this.columnGfx.moveTo(seg.x1 + jx, seg.y1).lineTo(seg.x2 + jx, seg.y2)
              .stroke({ width: seg.isFork ? 3.0 : 5.8, color: 0x0284c7, alpha: channelAlpha * 0.55 });

            // Mid vibrant electric cyan stroke
            this.columnGfx.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2)
              .stroke({ width: seg.isFork ? 1.8 : 3.4, color: 0x38bdf8, alpha: channelAlpha * 0.88 });

            // Incandescent pure white core
            this.columnGfx.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2)
              .stroke({ width: seg.isFork ? 1.0 : 2.0, color: 0xffffff, alpha: channelAlpha });

            // Vertex spark hotspots at sharp discharge bends
            if (!seg.isFork && Math.random() > 0.80) {
              this.columnGfx.circle(seg.x1, seg.y1, 2.8).fill({ color: 0xffffff, alpha: 0.95 });
              this.columnGfx.circle(seg.x1, seg.y1, 4.5).stroke({ width: 1.2, color: 0x67e8f9, alpha: 0.70 });
            }
          }
        }

        // 3. Dynamic horizontal electric arc bridges crackling between lightning channels
        if (this.lightningChannels.length >= 2 && Math.random() > 0.35) {
          const chA = this.lightningChannels[0];
          const chB = this.lightningChannels[1];
          const sampleCount = 6;
          for (let k = 0; k < sampleCount; k++) {
            const randIdxA = Math.floor(Math.random() * chA.length);
            const randIdxB = Math.floor(Math.random() * chB.length);
            const segA = chA[randIdxA];
            const segB = chB[randIdxB];
            if (segA && segB && Math.abs(segA.y1 - segB.y1) < 80) {
              this.columnGfx.moveTo(segA.x1, segA.y1).lineTo(segB.x1, segB.y1)
                .stroke({ width: 1.4, color: 0x67e8f9, alpha: 0.75 });
            }
          }
        }
        break;
      }

      case "mirror": {
        // Authentic GunBound Crystalline Laser Mirror Barrier
        const pulse = 0.88 + Math.sin(this.time * 3.5) * 0.12;

        // 1. Soft atmospheric amber warmth & prismatic glass base (smooth horizontal edge fade)
        this.columnGfx.rect(-w * 0.75, sY, w * 1.50, h).fill({ color: 0xfb923c, alpha: 0.08 * pulse });
        this.columnGfx.rect(-w * 0.52, sY, w * 1.04, h).fill({ color: 0xfacc15, alpha: 0.14 * pulse });
        this.columnGfx.rect(-w * 0.40, sY, w * 0.80, h).fill({ color: 0x38bdf8, alpha: 0.18 * pulse });
        this.columnGfx.rect(-w * 0.22, sY, w * 0.44, h).fill({ color: 0xbae6fd, alpha: 0.26 * pulse });

        // 2. Iconic Left & Right Boundary Rails (dual laser energy rails)
        const railPositions = [-w * 0.5, w * 0.5];
        for (const rX of railPositions) {
          // Outer vibrant amber/orange corona
          this.columnGfx.moveTo(rX, sY).lineTo(rX, eY)
            .stroke({ width: 3.8, color: 0xf97316, alpha: 0.45 * pulse });
          // Bright golden rail line
          this.columnGfx.moveTo(rX, sY).lineTo(rX, eY)
            .stroke({ width: 2.0, color: 0xfdba74, alpha: 0.85 * pulse });
          // Sharp incandescent white filament
          this.columnGfx.moveTo(rX, sY).lineTo(rX, eY)
            .stroke({ width: 1.0, color: 0xffffff, alpha: 0.95 });
        }

        // 3. Central Reflective Prismatic Laser Core
        this.columnGfx.moveTo(0, sY).lineTo(0, eY)
          .stroke({ width: 4.5, color: 0x7dd3fc, alpha: 0.35 * pulse });
        this.columnGfx.moveTo(0, sY).lineTo(0, eY)
          .stroke({ width: 2.0, color: 0xffffff, alpha: 0.92 * pulse });

        // 4. Gliding Refractive Diagonal Light Sheens (soft glass reflection sweep)
        const sheenSpacing = 160;
        const sheenScroll = (this.time * 130) % sheenSpacing;
        for (let base = sY - sheenSpacing; base <= eY + sheenSpacing; base += sheenSpacing) {
          const sy = base + sheenScroll;
          if (sy < sY || sy > eY) continue;
          const sheenAlpha = (0.45 + Math.sin(this.time * 4.0 + sy * 0.02) * 0.20) * pulse;

          // Soft outer cyan sheen
          this.columnGfx.moveTo(-w * 0.46, sy)
            .lineTo(w * 0.46, sy - 34)
            .stroke({ width: 3.5, color: 0x67e8f9, alpha: sheenAlpha * 0.45 });
          // Bright refractive crystal glint
          this.columnGfx.moveTo(-w * 0.46, sy)
            .lineTo(w * 0.46, sy - 34)
            .stroke({ width: 1.8, color: 0xffffff, alpha: sheenAlpha });
        }

        // 5. Upward subtle secondary counter-sheen
        const counterSpacing = 240;
        const counterScroll = (-this.time * 85) % counterSpacing;
        for (let base = sY - counterSpacing; base <= eY + counterSpacing; base += counterSpacing) {
          const sy = base + counterScroll;
          if (sy < sY || sy > eY) continue;
          this.columnGfx.moveTo(-w * 0.46, sy)
            .lineTo(w * 0.46, sy + 30)
            .stroke({ width: 2.0, color: 0xfed7aa, alpha: 0.35 * pulse });
        }

        // 6. Subtle laser node pulse points along the rails
        const nodeSpacing = 140;
        const nodeScroll = (this.time * 50) % nodeSpacing;
        for (let base = sY - nodeSpacing; base <= eY + nodeSpacing; base += nodeSpacing) {
          const ny = base + nodeScroll;
          if (ny < sY || ny > eY) continue;
          this.columnGfx.moveTo(-w * 0.5, ny).lineTo(w * 0.5, ny)
            .stroke({ width: 1.2, color: 0x38bdf8, alpha: 0.38 * pulse });
          this.columnGfx.circle(-w * 0.5, ny, 1.8).fill({ color: 0xffffff, alpha: 0.90 });
          this.columnGfx.circle(w * 0.5, ny, 1.8).fill({ color: 0xffffff, alpha: 0.90 });
        }
        break;
      }

      case "black": {
        const pulse = 0.85 + Math.sin(this.time * 2.5) * 0.15;
        // 1. Soft cosmic gravitational event horizon falloff
        this.columnGfx.rect(-w * 0.55, sY, w * 1.10, h).fill({ color: 0x2e1065, alpha: 0.15 * pulse });
        this.columnGfx.rect(-w * 0.42, sY, w * 0.84, h).fill({ color: 0x581c87, alpha: 0.28 * pulse });
        // 2. High-density dark matter core (0.97 alpha prevents background terrain textures from cutting through)
        this.columnGfx.rect(-w * 0.32, sY, w * 0.64, h).fill({ color: 0x090314, alpha: 0.97 });
        this.columnGfx.rect(-w * 0.18, sY, w * 0.36, h).fill({ color: 0x020108, alpha: 1.0 });
        // 3. Singularity event horizon filament
        this.columnGfx.moveTo(0, sY).lineTo(0, eY).stroke({ width: 2.5, color: 0xc084fc, alpha: 0.85 * pulse });
        this.columnGfx.moveTo(0, sY).lineTo(0, eY).stroke({ width: 1.0, color: 0xffffff, alpha: 0.95 * pulse });
        break;
      }

      case "random": {
        // Holographic conduit cylinder with prismatic energy rails
        const pulse = 0.85 + Math.sin(this.time * 3.0) * 0.15;
        // 1. Outer prismatic chromatic aura
        this.columnGfx.rect(-w * 0.60, sY, w * 1.20, h).fill({ color: 0x38bdf8, alpha: 0.08 * pulse });
        this.columnGfx.rect(-w * 0.45, sY, w * 0.90, h).fill({ color: 0xa855f7, alpha: 0.14 * pulse });
        this.columnGfx.rect(-w * 0.30, sY, w * 0.60, h).fill({ color: 0xfacc15, alpha: 0.18 * pulse });

        // 2. Boundary energy rails
        const rails = [-w * 0.48, w * 0.48];
        for (const rx of rails) {
          this.columnGfx.moveTo(rx, sY).lineTo(rx, eY).stroke({ width: 2.2, color: 0x38bdf8, alpha: 0.75 * pulse });
          this.columnGfx.moveTo(rx, sY).lineTo(rx, eY).stroke({ width: 1.0, color: 0xffffff, alpha: 0.90 });
        }

        // 3. Gliding horizontal laser node rings
        const nodeSpacing = 160;
        const nodeScroll = (this.time * 28) % nodeSpacing;
        for (let base = sY - nodeSpacing; base <= eY + nodeSpacing; base += nodeSpacing) {
          const ny = base + nodeScroll;
          if (ny < sY || ny > eY) continue;
          this.columnGfx.moveTo(-w * 0.48, ny).lineTo(w * 0.48, ny)
            .stroke({ width: 1.2, color: 0x38bdf8, alpha: 0.35 * pulse });
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
          if (p.life >= p.maxLife) {
            this.particles[i] = this.createParticle(false);
            continue;
          }
          const fade = Math.sin((p.life / p.maxLife) * Math.PI);
          p.alpha = fade * p.maxAlpha;
        }

        if (p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed;
        }

        // Keep gracefully confined within the mirror column width
        if (Math.abs(p.x) > this.columnWidth * 0.46) {
          p.vx *= -0.7;
          p.x = Math.sign(p.x) * this.columnWidth * 0.46;
        }

        if (p.shape === 1) {
          // Render elegant crystalline 4-point diamond prism glint
          const s = p.size;
          const rot = p.rotation || 0;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);

          // Diamond points (top, right, bottom, left)
          const tX = p.x + (0 * cos - -s * 1.5 * sin);
          const tY = p.y + (0 * sin + -s * 1.5 * cos);
          const rX = p.x + (s * 0.8 * cos - 0 * sin);
          const rY = p.y + (s * 0.8 * sin + 0 * cos);
          const bX = p.x + (0 * cos - s * 1.5 * sin);
          const bY = p.y + (0 * sin + s * 1.5 * cos);
          const lX = p.x + (-s * 0.8 * cos - 0 * sin);
          const lY = p.y + (-s * 0.8 * sin + 0 * cos);

          this.fxGfx.poly([tX, tY, rX, rY, bX, bY, lX, lY]).fill({ color: p.color, alpha: p.alpha });
          // Pure white incandescent central glint
          this.fxGfx.circle(p.x, p.y, s * 0.45).fill({ color: 0xffffff, alpha: p.alpha * 0.95 });
        } else {
          // Soft ambient crystal mote
          this.fxGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha * 0.70 });
          this.fxGfx.circle(p.x, p.y, p.size * 0.45).fill({ color: 0xffffff, alpha: p.alpha * 0.90 });
        }
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
      } else if (this.weatherType === "sun") {
        if (p.life !== undefined && p.maxLife !== undefined) {
          p.life++;
          if (p.life >= p.maxLife) {
            this.particles[i] = this.createParticle(false);
            continue;
          }
          const fade = Math.sin((p.life / p.maxLife) * Math.PI);
          p.alpha = fade * p.maxAlpha;
        }
        // Radiant solar energy mote: glowing halo + incandescent center
        this.fxGfx.circle(p.x, p.y, p.size * 1.5).fill({ color: p.color, alpha: p.alpha * 0.40 });
        this.fxGfx.circle(p.x, p.y, p.size * 0.8).fill({ color: 0xffffff, alpha: p.alpha * 0.90 });
        // Subtle vertical energy streak
        this.fxGfx.moveTo(p.x, p.y - p.size * 1.8).lineTo(p.x, p.y + p.size * 1.8)
          .stroke({ width: 1.2, color: 0xffffff, alpha: p.alpha * 0.75 });
      } else if (this.weatherType === "lightning") {
        if (p.life !== undefined && p.maxLife !== undefined) {
          p.life++;
          if (p.life >= p.maxLife) {
            this.particles[i] = this.createParticle(false);
            continue;
          }
        }
        // Sharp high-voltage discharge spark with needle tail & cross sparks
        this.fxGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
        const jx = (Math.random() - 0.5) * 8.0;
        const jy = (Math.random() - 0.5) * 8.0;
        this.fxGfx.moveTo(p.x, p.y).lineTo(p.x + jx, p.y + jy)
          .stroke({ width: 1.6, color: 0xffffff, alpha: p.alpha * 0.95 });
        if (Math.random() > 0.65) {
          this.fxGfx.moveTo(p.x - 3, p.y).lineTo(p.x + 3, p.y)
            .stroke({ width: 1.0, color: 0x67e8f9, alpha: p.alpha * 0.80 });
        }
      } else if (this.weatherType === "random") {
        if (p.life !== undefined && p.maxLife !== undefined) {
          p.life++;
          if (p.life >= p.maxLife) {
            this.particles[i] = this.createParticle(false);
            continue;
          }
          const fade = Math.sin((p.life / p.maxLife) * Math.PI);
          p.alpha = fade * p.maxAlpha;
        }
        this.fxGfx.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha });
        this.fxGfx.circle(p.x, p.y, p.size * 0.5).fill({ color: 0xffffff, alpha: p.alpha * 0.95 });
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
    if (this.sunTiling1) {
      this.sunTiling1.destroy();
      this.sunTiling1 = undefined;
    }
    if (this.sunTiling2) {
      this.sunTiling2.destroy();
      this.sunTiling2 = undefined;
    }
    if (this.mirrorTiling) {
      this.mirrorTiling.destroy();
      this.mirrorTiling = undefined;
    }
    if (this.randomTiling) {
      this.randomTiling.destroy();
      this.randomTiling = undefined;
    }
    for (const item of this.randomSprites) {
      item.sprite.destroy();
    }
    this.randomSprites = [];
    if (this.randomIconContainer) {
      this.randomIconContainer.destroy({ children: true });
      this.randomIconContainer = undefined;
    }
    for (const spr of this.sunTipSprites) {
      spr.destroy();
    }
    this.sunTipSprites = [];
    for (const tex of this.sunTipTextures) {
      tex.destroy(true);
    }
    this.sunTipTextures = [];
    this.columnGfx.destroy();
    this.fxGfx.destroy();
    this.destroy({ children: true });
  }
}
