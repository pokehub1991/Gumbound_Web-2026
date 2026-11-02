import { AnimatedSprite, Container, Graphics, Text, TextStyle } from "pixi.js";
import { MobileSpriteManager, MobileAnimationTextures } from "../animation/MobileSpriteManager.js";
import { MOBILES_DATA } from "../constants/mobiles.js";

export interface MobileEntityConfig {
  id: string;
  nickname: string;
  team: string; // "A" | "B"
  mobileType: number;
  maxHp?: number;
  hp?: number;
  x: number;
  y: number;
}

interface DamageSmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: number;
  isSpark?: boolean;
}

export class MobileEntity extends Container {
  public readonly id: string;
  public nickname: string;
  public team: string;
  public mobileType: number;
  public maxHp: number;
  public hp: number;

  public facing: number = 1; // 1 = right, -1 = left
  public angleDeg: number = 45;
  public slopeAngle: number = 0;

  private spriteContainer: Container;
  private animSprite?: AnimatedSprite;
  private animTextures?: MobileAnimationTextures;
  private currentAnimName: string = "normal";

  private fallbackBody: Graphics;
  public aimContainer: Container;
  private aimArrowGraphics: Graphics;
  private aimAngleText: Text;
  private hpBarGraphics: Graphics;
  private nameText: Text;

  // Damaged vehicle breakdown smoke & spark particles
  private smokeContainer: Container;
  private smokeGraphics: Graphics;
  private smokeParticles: DamageSmokeParticle[] = [];
  private smokeTimer: number = 0;

  constructor(config: MobileEntityConfig) {
    super();
    this.id = config.id;
    this.nickname = config.nickname;
    this.team = config.team;
    this.mobileType = config.mobileType;

    this.maxHp = config.maxHp ?? 1000;
    this.hp = config.hp ?? this.maxHp;

    this.x = config.x;
    this.y = config.y;

    this.spriteContainer = new Container();
    this.fallbackBody = new Graphics();
    this.hpBarGraphics = new Graphics();
    this.smokeContainer = new Container();
    this.smokeGraphics = new Graphics();
    this.smokeContainer.addChild(this.smokeGraphics);

    const teamColor = this.team === "A" ? 0x38bdf8 : 0xef4444;

    // Fallback tank body while textures load
    this.fallbackBody.roundRect(-22, -14, 44, 22, 4);
    this.fallbackBody.fill(0x334155);
    this.fallbackBody.stroke({ width: 2, color: teamColor });
    this.fallbackBody.roundRect(-24, 6, 48, 8, 3).fill(0x0f172a);

    // Authentic GunBound Aim Pointer Reticle & Angle Display
    this.aimContainer = new Container();
    this.aimContainer.y = -18;
    this.aimArrowGraphics = new Graphics();
    this.aimAngleText = new Text({
      text: `${this.angleDeg}°`,
      style: new TextStyle({
        fontFamily: "Inter, Roboto, Arial, sans-serif",
        fontSize: 12,
        fontWeight: "900",
        fill: "#ffffff",
        stroke: { color: "#000000", width: 3 },
      }),
    });
    this.aimAngleText.anchor.set(0.5, 0.5);

    this.aimContainer.addChild(this.aimArrowGraphics);
    this.aimContainer.addChild(this.aimAngleText);

    // HP Bar placed fixed below mobile treads (horizontal, never tilted with slope)
    this.hpBarGraphics.y = 14;

    // Nickname Label - positioned below HP bar underneath the mobile (GunBound retro comic style)
    const textStyle = new TextStyle({
      fontFamily: "Inter, Roboto, Arial, sans-serif",
      fontSize: 11,
      fontWeight: "bold",
      fill: "#ffedd5",
      stroke: { color: "#000000", width: 3 },
    });
    this.nameText = new Text({ text: this.nickname, style: textStyle });
    this.nameText.anchor.set(0.5, 0);
    this.nameText.y = 22;

    // Crucial: smokeContainer is placed at index 0 behind the mobile body and wheels
    this.addChild(this.smokeContainer);
    this.addChild(this.aimContainer);
    this.addChild(this.fallbackBody);
    this.addChild(this.spriteContainer);
    this.addChild(this.hpBarGraphics);
    this.addChild(this.nameText);

    this.updateHpBar();
    this.updateAimPointer();

    // Load authentic mobile EPA spritesheet
    this.loadSprite();
  }

