import { AnimatedSprite, Container, Graphics, Texture } from "pixi.js";
import { ProjectileSpriteManager } from "./ProjectileSpriteManager.js";

export interface Point2D {
  x: number;
  y: number;
}

export class Projectile extends Container {
  private bulletContainer: Container;
  private bulletSprite?: AnimatedSprite;
  private fallbackBullet: Graphics;

  private isProcedural: boolean = false;
  private proceduralGraphics: Graphics;

  private explodeSprite?: AnimatedSprite;
  private fallbackExplosion: Graphics;

  private points: Point2D[];
  private mobileType: number;
  private shotType: number;
  private progress: number = 0;
  private speedFactor: number = 0.72; // Calibrated speed for dramatic, authentic GunBound flight arc

  private onImpactCallback?: () => void;
  private onCompleteCallback?: () => void;
  private isExploding: boolean = false;
  private explosionTimer: number = 0;

  private currentX: number = 0;
  private currentY: number = 0;

  constructor(
    points: Point2D[],
    mobileType: number = 0,
    shotType: number = 0,
    onImpact?: () => void,
    onComplete?: () => void
  ) {
    super();
    this.points = points;
    this.mobileType = mobileType;
    this.shotType = shotType;
    this.onImpactCallback = onImpact;
    this.onCompleteCallback = onComplete;

    this.bulletContainer = new Container();
    this.fallbackBullet = new Graphics();
    this.proceduralGraphics = new Graphics();
    this.fallbackExplosion = new Graphics();

    // Check if this projectile should use authentic procedural rendering
    // Mage Shot 1 & 2 (mobileType 1, shot 0 & 1) and Turtle Shot 1 & 2 (mobileType 7, shot 0 & 1)
    if ((mobileType === 1 && shotType < 2) || (mobileType === 7 && shotType < 2)) {
      this.isProcedural = true;
      this.fallbackBullet.visible = false;
      this.bulletContainer.visible = false;
    } else {
      // Subtle fallback dot while authentic sprite loads
      this.fallbackBullet.circle(0, 0, 3.5).fill(0xf59e0b);
    }

    this.bulletContainer.addChild(this.fallbackBullet);
    this.addChild(this.proceduralGraphics);
    this.addChild(this.bulletContainer);
    this.addChild(this.fallbackExplosion);

    if (points.length > 0) {
      this.currentX = points[0].x;
      this.currentY = points[0].y;
      this.bulletContainer.x = this.currentX;
      this.bulletContainer.y = this.currentY;
    }

    // Try synchronous cache first for discrete sprites
    if (!this.isProcedural) {
      const cachedBullet = ProjectileSpriteManager.getCachedBullet(mobileType, shotType);
      if (cachedBullet && cachedBullet.textures.length > 0) {
        this.fallbackBullet.visible = false;
        this.bulletSprite = new AnimatedSprite(cachedBullet.textures);
        this.bulletSprite.anchor.set(cachedBullet.anchor.x, cachedBullet.anchor.y);
        this.bulletSprite.animationSpeed = 0.35;
        this.bulletSprite.play();
        this.bulletContainer.addChild(this.bulletSprite);
      }
    }

    const cachedExplosion = ProjectileSpriteManager.getCachedExplosion(mobileType, shotType);
    if (cachedExplosion && cachedExplosion.textures.length > 0) {
      this.setupExplodeSprite(cachedExplosion.textures, cachedExplosion.anchor);
    }

    // Load authentic sprites if not yet cached
    if ((!this.isProcedural && !this.bulletSprite) || !cachedExplosion) {
      this.loadSprites();
    }
  }

  public get currentPosition(): Point2D {
    return { x: this.currentX, y: this.currentY };
  }

  public get isExplodingState(): boolean {
    return this.isExploding;
  }

