import { AnimatedSprite, Container, Graphics } from "pixi.js";
import { ProjectileSpriteManager } from "../animation/ProjectileSpriteManager.js";
import { Point2D } from "../physics/BallisticsEngine.js";
import { AudioManager } from "../audio/AudioManager.js";
import { DynamicExplosionEngine } from "../effects/DynamicExplosionEngine.js";

interface BulletElectricSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export class ProjectileEntity extends Container {
  private bulletContainer: Container;
  private bulletSprite?: AnimatedSprite;
  private fallbackBullet: Graphics;

  private isProcedural: boolean = false;
  private proceduralGraphics: Graphics;

  private explodeSprite?: AnimatedSprite;
  private fallbackExplosion: Graphics;
  private auraGraphics: Graphics;
  private weatherTrailGraphics: Graphics;
  private weatherAuraTime: number = 0;
  private electricSparks: BulletElectricSpark[] = [];

  private points: Point2D[];
  private mobileType: number;
  private shotType: number;
  private subType?: string;
  public hitType: "ground" | "player" | "oob";
  private bungeRadius: number;
  private damage: number;
  private progress: number = 0;
  private speedFactor: number = 2.08; // 1:1 real-time velocity matching 8ms simulation steps at 60fps

  private onImpactCallback?: () => void;
  private onCompleteCallback?: () => void;
  private hasCompleted: boolean = false;
  public isExploding: boolean = false;
  private explosionTimer: number = 0;

