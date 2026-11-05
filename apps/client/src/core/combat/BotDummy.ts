import { Container, Text, TextStyle } from "pixi.js";
import { MobileEntity } from "../entities/MobileEntity.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { DeathGhostEntity } from "../effects/DeathGhostEntity.js";

export class BotDummy extends Container {
  public mobile: MobileEntity;
  private terrain: TerrainRenderer;
  public spawnX: number;
  public spawnY: number;

  public isDead: boolean = false;
  public isImmortal: boolean = true;
  private isBotBunged: boolean = false;
  private ghostEntity?: DeathGhostEntity;
  private damageNumbersContainer: Container;
  private botFallVy: number = 0;
  private isBotAirborne: boolean = false;

  constructor(terrain: TerrainRenderer, spawnX: number = 1380, spawnY: number = 520, mobileType: number = 1) {
    super();
    this.terrain = terrain;
    this.spawnX = spawnX;
    this.spawnY = spawnY;

    this.damageNumbersContainer = new Container();

    const groundY = this.terrain.findSurfaceY(spawnX, spawnY);
    this.mobile = new MobileEntity({
      id: "bot_dummy",
      nickname: "Haris Pilton",
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

    if (this.isImmortal) {
      // Immortal mode: HP stays maxed, bot never dies, but all hits & numbers are shown
      this.mobile.hp = this.mobile.maxHp;
      this.mobile.updateHpBar();
    } else {
      // Mortal mode: Bot takes real damage and can be defeated
      this.mobile.hp = Math.max(0, this.mobile.hp - damage);
      this.mobile.updateHpBar();
    }

    if (!this.isImmortal && this.mobile.hp <= 0) {
      this.handleDeath("K.O.!");
      return;
    }

    // Damage animation
    const isFrontHit = impactX <= this.mobile.x;
    this.mobile.playAnimation(isFrontHit ? "fdamage" : "bdamage", false, () => {
      if (!this.isDead) {
        this.mobile.playAnimation("normal");
      }
    });

    // Spawn floating damage text with authentic hit impact
    this.spawnFloatingDamage(damage, impactX, impactY);
  }

  public checkGroundFall(dt: number = 1.0) {
    if (this.isDead) {
      if (this.isBotBunged) {
        if (this.mobile.visible) {
          this.botFallVy = Math.min(8.5, this.botFallVy + 0.35 * dt);
          this.mobile.y += this.botFallVy * dt;

          // Once bot falls off the bottom edge, hide mobile and spawn ascending ghost!
          if (this.mobile.y >= this.terrain.mapHeight + 60) {
            this.mobile.visible = false;
            if (this.ghostEntity) {
              this.ghostEntity.cleanup();
            }
            this.ghostEntity = new DeathGhostEntity(this.mobile.x, this.terrain.mapHeight + 50);
            this.addChild(this.ghostEntity);
          }
        } else if (this.ghostEntity) {
          this.ghostEntity.update(dt);
        }
      } else if (this.ghostEntity) {
        this.ghostEntity.update(dt);
      }
      return;
    }

    const placement = this.terrain.getMobileSurfacePlacement(this.mobile.x, this.mobile.y);
    const currentSurfaceY = placement.y;
    const dropDist = currentSurfaceY - this.mobile.y;

    // Instant gravity fall whenever terrain beneath is destroyed (identical physics to player precipice fall)
    if (dropDist > 3) {
      if (!this.isBotAirborne) {
        this.isBotAirborne = true;
        this.mobile.playAnimation("drop", true);
      }
      this.botFallVy = Math.min(6.5, this.botFallVy + 0.25 * dt);
      this.mobile.y = Math.min(currentSurfaceY, this.mobile.y + this.botFallVy * dt);
      const targetFallTilt = this.mobile.facing * 0.10;
      this.mobile.setTilt(targetFallTilt);
    } else {
      if (this.isBotAirborne) {
        this.isBotAirborne = false;
        this.botFallVy = 0;
        this.mobile.playAnimation("normal", true);
      }
      this.mobile.y = currentSurfaceY;
      this.mobile.setTilt(placement.slope.angle);
    }

    // Knocked completely off map bottom or sides (bunge / void abyss fall)
    if (!this.isDead && (this.mobile.y >= this.terrain.mapHeight - 30 || this.mobile.x < -30 || this.mobile.x > this.terrain.mapWidth + 30)) {
      this.handleBunge();
    }
  }

  private handleBunge() {
    if (this.isDead) return;
    this.isDead = true;
    this.isBotBunged = true;
    this.isBotAirborne = true;
    this.mobile.playAnimation("drop", true);
    this.spawnFloatingDamage(0, this.mobile.x, this.mobile.y - 20, "BUNGE!");

    // Falling into abyss: falls off bottom screen, transforms into ghost and ascends to sky
    setTimeout(() => {
      this.respawn();
    }, 5000);
  }

  private handleDeath(reason: string) {
    if (this.isDead) return;
    this.isDead = true;
    this.isBotBunged = false;

    // Mobile stays in place for 2 seconds showing surrender / defeat animation
    this.mobile.playAnimation("dead", true);
    this.isBotAirborne = false;
    this.mobile.setTilt(0);

    this.spawnFloatingDamage(0, this.mobile.x, this.mobile.y - 20, reason);

    // Retraso de 2 segundos antes de que el móvil desaparezca y el fantasma vuele al cielo
    setTimeout(() => {
      this.mobile.visible = false;

      // Dedicated animated death ghost ascends straight up to heaven
      if (this.ghostEntity) {
        this.ghostEntity.cleanup();
      }
      this.ghostEntity = new DeathGhostEntity(this.mobile.x, this.mobile.y);
      this.addChild(this.ghostEntity);

      // Auto respawn after ghost completes ascension
      setTimeout(() => {
        this.respawn();
      }, 2800);
    }, 2000);
  }

  public toggleImmortal(): boolean {
    this.isImmortal = !this.isImmortal;
    if (this.isImmortal) {
      this.mobile.maxHp = 99999;
      this.mobile.hp = 99999;
    } else {
      this.mobile.maxHp = 1000;
      this.mobile.hp = 1000;
    }
    this.mobile.updateHpBar();
    return this.isImmortal;
  }

  public update(dt: number) {
    this.mobile.update(dt);
  }

  public spawnAt(x: number, y: number) {
    if (this.ghostEntity) {
      this.ghostEntity.cleanup();
      this.ghostEntity = undefined;
    }
    this.isDead = false;
    this.isBotBunged = false;
    this.mobile.alpha = 1.0;
    this.mobile.visible = true;
    this.isBotAirborne = false;
    this.botFallVy = 0;
    this.mobile.hp = this.mobile.maxHp;
    this.mobile.updateHpBar();

    const placement = this.terrain.getMobileSurfacePlacement(x, y);
    this.spawnX = x;
    this.spawnY = placement.y;
    this.mobile.x = x;
    this.mobile.y = placement.y;
    this.mobile.setFacing(-1);

    this.mobile.setTilt(placement.slope.angle);
    this.mobile.playAnimation("normal");
  }

  public respawn() {
    // Respawn stably at initial battle spawn post
    const placement = this.terrain.getMobileSurfacePlacement(this.spawnX, this.spawnY);
    this.spawnAt(this.spawnX, placement.y);
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
