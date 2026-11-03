import { AnimatedSprite, Container, Graphics } from "pixi.js";
import { ProjectileSpriteManager } from "../animation/ProjectileSpriteManager.js";
import { Point2D } from "../physics/BallisticsEngine.js";
import { AudioManager } from "../audio/AudioManager.js";
import { DynamicExplosionEngine } from "../effects/DynamicExplosionEngine.js";

export class ProjectileEntity extends Container {
  private bulletContainer: Container;
  private bulletSprite?: AnimatedSprite;
  private fallbackBullet: Graphics;

  private isProcedural: boolean = false;
  private proceduralGraphics: Graphics;

  private explodeSprite?: AnimatedSprite;
  private fallbackExplosion: Graphics;
  private auraGraphics: Graphics;

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
  public isExploding: boolean = false;
  private explosionTimer: number = 0;

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
        if (this.onCompleteCallback) this.onCompleteCallback();
      }
      return;
    }

    if (this.points.length < 2) {
      this.triggerImpact();
      return;
    }

    // If not paused in mid-air, advance progression along trajectory
    if (this.transformPauseMs <= 0) {
      this.progress += this.speedFactor * Math.max(0.5, Math.min(2.5, dt));
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
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
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
            if (this.onCompleteCallback) this.onCompleteCallback();
          },
          this.shotType
        );
      } else {
        setTimeout(() => {
          if (this.onCompleteCallback) this.onCompleteCallback();
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
            if (this.onCompleteCallback) this.onCompleteCallback();
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
          if (this.onCompleteCallback) this.onCompleteCallback();
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
