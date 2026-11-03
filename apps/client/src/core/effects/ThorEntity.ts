import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Text, TextStyle, Texture } from "pixi.js";
import { AudioManager } from "../audio/AudioManager";

/**
 * ThorEntity
 * 
 * Authentic GunBound Thor orbital satellite weapon.
 * - 20-Frame animated core from /sprites/effects/thor.png.
 * - Floating celestial sky physics above the battlefield.
 * - Level & damage text displays.
 * - High-energy directed orbital laser beam strike.
 */
export class ThorEntity extends Container {
  private thorSprite?: AnimatedSprite;
  private levelText: Text;
  private damageText: Text;
  private laserGraphic: Graphics;

  public level: number = 1;
  public accumulatedDamage: number = 0;

  public baseX: number = 705;
  public baseY: number = 115;
  private hoverTime: number = 0;

  private isFiringBeam: boolean = false;
  private beamTimer: number = 0;

  constructor() {
    super();

    this.position.set(this.baseX, this.baseY);

    this.laserGraphic = new Graphics();
    this.addChild(this.laserGraphic);

    // Retro text styles matching GunBound / DragonBound
    const lvlStyle = new TextStyle({
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 13,
      fontWeight: "900",
      fill: "#f73918",
      stroke: { color: "#000000", width: 3 },
    });

    const dmgStyle = new TextStyle({
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 11,
      fontWeight: "800",
      fill: "#ff5a42",
      stroke: { color: "#000000", width: 3 },
    });

    this.levelText = new Text({ text: `Lv. ${this.level}`, style: lvlStyle });
    this.damageText = new Text({ text: `${this.accumulatedDamage}`, style: dmgStyle });

    this.levelText.position.set(45, -20);
    this.damageText.position.set(45, -4);

    this.addChild(this.levelText);
    this.addChild(this.damageText);

    this.loadSprite();
  }

  private async loadSprite() {
    try {
      const texture = await Assets.load<Texture>("/sprites/effects/thor.png");
      const baseTex = texture.source;

      const frameWidth = 159;
      const frameHeight = 99;
      const frameCount = 20;

      const frames: Texture[] = [];
      for (let i = 0; i < frameCount; i++) {
        const rect = new Rectangle(i * frameWidth, 0, frameWidth, frameHeight);
        const t = new Texture({
          source: baseTex,
          frame: rect,
          defaultAnchor: {
            x: 98 / frameWidth,  // 0.6163
            y: 59 / frameHeight, // 0.5960
          },
        });
        frames.push(t);
      }

      this.thorSprite = new AnimatedSprite(frames);
      this.thorSprite.animationSpeed = 0.32; // ~19 FPS authentic GunBound rate
      this.thorSprite.play();
      this.thorSprite.anchor.set(98 / frameWidth, 59 / frameHeight);

      // Insert sprite behind texts and laser
      this.addChildAt(this.thorSprite, 0);
    } catch (e) {
      console.warn("[ThorEntity] Failed to load thor.png sprite:", e);
    }
  }

  public setLevelAndDamage(lvl: number, dmg: number) {
    this.level = lvl;
    this.accumulatedDamage = dmg;
    this.levelText.text = `Lv. ${this.level}`;
    this.damageText.text = `${this.accumulatedDamage}`;
  }

  /**
   * Fires the Thor satellite laser beam directly down towards (targetX, targetY)
   */
  public fireBeam(targetX: number, targetY: number, damage: number = 180): Promise<void> {
    return new Promise((resolve) => {
      this.isFiringBeam = true;
      this.beamTimer = 220; // Beam duration in ms

      // Calculate relative vector from Thor to target
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const angle = Math.atan2(dy, dx);

      // Rotate Thor sprite towards firing vector
      if (this.thorSprite) {
        this.thorSprite.rotation = angle + Math.PI / 2;
      }

      // Draw high-energy orbital laser beam
      this.laserGraphic.clear();

      // Outer golden/cyan halo
      this.laserGraphic.moveTo(0, 0);
      this.laserGraphic.lineTo(dx, dy);
      this.laserGraphic.stroke({ width: 14, color: 0x38bdf8, alpha: 0.6 });

      // Core energetic beam
      this.laserGraphic.moveTo(0, 0);
      this.laserGraphic.lineTo(dx, dy);
      this.laserGraphic.stroke({ width: 6, color: 0xffffff, alpha: 0.95 });

      // Impact blast flare at target ground
      this.laserGraphic.circle(dx, dy, 22).fill({ color: 0x38bdf8, alpha: 0.5 });
      this.laserGraphic.circle(dx, dy, 12).fill({ color: 0xffffff, alpha: 0.9 });

      // Sound effect
      AudioManager.play("12blast", 0.85);

      // Level up / accumulated damage update
      this.accumulatedDamage += damage;
      if (this.accumulatedDamage >= this.level * 450) {
        this.level = Math.min(9, this.level + 1);
      }
      this.setLevelAndDamage(this.level, this.accumulatedDamage);

      setTimeout(() => {
        this.laserGraphic.clear();
        this.isFiringBeam = false;
        if (this.thorSprite) {
          this.thorSprite.rotation = 0; // Return to neutral
        }
        resolve();
      }, 220);
    });
  }

  public update(dt: number) {
    this.hoverTime += dt * 0.05;

    // Smooth celestial hover floating across the sky
    if (!this.isFiringBeam) {
      const hoverY = Math.sin(this.hoverTime * 1.6) * 5.5;
      const hoverX = Math.cos(this.hoverTime * 0.8) * 10;
      this.y = this.baseY + hoverY;
      this.x = this.baseX + hoverX;
    }

    // Beam decay
    if (this.isFiringBeam && this.beamTimer > 0) {
      this.beamTimer -= dt * 16.66;
      this.laserGraphic.alpha = Math.max(0, this.beamTimer / 220);
    }
  }

  public destroy() {
    this.thorSprite?.destroy();
    this.laserGraphic.destroy();
    this.levelText.destroy();
    this.damageText.destroy();
    super.destroy({ children: true });
  }
}
