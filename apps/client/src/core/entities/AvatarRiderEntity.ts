import { Container, Sprite, Texture } from "pixi.js";
import {
  AvatarSlotKey,
  AvatarEquipment,
  AVATAR_ANCHORS,
  DEFAULT_AVATAR_EQUIPMENT,
} from "../constants/avatarSlots.js";
import { AvatarAssetManager } from "../animation/AvatarAssetManager.js";

export interface AvatarRiderConfig {
  gender?: "male" | "female";
  equipment?: Partial<AvatarEquipment>;
}

/**
 * Modern Modular Hierarchical Avatar Rider Entity for Gumbound-2026.
 * Replaces legacy 2003 frame-by-frame spritesheets with a 60 FPS
 * hierarchical joint rig supporting 1-PNG drop-in store cosmetics.
 */
export class AvatarRiderEntity extends Container {
  public gender: "male" | "female";
  private equipment: AvatarEquipment;

  // Rig joint hierarchy
  private torsoJoint: Container;
  private neckJoint: Container;
  private headJoint: Container;

  // Cosmetic slot sprites
  private flagSprite: Sprite;
  private hairBackSprite: Sprite;
  private bodySprite: Sprite;
  private faceSprite: Sprite;
  private eyesSprite: Sprite;
  private helmetSprite: Sprite;
  private petSprite: Sprite;

  // Cached textures for fast switching
  private faceDefaultTexture: Texture | null = null;
  private faceTurnTexture: Texture | null = null;
  private eyesOpenTexture: Texture | null = null;
  private eyesClosedTexture: Texture | null = null;

  // Animation clocks & state
  private animTime: number = 0;
  private damageFlashTimer: number = 0;

  // Blinking cycle
  private blinkTimer: number = 0;
  private blinkNextTrigger: number = 3.0;
  private isBlinking: boolean = false;

  // Head look-around turn cycle
  private turnTimer: number = 0;
  private turnNextTrigger: number = 4.0;
  private isTurningHead: boolean = false;
  private turnProgress: number = 0;
  private turnTargetAngle: number = 0.08; // ~4.5 degrees tilt

  constructor(config?: AvatarRiderConfig) {
    super();
    this.gender = config?.gender ?? "male";
    this.equipment = {
      ...DEFAULT_AVATAR_EQUIPMENT[this.gender],
      ...(config?.equipment ?? {}),
    };

    // 1. Joint hierarchy
    this.torsoJoint = new Container();
    this.neckJoint = new Container();
    this.headJoint = new Container();

    this.neckJoint.position.set(AVATAR_ANCHORS.neckOffset.x, AVATAR_ANCHORS.neckOffset.y);
    this.neckJoint.addChild(this.headJoint);
    this.torsoJoint.addChild(this.neckJoint);
    this.addChild(this.torsoJoint);

    // 2. Cosmetic slot sprites with standardized pivots
    this.flagSprite = new Sprite();
    this.flagSprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);

