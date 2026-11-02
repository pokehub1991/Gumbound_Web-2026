import { Container, Text, TextStyle } from "pixi.js";
import { MobileEntity } from "../entities/MobileEntity.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { AudioManager } from "../audio/AudioManager.js";

export class BotDummy extends Container {
  public mobile: MobileEntity;
  private terrain: TerrainRenderer;
  public spawnX: number;
  public spawnY: number;

  private isDead: boolean = false;
  private damageNumbersContainer: Container;

  constructor(terrain: TerrainRenderer, spawnX: number = 1380, spawnY: number = 520, mobileType: number = 1) {
    super();
    this.terrain = terrain;
    this.spawnX = spawnX;
    this.spawnY = spawnY;

    this.damageNumbersContainer = new Container();

    const groundY = this.terrain.findSurfaceY(spawnX, spawnY);
    this.mobile = new MobileEntity({
      id: "bot_dummy",
      nickname: "Bot Dummy [Target]",
      team: "B",
      mobileType: mobileType,
      maxHp: 1000,
      hp: 1000,
      x: spawnX,
      y: groundY,
    });

    this.mobile.setFacing(-1); // Faces left toward player
    this.mobile.aimContainer.visible = false; // Aim reticle only shown on player mobile
    const slope = this.terrain.getSlopeAngle(spawnX, groundY);
    this.mobile.setTilt(slope.angle);

    this.addChild(this.mobile);
    this.addChild(this.damageNumbersContainer);
  }

  public takeDamage(damage: number, impactX: number, impactY: number) {
    if (this.isDead) return;

    this.mobile.hp = Math.max(0, this.mobile.hp - damage);
    this.mobile.updateHpBar();

    // Damage animation
    const isFrontHit = impactX <= this.mobile.x;
    this.mobile.playAnimation(isFrontHit ? "fdamage" : "bdamage", false, () => {
      if (!this.isDead) {
        this.mobile.playAnimation("normal");
      }
    });

    // Spawn floating damage text
    this.spawnFloatingDamage(damage, impactX, impactY);

    if (this.mobile.hp <= 0) {
      this.handleDeath("K.O.!");
    }
  }

  public checkGroundFall() {
    if (this.isDead) return;

    const currentSurfaceY = this.terrain.findSurfaceY(this.mobile.x, this.mobile.y);

    // If crater excavated below bot, drop into it
    if (currentSurfaceY > this.mobile.y + 4) {
      this.mobile.y += 6;
      const slope = this.terrain.getSlopeAngle(this.mobile.x, this.mobile.y);
      this.mobile.setTilt(slope.angle);
    } else {
      this.mobile.y = currentSurfaceY;
    }

    // Bunge death if fell off bottom of map
    if (this.mobile.y >= this.terrain.mapHeight - 30) {
      this.handleDeath("BUNGE!");
    }
  }

  private handleDeath(reason: string) {
    if (this.isDead) return;
    this.isDead = true;

    this.mobile.playAnimation("dead", false);
    AudioManager.play("result_win.mp3", 0.6);

    this.spawnFloatingDamage(0, this.mobile.x, this.mobile.y - 20, reason);

    // Auto respawn after 1.8 seconds for continuous combat testing
    setTimeout(() => {
      this.respawn();
    }, 1800);
  }

  public spawnAt(x: number, y: number) {
    this.isDead = false;
    this.mobile.hp = this.mobile.maxHp;
    this.mobile.updateHpBar();

    const groundY = this.terrain.getFirstSolidY(x) ?? y;
    this.spawnX = x;
    this.spawnY = groundY;
    this.mobile.x = x;
    this.mobile.y = groundY;
    this.mobile.setFacing(-1);

    const slope = this.terrain.getSlopeAngle(x, groundY);
    this.mobile.setTilt(slope.angle);
    this.mobile.playAnimation("normal");
  }

  public respawn() {
    // Choose a random valid position on the terrain surface
    const randPos = this.terrain.getRandomGroundPosition(650, Math.min(1250, this.terrain.mapWidth - 150));
    this.spawnAt(randPos.x, randPos.y);
  }

  public setMobileType(type: number) {
    this.mobile.setMobileType(type);
    this.mobile.setFacing(-1);
  }

  private spawnFloatingDamage(amount: number, x: number, y: number, label?: string) {
    const textStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: label ? 22 : 18,
      fontWeight: "900",
      fill: label ? "#ef4444" : "#fbbf24",
      stroke: { color: "#000000", width: 4 },
      dropShadow: {
        color: "#000000",
        blur: 4,
        distance: 2,
      },
    });

    const dmgText = new Text({
      text: label || `-${amount}`,
      style: textStyle,
    });

    dmgText.anchor.set(0.5, 0.5);
    dmgText.x = x;
    dmgText.y = y - 30;

    this.damageNumbersContainer.addChild(dmgText);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 16;
      dmgText.y -= 1.2;
      dmgText.alpha -= 0.022;

      if (elapsed >= 900 || dmgText.alpha <= 0) {
        clearInterval(interval);
        this.damageNumbersContainer.removeChild(dmgText);
        dmgText.destroy();
      }
    }, 16);
  }
}