  public async loadSprite() {
    try {
      const textures = await MobileSpriteManager.loadMobileTextures(this.mobileType);
      this.animTextures = textures;

      // Hide fallback body once authentic sprite textures are available
      this.fallbackBody.visible = false;

      if (this.animSprite) {
        this.spriteContainer.removeChild(this.animSprite);
        this.animSprite.destroy();
      }

      const initialFrames = textures.animations["normal"] || Object.values(textures.animations)[0];
      this.animSprite = new AnimatedSprite(initialFrames);
      this.animSprite.animationSpeed = 0.35; // Authentic ~20 FPS breathing animation
      this.animSprite.anchor.set(textures.primaryAnchor.x, textures.primaryAnchor.y);
      this.animSprite.play();

      this.spriteContainer.addChild(this.animSprite);
      this.setFacing(this.facing);
      this.setTilt(this.slopeAngle);
    } catch (err) {
      console.warn(`[MobileEntity] Error loading sprite for mobile ${this.mobileType}:`, err);
    }
  }

  public setTilt(rad: number) {
    this.slopeAngle = rad;
    this.spriteContainer.rotation = rad;
    this.fallbackBody.rotation = rad;
    this.aimContainer.rotation = rad;
    this.updateAimPointer();
  }

  public setFacing(dir: number) {
    this.facing = dir >= 0 ? 1 : -1;
    // GunBound spritesheets face LEFT natively.
    // Facing RIGHT (+1): scale.x = -1. Facing LEFT (-1): scale.x = 1.
    const baseScale = 1.25;
    this.spriteContainer.scale.set(-this.facing * baseScale, baseScale);
    this.fallbackBody.scale.set(this.facing * baseScale, baseScale);
    this.updateAimPointer();
  }

  public setAngle(deg: number) {
    const data = MOBILES_DATA[this.mobileType] || MOBILES_DATA[0];
    const min = data.minAngle ?? data.minang ?? 10;
    const max = data.maxAngle ?? data.maxang ?? 55;
    this.angleDeg = Math.max(min, Math.min(max, deg));
    this.updateAimPointer();
  }

