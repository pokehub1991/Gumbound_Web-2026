import { AnimatedSprite, Assets, Container, Rectangle, Texture } from "pixi.js";

/**
 * DeathGhostEntity
 * 
 * Authentic GunBound Angel / Ghost ascension spirit.
 * Uses the authentic DragonBound/GunBound MOBILE.RANDOM ghost sprite (/sprites/effects/ghost_random_aligned.png).
 * Ascends straight up into the heavens at a calm, gentle pace without sinusoidal wobble.
 */
export class DeathGhostEntity extends Container {
  private ghostSprite?: AnimatedSprite;
  private isDestroyed: boolean = false;
  private life: number = 0;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);
    this.loadGhost();
  }

  private async loadGhost() {
    try {
      const texture = await Assets.load<Texture>("/sprites/effects/ghost_random_aligned.png");
      const baseTex = texture.source;

      const frameWidth = 36;
      const frameHeight = 48;
      const frameCount = 12;
      const frames: Texture[] = [];

      for (let i = 0; i < frameCount; i++) {
        const rect = new Rectangle(i * frameWidth, 0, frameWidth, frameHeight);
        frames.push(
          new Texture({
            source: baseTex,
            frame: rect,
            defaultAnchor: { x: 0.5, y: 46 / 48 },
          })
        );
      }

      this.ghostSprite = new AnimatedSprite(frames);
      this.ghostSprite.animationSpeed = 0.22; // ~13 FPS gentle flutter
      this.ghostSprite.loop = true;
      this.ghostSprite.anchor.set(0.5, 46 / 48);
      this.ghostSprite.scale.set(1.25); // Crisp authentic size
      this.ghostSprite.play();

      this.addChild(this.ghostSprite);
    } catch (e) {
      console.warn("[DeathGhostEntity] Failed to load ghost_random_aligned.png:", e);
    }
  }

  public update(dt: number = 1.0): boolean {
    if (this.isDestroyed) return false;
    this.life += dt;

    // Ascend smoothly straight up into heaven and exit through the top background border
    this.y -= 3.2 * dt;

    if (this.y < -120 || this.life > 600) {
      this.cleanup();
      return false;
    }
    return true;
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
