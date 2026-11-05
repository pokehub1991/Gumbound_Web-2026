import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Text, TextStyle, Texture } from "pixi.js";
import { AudioManager } from "../audio/AudioManager";

/**
 * ThorEntity
 * 
 * Authentic GunBound Thor orbital satellite weapon.
 * - 20-Frame animated core from /sprites/effects/thor.png (160px stride, 159x99 px frame).
 * - True celestial pendulum harmonic physics swaying above the battlefield.
 * - Smooth lerped aiming & orbital laser beam strike without teleports or snapping.
 * - Retro level & accumulated damage text displays matching GunBound.
 */
export class ThorEntity extends Container {
  private spriteContainer: Container;
  private thorSprite?: AnimatedSprite;
  private levelText: Text;
  private damageText: Text;
  private laserGraphic: Graphics;

  public level: number = 1;
  public accumulatedDamage: number = 0;

  // Positioned higher up in the celestial sky as requested (baseY = 68)
  public baseX: number = 720;
  public baseY: number = 68;
  private time: number = 0;

  private isFiringBeam: boolean = false;
  private beamTimer: number = 0;
  private targetAngle: number = 0;
  private currentRotation: number = 0;

  constructor() {
    super();

    this.position.set(this.baseX, this.baseY);

    this.laserGraphic = new Graphics();
    this.addChild(this.laserGraphic);

    this.spriteContainer = new Container();
    this.addChild(this.spriteContainer);

    // Retro text styles matching GunBound / DragonBound (Segoe UI This / Pixelify Sans with black outline)
    const lvlStyle = new TextStyle({
      fontFamily: ["Segoe UI This", "Pixelify Sans", "Arial", "sans-serif"],
      fontSize: 14,
      fontWeight: "900",
      fill: "#f73918",
      stroke: { color: "#000000", width: 3.5 },
    });

    const dmgStyle = new TextStyle({
      fontFamily: ["Segoe UI This", "Pixelify Sans", "Arial", "sans-serif"],
      fontSize: 12,
      fontWeight: "800",
      fill: "#ff5a42",
      stroke: { color: "#000000", width: 3.5 },
    });

    this.levelText = new Text({ text: `Lv. ${this.level}`, style: lvlStyle });
    this.damageText = new Text({ text: `${this.accumulatedDamage}`, style: dmgStyle });

    // Positioned beside/below the satellite body matching reference screenshot
    this.levelText.position.set(22, 18);
    this.damageText.position.set(28, 34);

    this.addChild(this.levelText);
    this.addChild(this.damageText);

    this.loadSprite();
  }

  private async loadSprite() {
    try {
      const texture = await Assets.load<Texture>("/sprites/effects/thor.png");
      const baseTex = texture.source;

      // Authentic GunBound spritesheet:
      // Total width: 3199px across 20 frames.
      // Each frame is 159x99 px, separated by 1px spacing (stride = 160px).
      // Center anchor: cx = 98, cy = 59.
      const frameStride = 160;
      const frameWidth = 159;
      const frameHeight = 99;
      const frameCount = 20;

      const frames: Texture[] = [];
      for (let i = 0; i < frameCount; i++) {
        const rect = new Rectangle(i * frameStride, 0, frameWidth, frameHeight);
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
      this.thorSprite.animationSpeed = 0.32; // ~19 FPS authentic GunBound breathing rate
      this.thorSprite.loop = true;
      this.thorSprite.anchor.set(98 / frameWidth, 59 / frameHeight);
      this.thorSprite.play();

      this.spriteContainer.addChild(this.thorSprite);
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
   * Fires the Thor satellite laser beam directly down towards (targetX, targetY).
   * Smoothly aims and rotates without abrupt teleporting or snapping!
   */
  public fireBeam(targetX: number, targetY: number, damage: number = 180): Promise<void> {
    return new Promise((resolve) => {
      this.isFiringBeam = true;
      this.beamTimer = 260; // Beam duration in ms

      // Calculate relative vector from Thor to target
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const rawAngle = Math.atan2(dy, dx);

      // Antennas point towards target when rotated
      this.targetAngle = rawAngle + Math.PI / 2;

      // Draw high-energy orbital laser beam
      this.laserGraphic.clear();

      // Outer golden/cyan halo
      this.laserGraphic.moveTo(0, 0);
      this.laserGraphic.lineTo(dx, dy);
      this.laserGraphic.stroke({ width: 14, color: 0x38bdf8, alpha: 0.65 });

      // Core energetic beam
      this.laserGraphic.moveTo(0, 0);
      this.laserGraphic.lineTo(dx, dy);
      this.laserGraphic.stroke({ width: 6, color: 0xffffff, alpha: 0.95 });

      // Impact blast flare at target ground
      this.laserGraphic.circle(dx, dy, 24).fill({ color: 0x38bdf8, alpha: 0.55 });
      this.laserGraphic.circle(dx, dy, 13).fill({ color: 0xffffff, alpha: 0.95 });

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
        resolve();
      }, 260);
    });
  }

  /**
   * Harmonic celestial pendulum update:
   * Sways continuously like a hanging pendulum with fluid harmonic oscillation.
   */
  public update(dt: number) {
    this.time += dt * 0.035;

    // Harmonic pendulum sway calculations
    // Horizontal sway: ±32 pixels
    const swayX = Math.sin(this.time) * 32;
    // True pendulum vertical dip: slightly drops at maximum swing amplitude
    const swayY = (1 - Math.cos(this.time * 2)) * 6;
    // Pendulum rocking tilt: tilts in synchronization with the swing (±0.22 rad / ~12.5 deg)
    const naturalPendulumAngle = Math.sin(this.time) * 0.22;

    this.x = this.baseX + swayX;
    this.y = this.baseY + swayY;

    if (this.thorSprite) {
      if (this.isFiringBeam) {
        // Smoothly lerp towards target aim angle while firing
        this.currentRotation += (this.targetAngle - this.currentRotation) * 0.25 * dt;
      } else {
        // Smoothly lerp back to the natural pendulum rocking angle (zero snapping / teleporting!)
        this.currentRotation += (naturalPendulumAngle - this.currentRotation) * 0.08 * dt;
      }

      this.spriteContainer.rotation = this.currentRotation;
    }

    // Laser beam fade out
    if (this.isFiringBeam && this.beamTimer > 0) {
      this.beamTimer -= dt * 16.66;
      this.laserGraphic.alpha = Math.max(0, this.beamTimer / 260);
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
