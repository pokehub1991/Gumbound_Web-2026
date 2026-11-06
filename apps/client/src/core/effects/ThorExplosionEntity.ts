import { AnimatedSprite, Assets, Container, Rectangle, Texture } from "pixi.js";

const THOR_FRAMES_DATA = [
  { x: 0, y: 0, w: 18, h: 18, ox: 9, oy: 9 },
  { x: 18, y: 0, w: 60, h: 60, ox: 30, oy: 30 },
  { x: 78, y: 0, w: 48, h: 47, ox: 24, oy: 23 },
  { x: 126, y: 0, w: 63, h: 67, ox: 31, oy: 31 },
  { x: 189, y: 0, w: 78, h: 80, ox: 38, oy: 39 },
  { x: 267, y: 0, w: 93, h: 96, ox: 46, oy: 47 },
  { x: 360, y: 0, w: 104, h: 96, ox: 52, oy: 47 },
  { x: 464, y: 0, w: 114, h: 96, ox: 57, oy: 47 },
  { x: 578, y: 0, w: 124, h: 96, ox: 62, oy: 47 },
  { x: 702, y: 0, w: 128, h: 96, ox: 61, oy: 47 },
  { x: 830, y: 0, w: 128, h: 92, ox: 57, oy: 48 },
  { x: 958, y: 0, w: 76, h: 84, ox: 34, oy: 40 },
  { x: 1034, y: 0, w: 79, h: 76, ox: 35, oy: 40 },
  { x: 1113, y: 0, w: 82, h: 78, ox: 37, oy: 44 },
  { x: 1195, y: 0, w: 81, h: 79, ox: 36, oy: 45 },
  { x: 1276, y: 0, w: 76, h: 79, ox: 38, oy: 46 },
];

/**
 * ThorExplosionEntity
 * 
 * Authentic GunBound Thor orbital laser strike detonation effect.
 * Uses 16-frame aduka1-thor.png explosion spritesheet with original frame anchors.
 */
export class ThorExplosionEntity extends Container {
  private sprite?: AnimatedSprite;
  private isDestroyed: boolean = false;

  constructor(x: number, y: number, onComplete?: () => void) {
    super();
    this.position.set(x, y);
    this.loadEffect(onComplete);
  }

  private async loadEffect(onComplete?: () => void) {
    try {
      const texture = await Assets.load<Texture>("/sprites/explodes/aduka1-thor.png");
      if (this.isDestroyed) return;
      const baseTex = texture.source;

      const frames: Texture[] = THOR_FRAMES_DATA.map((f) => {
        const rect = new Rectangle(f.x, f.y, f.w, f.h);
        return new Texture({
          source: baseTex,
          frame: rect,
          defaultAnchor: {
            x: f.ox / f.w,
            y: f.oy / f.h,
          },
        });
      });

      this.sprite = new AnimatedSprite(frames);
      this.sprite.animationSpeed = 0.45; // ~27 FPS snappy retro blast
      this.sprite.loop = false;
      this.sprite.anchor.set(0.5, 0.5);

      this.sprite.onComplete = () => {
        if (onComplete) onComplete();
        this.cleanup();
      };

      this.addChild(this.sprite);
      this.sprite.play();
    } catch (e) {
      console.warn("[ThorExplosionEntity] Failed to load aduka1-thor.png:", e);
      if (onComplete) onComplete();
      this.cleanup();
    }
  }

  public cleanup() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.destroy({ children: true });
  }
}

