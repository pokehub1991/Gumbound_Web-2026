import { Container, Sprite, Texture } from "pixi.js";
import {
  AvatarSlotKey,
  AvatarEquipment,
  AVATAR_ANCHORS,
  DEFAULT_AVATAR_EQUIPMENT,
  PET_REGISTRY,
  PetConfig,
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
  private petConfig: PetConfig | null = null;

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

    if (this.equipment.pet) {
      this.petConfig = PET_REGISTRY[this.equipment.pet] ?? null;
    }

    // 1. Joint hierarchy
    this.torsoJoint = new Container();
    this.neckJoint = new Container();
    this.headJoint = new Container();

    const neckOffset = AVATAR_ANCHORS.neckOffset[this.gender] ?? AVATAR_ANCHORS.neckOffset.male;
    this.neckJoint.position.set(neckOffset.x, neckOffset.y);
    this.neckJoint.addChild(this.headJoint);
    this.torsoJoint.addChild(this.neckJoint);
    this.addChild(this.torsoJoint);

    // 2. Cosmetic slot sprites with standardized pivots
    this.flagSprite = new Sprite();
    this.flagSprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);

    this.hairBackSprite = new Sprite();
    this.hairBackSprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);
    this.hairBackSprite.position.set(neckOffset.x, 0);

    this.bodySprite = new Sprite();
    this.bodySprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);

    this.faceSprite = new Sprite();
    this.faceSprite.anchor.set(AVATAR_ANCHORS.neck.x, AVATAR_ANCHORS.neck.y);

    this.eyesSprite = new Sprite();
    this.eyesSprite.anchor.set(AVATAR_ANCHORS.neck.x, AVATAR_ANCHORS.neck.y);

    this.helmetSprite = new Sprite();
    this.helmetSprite.anchor.set(AVATAR_ANCHORS.neck.x, AVATAR_ANCHORS.neck.y);

    const initialPetOffset = this.petConfig?.offset ?? AVATAR_ANCHORS.petOffset;
    this.petSprite = new Sprite();
    this.petSprite.anchor.set(AVATAR_ANCHORS.seat.x, AVATAR_ANCHORS.seat.y);
    this.petSprite.position.set(initialPetOffset.x, initialPetOffset.y);

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

    // Foreground over torso: Pet (shoulder, ground, or flying companion)
    this.torsoJoint.addChild(this.petSprite);

    // 4. Initial load
    this.load();
  }

  public async load() {
    try {
      const isFemale = this.gender === "female";
      const faceTurnId = isFemale ? "face_turn_female" : "face_turn";
      const eyesOpenId = this.equipment.eyes ?? (isFemale ? "eyes_open_female" : "eyes_open");
      const eyesClosedId = isFemale ? "eyes_closed_female" : "eyes_closed";

      const [textures, faceTurn, eyesOpen, eyesClosed] = await Promise.all([
        AvatarAssetManager.loadEquipment(this.equipment),
        AvatarAssetManager.loadItemTexture(faceTurnId),
        AvatarAssetManager.loadItemTexture(eyesOpenId),
        AvatarAssetManager.loadItemTexture(eyesClosedId),
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

      if (this.equipment.pet) {
        this.petConfig = PET_REGISTRY[this.equipment.pet] ?? null;
        if (this.petConfig) {
          this.petSprite.position.set(this.petConfig.offset.x, this.petConfig.offset.y);
        }
      }
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
    const neckOffset = AVATAR_ANCHORS.neckOffset[this.gender] ?? AVATAR_ANCHORS.neckOffset.male;
    this.neckJoint.position.set(neckOffset.x, neckOffset.y);
    this.hairBackSprite.position.set(neckOffset.x, 0);
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
      if (slot === "pet") {
        this.petConfig = null;
      }
      return;
    }

    targetSprite.visible = true;
    const tex = await AvatarAssetManager.loadItemTexture(itemId);
    if (tex) {
      targetSprite.texture = tex;
      if (slot === "face") {
        this.faceDefaultTexture = tex;
      } else if (slot === "eyes") {
        this.eyesOpenTexture = tex;
      } else if (slot === "pet") {
        this.petConfig = PET_REGISTRY[itemId] ?? {
          id: itemId,
          name: itemId,
          category: "shoulder",
          offset: AVATAR_ANCHORS.petOffset,
        };
        targetSprite.position.set(this.petConfig.offset.x, this.petConfig.offset.y);
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

    // 2. Idle breathing animation (authentic GunBound horizontal sway)
    // Synchronized with mobile's gentle idle cadence (~3.14 rad/s)
    const breath = Math.sin(this.animTime * 3.14);
    // Torso has subtle horizontal breathing (0.35px) with no vertical jump
    this.torsoJoint.x = breath * 0.35;
    this.torsoJoint.y = 0;

    // Head breathing: more pronounced horizontal breathing sway (0.9px)
    if (!this.isTurningHead) {
      this.headJoint.x = breath * 0.9;
      this.headJoint.rotation = breath * 0.015;
    }

    // 3. Flag waving in wind (authentic GunBound flagpole sway + cloth undulation)
    if (this.flagSprite.visible) {
      this.flagSprite.skew.y = Math.sin(this.animTime * 4.8) * 0.05;
      this.flagSprite.rotation = Math.sin(this.animTime * 3.2) * 0.025;
    }

    // 4. Pet animation based on Category (Shoulder, Ground, Flying)
    if (this.petSprite.visible && this.petConfig) {
      const category = this.petConfig.category;
      const baseOffset = this.petConfig.offset;
      const speed = this.petConfig.swaySpeed ?? 4.0;
      const ampX = this.petConfig.swayAmplitude?.x ?? 0.4;
      const ampY = this.petConfig.swayAmplitude?.y ?? 0.4;

      if (category === "shoulder") {
        // Sits on shoulder: sways with rider torso breathing + subtle wing/body bob
        this.petSprite.x = baseOffset.x + breath * 0.4;
        this.petSprite.y = baseOffset.y + Math.sin(this.animTime * speed) * ampY;
      } else if (category === "ground") {
        // Ground walker: trots/stands in front of mobile with energetic bounce
        this.petSprite.x = baseOffset.x + Math.sin(this.animTime * speed) * ampX;
        this.petSprite.y = baseOffset.y + Math.abs(Math.sin(this.animTime * speed)) * ampY;
      } else if (category === "flying") {
        // Flying/Hovering: smooth figure-8 floating orbit above rider's head
        this.petSprite.x = baseOffset.x + Math.sin(this.animTime * speed) * ampX;
        this.petSprite.y = baseOffset.y + Math.cos(this.animTime * speed * 1.5) * ampY;
      }
    }

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
          this.headJoint.x = 0;
          this.turnTimer = 0;

          // Return to side profile with single eye visible
          if (this.faceDefaultTexture) {
            this.faceSprite.texture = this.faceDefaultTexture;
          }
          this.eyesSprite.visible = true;
        } else {
          // Smooth sine curve: rotates out, looks at player, and returns smoothly to profile
          this.headJoint.rotation = Math.sin(this.turnProgress) * this.turnTargetAngle;
          this.headJoint.x = (1 - Math.sin(this.turnProgress)) * (breath * 0.9);
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
