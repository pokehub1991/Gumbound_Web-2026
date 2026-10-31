import { AnimatedSprite, Container, Graphics, Text, TextStyle } from "pixi.js";
import { MobileSpriteManager, MobileAnimationTextures } from "./MobileSpriteManager.js";

export interface MobileConfig {
  id: string;
  name?: string;
  nickname: string;
  team: string; // "A" | "B"
  mobileType: number;
  maxHp: number;
  hp: number;
  x: number;
  y: number;
}

export class Mobile extends Container {
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
  private aimPointer: Graphics;
  private hpBarGraphics: Graphics;
  private nameText: Text;

  constructor(config: MobileConfig) {
    super();
    this.id = config.id;
    this.nickname = config.nickname;
    this.team = config.team;
    this.mobileType = config.mobileType;
    this.maxHp = config.maxHp;
    this.hp = config.hp;

    this.x = config.x;
    this.y = config.y;

    this.spriteContainer = new Container();
    this.fallbackBody = new Graphics();
    this.aimPointer = new Graphics();
    this.hpBarGraphics = new Graphics();

    const teamColor = this.team === "A" ? 0x2196f3 : 0xf44336;

    // Fallback vector tank while sprite texture loads
    this.fallbackBody.roundRect(-20, -12, 40, 20, 4);
    this.fallbackBody.fill(0x37474f);
    this.fallbackBody.stroke({ width: 2, color: teamColor });
    this.fallbackBody.roundRect(-22, 6, 44, 8, 3).fill(0x212121);

    // Aim Pointer / Barrel direction line
    this.aimPointer.moveTo(0, 0);
    this.aimPointer.lineTo(28, 0);
    this.aimPointer.stroke({ width: 2.5, color: teamColor });
    this.aimPointer.x = 0;
    this.aimPointer.y = -10;

    // Player Nickname label (remains horizontal upright below mobile HP bar)
    const style = new TextStyle({
      fontFamily: "Arial",
      fontSize: 11,
      fontWeight: "bold",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
    });
    this.nameText = new Text({ text: this.nickname, style });
    this.nameText.anchor.set(0.5, 0);
    this.nameText.y = 21;

    this.addChild(this.fallbackBody);
    this.addChild(this.spriteContainer);
    this.addChild(this.aimPointer);
    this.addChild(this.hpBarGraphics);
    this.addChild(this.nameText);

    this.updateHpBar();
    this.setAngle(this.angleDeg);

    // Load authentic mobile sprite
    this.loadSprite();
  }

  private async loadSprite() {
    try {
      const textures = await MobileSpriteManager.loadMobileTextures(this.mobileType);
      this.animTextures = textures;

      // Remove fallback graphics and barrel vector line when authentic sprite is active
      this.fallbackBody.visible = false;
      this.aimPointer.visible = false;

      const initialFrames = textures.animations["normal"] || Object.values(textures.animations)[0];
      this.animSprite = new AnimatedSprite(initialFrames);
      this.animSprite.animationSpeed = 0.35;
      this.animSprite.anchor.set(textures.primaryAnchor.x, textures.primaryAnchor.y);
      this.animSprite.play();

      this.spriteContainer.addChild(this.animSprite);
      this.setFacing(this.facing);
      this.setTilt(this.slopeAngle);
    } catch (err) {
      console.warn(`[Mobile] Could not load sprite for mobile ${this.mobileType}, using fallback:`, err);
    }
  }

  public setTilt(rad: number) {
    this.slopeAngle = rad;
    this.spriteContainer.rotation = rad;
    this.fallbackBody.rotation = rad;
  }