  private setupExplodeSprite(textures: Texture[], anchor: { x: number; y: number }) {
    if (this.explodeSprite) {
      this.removeChild(this.explodeSprite);
      this.explodeSprite.destroy();
    }
    this.explodeSprite = new AnimatedSprite(textures);
    this.explodeSprite.anchor.set(anchor.x, anchor.y);
    this.explodeSprite.animationSpeed = 0.5; // Authentic 30 FPS playback
    this.explodeSprite.loop = false;
    this.explodeSprite.visible = false;
    this.explodeSprite.onFrameChange = (frame) => {
      if (!this.explodeSprite) return;
      const tex = this.explodeSprite.textures[frame] as Texture;
      if (tex && tex.defaultAnchor) {
        this.explodeSprite.anchor.set(tex.defaultAnchor.x, tex.defaultAnchor.y);
      }
    };
    this.addChild(this.explodeSprite);
  }

  private async loadSprites() {
    try {
      if (!this.isProcedural && !this.bulletSprite) {
        const bulletData = await ProjectileSpriteManager.loadBullet(this.mobileType, this.shotType);
        if (bulletData.textures.length > 0) {
          this.fallbackBullet.visible = false;
          this.bulletSprite = new AnimatedSprite(bulletData.textures);
          this.bulletSprite.anchor.set(bulletData.anchor.x, bulletData.anchor.y);
          this.bulletSprite.animationSpeed = 0.35;
          this.bulletSprite.play();
          this.bulletContainer.addChild(this.bulletSprite);
        }
      }

      if (!this.explodeSprite) {
        const explodeData = await ProjectileSpriteManager.loadExplosion(this.mobileType, this.shotType);
        if (explodeData.textures.length > 0) {
          this.setupExplodeSprite(explodeData.textures, explodeData.anchor);
        }
      }
    } catch (e) {
      console.warn("[Projectile] Error loading authentic sprites:", e);
    }
  }

  private getPointAtProgress(prog: number): Point2D {
    if (this.points.length === 0) return { x: 0, y: 0 };
    if (prog <= 0) return this.points[0];
    if (prog >= this.points.length - 1) return this.points[this.points.length - 1];

    const idx0 = Math.floor(prog);
    const idx1 = Math.min(this.points.length - 1, idx0 + 1);
    const frac = prog - idx0;

    const p0 = this.points[idx0];
    const p1 = this.points[idx1];

    return {
      x: p0.x + (p1.x - p0.x) * frac,
      y: p0.y + (p1.y - p0.y) * frac,
    };
  }

