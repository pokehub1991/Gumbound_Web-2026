import { AnimatedSprite, Container, Graphics } from "pixi.js";
import { ProjectileSpriteManager } from "./ProjectileSpriteManager.js";

export interface Point2D {
  x: number;
  y: number;
}

export class Projectile extends Container {
  private bulletContainer: Container;
  private bulletSprite?: AnimatedSprite;
  private fallbackBullet: Graphics;
  private trailGraphics: Graphics;

  private explodeSprite?: AnimatedSprite;
  private fallbackExplosion: Graphics;
  private ssAura?: Graphics;

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
    this.trailGraphics = new Graphics();
    this.fallbackBullet = new Graphics();
    this.fallbackExplosion = new Graphics();

    // Fallback vector missile (sharp conical bullet with flame tail)
    this.fallbackBullet.poly([
      14, 0,
      -8, -5,
      -12, 0,
      -8, 5,
    ]).fill(0xf59e0b).stroke({ width: 1.5, color: 0xffffff });
    this.fallbackBullet.circle(0, 0, 3.5).fill(0xffffff);

    // Epic SS radiant energy aura
    if (this.shotType === 2) {
      this.ssAura = new Graphics();
      this.bulletContainer.addChild(this.ssAura);
    }

    this.bulletContainer.addChild(this.fallbackBullet);
    this.addChild(this.trailGraphics);
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
    if (cachedBullet && cachedBullet.textures.length > 0) {
      this.fallbackBullet.visible = false;
      this.bulletSprite = new AnimatedSprite(cachedBullet.textures);
      this.bulletSprite.anchor.set(cachedBullet.anchor.x, cachedBullet.anchor.y);
      this.bulletSprite.animationSpeed = 0.35;
      this.bulletSprite.play();
      this.bulletContainer.addChild(this.bulletSprite);
    }

    const cachedExplosion = ProjectileSpriteManager.getCachedExplosion(mobileType, shotType);
    if (cachedExplosion && cachedExplosion.textures.length > 0) {
      this.explodeSprite = new AnimatedSprite(cachedExplosion.textures);
      this.explodeSprite.anchor.set(cachedExplosion.anchor.x, cachedExplosion.anchor.y);
      this.explodeSprite.animationSpeed = 0.45;
      this.explodeSprite.loop = false;
      this.explodeSprite.visible = false;
      this.addChild(this.explodeSprite);
    }

    // Load authentic sprites if not yet cached
    if (!cachedBullet || !cachedExplosion) {
      this.loadSprites();
    }
  }

  public get currentPosition(): Point2D {
    return { x: this.currentX, y: this.currentY };
  }

  private async loadSprites() {
    try {
      if (!this.bulletSprite) {
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
          this.explodeSprite = new AnimatedSprite(explodeData.textures);
          this.explodeSprite.anchor.set(explodeData.anchor.x, explodeData.anchor.y);
          this.explodeSprite.animationSpeed = 0.45;
          this.explodeSprite.loop = false;
          this.explodeSprite.visible = false;
          this.addChild(this.explodeSprite);
        }
      }
    } catch (e) {
      console.warn("[Projectile] Error loading authentic sprites:", e);
    }
  }

  public update(dt: number = 1): boolean {
    if (this.isExploding) {
      this.explosionTimer += dt;
      if (this.explodeSprite) {
        if (!this.explodeSprite.playing || this.explodeSprite.currentFrame >= this.explodeSprite.textures.length - 1) {
          this.finish();
          return true;
        }
      } else {
        const prog = Math.min(1.0, this.explosionTimer / 18);
        this.fallbackExplosion.clear();
        this.fallbackExplosion.circle(0, 0, prog * 38).fill({ color: 0xff4500, alpha: 1.0 - prog });
        this.fallbackExplosion.circle(0, 0, prog * 22).fill({ color: 0xffeb3b, alpha: 1.0 - prog * 0.7 });
        this.fallbackExplosion.stroke({ width: 2, color: 0xffffff, alpha: 1.0 - prog });

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

    // Smooth sub-tick floating advancement along trajectory
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
    const idx0 = Math.floor(this.progress);
    const idx1 = Math.min(this.points.length - 1, idx0 + 1);
    const frac = this.progress - idx0;

    const p0 = this.points[idx0];
    const p1 = this.points[idx1];

    this.currentX = p0.x + (p1.x - p0.x) * frac;
    this.currentY = p0.y + (p1.y - p0.y) * frac;

    this.bulletContainer.x = this.currentX;
    this.bulletContainer.y = this.currentY;

    // Angle of flight direction
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      this.bulletContainer.rotation = Math.atan2(dy, dx);
    }

    // Pulsating radiant energy aura for Super Shot (SS)
    if (this.ssAura && this.shotType === 2) {
      this.ssAura.clear();
      const pulse = Math.sin(Date.now() * 0.02) * 4;
      this.ssAura.circle(0, 0, 24 + pulse).fill({ color: 0x7c3aed, alpha: 0.35 });
      this.ssAura.circle(0, 0, 14 + pulse * 0.5).fill({ color: 0xc084fc, alpha: 0.65 });
      this.ssAura.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.95 });
    }

    // Draw glowing curved particle trail behind missile
    this.trailGraphics.clear();
    const trailSpan = this.shotType === 2 ? 18 : 12;
    const startIdx = Math.max(0, idx0 - trailSpan);
    if (idx0 > startIdx) {
      for (let i = startIdx; i < idx0; i++) {
        const ptA = this.points[i];
        const ptB = this.points[i + 1];
        const alpha = (i - startIdx + 1) / trailSpan;
        const width = (this.shotType === 2 ? 3.0 : 1.5) + alpha * (this.shotType === 2 ? 5.5 : 3.5);

        this.trailGraphics.moveTo(ptA.x, ptA.y);
        this.trailGraphics.lineTo(ptB.x, ptB.y);
        this.trailGraphics.stroke({
          width,
          color: this.shotType === 2 ? 0xa855f7 : 0xf97316,
          alpha: alpha * (this.shotType === 2 ? 0.95 : 0.85),
        });
      }
      // Connect to current interpolated position
      this.trailGraphics.moveTo(p0.x, p0.y);
      this.trailGraphics.lineTo(this.currentX, this.currentY);
      this.trailGraphics.stroke({
        width: this.shotType === 2 ? 7.0 : 4.5,
        color: this.shotType === 2 ? 0xe879f9 : 0xf97316,
        alpha: 0.95,
      });
    }

    return false;
  }

  private triggerImpact() {
    this.isExploding = true;
    this.bulletContainer.visible = false;
    this.trailGraphics.clear();

    const lastPt = this.points[this.points.length - 1];
    this.currentX = lastPt.x;
    this.currentY = lastPt.y;

    if (this.explodeSprite) {
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
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = undefined;
    }
  }
}