  public updateAimPointer() {
    this.aimArrowGraphics.clear();

    const data = MOBILES_DATA[this.mobileType] || MOBILES_DATA[0];
    const minAng = data.minAngle ?? data.minang ?? 10;
    const maxAng = data.maxAngle ?? data.maxang ?? 55;

    // Authentic GunBound Aiming Protractor Gauge (Radius 48px, attached to mobile tilt)
    const gaugeRadius = 48;

    let rotRad: number;
    let minRad: number;
    let maxRad: number;

    if (this.facing === 1) {
      rotRad = -(this.angleDeg * Math.PI) / 180;
      minRad = -(minAng * Math.PI) / 180;
      maxRad = -(maxAng * Math.PI) / 180;
    } else {
      rotRad = -((180 - this.angleDeg) * Math.PI) / 180;
      minRad = -((180 - minAng) * Math.PI) / 180;
      maxRad = -((180 - maxAng) * Math.PI) / 180;
    }

    // Protractor tilts with tank body on slopes and anchors precisely at mobile's nose/muzzle
    this.aimContainer.rotation = this.slopeAngle;
    const cosS = Math.cos(this.slopeAngle);
    const sinS = Math.sin(this.slopeAngle);
    const localMountX = this.facing * 20;
    const localMountY = -22;
    const noseX = localMountX * cosS - localMountY * sinS;
    const noseY = localMountX * sinS + localMountY * cosS;
    this.aimContainer.position.set(noseX, noseY);

    // Forward-half angle bounds (rear half remains 100% transparent so mobile body is fully visible)
    const forwardBase = this.facing === 1 ? 0 : Math.PI;
    const semiStart = forwardBase - Math.PI / 2;
    const semiEnd = forwardBase + Math.PI / 2;

    // 1. Forward-Half Translucent White Disc
    this.aimArrowGraphics.beginPath();
    this.aimArrowGraphics.arc(0, 0, gaugeRadius, semiStart, semiEnd);
    this.aimArrowGraphics.lineTo(0, 0);
    this.aimArrowGraphics.closePath();
    this.aimArrowGraphics.fill({ color: 0xffffff, alpha: 0.24 });
    this.aimArrowGraphics.stroke({ width: 1.0, color: 0xffffff, alpha: 0.45 });

    // Subtle inner concentric ring guideline on forward half
    this.aimArrowGraphics.beginPath();
    this.aimArrowGraphics.arc(0, 0, 24, semiStart, semiEnd);
    this.aimArrowGraphics.stroke({ width: 0.8, color: 0xffffff, alpha: 0.25 });

    // Subtle radial tick guidelines at 0°, 30°, 60°, 90°
    const ticks = [0, 30, 60, 90];
    for (const deg of ticks) {
      const tRad = this.facing === 1 ? -(deg * Math.PI) / 180 : -((180 - deg) * Math.PI) / 180;
      this.aimArrowGraphics.moveTo(0, 0);
      this.aimArrowGraphics.lineTo(Math.cos(tRad) * gaugeRadius, Math.sin(tRad) * gaugeRadius);
      this.aimArrowGraphics.stroke({ width: 0.8, color: 0xffffff, alpha: 0.32 });
    }

    // 2. Valid Angle Sector Wedge (Luminous GunBound Green arc band from minAngle to maxAngle - Image 4 reference)
    const arcStart = Math.min(minRad, maxRad);
    const arcEnd = Math.max(minRad, maxRad);
    const innerR = 24;
    const outerR = 52;

    this.aimArrowGraphics.beginPath();
    this.aimArrowGraphics.moveTo(Math.cos(arcStart) * innerR, Math.sin(arcStart) * innerR);
    this.aimArrowGraphics.arc(0, 0, outerR, arcStart, arcEnd);
    this.aimArrowGraphics.lineTo(Math.cos(arcEnd) * innerR, Math.sin(arcEnd) * innerR);
    this.aimArrowGraphics.arc(0, 0, innerR, arcEnd, arcStart, true);
    this.aimArrowGraphics.closePath();
    this.aimArrowGraphics.fill({ color: 0x22c55e, alpha: 0.58 });
    this.aimArrowGraphics.stroke({ width: 1.0, color: 0x15803d, alpha: 0.85 });

    // 3. Active Pointer Needle (Sleek tapered red needle matching GunBound reference)
    // Tapers from 3.2px base at inner radius (12) to a sharp 1.2px tip at radius 50
    const tipR = 50;
    const baseR = 12;
    const baseHalfW = 1.6;
    const tipHalfW = 0.6;

    const tipMidX = Math.cos(rotRad) * tipR;
    const tipMidY = Math.sin(rotRad) * tipR;
    const baseMidX = Math.cos(rotRad) * baseR;
    const baseMidY = Math.sin(rotRad) * baseR;
    const perpBaseX = -Math.sin(rotRad) * baseHalfW;
    const perpBaseY = Math.cos(rotRad) * baseHalfW;
    const perpTipX = -Math.sin(rotRad) * tipHalfW;
    const perpTipY = Math.cos(rotRad) * tipHalfW;

    // Subtle needle drop shadow
    const shadowOffset = 1.0;
    this.aimArrowGraphics.poly([
      tipMidX + perpTipX + shadowOffset, tipMidY + perpTipY + shadowOffset,
      tipMidX - perpTipX + shadowOffset, tipMidY - perpTipY + shadowOffset,
      baseMidX - perpBaseX + shadowOffset, baseMidY - perpBaseY + shadowOffset,
      baseMidX + perpBaseX + shadowOffset, baseMidY + perpBaseY + shadowOffset,
    ]);
    this.aimArrowGraphics.fill({ color: 0x000000, alpha: 0.35 });

    // Vibrant Red Tapered Needle (Image 4 reference)
    this.aimArrowGraphics.poly([
      tipMidX + perpTipX, tipMidY + perpTipY,
      tipMidX - perpTipX, tipMidY - perpTipY,
      baseMidX - perpBaseX, baseMidY - perpBaseY,
      baseMidX + perpBaseX, baseMidY + perpBaseY,
    ]);
    this.aimArrowGraphics.fill({ color: 0xef4444, alpha: 1.0 });
    this.aimArrowGraphics.stroke({ width: 0.8, color: 0x7f1d1d, alpha: 0.95 });

    // Center pivot removed to ensure no dot or white mark appears in the protractor center
    // Hide angle degree text & badge above mobile as requested (angle is displayed in HUD)
    this.aimAngleText.visible = false;
  }

