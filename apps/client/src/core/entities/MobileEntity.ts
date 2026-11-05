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
  ax?: number;
  ay?: number;
  radius: number;
  growthRate: number;
  alpha: number;
  fadeRate: number;
  color: number;
  isSpark?: boolean;
  turbulence?: number;
  life: number;
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
  private sparkTimer: number = 0;

  // Floating Chat Bubble / Cloud
  private chatBubbleContainer?: Container;
  private chatBubbleTimeout?: number;
  public activeFontFamily: string = "Silkscreen";

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
        fontFamily: ["Silkscreen", "GameFont", "Arial"],
        fontSize: 11,
        fontWeight: "900",
        fill: "#ffffff",
        stroke: { color: "#000000", width: 3 },
      }),
    });
    this.aimAngleText.anchor.set(0.5, 0.5);

    this.aimContainer.addChild(this.aimArrowGraphics);
    this.aimContainer.addChild(this.aimAngleText);

    // HP Bar placed fixed below mobile treads (horizontal, never tilted with slope)
    this.hpBarGraphics.y = 10;

    // Nickname Label - positioned below HP bar underneath the mobile (GunBound retro comic style)
    const textStyle = new TextStyle({
      fontFamily: ["Silkscreen", "GameFont", "Arial"],
      fontSize: 11,
      fontWeight: "bold",
      fill: config.team === "A" ? "#f59e0b" : "#38bdf8",
      stroke: { color: "#000000", width: 3 },
    });
    const rankIcon = config.team === "A" ? "🐣" : "🔨";
    this.nameText = new Text({ text: `[${rankIcon}] ${this.nickname}`, style: textStyle });
    this.nameText.anchor.set(0.5, 0);
    this.nameText.y = 19;

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

  public updateFontFamily(fontName: string) {
    this.activeFontFamily = fontName;
    if (this.nameText) {
      this.nameText.style.fontFamily = [fontName, "Silkscreen", "EditUndo", "Pixeboy", "Arial"];
    }
    if (this.aimAngleText) {
      this.aimAngleText.style.fontFamily = [fontName, "Silkscreen", "EditUndo", "Pixeboy", "Arial"];
    }
  }

  public setNickname(name: string, team?: "A" | "B") {
    this.nickname = name;
    if (team) this.team = team;
    const rankIcon = this.team === "A" ? "🐣" : "🔨";
    this.nameText.text = `[${rankIcon}] ${this.nickname}`;
    this.nameText.style.fill = this.team === "A" ? "#f59e0b" : "#38bdf8";
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

  /**
   * GunBound Authentic True Aim Angle (Ángulo Real respecto al horizonte):
   * Calculates the real ballistic firing angle relative to the horizontal world plane,
   * factoring in terrain ground slope and facing direction.
   */
  public getTrueAimAngle(): number {
    const slopeDeg = (this.slopeAngle * 180) / Math.PI;
    const tiltDeg = this.facing === 1 ? -slopeDeg : slopeDeg;
    return Math.round(this.angleDeg + tiltDeg);
  }

  public updateAimPointer() {
    this.aimArrowGraphics.clear();

    const data = MOBILES_DATA[this.mobileType] || MOBILES_DATA[0];
    const minAng = data.minAngle ?? data.minang ?? 10;
    const maxAng = data.maxAngle ?? data.maxang ?? 55;

    // Authentic GunBound Aiming Protractor Gauge (Radius 48px, concentric with green gauge)
    const gaugeRadius = 48;
    const innerRadius = 22;

    // In GunBound, the protractor is strictly horizontal to the horizon (rotation = 0).
    // The mobile's tilt on ground slopes shifts the allowable firing arc (green sector) and needle
    // relative to the horizontal world coordinate frame.
    const slopeDeg = (this.slopeAngle * 180) / Math.PI;
    const tiltDeg = this.facing === 1 ? -slopeDeg : slopeDeg;

    const trueMinDeg = minAng + tiltDeg;
    const trueMaxDeg = maxAng + tiltDeg;
    const trueNeedleDeg = this.angleDeg + tiltDeg;

    let rotRad: number;
    let minRad: number;
    let maxRad: number;

    if (this.facing === 1) {
      rotRad = -(trueNeedleDeg * Math.PI) / 180;
      minRad = -(trueMinDeg * Math.PI) / 180;
      maxRad = -(trueMaxDeg * Math.PI) / 180;
    } else {
      rotRad = -((180 - trueNeedleDeg) * Math.PI) / 180;
      minRad = -((180 - trueMinDeg) * Math.PI) / 180;
      maxRad = -((180 - trueMaxDeg) * Math.PI) / 180;
    }

    // Protractor stays horizontal (level with the horizon) and anchors at mobile's cannon/nose mount
    this.aimContainer.rotation = 0;
    const cosS = Math.cos(this.slopeAngle);
    const sinS = Math.sin(this.slopeAngle);
    const localMountX = this.facing * 20;
    const localMountY = -22;
    const noseX = localMountX * cosS - localMountY * sinS;
    const noseY = localMountX * sinS + localMountY * cosS;
    this.aimContainer.position.set(noseX, noseY);

    // 1. White Protractor Disc with long, gentle symmetric fade at both bottom-rear and top-rear
    // Seamlessly spans from -45° to +135° (180° semicircle) with a wide 65° smooth sinusoidal transition at both ends
    const numSlices = 72;
    const minDeg = -45;
    const maxDeg = 135;
    const totalSpan = maxDeg - minDeg;
    const sliceStep = totalSpan / numSlices;

    for (let i = 0; i < numSlices; i++) {
      const startDeg = minDeg + i * sliceStep;
      const endDeg = startDeg + sliceStep;
      const midDeg = (startDeg + endDeg) / 2;

      // Long, gradual cosine transition over 65 degrees:
      // Bottom-rear: -45° to +20° (smooth sinusoidal ease-in)
      // Top-rear: +70° to +135° (smooth sinusoidal ease-out)
      // Forward aiming core (+20° to +70°): 100% full clarity
      let bottomFade = 1.0;
      if (midDeg < 20) {
        const t = Math.max(0, Math.min(1, (midDeg - (-45)) / 65));
        bottomFade = 0.5 - 0.5 * Math.cos(t * Math.PI);
      }

      let topFade = 1.0;
      if (midDeg > 70) {
        const t = Math.max(0, Math.min(1, (135 - midDeg) / 65));
        topFade = 0.5 - 0.5 * Math.cos(t * Math.PI);
      }

      const edgeFade = bottomFade * topFade;
      const fillAlpha = 0.35 * edgeFade;
      const strokeAlpha = 0.45 * edgeFade;

      if (fillAlpha > 0.005) {
        let rad1: number;
        let rad2: number;

        if (this.facing === 1) {
          rad1 = -(endDeg * Math.PI) / 180;
          rad2 = -(startDeg * Math.PI) / 180;
        } else {
          rad1 = -((180 - startDeg) * Math.PI) / 180;
          rad2 = -((180 - endDeg) * Math.PI) / 180;
        }

        // Outer sector band (innerRadius -> gaugeRadius)
        this.aimArrowGraphics.beginPath();
        this.aimArrowGraphics.arc(0, 0, gaugeRadius, rad1, rad2);
        this.aimArrowGraphics.lineTo(Math.cos(rad2) * innerRadius, Math.sin(rad2) * innerRadius);
        this.aimArrowGraphics.arc(0, 0, innerRadius, rad2, rad1, true);
        this.aimArrowGraphics.closePath();
        this.aimArrowGraphics.fill({ color: 0xffffff, alpha: fillAlpha });

        // Outer border arc segment
        this.aimArrowGraphics.beginPath();
        this.aimArrowGraphics.arc(0, 0, gaugeRadius, rad1, rad2);
        this.aimArrowGraphics.stroke({ width: 1.0, color: 0xffffff, alpha: strokeAlpha });

        // Inner concentric guideline arc segment
        this.aimArrowGraphics.beginPath();
        this.aimArrowGraphics.arc(0, 0, innerRadius, rad1, rad2);
        this.aimArrowGraphics.stroke({ width: 0.7, color: 0xffffff, alpha: strokeAlpha * 0.65 });
      }
    }

    // Subtle radial tick guidelines at 0°, 30°, 60°, 90° (Image 1 authentic GunBound crosshairs)
    const ticks = [0, 30, 60, 90];
    for (const deg of ticks) {
      let tickFade = 1.0;
      if (deg < 20) {
        const t = Math.max(0, Math.min(1, (deg - (-45)) / 65));
        tickFade = 0.5 - 0.5 * Math.cos(t * Math.PI);
      } else if (deg > 70) {
        const t = Math.max(0, Math.min(1, (135 - deg) / 65));
        tickFade = 0.5 - 0.5 * Math.cos(t * Math.PI);
      }
      const tRad = this.facing === 1 ? -(deg * Math.PI) / 180 : -((180 - deg) * Math.PI) / 180;
      this.aimArrowGraphics.beginPath();
      this.aimArrowGraphics.moveTo(Math.cos(tRad) * innerRadius, Math.sin(tRad) * innerRadius);
      this.aimArrowGraphics.lineTo(Math.cos(tRad) * gaugeRadius, Math.sin(tRad) * gaugeRadius);
      this.aimArrowGraphics.stroke({ width: 0.85, color: 0xffffff, alpha: 0.45 * tickFade });
    }

    // 2. Valid Angle Sector Wedge (Luminous GunBound Green arc band from minAngle to maxAngle)
    // PERFECTLY ALIGNED with the protractor (same innerRadius 22, same outer gaugeRadius 48)
    const arcStart = Math.min(minRad, maxRad);
    const arcEnd = Math.max(minRad, maxRad);

    this.aimArrowGraphics.beginPath();
    this.aimArrowGraphics.arc(0, 0, gaugeRadius, arcStart, arcEnd);
    this.aimArrowGraphics.lineTo(Math.cos(arcEnd) * innerRadius, Math.sin(arcEnd) * innerRadius);
    this.aimArrowGraphics.arc(0, 0, innerRadius, arcEnd, arcStart, true);
    this.aimArrowGraphics.closePath();
    this.aimArrowGraphics.fill({ color: 0x22c55e, alpha: 0.62 });
    this.aimArrowGraphics.stroke({ width: 1.0, color: 0x15803d, alpha: 0.90 });

    // 3. Active Pointer Needle (Sleek tapered red needle matching GunBound reference)
    // Tapers from 3.0px base at inner radius (10) to a sharp 1.0px tip at radius 46
    const tipR = 46;
    const baseR = 10;
    const baseHalfW = 1.5;
    const tipHalfW = 0.5;

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
      fontFamily: [this.activeFontFamily, "Silkscreen", "EditUndo", "Pixeboy", "sans-serif"],
      fontSize: 20,
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

  /**
   * GunBound Authentic Floating Chat Speech Cloud / Bubble above the mobile
   */
  public showChatBubble(message: string, durationMs: number = 9500) {
    if (!message || message.trim().length === 0) return;

    if (this.chatBubbleTimeout !== undefined) {
      window.clearTimeout(this.chatBubbleTimeout);
      this.chatBubbleTimeout = undefined;
    }

    if (this.chatBubbleContainer) {
      this.removeChild(this.chatBubbleContainer);
      this.chatBubbleContainer.destroy({ children: true });
      this.chatBubbleContainer = undefined;
    }

    const container = new Container();
    this.chatBubbleContainer = container;

    const textStyle = new TextStyle({
      fontFamily: [this.activeFontFamily, "Silkscreen", "EditUndo", "Pixeboy", "sans-serif"],
      fontSize: 10,
      fontWeight: "bold",
      fill: "#000000",
      wordWrap: true,
      wordWrapWidth: 160,
      align: "center",
      lineHeight: 14,
    });

    const textObj = new Text({ text: message.trim(), style: textStyle });
    textObj.anchor.set(0.5, 0.5);

    const paddingX = 10;
    const paddingY = 6;
    const bubbleWidth = Math.max(46, Math.min(180, textObj.width + paddingX * 2));
    const bubbleHeight = textObj.height + paddingY * 2;

    const bubbleGfx = new Graphics();

    // 1. Shadow for 3D retro depth
    bubbleGfx.roundRect(-bubbleWidth / 2 + 1, -bubbleHeight - 8 + 2, bubbleWidth, bubbleHeight, 6);
    bubbleGfx.fill({ color: 0x000000, alpha: 0.35 });

    // 2. White bubble body with 2px solid black border
    bubbleGfx.roundRect(-bubbleWidth / 2, -bubbleHeight - 8, bubbleWidth, bubbleHeight, 5);
    bubbleGfx.fill(0xffffff);
    bubbleGfx.stroke({ width: 2, color: 0x000000 });

    // 3. Pointer tail pointing down toward mobile top
    bubbleGfx.poly([
      { x: -6, y: -8 },
      { x: 6, y: -8 },
      { x: 0, y: -1 },
    ]);
    bubbleGfx.fill(0x000000);

    bubbleGfx.poly([
      { x: -4, y: -9 },
      { x: 4, y: -9 },
      { x: 0, y: -3 },
    ]);
    bubbleGfx.fill(0xffffff);

    // Merge white seam between bubble body and tail
    bubbleGfx.moveTo(-4, -8);
    bubbleGfx.lineTo(4, -8);
    bubbleGfx.stroke({ width: 3, color: 0xffffff });

    textObj.position.set(0, -bubbleHeight / 2 - 8);

    container.addChild(bubbleGfx);
    container.addChild(textObj);

    // Position above mobile body
    container.position.set(0, -42);
    container.alpha = 1.0;

    this.addChild(container);

    // Auto fade-out after durationMs
    this.chatBubbleTimeout = window.setTimeout(() => {
      let fadeElapsed = 0;
      const fadeInterval = setInterval(() => {
        fadeElapsed += 25;
        if (!this.chatBubbleContainer || this.chatBubbleContainer !== container) {
          clearInterval(fadeInterval);
          return;
        }
        container.alpha = Math.max(0, 1.0 - fadeElapsed / 300);
        if (fadeElapsed >= 300) {
          clearInterval(fadeInterval);
          if (this.chatBubbleContainer === container) {
            this.removeChild(container);
            container.destroy({ children: true });
            this.chatBubbleContainer = undefined;
          }
        }
      }, 25);
    }, durationMs);
  }

  public updateHpBar() {
    this.hpBarGraphics.clear();
    const w = 78;
    const h = 5.5;
    const x = -w / 2;
    const y = 0; // Relative to hpBarGraphics which is anchored at y = 10 below treads

    // Dark backdrop with crisp 1.4px solid white border (Image 3 & 4 authentic GunBound reference)
    this.hpBarGraphics.rect(x, y, w, h).fill(0x111827);
    this.hpBarGraphics.rect(x, y, w, h).stroke({ width: 1.4, color: 0xffffff, alpha: 0.95 });

    // Dynamic HP fill
    const pct = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    const fillColor = pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xfacc15 : 0xef4444;
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
   * Dynamic damage smoke & spark breakdown system:
   * 1. Leve (HP 40% - 70%): Slow, gentle puffs of light translucent gray smoke from rear exhaust.
   * 2. Intenso (HP 20% - 40%): Dense dark soot smoke rising fast with occasional glowing embers.
   * 3. Múltiples humos con distintas físicas (HP < 20%):
   *    - Emitter 1 (Exhaust): Thick billowing black plume with rear momentum.
   *    - Emitter 2 (Turret/Chassis): Violent turbulent smoke with fiery sparks and oscillation.
   *    - Emitter 3 (Treads): Ground-level friction smoke dragging horizontally along terrain.
   */
  public update(dt: number) {
    const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1.0;

    if (hpRatio < 0.70 && this.hp > 0) {
      this.smokeTimer += dt;

      // Multi-tier spawn intervals based on vehicle health
      let spawnInterval = 14; // Default: Leve
      if (hpRatio < 0.20) {
        spawnInterval = 3.5; // Crítico: fast, multi-emitter emission
      } else if (hpRatio < 0.40) {
        spawnInterval = 7.0; // Intenso: dense continuous soot
      }

      if (this.smokeTimer >= spawnInterval) {
        this.smokeTimer = 0;

        const cosS = Math.cos(this.slopeAngle);
        const sinS = Math.sin(this.slopeAngle);

        if (hpRatio >= 0.40) {
          // ============================================================
          // ESTADO 1: HUMO LEVE (Daño normal / moderado)
          // ============================================================
          const rearLocalX = -this.facing * (14 + Math.random() * 3);
          const rearLocalY = -7 + (Math.random() - 0.5) * 3;
          const spawnX = rearLocalX * cosS - rearLocalY * sinS;
          const spawnY = rearLocalX * sinS + rearLocalY * cosS;

          this.smokeParticles.push({
            x: spawnX,
            y: spawnY,
            vx: -this.facing * (0.15 + Math.random() * 0.2) + (Math.random() - 0.5) * 0.15,
            vy: -(0.35 + Math.random() * 0.3),
            radius: 2.8 + Math.random() * 1.5,
            growthRate: 0.07,
            alpha: 0.26 + Math.random() * 0.08,
            fadeRate: 0.007,
            color: 0x94a3b8, // Light wispy slate gray
            isSpark: false,
            life: 0,
          });
        } else if (hpRatio >= 0.20) {
          // ============================================================
          // ESTADO 2: HUMO INTENSO (Daño severo)
          // ============================================================
          const rearLocalX = -this.facing * (15 + Math.random() * 4);
          const rearLocalY = -8 + (Math.random() - 0.5) * 4;
          const spawnX = rearLocalX * cosS - rearLocalY * sinS;
          const spawnY = rearLocalX * sinS + rearLocalY * cosS;

          const isEmber = Math.random() < 0.22;
          this.smokeParticles.push({
            x: spawnX,
            y: spawnY,
            vx: -this.facing * (0.35 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.2,
            vy: isEmber ? -(0.8 + Math.random() * 0.8) : -(0.7 + Math.random() * 0.6),
            radius: isEmber ? 1.6 : 3.8 + Math.random() * 2.2,
            growthRate: isEmber ? -0.015 : 0.14,
            alpha: isEmber ? 0.95 : 0.48,
            fadeRate: isEmber ? 0.025 : 0.009,
            color: isEmber ? 0xf59e0b : 0x1e293b, // Dense dark soot or glowing ember
            isSpark: isEmber,
            life: 0,
          });
        } else {
          // ============================================================
          // ESTADO 3: MÚLTIPLES HUMOS CON DISTINTAS FÍSICAS (Crítico)
          // ============================================================
          const emitterRoll = Math.random();

          if (emitterRoll < 0.40) {
            // Emisor 1: Motor / Escape Trasero (Pluma gruesa de humo negro con inercia)
            const rearLocalX = -this.facing * (16 + Math.random() * 4);
            const rearLocalY = -9 + (Math.random() - 0.5) * 3;
            const spawnX = rearLocalX * cosS - rearLocalY * sinS;
            const spawnY = rearLocalX * sinS + rearLocalY * cosS;

            this.smokeParticles.push({
              x: spawnX,
              y: spawnY,
              vx: -this.facing * (0.6 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.25,
              vy: -(0.85 + Math.random() * 0.7),
              radius: 4.2 + Math.random() * 2.5,
              growthRate: 0.18,
              alpha: 0.62,
              fadeRate: 0.008,
              color: Math.random() < 0.5 ? 0x0f172a : 0x1e293b,
              isSpark: false,
              life: 0,
            });
          } else if (emitterRoll < 0.75) {
            // Emisor 2: Torreta / Chasis Dañado (Humo turbulento vertical con chispas de fuego)
            const midLocalX = (Math.random() - 0.5) * 12;
            const midLocalY = -18 + (Math.random() - 0.5) * 4;
            const spawnX = midLocalX * cosS - midLocalY * sinS;
            const spawnY = midLocalX * sinS + midLocalY * cosS;

            const isFierySpark = Math.random() < 0.35;
            const sparkColors = [0xef4444, 0xf97316, 0xfbbf24];
            const sparkColor = sparkColors[Math.floor(Math.random() * sparkColors.length)];

            this.smokeParticles.push({
              x: spawnX,
              y: spawnY,
              vx: (Math.random() - 0.5) * 0.6,
              vy: isFierySpark ? -(1.1 + Math.random() * 1.0) : -(0.9 + Math.random() * 0.5),
              radius: isFierySpark ? 1.8 : 3.5 + Math.random() * 2.0,
              growthRate: isFierySpark ? -0.02 : 0.15,
              alpha: isFierySpark ? 1.0 : 0.55,
              fadeRate: isFierySpark ? 0.03 : 0.009,
              color: isFierySpark ? sparkColor : 0x334155,
              isSpark: isFierySpark,
              turbulence: 0.8,
              life: 0,
            });
          } else {
            // Emisor 3: Oruga / Tracción Dañada (Humo a ras de suelo con fricción y dispersión)
            const treadLocalX = this.facing * (Math.random() - 0.5) * 18;
            const treadLocalY = 2 + Math.random() * 2;
            const spawnX = treadLocalX * cosS - treadLocalY * sinS;
            const spawnY = treadLocalX * sinS + treadLocalY * cosS;

            this.smokeParticles.push({
              x: spawnX,
              y: spawnY,
              vx: (Math.random() - 0.5) * 0.8 - this.facing * 0.2,
              vy: -(0.25 + Math.random() * 0.3),
              radius: 3.0 + Math.random() * 1.8,
              growthRate: 0.12,
              alpha: 0.40,
              fadeRate: 0.012,
              color: 0x475569, // Gray friction soot
              isSpark: false,
              life: 0,
            });
          }
        }
      }

      // ============================================================
      // CHISPAS ANIMADAS DE DAÑO CRÍTICO (HP < 35%)
      // ============================================================
      // Genera chispas eléctricas y de fuego que saltan vivamente del chasis, torreta y motor
      if (hpRatio < 0.35) {
        this.sparkTimer += dt;
        const sparkInterval = hpRatio < 0.15 ? 2.2 : hpRatio < 0.25 ? 3.8 : 5.8;

        if (this.sparkTimer >= sparkInterval) {
          this.sparkTimer = 0;
          const sparkCount = hpRatio < 0.15 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
          const cosS = Math.cos(this.slopeAngle);
          const sinS = Math.sin(this.slopeAngle);

          for (let s = 0; s < sparkCount; s++) {
            const originRoll = Math.random();
            let localX = 0;
            let localY = 0;

            if (originRoll < 0.45) {
              // Motor / Escape trasero en cortocircuito
              localX = -this.facing * (13 + Math.random() * 6);
              localY = -8 + (Math.random() - 0.5) * 6;
            } else if (originRoll < 0.80) {
              // Chasis / Torreta averiada
              localX = (Math.random() - 0.5) * 16;
              localY = -16 + (Math.random() - 0.5) * 8;
            } else {
              // Cañón / Zona frontal chispeando
              localX = this.facing * (10 + Math.random() * 6);
              localY = -12 + (Math.random() - 0.5) * 6;
            }

            const spawnX = localX * cosS - localY * sinS;
            const spawnY = localX * sinS + localY * cosS;

            const sparkPalette = [0xffffff, 0xfef08a, 0xfde047, 0xfacc15, 0xfbbf24, 0xf97316, 0xef4444];
            const sparkColor = sparkPalette[Math.floor(Math.random() * sparkPalette.length)];

            this.smokeParticles.push({
              x: spawnX,
              y: spawnY,
              vx: (Math.random() - 0.5) * 3.0 + (originRoll < 0.45 ? -this.facing * 0.7 : 0),
              vy: -(1.4 + Math.random() * 2.2),
              ay: 0.08 + Math.random() * 0.04, // Gravedad natural de arco de chispa
              radius: 1.2 + Math.random() * 1.4,
              growthRate: -0.018,
              alpha: 1.0,
              fadeRate: 0.034 + Math.random() * 0.02, // Vida enérgica y rápida (20-30 frames)
              color: sparkColor,
              isSpark: true,
              life: 0,
            });
          }
        }
      }
    }

    // Step active smoke particles with individual physics & easing
    if (this.smokeParticles.length > 0) {
      this.smokeGraphics.clear();

      for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
        const p = this.smokeParticles[i];
        p.life += dt;

        // Turbulence sinusoidal drift
        if (p.turbulence) {
          p.x += Math.sin(p.life * 0.12) * p.turbulence * dt;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.isSpark) {
          if (p.ay) p.vy += p.ay * dt;
          p.alpha -= p.fadeRate * dt;
          p.radius = Math.max(0.6, p.radius + p.growthRate * dt);
          // Vibración / crackle eléctrico sutil
          p.x += (Math.random() - 0.5) * 0.7 * dt;
        } else {
          p.vy -= 0.009 * dt; // gentle thermal rise
          p.alpha -= p.fadeRate * dt;
          p.radius += p.growthRate * dt;
        }

        if (p.alpha <= 0.01) {
          this.smokeParticles.splice(i, 1);
          continue;
        }

        this.smokeGraphics.circle(p.x, p.y, Math.max(0.5, p.radius));
        this.smokeGraphics.fill({ color: p.color, alpha: Math.max(0, p.alpha) });

        // Núcleo brillante blanco en las chispas intensas
        if (p.isSpark && p.alpha > 0.35) {
          this.smokeGraphics.circle(p.x, p.y, Math.max(0.4, p.radius * 0.45));
          this.smokeGraphics.fill({ color: 0xffffff, alpha: Math.min(1.0, p.alpha * 1.2) });
        }
      }
    } else {
      this.smokeGraphics.clear();
    }
  }
}