    this.hairBackSprite = new Sprite();
    this.hairBackSprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);

    this.bodySprite = new Sprite();
    this.bodySprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);

    this.faceSprite = new Sprite();
    this.faceSprite.anchor.set(AVATAR_ANCHORS.neck.x, AVATAR_ANCHORS.neck.y);

    this.eyesSprite = new Sprite();
    this.eyesSprite.anchor.set(AVATAR_ANCHORS.neck.x, AVATAR_ANCHORS.neck.y);

    this.helmetSprite = new Sprite();
    this.helmetSprite.anchor.set(AVATAR_ANCHORS.neck.x, AVATAR_ANCHORS.neck.y);

    this.petSprite = new Sprite();
    this.petSprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);

    // 3. Assemble layer order (Z-index):
    // Behind torso: Flag (0), HairBack (1), Body (2)
    this.torsoJoint.addChild(this.flagSprite);
    this.torsoJoint.addChild(this.hairBackSprite);
    this.torsoJoint.addChild(this.bodySprite);

    // Head parts attached to headJoint:
    // Face (0), Eyes (1), Helmet/HairFront (2)
    this.headJoint.addChild(this.faceSprite);
    this.headJoint.addChild(this.eyesSprite);
    this.headJoint.addChild(this.helmetSprite);

    // Foreground over torso: Pet (on right shoulder)
    this.torsoJoint.addChild(this.petSprite);

    // 4. Initial load
    this.load();
  }

  public async load() {
    try {
      const [textures, faceTurn, eyesOpen, eyesClosed] = await Promise.all([
        AvatarAssetManager.loadEquipment(this.equipment),
        AvatarAssetManager.loadItemTexture("face_turn"),
        AvatarAssetManager.loadItemTexture("eyes_open"),
        AvatarAssetManager.loadItemTexture("eyes_closed"),
      ]);

      this.faceDefaultTexture = textures.face ?? null;
      this.faceTurnTexture = faceTurn;
      this.eyesOpenTexture = eyesOpen;
      this.eyesClosedTexture = eyesClosed;

      this.flagSprite.texture = textures.flag ?? Texture.EMPTY;
      this.flagSprite.visible = !!textures.flag;

      this.hairBackSprite.texture = textures.hairBack ?? Texture.EMPTY;
      this.hairBackSprite.visible = !!textures.hairBack;

      this.bodySprite.texture = textures.body ?? Texture.EMPTY;
      this.bodySprite.visible = !!textures.body;

      this.faceSprite.texture = textures.face ?? Texture.EMPTY;
      this.faceSprite.visible = !!textures.face;

      this.eyesSprite.texture = textures.eyes ?? Texture.EMPTY;
      this.eyesSprite.visible = !!textures.eyes;

      this.helmetSprite.texture = textures.helmet ?? Texture.EMPTY;
      this.helmetSprite.visible = !!textures.helmet;

      this.petSprite.texture = textures.pet ?? Texture.EMPTY;
      this.petSprite.visible = !!textures.pet;
    } catch (err) {
      console.warn(`[AvatarRiderEntity] Failed to load avatar textures:`, err);
    }
  }

  public setGender(gender: "male" | "female") {
    if (this.gender === gender) return;
    this.gender = gender;
    this.equipment = {
      ...DEFAULT_AVATAR_EQUIPMENT[this.gender],
    };
    this.load();
  }

  /**
   * Equips or un-equips an item in a specific avatar slot.
   */
  public async equip(slot: AvatarSlotKey, itemId: string | null) {
    this.equipment[slot] = itemId;
    const spriteMap: Record<AvatarSlotKey, Sprite> = {
      flag: this.flagSprite,
      hairBack: this.hairBackSprite,
      body: this.bodySprite,
      face: this.faceSprite,
      eyes: this.eyesSprite,
      helmet: this.helmetSprite,
      pet: this.petSprite,
    };

    const targetSprite = spriteMap[slot];
    if (!targetSprite) return;

    if (!itemId) {
      targetSprite.visible = false;
      targetSprite.texture = Texture.EMPTY;
      return;
    }

    targetSprite.visible = true;
    const tex = await AvatarAssetManager.loadItemTexture(itemId);
    if (tex) {
      targetSprite.texture = tex;
      if (slot === "face") {
        this.faceDefaultTexture = tex;
      }
    }
  }

  public getEquipment(): AvatarEquipment {
    return { ...this.equipment };
  }

  public setSeatOffset(x: number, y: number) {
    this.position.set(x, y);
  }

  public triggerDamageReaction() {
    this.damageFlashTimer = 0.35; // 350ms damage reaction
    this.torsoJoint.x = -2;
    this.headJoint.rotation = -0.12;
  }

  public update(dt: number) {
    // In PixiJS 8 ticker, dt ~ 1.0 at 60 FPS
    const dtSec = dt / 60;
    this.animTime += dtSec;

    // 1. Damage flash & recoil decay
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dtSec;
      this.alpha = Math.sin(this.damageFlashTimer * 35) > 0 ? 0.5 : 1.0;
      if (this.damageFlashTimer <= 0) {
        this.alpha = 1.0;
        this.torsoJoint.x = 0;
        this.headJoint.rotation = 0;
      }
    }

    // 2. Idle breathing animation (natural 60 FPS sine wave)
    const breath = Math.sin(this.animTime * 3.2) * 0.9;
    this.torsoJoint.y = breath;

    // 3. Flag waving in wind (authentic GunBound flagpole sway + cloth undulation)
    this.flagSprite.skew.y = Math.sin(this.animTime * 5.0) * 0.06;
    this.flagSprite.rotation = Math.sin(this.animTime * 3.5) * 0.03;

    // 4. Pet shoulder companion breathing
    this.petSprite.y = Math.sin(this.animTime * 4.8 + 1.2) * 0.6;

    // 5. Look-around head turn cycle (authentic GunBound: turns to face player with both eyes)
    if (this.damageFlashTimer <= 0) {
      this.turnTimer += dtSec;
      if (!this.isTurningHead && this.turnTimer >= this.turnNextTrigger) {
        this.isTurningHead = true;
        this.turnProgress = 0;
        this.turnNextTrigger = 3.5 + Math.random() * 4.5;
        this.turnTargetAngle = (Math.random() > 0.5 ? 1 : -1) * 0.04; // subtle ±2.3 degrees tilt

        // Switch to front turn texture looking at player
        if (this.faceTurnTexture) {
          this.faceSprite.texture = this.faceTurnTexture;
          this.eyesSprite.visible = false;
        }
      }

      if (this.isTurningHead) {
        this.turnProgress += dtSec * 2.2; // ~1.4s look-around duration
        if (this.turnProgress >= Math.PI) {
          this.isTurningHead = false;
          this.headJoint.rotation = 0;
          this.turnTimer = 0;

          // Return to side profile with single eye visible
          if (this.faceDefaultTexture) {
            this.faceSprite.texture = this.faceDefaultTexture;
          }
          this.eyesSprite.visible = true;
        } else {
          // Smooth sine curve: rotates out, looks at player, and returns smoothly to profile
          this.headJoint.rotation = Math.sin(this.turnProgress) * this.turnTargetAngle;
        }
      }
    }

    // 6. Eye blinking cycle
    this.blinkTimer += dtSec;
    if (!this.isBlinking && this.blinkTimer >= this.blinkNextTrigger) {
      this.isBlinking = true;
      this.blinkTimer = 0;
      this.blinkNextTrigger = 2.8 + Math.random() * 3.5;
      if (this.eyesClosedTexture) {
        this.eyesSprite.texture = this.eyesClosedTexture;
      }
    } else if (this.isBlinking && this.blinkTimer >= 0.12) {
      // 120ms blink duration
      this.isBlinking = false;
      this.blinkTimer = 0;
      if (this.eyesOpenTexture) {
        this.eyesSprite.texture = this.eyesOpenTexture;
      }
    }
  }
}