  private invokeComplete() {
    if (this.hasCompleted) return;
    this.hasCompleted = true;
    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = undefined;
      cb();
    }
  }

  public currentX: number = 0;
  public currentY: number = 0;

  constructor(
    points: Point2D[],
    mobileType: number = 0,
    shotType: number = 0,
    onImpact?: () => void,
    onComplete?: () => void,
    subType?: string,
    hitType: "ground" | "player" | "oob" = "ground",
    bungeRadius: number = 42,
    damage: number = 200
  ) {
    super();
    this.points = points;
    this.mobileType = mobileType;
    this.shotType = shotType;
    this.subType = subType;
    this.hitType = hitType;
    this.bungeRadius = bungeRadius;
    this.damage = damage;
    this.onImpactCallback = onImpact;
    this.onCompleteCallback = onComplete;
    this.speedFactor = 2.08;

    this.bulletContainer = new Container();
    this.fallbackBullet = new Graphics();
    this.proceduralGraphics = new Graphics();
    this.fallbackExplosion = new Graphics();
    this.auraGraphics = new Graphics();
    this.weatherTrailGraphics = new Graphics();

    // Canonical Mage is 13, Canonical Turtle is 14
    if ((mobileType === 13 && shotType < 2) || (mobileType === 14 && shotType < 2)) {
      this.isProcedural = true;
      this.fallbackBullet.visible = false;
      this.bulletContainer.visible = false;
    } else {
      this.fallbackBullet.circle(0, 0, 4).fill(0xf59e0b);
    }

    this.bulletContainer.addChild(this.fallbackBullet);
    this.bulletContainer.addChild(this.auraGraphics);
    this.addChild(this.weatherTrailGraphics);
    this.addChild(this.proceduralGraphics);
    this.addChild(this.bulletContainer);
    this.addChild(this.fallbackExplosion);

    if (points.length > 0) {
      this.currentX = points[0].x;
      this.currentY = points[0].y;
      this.bulletContainer.position.set(this.currentX, this.currentY);
    }

    if (!this.isProcedural) {
      this.loadBulletSprite();
    }
    this.loadExplosionSprite();

    // Armor SS special shell transformation
    if (mobileType === 0 && shotType === 2) {
      this.isArmorSS = true;
      this.loadArmorSSOpenTextures();
    }
  }

  private isArmorSS: boolean = false;
  private isArmorSSOpen: boolean = false;
  private transformPauseMs: number = 0;
  private armorSSOpenTextures?: import("pixi.js").Texture[];
  private armorSSOpenAnchor?: { x: number; y: number };

  private async loadArmorSSOpenTextures() {
    try {
      const openData = await ProjectileSpriteManager.loadBulletByKey("armorss2");
      if (openData && openData.textures.length > 0) {
        this.armorSSOpenTextures = openData.textures;
        this.armorSSOpenAnchor = openData.anchor;
      }
    } catch (e) {
      console.warn("[ProjectileEntity] Error loading armorSSopen textures:", e);
    }
  }

  private async loadBulletSprite() {
    try {
      const bulletData = await ProjectileSpriteManager.loadBulletTextures(this.mobileType, this.shotType);
      if (bulletData && bulletData.textures.length > 0) {
        this.fallbackBullet.visible = false;
        this.bulletSprite = new AnimatedSprite(bulletData.textures);
        this.bulletSprite.anchor.set(bulletData.anchor.x, bulletData.anchor.y);
        this.bulletSprite.onFrameChange = (frameIdx) => {
          const tex = this.bulletSprite?.textures[frameIdx];
          if (tex && "defaultAnchor" in tex && tex.defaultAnchor) {
            this.bulletSprite?.anchor.set(tex.defaultAnchor.x, tex.defaultAnchor.y);
          }
        };
        this.bulletSprite.animationSpeed = 0.35;
        this.bulletSprite.play();
        this.bulletContainer.addChild(this.bulletSprite);
      }
    } catch (err) {
      console.warn(`[ProjectileEntity] Could not load bullet textures for mobile ${this.mobileType}:`, err);
    }
  }

  private async loadExplosionSprite() {
    try {
      const explodeData = await ProjectileSpriteManager.loadExplosionTextures(this.mobileType, this.shotType);
      if (explodeData && explodeData.textures.length > 0) {
        this.explodeSprite = new AnimatedSprite(explodeData.textures);
        this.explodeSprite.anchor.set(explodeData.anchor.x, explodeData.anchor.y);
        this.explodeSprite.animationSpeed = 0.28; // Subtly slower for majestic blast visibility
        this.explodeSprite.loop = false;
        this.explodeSprite.visible = false;
        this.explodeSprite.onFrameChange = (frameIdx) => {
          const tex = this.explodeSprite?.textures[frameIdx];
          if (tex && "defaultAnchor" in tex && tex.defaultAnchor) {
            this.explodeSprite?.anchor.set(tex.defaultAnchor.x, tex.defaultAnchor.y);
          }
        };
        this.addChild(this.explodeSprite);
      }
    } catch (err) {
      console.warn(`[ProjectileEntity] Could not load explosion textures:`, err);
    }
  }

  public getPointAtProgress(prog: number): Point2D {
    if (this.points.length === 0) return { x: 0, y: 0 };
    if (prog <= 0) return this.points[0];
    if (prog >= this.points.length - 1) return this.points[this.points.length - 1];

    const idx = Math.floor(prog);
    const frac = prog - idx;
    const p1 = this.points[idx];
    const p2 = this.points[idx + 1] || p1;

    return {
      x: p1.x + (p2.x - p1.x) * frac,
      y: p1.y + (p2.y - p1.y) * frac,
    };
  }

  public update(dt: number) {
    if (this.isExploding) {
      this.explosionTimer += dt * 16.66;
      if (this.explosionTimer > 600) {
        this.invokeComplete();
      }
      return;
    }

    if (this.points.length < 2) {
      this.triggerImpact();
      return;
    }

    // Check if currently swirling inside the tornado vortex for cinematic slow-motion
    const ptIdx = Math.floor(this.progress);
    const currentPoint = this.points[ptIdx] as (Point2D & { isInsideTornado?: boolean; isSpecialPhase?: boolean });
    const isSlowMoTornado = !!currentPoint?.isInsideTornado;

    // Slow-motion inside tornado vortex (~48% of natural speed) so bullet dramatically swirls through the vortex,
    // and instant 100% full natural velocity once it passes through and exits!
    const effectiveSpeed = isSlowMoTornado
      ? this.speedFactor * 0.48
      : this.speedFactor;

    // If not paused in mid-air, advance progression along trajectory
    if (this.transformPauseMs <= 0) {
      this.progress += effectiveSpeed * Math.max(0.5, Math.min(2.5, dt));
    }

    if (this.progress >= this.points.length - 1) {
      const last = this.points[this.points.length - 1];
      this.currentX = last.x;
      this.currentY = last.y;
      this.bulletContainer.position.set(this.currentX, this.currentY);
      this.triggerImpact();
      return;
    }

    const currentPt = this.getPointAtProgress(this.progress);
    this.currentX = currentPt.x;
    this.currentY = currentPt.y;
    this.bulletContainer.position.set(this.currentX, this.currentY);

    const nextProg = Math.min(this.points.length - 1, this.progress + 1.2);
    const nextPt = this.getPointAtProgress(nextProg);
    const dx = nextPt.x - currentPt.x;
    const dy = nextPt.y - currentPt.y;

    // Smooth angle interpolation without frame pop or vibration
    if (Math.hypot(dx, dy) > 0.001) {
      const targetRot = Math.atan2(dy, dx);
      let diff = targetRot - this.bulletContainer.rotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.bulletContainer.rotation += diff * Math.min(1.0, 0.55 * Math.max(0.5, dt));
    }

    // Armor SS dramatic mid-air transformation check (isSpecialPhase at tMs >= 1540)
    if (this.isArmorSS && !this.isArmorSSOpen) {
      const ptIdx = Math.floor(this.progress);
      const currentPoint = this.points[ptIdx] as (Point2D & { isSpecialPhase?: boolean });
      if (currentPoint && currentPoint.isSpecialPhase && this.armorSSOpenTextures && this.bulletSprite) {
        this.isArmorSSOpen = true;
        this.transformPauseMs = 520; // 520ms dramatic mid-air suspension!
        this.bulletSprite.textures = this.armorSSOpenTextures;
        this.bulletSprite.onFrameChange = (frameIdx) => {
          const tex = this.bulletSprite?.textures[frameIdx];
          if (tex && "defaultAnchor" in tex && tex.defaultAnchor) {
            this.bulletSprite?.anchor.set(tex.defaultAnchor.x, tex.defaultAnchor.y);
          }
        };
        if (this.armorSSOpenAnchor) {
          this.bulletSprite.anchor.set(this.armorSSOpenAnchor.x, this.armorSSOpenAnchor.y);
        }
        // Slower deliberate speed (0.20) so the wing expansion & spinning propellers are clearly visible!
        this.bulletSprite.animationSpeed = 0.20;
        this.bulletSprite.loop = true;
        this.bulletSprite.gotoAndPlay(0);
        AudioManager.play("bpush1", 0.95);
      }
    }

    // Mid-air dramatic pause handling: render sonic shockwave aura and hover seamlessly
    if (this.transformPauseMs > 0) {
      this.transformPauseMs -= dt * 16.66;
      const pauseProgress = 1 - Math.max(0, this.transformPauseMs / 520); // 0 -> 1

      // Expanding energy aura ring
      this.auraGraphics.clear();
      const auraR = 10 + pauseProgress * 44;
      const alpha = Math.max(0, (1 - pauseProgress) * 0.95);
      this.auraGraphics.circle(0, 0, auraR).stroke({ width: 2.5, color: 0x38bdf8, alpha });
      this.auraGraphics.circle(0, 0, auraR * 0.65).stroke({ width: 1.5, color: 0xfef08a, alpha: alpha * 0.85 });

      if (this.transformPauseMs <= 0) {
        this.auraGraphics.clear();
        if (this.bulletSprite) {
          this.bulletSprite.loop = true;
          this.bulletSprite.play();
        }
      }
      return;
    }

    // Procedural laser ribbon trails for Mage (13) and Turtle (14)
    if (this.isProcedural) {
      this.renderProceduralShot();
    }

    // Dynamic weather energy aura and trails
    this.renderWeatherBulletEffects(dt);
  }

  private renderWeatherBulletEffects(dt: number) {
    if (this.isExploding) {
      this.weatherTrailGraphics.clear();
      this.auraGraphics.clear();
      return;
    }

    const ptIdx = Math.floor(this.progress);
    const currentPt = this.points[ptIdx] as (Point2D & { weatherEffect?: "sun" | "lightning" | "mirror" | "tornado" | "black" });
    const effect = currentPt?.weatherEffect;

    this.weatherTrailGraphics.clear();

    if (!effect) {
      if (this.transformPauseMs <= 0) {
        this.auraGraphics.clear();
      }
      return;
    }

    this.weatherAuraTime += dt * 0.15;
    const time = this.weatherAuraTime;

    // 1. Draw glowing local halo / corona around the bullet (inside bulletContainer)
    this.auraGraphics.clear();

    switch (effect) {
      case "sun": {
        const pulse = 0.85 + Math.sin(time * 8) * 0.15;
        // Outer radiant god-ray flare
        this.auraGraphics.circle(0, 0, 16 * pulse).fill({ color: 0xfef08a, alpha: 0.28 });
        // Golden solar halo
        this.auraGraphics.circle(0, 0, 11 * pulse).fill({ color: 0xfacc15, alpha: 0.55 });
        // Incandescent core ring
        this.auraGraphics.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.85 });
        break;
      }

      case "lightning": {
        // High-voltage electric plasma aura with erratic crackle
        this.auraGraphics.circle(0, 0, 11).fill({ color: 0x2563eb, alpha: 0.40 });
        this.auraGraphics.circle(0, 0, 8).stroke({ width: 1.8, color: 0x67e8f9, alpha: 0.90 });
        for (let a = 0; a < 4; a++) {
          const ang = time * 18 + a * (Math.PI / 2);
          const r1 = 4;
          const r2 = 11 + Math.random() * 6;
          const midAng = ang + (Math.random() - 0.5) * 0.8;
          this.auraGraphics.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1)
            .lineTo(Math.cos(midAng) * (r1 + r2) * 0.5, Math.sin(midAng) * (r1 + r2) * 0.5)
            .lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2)
            .stroke({ width: 1.5, color: a % 2 === 0 ? 0xffffff : 0x38bdf8, alpha: 0.95 });
          // Tiny discharge spark node at tip
          this.auraGraphics.circle(Math.cos(ang) * r2, Math.sin(ang) * r2, 1.5).fill({ color: 0xffffff, alpha: 0.95 });
        }
        break;
      }

      case "mirror": {
        const pulse = 0.8 + Math.sin(time * 10) * 0.2;
        // Crystalline amber/gold reflective shield
        this.auraGraphics.poly([
          0, -14 * pulse,
          10 * pulse, 0,
          0, 14 * pulse,
          -10 * pulse, 0,
        ]).stroke({ width: 2.2, color: 0xfb923c, alpha: 0.90 });
        this.auraGraphics.circle(0, 0, 8).fill({ color: 0xfdba74, alpha: 0.35 });
        break;
      }

      case "tornado": {
        // Authentic GunBound swirling cyclonic wind vortex ring
        const tPulse = 0.9 + Math.sin(time * 8) * 0.1;
        this.auraGraphics.circle(0, 0, 14 * tPulse).stroke({ width: 2.0, color: 0x38bdf8, alpha: 0.70 });
        this.auraGraphics.circle(0, 0, 9 * tPulse).stroke({ width: 1.6, color: 0x6ee7b7, alpha: 0.85 });
        // 3 interlocking rotating wind vortex curls spinning around missile
        for (let c = 0; c < 3; c++) {
          const startA = time * 16 + c * ((Math.PI * 2) / 3);
          this.auraGraphics.arc(0, 0, 11 + c * 2.5, startA, startA + Math.PI * 0.65)
            .stroke({ width: 2.2, color: c === 0 ? 0xffffff : c === 1 ? 0x38bdf8 : 0x34d399, alpha: 0.90 });
        }
        break;
      }

      case "black": {
        const pulse = 0.85 + Math.sin(time * 6) * 0.15;
        // Deep obsidian void aura
        this.auraGraphics.circle(0, 0, 13 * pulse).fill({ color: 0x581c87, alpha: 0.40 });
        this.auraGraphics.circle(0, 0, 7).stroke({ width: 2.0, color: 0xc084fc, alpha: 0.85 });
        break;
      }
    }

    // 2. High-energy electric sparks emitted into world coordinates along bullet trajectory
    if (effect === "lightning") {
      for (let s = 0; s < 3; s++) {
        const spAngle = Math.random() * Math.PI * 2;
        const spSpeed = 30 + Math.random() * 65;
        this.electricSparks.push({
          x: this.currentX + (Math.random() - 0.5) * 6,
          y: this.currentY + (Math.random() - 0.5) * 6,
          vx: Math.cos(spAngle) * spSpeed,
          vy: Math.sin(spAngle) * spSpeed,
          life: 0,
          maxLife: 8 + Math.random() * 10,
          color: Math.random() > 0.4 ? 0xffffff : 0x67e8f9,
          size: 1.2 + Math.random() * 1.8,
        });
      }
    }

    // Update and render electric sparks in weatherTrailGraphics
    for (let i = this.electricSparks.length - 1; i >= 0; i--) {
      const sp = this.electricSparks[i];
      sp.life += dt * 1.3;
      if (sp.life >= sp.maxLife) {
        this.electricSparks.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * dt * 0.04;
      sp.y += sp.vy * dt * 0.04;
      const spAlpha = (1 - (sp.life / sp.maxLife)) * 0.95;

      this.weatherTrailGraphics.circle(sp.x, sp.y, sp.size).fill({ color: sp.color, alpha: spAlpha });
      const jx = (Math.random() - 0.5) * 5.0;
      const jy = (Math.random() - 0.5) * 5.0;
      this.weatherTrailGraphics.moveTo(sp.x, sp.y)
        .lineTo(sp.x + jx, sp.y + jy)
        .stroke({ width: 1.2, color: 0x38bdf8, alpha: spAlpha * 0.85 });
    }

    // 3. Draw energy ribbon trail in world coordinates behind the bullet
    const trailSpan = 16;
    const span = Math.min(this.progress, trailSpan);
    if (span <= 0.5) return;

    const sampleSteps = Math.floor(span * 2);
    const pts: Point2D[] = [];
    for (let s = 0; s <= sampleSteps; s++) {
      const p = Math.max(0, this.progress - span * (s / sampleSteps));
      pts.push(this.getPointAtProgress(p));
    }
    if (pts.length < 2) return;

    for (let i = 0; i < pts.length - 1; i++) {
      const frac = 1 - (i / (pts.length - 1)); // 1 at bullet, 0 at tail tip
      const alpha = frac * 0.75;
      const width = Math.max(1.0, frac * 5.0);

      if (effect === "lightning") {
        const jx = (Math.random() - 0.5) * 2.5;
        const jy = (Math.random() - 0.5) * 2.5;
        this.weatherTrailGraphics.moveTo(pts[i].x + jx, pts[i].y + jy)
          .lineTo(pts[i + 1].x + jx, pts[i + 1].y + jy)
          .stroke({ width: Math.max(1.5, width * 0.7), color: 0x38bdf8, alpha: alpha * 0.9 });
        this.weatherTrailGraphics.moveTo(pts[i].x, pts[i].y)
          .lineTo(pts[i + 1].x, pts[i + 1].y)
          .stroke({ width: 1.2, color: 0xffffff, alpha });
      } else {
        let trailColor = 0xffffff;
        if (effect === "sun") trailColor = 0xf59e0b;
        else if (effect === "mirror") trailColor = 0xfb923c;
        else if (effect === "tornado") trailColor = 0x6ee7b7;
        else if (effect === "black") trailColor = 0xa855f7;

        this.weatherTrailGraphics.moveTo(pts[i].x, pts[i].y)
          .lineTo(pts[i + 1].x, pts[i + 1].y)
          .stroke({ width, color: trailColor, alpha });
      }
    }
  }

  private renderProceduralShot() {
    this.proceduralGraphics.clear();

    const trailSpan = this.shotType === 1 ? 26 : 18;
    const span = Math.min(this.progress, trailSpan);
    if (span <= 0.2) return;

    const sampleSteps = Math.max(12, Math.floor(span * 3));
    const pts: Point2D[] = [];
    const normals: Point2D[] = [];
    const progs: number[] = [];

    for (let s = 0; s <= sampleSteps; s++) {
      const p = Math.max(0, this.progress - span * (s / sampleSteps));
      progs.push(p);
      const pt = this.getPointAtProgress(p);
      pts.push(pt);

      const pNext = this.getPointAtProgress(Math.min(this.points.length - 1, p + 0.1));
      const pPrev = this.getPointAtProgress(Math.max(0, p - 0.1));
      const tdx = pNext.x - pPrev.x;
      const tdy = pNext.y - pPrev.y;
      const dist = Math.hypot(tdx, tdy) || 1;
      normals.push({ x: -tdy / dist, y: tdx / dist });
    }

    if (pts.length < 2) return;

    // 1. MAGE LASERS (Canonical ID 13)
    if (this.mobileType === 13) {
      if (this.shotType === 0) {
        // Shot 1: Concentrated cyan plasma beam with white energy core
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 7, color: 0x06b6d4, alpha: 0.45 });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 2.5, color: 0xffffff, alpha: 0.95 });
      } else {
        // Shot 2: Intertwined dual-helix sine curves
        const freq = 0.55;
        const maxAmp = 9.0;

        const isA = !this.subType || this.subType === "mage_helix_a";
        const isB = !this.subType || this.subType === "mage_helix_b";

        if (isA) {
          // Helix Ribbon A (cyan)
          this.proceduralGraphics.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const osc = Math.sin(progs[i] * freq) * maxAmp * (1 - i / pts.length);
            const x = pts[i].x + normals[i].x * osc;
            const y = pts[i].y + normals[i].y * osc;
            if (i === 0) this.proceduralGraphics.moveTo(x, y);
            else this.proceduralGraphics.lineTo(x, y);
          }
          this.proceduralGraphics.stroke({ width: 3.5, color: 0x38bdf8, alpha: 0.95 });
        }

        if (isB) {
          // Helix Ribbon B (Counter-phase, magenta/purple)
          this.proceduralGraphics.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const osc = -Math.sin(progs[i] * freq) * maxAmp * (1 - i / pts.length);
            const x = pts[i].x + normals[i].x * osc;
            const y = pts[i].y + normals[i].y * osc;
            if (i === 0) this.proceduralGraphics.moveTo(x, y);
            else this.proceduralGraphics.lineTo(x, y);
          }
          this.proceduralGraphics.stroke({ width: 3.5, color: 0xa855f7, alpha: 0.95 });
        }

        // Central glowing core
        this.proceduralGraphics.circle(pts[0].x, pts[0].y, 3.5).fill({ color: 0xffffff, alpha: 0.95 });
      }
    }

    // 2. TURTLE WATER STREAM & TIMEBOMB (Canonical ID 14)
    if (this.mobileType === 14) {
      if (this.shotType === 0) {
        // Shot 1: Water jet trail
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 5, color: 0x60a5fa, alpha: 0.6 });
        this.proceduralGraphics.circle(pts[0].x, pts[0].y, 4).fill(0x38bdf8);
      } else {
        // Shot 2: TimeBomb 4-phase split
        const totalPoints = this.points.length;
        const phaseRatio = this.progress / totalPoints;
        const forkSpread = Math.sin(phaseRatio * Math.PI) * 14.0;

        const isLeft = !this.subType || this.subType === "turtle_timebomb_a";
        const isRight = !this.subType || this.subType === "turtle_timebomb_b";

        if (isLeft) {
          // Stream Left
          this.proceduralGraphics.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const x = pts[i].x + normals[i].x * forkSpread * (1 - i / pts.length);
            const y = pts[i].y + normals[i].y * forkSpread * (1 - i / pts.length);
            if (i === 0) this.proceduralGraphics.moveTo(x, y);
            else this.proceduralGraphics.lineTo(x, y);
          }
          this.proceduralGraphics.stroke({ width: 3.5, color: 0x0284c7, alpha: 0.85 });
        }

        if (isRight) {
          // Stream Right
          this.proceduralGraphics.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const x = pts[i].x - normals[i].x * forkSpread * (1 - i / pts.length);
            const y = pts[i].y - normals[i].y * forkSpread * (1 - i / pts.length);
            if (i === 0) this.proceduralGraphics.moveTo(x, y);
            else this.proceduralGraphics.lineTo(x, y);
          }
          this.proceduralGraphics.stroke({ width: 3.5, color: 0x38bdf8, alpha: 0.85 });
        }
      }
    }
  }

  private triggerImpact() {
    if (this.isExploding) return;
    this.isExploding = true;

    this.bulletContainer.visible = false;
    this.proceduralGraphics.clear();

    // Out of bounds / void shots vanish quietly without detonating an explosion in the sky
    if (this.hitType === "oob") {
      this.invokeComplete();
      return;
    }

    // 1. Real-time procedural dynamic explosion without spritesheets
    if (DynamicExplosionEngine.isDynamicEnabled) {
      const dynamicEngine = DynamicExplosionEngine.getInstance();
      if (dynamicEngine) {
        dynamicEngine.triggerExplosion(
          this.currentX,
          this.currentY,
          this.bungeRadius,
          this.damage,
          () => {
            this.invokeComplete();
          },
          this.shotType
        );
      } else {
        setTimeout(() => {
          this.invokeComplete();
        }, 400);
      }
    } else if (this.explodeSprite) {
      // 2. Classic retro spritesheet explosion with smooth alpha fade-out
      this.explodeSprite.position.set(this.currentX, this.currentY);
      this.explodeSprite.visible = true;
      this.explodeSprite.alpha = 1.0;
      this.explodeSprite.gotoAndPlay(0);
      this.explodeSprite.onComplete = () => {
        // Smooth fade-out alpha transition so blast disperses naturally into air
        let fadeAlpha = 1.0;
        const fadeInterval = setInterval(() => {
          fadeAlpha -= 0.14;
          if (this.explodeSprite) {
            this.explodeSprite.alpha = Math.max(0, fadeAlpha);
          }
          if (fadeAlpha <= 0) {
            clearInterval(fadeInterval);
            this.invokeComplete();
          }
        }, 25);
      };
    } else {
      // Fallback shockwave ring
      this.fallbackExplosion.position.set(this.currentX, this.currentY);
      this.fallbackExplosion.circle(0, 0, 36).fill({ color: 0xf59e0b, alpha: 0.75 });
      this.fallbackExplosion.circle(0, 0, 22).fill({ color: 0xffffff, alpha: 0.95 });

      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 20;
        this.fallbackExplosion.scale.set(1 + elapsed / 180);
        this.fallbackExplosion.alpha = Math.max(0, 1 - elapsed / 280);
        if (elapsed >= 280) {
          clearInterval(interval);
          this.invokeComplete();
        }
      }, 20);
    }

    if (this.onImpactCallback) {
      this.onImpactCallback();
    }
  }

  public forceFinish() {
    this.triggerImpact();
  }
}