  public update(dt: number = 1): boolean {
    if (this.isExploding) {
      this.explosionTimer += dt;
      // Mage SS: spin rapidly around its impact axis while detonating!
      if (this.mobileType === 1 && this.shotType === 2 && this.explodeSprite) {
        this.explodeSprite.rotation += 0.14 * dt;
      }
      if (this.explodeSprite && this.explodeSprite.textures.length > 0) {
        if (!this.explodeSprite.playing || this.explodeSprite.currentFrame >= this.explodeSprite.textures.length - 1) {
          this.finish();
          return true;
        }
      } else {
        const prog = Math.min(1.0, this.explosionTimer / 18);
        this.fallbackExplosion.clear();
        this.fallbackExplosion.circle(0, 0, prog * 35).fill({ color: 0xff4500, alpha: 1.0 - prog });
        this.fallbackExplosion.stroke({ width: 2, color: 0xffeb3b, alpha: 1.0 - prog });

        if (prog >= 1.0) {
          this.finish();
          return true;
        }
      }
      return false;
    }

    if (this.points.length <= 1) {
      this.triggerImpact();
      return false;
    }

    // Smooth advancement along trajectory
    this.progress += this.speedFactor * Math.max(0.5, Math.min(2.5, dt));

    if (this.progress >= this.points.length - 1) {
      const last = this.points[this.points.length - 1];
      this.currentX = last.x;
      this.currentY = last.y;
      this.bulletContainer.x = this.currentX;
      this.bulletContainer.y = this.currentY;
      this.triggerImpact();
      return false;
    }

    // Continuous linear interpolation between adjacent trajectory points
    const currentPt = this.getPointAtProgress(this.progress);
    this.currentX = currentPt.x;
    this.currentY = currentPt.y;

    this.bulletContainer.x = this.currentX;
    this.bulletContainer.y = this.currentY;

    // Angle of flight direction
    const nextProg = Math.min(this.points.length - 1, this.progress + 0.2);
    const nextPt = this.getPointAtProgress(nextProg);
    const dx = nextPt.x - currentPt.x;
    const dy = nextPt.y - currentPt.y;

    // Special animation & rotation for Raon walking mines
    if (this.mobileType === 6 && this.shotType >= 1 && this.bulletSprite && this.bulletSprite.textures.length >= 10) {
      const isWalkingGround = Math.abs(dx) <= 4.0 && Math.abs(dy) <= 3.5 && this.progress > 5;
      if (isWalkingGround) {
        // Mine reached terrain: walk upright with animated walking frames 4-9
        this.bulletContainer.rotation = 0;
        if (dx < -0.1) {
          this.bulletSprite.scale.x = -1;
        } else if (dx > 0.1) {
          this.bulletSprite.scale.x = 1;
        }
        const walkFrame = 4 + (Math.floor(this.progress * 1.6) % 6);
        this.bulletSprite.gotoAndStop(walkFrame);
      } else {
        // In-flight spinning capsule: frames 0-3
        this.bulletSprite.scale.x = 1;
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
          this.bulletContainer.rotation = Math.atan2(dy, dx);
        }
        const flyFrame = Math.floor(this.progress * 1.5) % 4;
        this.bulletSprite.gotoAndStop(flyFrame);
      }
    } else {
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        this.bulletContainer.rotation = Math.atan2(dy, dx);
      }
    }

    // Procedural rendering for Mage (Lasers) and Turtle (Water Jets)
    if (this.isProcedural) {
      this.renderProceduralShot(currentPt);
    }

    return false;
  }

  private renderProceduralShot(headPt: Point2D) {
    this.proceduralGraphics.clear();

    const trailSpan = this.shotType === 1 ? 28 : 18;
    const span = Math.min(this.progress, trailSpan);
    if (span <= 0.2) return;

    const sampleSteps = Math.max(10, Math.floor(span * 3));
    const pts: Point2D[] = [];
    const normals: Point2D[] = [];
    const progs: number[] = [];

    for (let s = 0; s <= sampleSteps; s++) {
      const p = Math.max(0, this.progress - (span * (s / sampleSteps)));
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

    // ----------------------------------------------------
    // MAGE SHOTS (Plasma Energy Lasers)
    // ----------------------------------------------------
    if (this.mobileType === 1) {
      if (this.shotType === 0) {
        // Mage Shot 1: High-energy electric laser beam
        // Layer 1: Outer cyan aura glow
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 14, color: 0x00e5ff, alpha: 0.25, cap: "round", join: "round" });

        // Layer 2: Neon plasma beam
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 6.5, color: 0x00f5d4, alpha: 0.85, cap: "round", join: "round" });

        // Layer 3: Blinding white core
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 2.5, color: 0xffffff, alpha: 1.0, cap: "round", join: "round" });

        // Plasma head orb
        this.proceduralGraphics.circle(headPt.x, headPt.y, 8).fill({ color: 0x00e5ff, alpha: 0.45 });
        this.proceduralGraphics.circle(headPt.x, headPt.y, 4.5).fill(0xffffff);

      } else {
        // Mage Shot 2: Twin spiraling plasma energy lasers (Reference Image 1)
        const spatialFreq = 0.22;
        const amp = 5.8;

        const ptsA: Point2D[] = [];
        const ptsB: Point2D[] = [];

        for (let i = 0; i < pts.length; i++) {
          const osc = Math.sin(progs[i] * spatialFreq) * amp;
          ptsA.push({
            x: pts[i].x + normals[i].x * osc,
            y: pts[i].y + normals[i].y * osc,
          });
          ptsB.push({
            x: pts[i].x - normals[i].x * osc,
            y: pts[i].y - normals[i].y * osc,
          });
        }

        // Beam A: Electric Cyan Aura & Core
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsA[0].x, ptsA[0].y);
        for (let i = 1; i < ptsA.length; i++) this.proceduralGraphics.lineTo(ptsA[i].x, ptsA[i].y);
        this.proceduralGraphics.stroke({ width: 7, color: 0x00f0ff, alpha: 0.45, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsA[0].x, ptsA[0].y);
        for (let i = 1; i < ptsA.length; i++) this.proceduralGraphics.lineTo(ptsA[i].x, ptsA[i].y);
        this.proceduralGraphics.stroke({ width: 3.2, color: 0x38bdf8, alpha: 0.90, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsA[0].x, ptsA[0].y);
        for (let i = 1; i < ptsA.length; i++) this.proceduralGraphics.lineTo(ptsA[i].x, ptsA[i].y);
        this.proceduralGraphics.stroke({ width: 1.5, color: 0xffffff, alpha: 1.0, cap: "round", join: "round" });

        // Beam B: Electric Pink/Magenta Aura & Core
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsB[0].x, ptsB[0].y);
        for (let i = 1; i < ptsB.length; i++) this.proceduralGraphics.lineTo(ptsB[i].x, ptsB[i].y);
        this.proceduralGraphics.stroke({ width: 7, color: 0xf43f5e, alpha: 0.45, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsB[0].x, ptsB[0].y);
        for (let i = 1; i < ptsB.length; i++) this.proceduralGraphics.lineTo(ptsB[i].x, ptsB[i].y);
        this.proceduralGraphics.stroke({ width: 3.2, color: 0xf472b6, alpha: 0.90, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsB[0].x, ptsB[0].y);
        for (let i = 1; i < ptsB.length; i++) this.proceduralGraphics.lineTo(ptsB[i].x, ptsB[i].y);
        this.proceduralGraphics.stroke({ width: 1.5, color: 0xffffff, alpha: 1.0, cap: "round", join: "round" });

        // Dual glowing heads
        this.proceduralGraphics.circle(ptsA[0].x, ptsA[0].y, 4.5).fill({ color: 0x00f0ff, alpha: 0.9 });
        this.proceduralGraphics.circle(ptsA[0].x, ptsA[0].y, 2.2).fill(0xffffff);
        this.proceduralGraphics.circle(ptsB[0].x, ptsB[0].y, 4.5).fill({ color: 0xf43f5e, alpha: 0.9 });
        this.proceduralGraphics.circle(ptsB[0].x, ptsB[0].y, 2.2).fill(0xffffff);
      }
    }

    // ----------------------------------------------------
    // TURTLE SHOTS (Hydraulic Water Jets)
    // ----------------------------------------------------
    else if (this.mobileType === 7) {
      if (this.shotType === 0) {
        // Turtle Shot 1: Smooth curving continuous water stream
        // Layer 1: Outer water envelope
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 12, color: 0x0284c7, alpha: 0.45, cap: "round", join: "round" });

        // Layer 2: Pressurized hydraulic water stream
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 6.5, color: 0x38bdf8, alpha: 0.85, cap: "round", join: "round" });

        // Layer 3: Frothy whitewater core
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.proceduralGraphics.lineTo(pts[i].x, pts[i].y);
        this.proceduralGraphics.stroke({ width: 2.2, color: 0xffffff, alpha: 0.95, cap: "round", join: "round" });

        // Hydrodynamic water droplet head
        this.proceduralGraphics.circle(headPt.x, headPt.y, 6.5).fill({ color: 0x38bdf8, alpha: 0.9 });
        this.proceduralGraphics.circle(headPt.x, headPt.y, 3.5).fill(0xffffff);

      } else {
        // Turtle Shot 2: Braided figure-8 twin water jets (Reference Image 2)
        const spatialFreq = 0.20;
        const amp = 7.0;

        const ptsA: Point2D[] = [];
        const ptsB: Point2D[] = [];

        for (let i = 0; i < pts.length; i++) {
          const osc = Math.sin(progs[i] * spatialFreq) * amp;
          ptsA.push({
            x: pts[i].x + normals[i].x * osc,
            y: pts[i].y + normals[i].y * osc,
          });
          ptsB.push({
            x: pts[i].x - normals[i].x * osc,
            y: pts[i].y - normals[i].y * osc,
          });
        }

        // Stream A: Outer translucent water body & pressurized foam core
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsA[0].x, ptsA[0].y);
        for (let i = 1; i < ptsA.length; i++) this.proceduralGraphics.lineTo(ptsA[i].x, ptsA[i].y);
        this.proceduralGraphics.stroke({ width: 8.5, color: 0x0284c7, alpha: 0.40, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsA[0].x, ptsA[0].y);
        for (let i = 1; i < ptsA.length; i++) this.proceduralGraphics.lineTo(ptsA[i].x, ptsA[i].y);
        this.proceduralGraphics.stroke({ width: 4.5, color: 0x7dd3fc, alpha: 0.85, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsA[0].x, ptsA[0].y);
        for (let i = 1; i < ptsA.length; i++) this.proceduralGraphics.lineTo(ptsA[i].x, ptsA[i].y);
        this.proceduralGraphics.stroke({ width: 1.8, color: 0xffffff, alpha: 0.95, cap: "round", join: "round" });

        // Stream B: Outer translucent water body & pressurized foam core
        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsB[0].x, ptsB[0].y);
        for (let i = 1; i < ptsB.length; i++) this.proceduralGraphics.lineTo(ptsB[i].x, ptsB[i].y);
        this.proceduralGraphics.stroke({ width: 8.5, color: 0x0284c7, alpha: 0.40, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsB[0].x, ptsB[0].y);
        for (let i = 1; i < ptsB.length; i++) this.proceduralGraphics.lineTo(ptsB[i].x, ptsB[i].y);
        this.proceduralGraphics.stroke({ width: 4.5, color: 0x7dd3fc, alpha: 0.85, cap: "round", join: "round" });

        this.proceduralGraphics.beginPath();
        this.proceduralGraphics.moveTo(ptsB[0].x, ptsB[0].y);
        for (let i = 1; i < ptsB.length; i++) this.proceduralGraphics.lineTo(ptsB[i].x, ptsB[i].y);
        this.proceduralGraphics.stroke({ width: 1.8, color: 0xffffff, alpha: 0.95, cap: "round", join: "round" });

        // Dual droplet heads
        this.proceduralGraphics.circle(ptsA[0].x, ptsA[0].y, 5).fill({ color: 0x38bdf8, alpha: 0.9 });
        this.proceduralGraphics.circle(ptsA[0].x, ptsA[0].y, 2.5).fill(0xffffff);
        this.proceduralGraphics.circle(ptsB[0].x, ptsB[0].y, 5).fill({ color: 0x38bdf8, alpha: 0.9 });
        this.proceduralGraphics.circle(ptsB[0].x, ptsB[0].y, 2.5).fill(0xffffff);
      }
    }
  }

  private triggerImpact() {
    this.isExploding = true;
    this.bulletContainer.visible = false;
    this.proceduralGraphics.clear();

    const lastPt = this.points[this.points.length - 1];
    this.currentX = lastPt.x;
    this.currentY = lastPt.y;

    if (this.explodeSprite && this.explodeSprite.textures.length > 0) {
      this.explodeSprite.x = lastPt.x;
      this.explodeSprite.y = lastPt.y;
      this.explodeSprite.visible = true;
      this.explodeSprite.gotoAndPlay(0);
    } else {
      this.fallbackExplosion.x = lastPt.x;
      this.fallbackExplosion.y = lastPt.y;
      this.fallbackExplosion.visible = true;
    }

    if (this.onImpactCallback) {
      this.onImpactCallback();
      this.onImpactCallback = undefined;
    }
  }

  private finish() {
    this.proceduralGraphics.clear();
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = undefined;
    }
  }
}