  public setMobileType(newType: number) {
    if (this.mobileType === newType) return;
    this.mobileType = newType;
    if (this.animSprite) {
      this.spriteContainer.removeChild(this.animSprite);
      this.animSprite.destroy();
      this.animSprite = undefined;
    }
    this.animTextures = undefined;
    this.fallbackBody.visible = true;
    this.loadSprite();

    // Clamp angle to new mobile limits
    const data = MOBILES_DATA[newType] || MOBILES_DATA[0];
    const min = data.minAngle ?? data.minang ?? 10;
    const max = data.maxAngle ?? data.maxang ?? 55;
    this.setAngle(Math.max(min, Math.min(max, this.angleDeg)));
  }

  public playAnimation(name: string, loop: boolean = true, onComplete?: () => void) {
    if (!this.animSprite || !this.animTextures) return;

    // Authentic breathing idle: prefer "wnormal" over static "normal"
    let animKey = name;
    if (name === "normal" && this.animTextures.animations["wnormal"]) {
      animKey = "wnormal";
    }

    if (this.currentAnimName === animKey && this.animSprite.playing) return;

    const frames = this.animTextures.animations[animKey] || this.animTextures.animations["normal"];
    if (!frames || frames.length === 0) return;

    this.currentAnimName = animKey;
    this.animSprite.textures = frames;
    this.animSprite.loop = loop;

    // Dynamically adjust anchor per frame so frames never jump or skip
    this.animSprite.onFrameChange = (frame) => {
      const tex = this.animSprite?.textures[frame];
      if (tex && "defaultAnchor" in tex && tex.defaultAnchor) {
        this.animSprite?.anchor.set(tex.defaultAnchor.x, tex.defaultAnchor.y);
      }
    };

    const firstTex = frames[0];
    if (firstTex && "defaultAnchor" in firstTex && firstTex.defaultAnchor) {
      this.animSprite.anchor.set(firstTex.defaultAnchor.x, firstTex.defaultAnchor.y);
    } else if (this.animTextures.anchors && this.animTextures.anchors[animKey]) {
      const a = this.animTextures.anchors[animKey];
      this.animSprite.anchor.set(a.x, a.y);
    } else {
      this.animSprite.anchor.set(this.animTextures.primaryAnchor.x, this.animTextures.primaryAnchor.y);
    }

    // Authentic GunBound framerates (18 FPS = 0.30 on 60fps ticker)
    if (animKey.startsWith("bfire") || animKey.startsWith("bsfire")) {
      this.animSprite.animationSpeed = 0.35; // Power charge vibration
    } else if (animKey === "move" || animKey === "wmove") {
      this.animSprite.animationSpeed = 0.38; // Rapid treads
    } else if (animKey.startsWith("fire") || animKey.startsWith("sfire")) {
      this.animSprite.animationSpeed = 0.30; // Recoil burst (18 FPS)
    } else if (animKey.includes("damage")) {
      this.animSprite.animationSpeed = 0.30; // Hit reaction
    } else if (animKey === "dead") {
      this.animSprite.animationSpeed = 0.25;
    } else if (animKey === "wnormal") {
      this.animSprite.animationSpeed = 0.22; // Authentic gentle breathing cycle
    } else {
      this.animSprite.animationSpeed = 0.30;
    }

    this.animSprite.gotoAndPlay(0);

    if (!loop) {
      this.animSprite.onComplete = () => {
        if (onComplete) onComplete();
        else if (animKey !== "dead") {
          this.playAnimation("normal");
        }
      };
    } else {
      this.animSprite.onComplete = undefined;
    }
  }

  public setHp(hp: number) {
    const prevHp = this.hp;
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.updateHpBar();

    if (this.hp === 0) {
      this.playAnimation("dead", false);
      this.alpha = 0.65;
    } else if (this.hp < prevHp) {
      this.showDamagePopup(prevHp - this.hp);
      this.playAnimation("fdamage", false);
    }
  }

