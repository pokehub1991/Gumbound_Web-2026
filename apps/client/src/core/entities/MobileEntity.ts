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

    // Nickname Label
    const textStyle = new TextStyle({
      fontFamily: "Inter, Roboto, Arial, sans-serif",
      fontSize: 11,
      fontWeight: "bold",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
    });
    this.nameText = new Text({ text: this.nickname, style: textStyle });
    this.nameText.anchor.set(0.5, 0);
    this.nameText.y = 22;

    // Protractor is rendered behind the mobile tank and avatar driver so it never covers them
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
    const arrowLen = 47;
    const headLen = 10;
    const headWidth = 6;

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

    // Protractor tilts with tank body on slopes and anchors forward at the cannon pivot
    this.aimContainer.rotation = this.slopeAngle;
    this.aimContainer.position.set(this.facing === 1 ? 16 : -16, -16);

    // 1. Forward-half translucent white/ivory disc with smooth fade towards the rear (Image 1 reference)
    const forwardBase = this.facing === 1 ? 0 : Math.PI;
    const segmentCount = 20;
    const startOffset = -Math.PI / 2 - 0.15;
    const endOffset = Math.PI / 2 + 0.15;
    const step = (endOffset - startOffset) / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
      const a0 = forwardBase + startOffset + i * step;
      const a1 = a0 + step;
      const midRel = startOffset + (i + 0.5) * step;
      const forwardAlign = Math.cos(midRel); // 1.0 at center forward, 0 at top/bottom edges
      if (forwardAlign > 0.01) {
        const sliceAlpha = Math.min(0.25, Math.pow(forwardAlign, 0.65) * 0.22);
        this.aimArrowGraphics.beginPath();
        this.aimArrowGraphics.moveTo(0, 0);
        this.aimArrowGraphics.arc(0, 0, gaugeRadius, a0, a1);
        this.aimArrowGraphics.closePath();
        this.aimArrowGraphics.fill({ color: 0xffffff, alpha: sliceAlpha });
      }
    }

    // 2. Subtle 1px circular contour on forward arc
    this.aimArrowGraphics.beginPath();
    this.aimArrowGraphics.arc(0, 0, gaugeRadius, forwardBase - Math.PI / 2 - 0.1, forwardBase + Math.PI / 2 + 0.1);
    this.aimArrowGraphics.stroke({ width: 1.0, color: 0x334155, alpha: 0.35 });

    // 3. Subtle radial tick guidelines at 0°, 30°, 60°, 90°
    const ticks = [0, 30, 60, 90];
    for (const deg of ticks) {
      const tRad = this.facing === 1 ? -(deg * Math.PI) / 180 : -((180 - deg) * Math.PI) / 180;
      this.aimArrowGraphics.moveTo(0, 0);
      this.aimArrowGraphics.lineTo(Math.cos(tRad) * gaugeRadius, Math.sin(tRad) * gaugeRadius);
      this.aimArrowGraphics.stroke({ width: 1.0, color: 0x475569, alpha: 0.22 });
    }

    // 4. Valid Angle Sector Wedge (Bright GunBound Green from minAngle to maxAngle)
    const arcStart = Math.min(minRad, maxRad);
    const arcEnd = Math.max(minRad, maxRad);

    this.aimArrowGraphics.beginPath();
    this.aimArrowGraphics.moveTo(0, 0);
    this.aimArrowGraphics.arc(0, 0, gaugeRadius, arcStart, arcEnd);
    this.aimArrowGraphics.closePath();
    this.aimArrowGraphics.fill({ color: 0x22c55e, alpha: 0.82 });
    this.aimArrowGraphics.stroke({ width: 1.0, color: 0x15803d, alpha: 0.9 });

    // 5. Active Pointer Needle (Sleek Red Needle with Arrowhead)
    const needleEndX = Math.cos(rotRad) * arrowLen;
    const needleEndY = Math.sin(rotRad) * arrowLen;
    const shaftEndX = Math.cos(rotRad) * (arrowLen - headLen);
    const shaftEndY = Math.sin(rotRad) * (arrowLen - headLen);

    // Needle shadow
    this.aimArrowGraphics.moveTo(0, 0);
    this.aimArrowGraphics.lineTo(shaftEndX, shaftEndY);
    this.aimArrowGraphics.stroke({ width: 3.5, color: 0x000000, alpha: 0.45 });

    // Needle shaft
    this.aimArrowGraphics.moveTo(0, 0);
    this.aimArrowGraphics.lineTo(shaftEndX, shaftEndY);
    this.aimArrowGraphics.stroke({ width: 2.2, color: 0xef4444, alpha: 1.0 });

    // Arrowhead Triangle
    const perpX = -Math.sin(rotRad) * headWidth;
    const perpY = Math.cos(rotRad) * headWidth;

    this.aimArrowGraphics.poly([
      needleEndX, needleEndY,
      shaftEndX + perpX, shaftEndY + perpY,
      shaftEndX - perpX, shaftEndY - perpY,
    ]);
    this.aimArrowGraphics.fill({ color: 0xef4444, alpha: 1.0 });
    this.aimArrowGraphics.stroke({ width: 1.0, color: 0x991b1b, alpha: 0.95 });

    // Center pivot dot
    this.aimArrowGraphics.circle(0, 0, 3.0).fill(0x1e293b);
    this.aimArrowGraphics.circle(0, 0, 1.5).fill(0xffffff);

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
    popup.y = -50;
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
    const w = 46;
    const h = 5;
    const x = -w / 2;
    const y = 14;

    // Dark backdrop
    this.hpBarGraphics.roundRect(x, y, w, h, 2).fill(0x0a0f1d);

    // Dynamic HP fill
    const pct = this.hp / this.maxHp;
    const fillColor = pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xeab308 : 0xef4444;
    this.hpBarGraphics.roundRect(x + 1, y + 1, (w - 2) * pct, h - 2, 1).fill(fillColor);
  }

  public getMuzzlePosition(): { x: number; y: number } {
    const rad = (this.angleDeg * Math.PI) / 180;
    const barrelLength = 34;
    const offsetX = Math.cos(rad) * barrelLength * this.facing;
    const offsetY = -Math.sin(rad) * barrelLength - 8;
    return {
      x: this.x + offsetX,
      y: this.y + offsetY,
    };
  }
}
