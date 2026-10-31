import { AnimatedSprite, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { ProjectileSpriteManager, ProjectileTextures } from "./ProjectileSpriteManager.js";

export interface Point2D {
  x: number;
  y: number;
}

interface StreamSegment {
  sprite: Sprite;
  sliceW: number;
  sliceH: number;
}

export class Projectile extends Container {
  private bulletContainer: Container;
  private bulletSprite?: AnimatedSprite;
  private fallbackBullet: Graphics;

  private streamContainer?: Container;
  private streamSegments: StreamSegment[] = [];
  private isStream: boolean = false;

  private explodeSprite?: AnimatedSprite;
  private fallbackExplosion: Graphics;

  private points: Point2D[];
  private mobileType: number;
  private shotType: number;
  private progress: number = 0;
  private speedFactor: number = 1.0; // 1 trajectory point per tick (at 60 FPS)

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
    this.fallbackExplosion = new Graphics();

    // Subtle fallback dot while authentic sprite loads
    this.fallbackBullet.circle(0, 0, 3.5).fill(0xf59e0b);

    this.bulletContainer.addChild(this.fallbackBullet);
    this.addChild(this.bulletContainer);
    this.addChild(this.fallbackExplosion);

    if (points.length > 0) {
      this.currentX = points[0].x;
      this.currentY = points[0].y;
      this.bulletContainer.x = this.currentX;
      this.bulletContainer.y = this.currentY;
    }

    // Try synchronous cache first
    const cachedBullet = ProjectileSpriteManager.getCachedBullet(mobileType, shotType);
    if (cachedBullet) {
      if (cachedBullet.isStream) {
        this.setupStream(cachedBullet);
      } else if (cachedBullet.textures.length > 0) {
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
    if (!cachedBullet || !cachedExplosion) {
      this.loadSprites();
    }
  }

  public get currentPosition(): Point2D {
    return { x: this.currentX, y: this.currentY };
  }

  private setupStream(bulletData: ProjectileTextures) {
    if (!bulletData.baseTexture) return;
    this.isStream = true;
    this.fallbackBullet.visible = false;

    if (this.streamContainer) {
      this.removeChild(this.streamContainer);
      this.streamContainer.destroy();
    }

    this.streamContainer = new Container();
    this.streamSegments = [];

    const trace = bulletData.trace || 8;
    const baseTex = bulletData.baseTexture;
    const sliceW = Math.max(1, Math.floor(baseTex.width / trace));
    const sliceH = bulletData.traceH || baseTex.height;
    const traceY = bulletData.traceY || 0;

    for (let m = 0; m < trace; m++) {
      const clampedX = Math.min(baseTex.width - 1, m * sliceW);
      const clampedW = Math.min(sliceW, baseTex.width - clampedX);
      const frame = new Rectangle(clampedX, traceY, clampedW, sliceH);
      const segTex = new Texture({
        source: baseTex.source,
        frame,
      });
      const segSprite = new Sprite(segTex);
      segSprite.anchor.set(0, 0.5);
      segSprite.visible = false;
      this.streamSegments.push({
        sprite: segSprite,
        sliceW: clampedW,
        sliceH,
      });
      this.streamContainer.addChild(segSprite);
    }

    this.addChildAt(this.streamContainer, 0);
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
      if (!this.bulletSprite && !this.isStream) {
        const bulletData = await ProjectileSpriteManager.loadBullet(this.mobileType, this.shotType);
        if (bulletData.isStream) {
          this.setupStream(bulletData);
        } else if (bulletData.textures.length > 0) {
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

    // Angle of flight direction (rotates authentic sprite naturally)
    const nextProg = Math.min(this.points.length - 1, this.progress + 0.2);
    const nextPt = this.getPointAtProgress(nextProg);
    const dx = nextPt.x - currentPt.x;
    const dy = nextPt.y - currentPt.y;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      this.bulletContainer.rotation = Math.atan2(dy, dx);
    }

    // Authentic stream / trace rendering for laser and water jets (Mage & Turtle)
    if (this.isStream && this.streamSegments.length > 0) {
      const numSegs = this.streamSegments.length;
      // Trail length connects smoothly behind projectile head
      const trailSpan = Math.min(this.progress, numSegs * 0.95);
      const step = trailSpan / numSegs;

      for (let m = 0; m < numSegs; m++) {
        const seg = this.streamSegments[m];
        const progHead = Math.max(0, this.progress - m * step);
        const progTail = Math.max(0, this.progress - (m + 1) * step);

        const ptHead = this.getPointAtProgress(progHead);
        const ptTail = this.getPointAtProgress(progTail);

        const segDx = ptHead.x - ptTail.x;
        const segDy = ptHead.y - ptTail.y;
        const segDist = Math.hypot(segDx, segDy);

        if (this.progress > 0.1 && segDist > 0.1) {
          seg.sprite.visible = true;
          seg.sprite.x = ptTail.x;
          seg.sprite.y = ptTail.y;
          seg.sprite.rotation = Math.atan2(segDy, segDx);
          seg.sprite.scale.x = Math.max(0.01, segDist / seg.sliceW);
          seg.sprite.scale.y = 1.0;
        } else {
          seg.sprite.visible = false;
        }
      }
    }

    return false;
  }

  private triggerImpact() {
    this.isExploding = true;
    this.bulletContainer.visible = false;
    if (this.streamContainer) {
      this.streamContainer.visible = false;
    }

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
    if (this.streamContainer) {
      this.streamContainer.visible = false;
    }
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = undefined;
    }
  }
}
