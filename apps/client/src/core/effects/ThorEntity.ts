import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Text, TextStyle, Texture } from "pixi.js";
import { AudioManager } from "../audio/AudioManager.js";
import { ThorExplosionEntity } from "./ThorExplosionEntity.js";

/**
 * Authentic GunBound Thor Level Thresholds (from DragonBound/GunBound original specs)
 * Level 1: 0 - 299
 * Level 2: 300 - 899
 * Level 3: 900 - 1799
 * Level 4: 1800 - 3199
 * Level 5: 3200 - 5999
 * Level 6+: 6000+ (Max 6000)
 */
const THOR_THRESHOLDS = [0, 300, 900, 1800, 3200, 6000];

/**
 * ThorEntity
 * 
 * Authentic GunBound Thor orbital satellite weapon.
 * - Positioned high in the celestial sky (baseY = 80) well above the battlefield and terrain.
 * - 20-Frame animated core from /sprites/effects/thor.png.
 * - True celestial pendulum harmonic physics swaying above the battlefield.
 * - Multi-beam scaling with Level (thicker lasers and ion coronas as Thor levels up).
 * - Smooth lerped aiming & orbital laser beam strike without snapping.
 * - Authentic 16-frame aduka1-thor.png explosion at impact location.
 */
export class ThorEntity extends Container {
  private spriteContainer: Container;
  private thorSprite?: AnimatedSprite;
  private levelText: Text;
  private damageText: Text;
  private laserGraphic: Graphics;
  private activeGlowGraphic: Graphics;

  public level: number = 1;
  public accumulatedDamage: number = 0;
  public isWeatherActive: boolean = false;

  // Positioned high up in the celestial stratosphere (baseY = -340) clear above all castles & towers
  public baseX: number = 720;
  public baseY: number = -340;
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

    this.activeGlowGraphic = new Graphics();
    this.addChild(this.activeGlowGraphic);

    this.spriteContainer = new Container();
    this.addChild(this.spriteContainer);

    // Retro text styles matching GunBound (Silkscreen for numbers, red with black stroke)
    const lvlStyle = new TextStyle({
      fontFamily: ["Silkscreen", "sans-serif"],
      fontSize: 13,
      fontWeight: "900",
      fill: "#f73918",
      stroke: { color: "#000000", width: 3.5 },
    });

    const dmgStyle = new TextStyle({
      fontFamily: ["Silkscreen", "sans-serif"],
      fontSize: 12,
      fontWeight: "800",
      fill: "#ff5a42",
      stroke: { color: "#000000", width: 3.5 },
    });

    this.levelText = new Text({ text: `Lv. ${this.level}`, style: lvlStyle });
    this.damageText = new Text({ text: `${this.accumulatedDamage}`, style: dmgStyle });

    // Positioned beside/below the satellite body matching reference screenshot 4
    this.levelText.position.set(24, 18);
    this.damageText.position.set(30, 36);

    this.addChild(this.levelText);
    this.addChild(this.damageText);

