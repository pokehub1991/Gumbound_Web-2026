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

  private spriteContainer: Container;
  private animSprite?: AnimatedSprite;
  private animTextures?: MobileAnimationTextures;
  private currentAnimName: "normal" | "move" = "normal";

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

    // Temporary fallback vector tank while sprite texture loads
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

    // Player Nickname label
    const style = new TextStyle({
      fontFamily: "Arial",
      fontSize: 12,
      fontWeight: "bold",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
    });
    this.nameText = new Text({ text: this.nickname, style });
    this.nameText.anchor.set(0.5, 1);
    this.nameText.y = -36;

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

      // Remove fallback graphics
      this.fallbackBody.visible = false;

      this.animSprite = new AnimatedSprite(textures.normal);
      this.animSprite.animationSpeed = 0.25; // ~15 FPS
      this.animSprite.anchor.set(textures.primaryAnchor.x, textures.primaryAnchor.y);
      this.animSprite.play();

      this.spriteContainer.addChild(this.animSprite);
      this.setFacing(this.facing);
    } catch (err) {
      console.warn(`[Mobile] Could not load sprite for mobile ${this.mobileType}, using fallback:`, err);
    }
  }

  public playAnimation(name: "normal" | "move") {
    if (this.currentAnimName === name || !this.animSprite || !this.animTextures) return;
    this.currentAnimName = name;

    const frames = name === "move" ? this.animTextures.move : this.animTextures.normal;
    this.animSprite.textures = frames;
    this.animSprite.animationSpeed = name === "move" ? 0.35 : 0.2;
    this.animSprite.play();
  }

  public setAngle(deg: number) {
    this.angleDeg = deg;
    const rad = (deg * Math.PI) / 180;
    this.aimPointer.rotation = -rad * this.facing;
  }

  public setFacing(dir: number) {
    this.facing = dir >= 0 ? 1 : -1;
    this.spriteContainer.scale.x = this.facing;
    this.fallbackBody.scale.x = this.facing;
    this.aimPointer.scale.x = this.facing;
    this.setAngle(this.angleDeg);
  }

  public setHp(hp: number) {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.updateHpBar();
    if (this.hp === 0) {
      this.alpha = 0.4;
    }
  }

  private updateHpBar() {
    this.hpBarGraphics.clear();
    const width = 44;
    const height = 5;
    const x = -width / 2;
    const y = -28;

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
