import { AnimatedSprite, Assets, Container, Rectangle, Texture } from "pixi.js";

/**
 * ItemPowerupEntity
 * 
 * Authentic GunBound item activation powerup animation.
 * Uses aligned 18-frame spritesheet from /sprites/explodes/item_powerup_aligned.png.
 * Centered perfectly over the mobile with zero frame-jumping or jitter.
 */
export class ItemPowerupEntity extends Container {
  private sprite?: AnimatedSprite;
  private isDestroyed: boolean = false;
  private animFrameId?: number;

  constructor(x: number, y: number) {
    super();
    // Positioned at mobile center/base
    this.position.set(x, y);
    this.loadEffect();
  }

  private async loadEffect() {
    try {
      const texture = await Assets.load<Texture>("/sprites/explodes/item_powerup_aligned.png");
      if (this.isDestroyed) return;
      const baseTex = texture.source;

      const frameWidth = 86;
      const frameHeight = 120;
      const frameCount = 18;
      const frames: Texture[] = [];

      for (let i = 0; i < frameCount; i++) {
        const rect = new Rectangle(i * frameWidth, 0, frameWidth, frameHeight);
        frames.push(
          new Texture({
            source: baseTex,
            frame: rect,
            defaultAnchor: { x: 0.5, y: 114 / 120 },
          })
        );
      }

      this.sprite = new AnimatedSprite(frames);
      // Fluid authentic GunBound aura playback (~30 FPS, energetic & snappy)
      this.sprite.animationSpeed = 0.50;
      this.sprite.loop = false;
      this.sprite.anchor.set(0.5, 114 / 120);

      // Smooth gradual fade in the final frames instead of sudden clipping
      this.sprite.onFrameChange = (currentFrame: number) => {
        if (currentFrame >= 14) {
          const progress = (currentFrame - 14) / (frameCount - 14);
          this.alpha = Math.max(0.6, 1.0 - progress * 0.35);
        }
      };

      this.sprite.onComplete = () => {
        this.startDissolve();
      };

      this.sprite.play();
      this.addChild(this.sprite);
    } catch (e) {
      console.warn("[ItemPowerupEntity] Failed to load item_powerup_aligned.png:", e);
      this.cleanup();
    }
  }

  /**
   * Smooth ethereal dissipation at the end of the aura animation.
   * Evaporates softly upward without cutting abruptly.
   */
  private startDissolve() {
    if (this.isDestroyed) return;
    let fadeStepCount = 0;
    const maxSteps = 16;

    const fadeStep = () => {
      if (this.isDestroyed) return;
      fadeStepCount++;
      const t = fadeStepCount / maxSteps;
      this.alpha = Math.max(0, 0.55 * (1 - t * t));
      this.scale.y += 0.008;
      this.y -= 0.5;

      if (fadeStepCount >= maxSteps || this.alpha <= 0.02) {
        this.cleanup();
      } else {
        this.animFrameId = requestAnimationFrame(fadeStep);
      }
    };

    this.animFrameId = requestAnimationFrame(fadeStep);
  }

  public cleanup() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.animFrameId !== undefined) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = undefined;
    }
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.destroy({ children: true });
  }
}