  public showDamagePopup(damage: number) {
    if (damage <= 0) return;
    const style = new TextStyle({
      fontFamily: "Impact, Arial Black, sans-serif",
      fontSize: 22,
      fontWeight: "bold",
      fill: damage >= 300 ? "#ff2a5f" : "#fbbf24",
      stroke: { color: "#000000", width: 4 },
    });
    const popup = new Text({ text: `-${damage}`, style });
    popup.anchor.set(0.5, 0.5);
    popup.y = -75;
    this.addChild(popup);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 16;
      popup.y -= 1.1;
      popup.alpha = Math.max(0, 1.0 - elapsed / 1000);
      if (elapsed >= 1000) {
        clearInterval(interval);
        this.removeChild(popup);
        popup.destroy();
      }
    }, 16);
  }

  public updateHpBar() {
    this.hpBarGraphics.clear();
    const w = 52;
    const h = 6;
    const x = -w / 2;
    const y = 0; // Relative to hpBarGraphics which is anchored at y = 14 below treads

    // Dark backdrop with crisp 1.2px solid white border (Image 4 reference)
    this.hpBarGraphics.rect(x, y, w, h).fill(0x0a0f1d);
    this.hpBarGraphics.rect(x, y, w, h).stroke({ width: 1.2, color: 0xffffff, alpha: 0.95 });

    // Dynamic HP fill
    const pct = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    const fillColor = pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfacc15 : 0xef4444;
    if (pct > 0) {
      this.hpBarGraphics.rect(x + 1, y + 1, Math.max(1, (w - 2) * pct), h - 2).fill(fillColor);
    }
  }

  public getMuzzlePosition(): { x: number; y: number } {
    const cosS = Math.cos(this.slopeAngle);
    const sinS = Math.sin(this.slopeAngle);
    const localMountX = this.facing * 20;
    const localMountY = -22;
    const noseX = localMountX * cosS - localMountY * sinS;
    const noseY = localMountX * sinS + localMountY * cosS;

    const rad = this.facing === 1
      ? -(this.angleDeg * Math.PI) / 180 + this.slopeAngle
      : -((180 - this.angleDeg) * Math.PI) / 180 + this.slopeAngle;
    const barrelLength = 16;
    return {
      x: this.x + noseX + Math.cos(rad) * barrelLength,
      y: this.y + noseY + Math.sin(rad) * barrelLength,
    };
  }

  /**
   * Update subtle damage breakdown smoke particles emitted behind vehicle when HP is low.
   */
  public update(dt: number) {
    const isDamaged = this.hp < this.maxHp * 0.45;
    const isCritical = this.hp < this.maxHp * 0.20;

    if (isDamaged && this.hp > 0) {
      this.smokeTimer += dt;
      const spawnInterval = isCritical ? 5 : 10;

      if (this.smokeTimer >= spawnInterval) {
        this.smokeTimer = 0;

        // Exhaust point at the rear of the tank, rotated with terrain slope
        const cosS = Math.cos(this.slopeAngle);
        const sinS = Math.sin(this.slopeAngle);
        const rearLocalX = -this.facing * (14 + Math.random() * 4);
        const rearLocalY = -8 + (Math.random() - 0.5) * 4;
        const spawnX = rearLocalX * cosS - rearLocalY * sinS;
        const spawnY = rearLocalX * sinS + rearLocalY * cosS;

        // Subtle smoke puff
        const color = isCritical
          ? Math.random() < 0.25
            ? 0xf59e0b // Occasional spark ember
            : 0x1e293b // Dark breakdown smoke
          : 0x64748b; // Wispy gray smoke

        const isSpark = color === 0xf59e0b;

        this.smokeParticles.push({
          x: spawnX,
          y: spawnY,
          vx: -this.facing * (0.2 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.2,
          vy: -(0.5 + Math.random() * 0.6),
          radius: isSpark ? 1.5 : 3.5 + Math.random() * 2,
          alpha: isSpark ? 0.9 : 0.38,
          color,
          isSpark,
        });
      }
    }

    // Step active smoke particles
    if (this.smokeParticles.length > 0) {
      this.smokeGraphics.clear();

      for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
        const p = this.smokeParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 0.008 * dt; // gentle rise

        if (p.isSpark) {
          p.alpha -= 0.035 * dt;
          p.radius = Math.max(0.5, p.radius - 0.02 * dt);
        } else {
          p.alpha -= 0.010 * dt; // soft, subtle fading
          p.radius += 0.14 * dt;  // gentle puff expansion
        }

        if (p.alpha <= 0.01) {
          this.smokeParticles.splice(i, 1);
          continue;
        }

        this.smokeGraphics.circle(p.x, p.y, p.radius);
        this.smokeGraphics.fill({ color: p.color, alpha: Math.max(0, p.alpha) });
      }
    } else {
      this.smokeGraphics.clear();
    }
  }
}