  public playAnimation(name: string, loop: boolean = true, onComplete?: () => void) {
    if (!this.animSprite || !this.animTextures) return;
    if (this.currentAnimName === name && this.animSprite.playing) return;

    const frames = this.animTextures.animations[name] || this.animTextures.animations["normal"];
    if (!frames || frames.length === 0) return;

    this.currentAnimName = name;
    this.animSprite.textures = frames;
    this.animSprite.loop = loop;

    // Center anchor accurately per animation bounding box
    if (this.animTextures.anchors && this.animTextures.anchors[name]) {
      const a = this.animTextures.anchors[name];
      this.animSprite.anchor.set(a.x, a.y);
    } else {
      this.animSprite.anchor.set(this.animTextures.primaryAnchor.x, this.animTextures.primaryAnchor.y);
    }

    // Authentic GunBound framerate (MOBILE_FPS = 20, at 60 FPS ticker = 0.35)
    if (name.startsWith("bfire") || name.startsWith("bifire") || name.startsWith("bsfire")) {
      this.animSprite.animationSpeed = 0.40; // charge animation
    } else if (name === "move" || name === "wmove") {
      this.animSprite.animationSpeed = 0.45; // fluid, rapid tread movement
    } else if (name.startsWith("fire") || name === "sfire" || name === "ifire") {
      this.animSprite.animationSpeed = 0.60; // crisp weapon fire recoil
    } else if (name.includes("damage")) {
      this.animSprite.animationSpeed = 0.50; // hit reaction
    } else if (name === "dead") {
      this.animSprite.animationSpeed = 0.30;
    } else {
      this.animSprite.animationSpeed = 0.35; // fluid breathing idle (~20 FPS)
    }

    this.animSprite.gotoAndPlay(0);

    if (!loop) {
      this.animSprite.onComplete = () => {
        if (onComplete) onComplete();
        else if (name !== "dead") {
          this.playAnimation("normal");
        }
      };
    } else {
      this.animSprite.onComplete = undefined;
    }
  }

  public setAngle(deg: number) {
    this.angleDeg = deg;
    const rad = (deg * Math.PI) / 180;
    this.aimPointer.rotation = -rad * this.facing;
  }

  public setFacing(dir: number) {
    this.facing = dir >= 0 ? 1 : -1;
    // Authentic GunBound spritesheet natively faces LEFT by default.
    // To face RIGHT (+1), invert scale.x (-1). To face LEFT (-1), keep scale.x (+1).
    this.spriteContainer.scale.x = -this.facing;
    this.fallbackBody.scale.x = this.facing;
    this.aimPointer.scale.x = this.facing;
    this.setAngle(this.angleDeg);
  }

  public setHp(hp: number) {
    const prevHp = this.hp;
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.updateHpBar();
    if (this.hp === 0) {
      this.playAnimation("dead", false);
      this.alpha = 0.6;
    } else if (this.hp < prevHp) {
      this.showDamagePopup(prevHp - this.hp);
      this.playAnimation("fdamage", false);
    }
  }

  public showDamagePopup(damage: number) {
    if (damage <= 0) return;
    const style = new TextStyle({
      fontFamily: "Impact, Arial Black, sans-serif",
      fontSize: 20,
      fontWeight: "bold",
      fill: damage >= 300 ? "#ff1744" : "#ffeb3b",
      stroke: { color: "#000000", width: 4 },
    });
    const popupText = new Text({ text: `-${damage}`, style });
    popupText.anchor.set(0.5, 0.5);
    popupText.x = 0;
    popupText.y = -52;
    this.addChild(popupText);

    let elapsed = 0;
    const animInterval = setInterval(() => {
      elapsed += 16;
      popupText.y -= 1.0;
      popupText.alpha = Math.max(0, 1.0 - elapsed / 1100);
      if (elapsed >= 1100) {
        clearInterval(animInterval);
        this.removeChild(popupText);
      }
    }, 16);
  }

  private updateHpBar() {
    this.hpBarGraphics.clear();
    const width = 44;
    const height = 5;
    const x = -width / 2;
    const y = 12; // Positioned cleanly below the tank tread base

    // Background bar
    this.hpBarGraphics.rect(x, y, width, height).fill(0x000000);

    // Health fill
    const healthPercent = this.hp / this.maxHp;
    const fillColor = healthPercent > 0.5 ? 0x4caf50 : healthPercent > 0.25 ? 0xffeb3b : 0xf44336;
    this.hpBarGraphics.rect(x + 1, y + 1, (width - 2) * healthPercent, height - 2).fill(fillColor);
  }

  public getMuzzlePosition(): { x: number; y: number } {
    const rad = (this.angleDeg * Math.PI) / 180;
    const barrelLength = 32;
    const offsetX = Math.cos(rad) * barrelLength * this.facing;
    const offsetY = -Math.sin(rad) * barrelLength - 10;
    return {
      x: this.x + offsetX,
      y: this.y + offsetY,
    };
  }
}