    this.loadSprite();
  }

  private async loadSprite() {
    try {
      const texture = await Assets.load<Texture>("/sprites/effects/thor.png");
      const baseTex = texture.source;

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

  public setWeatherActive(active: boolean) {
    this.isWeatherActive = active;
    if (!active) {
      this.activeGlowGraphic.clear();
    }
  }

  public setLevelAndDamage(lvl: number, dmg: number) {
    this.level = Math.min(6, Math.max(1, lvl));
    this.accumulatedDamage = Math.min(6000, Math.max(0, dmg));
    this.levelText.text = `Lv. ${this.level}`;
    this.damageText.text = `${this.accumulatedDamage}`;
  }

  /**
   * Authentic GunBound Thor experience meter:
   * Adds damage / 2 to Thor's meter, maxing out at 6000 points.
   */
  public addDamage(damage: number) {
    const addedExp = Math.round(damage / 2);
    this.accumulatedDamage = Math.min(6000, this.accumulatedDamage + addedExp);

    let newLevel = 1;
    for (let i = THOR_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.accumulatedDamage >= THOR_THRESHOLDS[i]) {
        newLevel = i + 1;
        break;
      }
    }
    this.setLevelAndDamage(newLevel, this.accumulatedDamage);
  }

  /**
   * Fires the Thor satellite laser beam directly down towards (targetX, targetY).
   * Visual scales with Thor Level:
   * - Lv 1: Single focused beam
   * - Lv 2-3: Dual energetic beam with ion corona
   * - Lv 4+: Massive triple heavy orbital plasma strike
   */
  public fireBeam(targetX: number, targetY: number, damage: number = 180, effectsContainer?: Container): Promise<void> {
    return new Promise((resolve) => {
      this.isFiringBeam = true;
      this.beamTimer = 280; // Beam duration in ms

      // Calculate relative vector from Thor to target
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const rawAngle = Math.atan2(dy, dx);

      // Antennas point towards target when rotated
      this.targetAngle = rawAngle + Math.PI / 2;

      // Draw high-energy orbital laser beam
      this.laserGraphic.clear();

      const lvl = this.level;
      const outerWidth = 14 + lvl * 4;
      const coreWidth = 3 + Math.floor(lvl * 1.2);

      // Outer glowing cyan beam
      this.laserGraphic.moveTo(0, 0);
      this.laserGraphic.lineTo(dx, dy);
      this.laserGraphic.stroke({ width: outerWidth, color: 0x38bdf8, alpha: 0.65 });

      // Secondary bright golden core ring for Lv 2+
      if (lvl >= 2) {
        this.laserGraphic.moveTo(0, 0);
        this.laserGraphic.lineTo(dx, dy);
        this.laserGraphic.stroke({ width: outerWidth * 0.5, color: 0xfacc15, alpha: 0.85 });
      }

      // High-level twin satellite parallel ion traces for Lv 4+
      if (lvl >= 4) {
        const perpX = -Math.sin(rawAngle) * 12;
        const perpY = Math.cos(rawAngle) * 12;
        this.laserGraphic.moveTo(perpX, perpY);
        this.laserGraphic.lineTo(dx + perpX, dy + perpY);
        this.laserGraphic.stroke({ width: 3, color: 0x93c5fd, alpha: 0.8 });

        this.laserGraphic.moveTo(-perpX, -perpY);
        this.laserGraphic.lineTo(dx - perpX, dy - perpY);
        this.laserGraphic.stroke({ width: 3, color: 0x93c5fd, alpha: 0.8 });
      }

      // Core incandescent white laser
      this.laserGraphic.moveTo(0, 0);
      this.laserGraphic.lineTo(dx, dy);
      this.laserGraphic.stroke({ width: coreWidth, color: 0xffffff, alpha: 1.0 });

      // Impact blast flare at target ground
      const flareRadius = 24 + lvl * 6;
      this.laserGraphic.circle(dx, dy, flareRadius).fill({ color: 0x38bdf8, alpha: 0.6 });
      this.laserGraphic.circle(dx, dy, flareRadius * 0.5).fill({ color: 0xffffff, alpha: 0.95 });

      // Sound effect
      AudioManager.play("11blast", 0.9);
      AudioManager.play("12blast", 0.8);

      // Spawn authentic aduka1-thor.png explosion at ground target
      const targetParent = effectsContainer || (this.parent as Container);
      if (targetParent) {
        const thorExp = new ThorExplosionEntity(targetX, targetY);
        targetParent.addChild(thorExp);
      }

      // Level up & damage update
      this.addDamage(damage);

      setTimeout(() => {
        this.laserGraphic.clear();
        this.isFiringBeam = false;
        resolve();
      }, 280);
    });
  }

  /**
   * Harmonic celestial pendulum update:
   * Sways continuously like a hanging pendulum with fluid harmonic oscillation high in the sky.
   */
  public update(dt: number) {
    this.time += dt * 0.035;

    // Harmonic pendulum sway calculations
    const swayX = Math.sin(this.time) * 32;
    const swayY = (1 - Math.cos(this.time * 2)) * 6;
    const naturalPendulumAngle = Math.sin(this.time) * 0.22;

    this.x = this.baseX + swayX;
    this.y = this.baseY + swayY;

    // Active Thor Weather pulsing halo
    if (this.isWeatherActive) {
      this.activeGlowGraphic.clear();
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      this.activeGlowGraphic.circle(0, 0, 48 + pulse * 10).fill({ color: 0x38bdf8, alpha: 0.25 * pulse });
      this.activeGlowGraphic.circle(0, 0, 36).stroke({ width: 2, color: 0x38bdf8, alpha: 0.6 });
    }

    if (this.thorSprite) {
      if (this.isFiringBeam) {
        // Smoothly lerp towards target aim angle while firing
        this.currentRotation += (this.targetAngle - this.currentRotation) * 0.25 * dt;
      } else {
        // Smoothly lerp back to the natural pendulum rocking angle
        this.currentRotation += (naturalPendulumAngle - this.currentRotation) * 0.08 * dt;
      }

      this.spriteContainer.rotation = this.currentRotation;
    }

    // Laser beam fade out
    if (this.isFiringBeam && this.beamTimer > 0) {
      this.beamTimer -= dt * 16.66;
      this.laserGraphic.alpha = Math.max(0, this.beamTimer / 280);
    }
  }

  public destroy() {
    this.thorSprite?.destroy();
    this.laserGraphic.destroy();
    this.activeGlowGraphic.destroy();
    this.levelText.destroy();
    this.damageText.destroy();
    super.destroy({ children: true });
  }
}
