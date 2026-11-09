import { Container, Sprite } from "pixi.js";
import { AvatarSpriteManager, AvatarTextures } from "../animation/AvatarSpriteManager.js";

export interface AvatarRiderConfig {
  gender?: "male" | "female";
}

export class AvatarRiderEntity extends Container {
  public gender: "male" | "female";
  private textures?: AvatarTextures;

  private headSprite: Sprite;
  private bodySprite: Sprite;

  private animStep: number = 0;
  private animTimer: number = 0;
  private animInterval: number = 0.09; // ~11-12 FPS authentic GunBound avatar animation

  private turnCycle?: number;
  private isSpecialHead: boolean = false;
  private damageFlashTimer: number = 0;

  constructor(config?: AvatarRiderConfig) {
    super();
    this.gender = config?.gender ?? "male";

    this.headSprite = new Sprite();
    this.bodySprite = new Sprite();

    // Authentic GunBound layer order:
    // Head (z=3) is placed first, Body (z=4) is placed second on top
    // so the pilot's shirt/armor collar sits naturally over the neck.
    this.addChild(this.headSprite);
    this.addChild(this.bodySprite);

    this.load();
  }

  public async load() {
    try {
      this.textures = await AvatarSpriteManager.loadAvatar(this.gender);
      this.updateFrames(0);
    } catch (err) {
      console.warn(`[AvatarRiderEntity] Failed to load avatar textures (${this.gender}):`, err);
    }
  }

  public setGender(gender: "male" | "female") {
    if (this.gender === gender) return;
    this.gender = gender;
    this.load();
  }

  public setSeatOffset(x: number, y: number) {
    this.position.set(x, y);
  }

  public triggerDamageReaction() {
    this.damageFlashTimer = 0.35; // 350ms damage reaction
    this.isSpecialHead = true;
  }

  public update(dt: number) {
    if (!this.textures) return;

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      this.alpha = Math.sin(this.damageFlashTimer * 40) > 0 ? 0.6 : 1.0;
      if (this.damageFlashTimer <= 0) {
        this.alpha = 1.0;
        this.isSpecialHead = false;
      }
    }

    this.animTimer += dt;
    if (this.animTimer >= this.animInterval) {
      this.animTimer -= this.animInterval;
      this.animStep++;
      this.updateFrames(this.animStep);
    }
  }

  private updateFrames(step: number) {
    if (!this.textures) return;

    const { headTextures, bodyTextures, headFrames, bodyFrames } = this.textures;
    if (headTextures.length === 0 || bodyTextures.length === 0) return;

    // 1. Calculate Body Frame using GunBound LOOP_NORMAL_AND_REVERSE:
    // Ping-pong loop between 0 and N-1 for natural idle breathing
    const bCount = bodyFrames.length;
    const bCycle = 2 * bCount - 2;
    let bFrame = step % (bCycle > 0 ? bCycle : 1);
    if (bFrame >= bCount) {
      bFrame = bCycle - bFrame;
    }
    bFrame = Math.max(0, Math.min(bCount - 1, bFrame));

    const bDef = bodyFrames[bFrame];
    this.bodySprite.texture = bodyTextures[bFrame];
    // GunBound: position.x = -cx, position.y = -cy
    this.bodySprite.position.set(-bDef.cx, -bDef.cy);

    // 2. Calculate Head Frame using GunBound LOOP_AVATAR:
    // Normal state breathes and blinks in frames 11..20..11.
    // Occasionally turnCycle triggers is_special to look around (frames 0..10..0).
    const hCount = headFrames.length; // 22 frames
    const half = Math.floor(hCount / 2); // 11
    const hCycle = 2 * half - 2; // 20

    if (this.damageFlashTimer <= 0) {
      const cycleIdx = Math.floor(step / (hCount - 2 > 0 ? hCount - 2 : 1));
      if (this.turnCycle === undefined || cycleIdx > this.turnCycle) {
        // GunBound RANDOM_FACE_TURN_CHANCE = 6
        this.turnCycle = cycleIdx + 2 + Math.floor(Math.random() * 5);
      }
      this.isSpecialHead = cycleIdx === this.turnCycle;
    }

    let hFrame = step % (hCycle > 0 ? hCycle : 1);
    if (hFrame >= half) {
      hFrame = hCycle - hFrame;
    }
    if (!this.isSpecialHead) {
      hFrame += half; // Idle breathing frames (11..20)
    }
    hFrame = Math.max(0, Math.min(hCount - 1, hFrame));

    const hDef = headFrames[hFrame];
    this.headSprite.texture = headTextures[hFrame];
    this.headSprite.position.set(-hDef.cx, -hDef.cy);
  }
}

