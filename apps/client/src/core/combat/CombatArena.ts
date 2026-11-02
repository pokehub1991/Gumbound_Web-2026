import { Container, Graphics, Sprite, Texture, Assets } from "pixi.js";
import { GameEngine } from "../engine/GameEngine.js";
import { MobileEntity } from "../entities/MobileEntity.js";
import { ProjectileEntity } from "../entities/ProjectileEntity.js";
import { BotDummy } from "./BotDummy.js";
import { AimController } from "../controls/AimController.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { BallisticsEngine, ShotTrajectory, FireParams } from "../physics/BallisticsEngine.js";
import { MOBILES_DATA } from "../constants/mobiles.js";
import { MAPS } from "../constants/maps.js";
import { AudioManager } from "../audio/AudioManager.js";
import { DestructionParticles } from "../effects/DestructionParticles.js";

export class CombatArena {
  public engine: GameEngine;
  public terrain: TerrainRenderer;
  public player: MobileEntity;
  public bot: BotDummy;
  public aimController: AimController;

  public backgroundSprite?: Sprite;
  public destructionParticles: DestructionParticles;

  public windPower: number = 8;
  public windAngle: number = 45;

  public selectedShotType: number = 0; // 0 = Shot 1, 1 = Shot 2, 2 = SS
  public isSimulating: boolean = false;

  private activeProjectiles: ProjectileEntity[] = [];
  private orbitalEffectsContainer: Container;

  // UI callbacks for React state synchronization
  public onWindUpdate?: (power: number, angle: number) => void;
  public onPlayerAngleUpdate?: (angle: number) => void;
  public onPlayerPowerUpdate?: (power: number) => void;
  public onLastPowerUpdate?: (power: number) => void;
  public onTurnReady?: () => void;
  public onBotHpUpdate?: (hp: number, maxHp: number) => void;

  // Fall physics
  private playerFallVy: number = 0;
  private isPlayerAirborne: boolean = false;

  // Drag Shoot Mode
  public shootMode: "space" | "drag" = "space";
  public isDraggingAim: boolean = false;
  private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.orbitalEffectsContainer = new Container();
    this.destructionParticles = new DestructionParticles(this.engine.effectsContainer);

    const mapDef = MAPS["metamine"];

    // 1. Initialize Metamine Terrain (1800x904 px)
    this.terrain = new TerrainRenderer(mapDef.width, mapDef.height);
    this.engine.worldContainer.addChildAt(this.terrain, 0);

    // 2. Load Parallax Background
    this.loadBackground(mapDef.bg);

    // 3. Initialize Local Player on Metamine spawn
    const playerSpawn = mapDef.player1Spawn;
    const playerGroundY = this.terrain.findSurfaceY(playerSpawn.x, playerSpawn.y);

    this.player = new MobileEntity({
      id: "player_local",
      nickname: "Player [You]",
      team: "A",
      mobileType: 0, // Armor by default
      maxHp: 1000,
      hp: 1000,
      x: playerSpawn.x,
      y: playerGroundY,
    });
    this.player.setFacing(1); // Face right toward enemy
    const pSlope = this.terrain.getSlopeAngle(this.player.x, this.player.y);
    this.player.setTilt(pSlope.angle);
    this.engine.mobilesContainer.addChild(this.player);

    // 4. Initialize Bot Dummy on Metamine right side
    const botSpawn = mapDef.botSpawn;
    this.bot = new BotDummy(this.terrain, botSpawn.x, botSpawn.y, 1);
    this.engine.mobilesContainer.addChild(this.bot);

    // 5. Orbital Laser & Satellite effects container
    this.engine.worldContainer.addChild(this.orbitalEffectsContainer);

    // 6. Connect AimController
    this.aimController = new AimController(this.terrain);
    this.aimController.setActiveMobile(this.player);

    this.aimController.onFireCallback = (angle, power, shotType) => {
      this.fireShot(angle, power, shotType);
    };

    this.aimController.onAngleChange = (angle) => {
      if (this.onPlayerAngleUpdate) this.onPlayerAngleUpdate(angle);
    };

    this.aimController.onPowerChange = (power) => {
      if (this.onPlayerPowerUpdate) this.onPlayerPowerUpdate(power);
    };

    this.aimController.onShotTypeChange = (type) => {
      this.selectedShotType = type;
    };

    // 7. Initial Wind
    this.randomizeWind();

    // 8. Center Camera across the battlefield with authentic framing
    this.engine.panTo(700, 520, true);

    // 9. Play Battle Music
    AudioManager.playMusic("dbBattleMiramoTown.mp3");

    // 10. Frame Ticker
    this.engine.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // 11. Mouse Drag Shoot Listeners (Slice Shoot mode)
    window.addEventListener("pointerdown", (e) => {
      if (e.button === 0 && this.shootMode === "drag" && !this.isSimulating) {
        // Only trigger if click targets canvas or background (not interactive buttons)
        const target = e.target as HTMLElement;
        if (target && target.tagName === "BUTTON") return;
        this.isDraggingAim = true;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.aimController.power = 0;
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (this.isDraggingAim && this.shootMode === "drag" && !this.isSimulating) {
        const dx = this.dragStartPos.x - e.clientX;
        const dy = this.dragStartPos.y - e.clientY;
        const dist = Math.hypot(dx, dy);
        const power = Math.max(0, Math.min(100, (dist / 220) * 100));
        this.aimController.power = power;
        if (this.onPlayerPowerUpdate) this.onPlayerPowerUpdate(power);
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.isDraggingAim && this.shootMode === "drag" && !this.isSimulating) {
        this.isDraggingAim = false;
        const finalPower = Math.round(this.aimController.power);
        if (finalPower >= 5) {
          this.fireShot(this.player.angleDeg, finalPower, this.selectedShotType);
        }
        this.aimController.power = 0;
        if (this.onPlayerPowerUpdate) this.onPlayerPowerUpdate(0);
      }
    });
  }

  private async loadBackground(bgPath: string) {
    try {
      const texture = await Assets.load<Texture>(bgPath);
      this.backgroundSprite = new Sprite(texture);
      // Stretch background and elevate higher (-500) so clock tower and castle align with bridge like DragonBound
      this.backgroundSprite.width = Math.max(this.engine.worldWidth + 800, 2400);
      this.backgroundSprite.height = Math.max(this.engine.worldHeight + 600, 1600);
      this.backgroundSprite.position.set(-400, -500);
      this.engine.parallaxContainer.addChild(this.backgroundSprite);
    } catch (e) {
      console.warn("[CombatArena] Could not load background image, using ambient clear:", e);
    }
  }

  public update(dt: number) {
    this.aimController.update(dt);
    this.bot.checkGroundFall();
    this.destructionParticles.update(dt);

    // Check player ground fall with smooth airborne gravity physics
    if (!this.isSimulating) {
      const pSurface = this.terrain.findSurfaceY(this.player.x, this.player.y);
      const dropDistance = pSurface - this.player.y;

      if (dropDistance > 4) {
        // Airborne gravity fall with authentic 'drop' animation
        if (!this.isPlayerAirborne) {
          this.isPlayerAirborne = true;
          this.player.playAnimation("drop", true);
        }
        this.playerFallVy += 0.55 * dt;
        this.player.y += this.playerFallVy * dt;

        // Subtle natural tilt during air fall
        const targetFallTilt = this.player.facing * 0.12;
        this.player.setTilt(targetFallTilt);
      } else {
        if (this.isPlayerAirborne) {
          // Landing impact
          this.isPlayerAirborne = false;
          if (this.playerFallVy > 3.0) {
            AudioManager.play("click", 0.5);
            this.engine.shakeScreen(3, 140);
          }
          this.playerFallVy = 0;
          this.player.playAnimation("normal", true);
        }
        this.player.y = pSurface;
        const slope = this.terrain.getSlopeAngle(this.player.x, this.player.y);
        this.player.setTilt(slope.angle);
      }

      // Check player fall off map bottom (bunge)
      if (this.player.y >= this.terrain.mapHeight - 30 && this.player.hp > 0) {
        this.damagePlayer(this.player.hp, this.player.x, this.player.y);
      }
    }

    // Update active flying projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const proj = this.activeProjectiles[i];
      proj.update(dt);
    }

    // Camera follow active projectile: keep Camera Y bounded within background limits on high sky shots
    // while continuously tracking the bullet's horizontal X trajectory across the map
    if (this.activeProjectiles.length > 0) {
      const leadProj = this.activeProjectiles.find((p) => !p.isExploding) || this.activeProjectiles[0];
      const minCamY = 320; // Holds camera at upper sky limit while bullet travels above screen
      const targetY = Math.max(minCamY, leadProj.currentY);
      this.engine.panTo(leadProj.currentX, targetY);
    }

    if (this.onBotHpUpdate) {
      this.onBotHpUpdate(this.bot.mobile.hp, this.bot.mobile.maxHp);
    }
  }

  public setPlayerMobile(mobileId: number) {
    this.player.setMobileType(mobileId);
    this.aimController.setActiveMobile(this.player);
  }

  public setBotMobile(mobileId: number) {
    this.bot.setMobileType(mobileId);
  }

  public setShotType(type: number) {
    this.selectedShotType = type;
    this.aimController.setShotType(type);
  }

  public setWind(power: number, angle: number) {
    this.windPower = Math.max(0, Math.min(26, power));
    this.windAngle = (angle + 360) % 360;
    if (this.onWindUpdate) {
      this.onWindUpdate(this.windPower, this.windAngle);
    }
  }

  public randomizeWind() {
    const power = Math.floor(Math.random() * 25);
    const angle = Math.floor(Math.random() * 360);
    this.setWind(power, angle);
  }

  public fireShot(rawAngle: number, power: number, shotType: number) {
    if (this.isSimulating) return;
    this.isSimulating = true;
    this.aimController.enabled = false;

    // Report last shot power for power bar guide marker
    if (this.onLastPowerUpdate) {
      this.onLastPowerUpdate(power);
    }

    // Trigger SS battlefield darkness if Shot 2 / SS
    if (shotType === 2) {
      this.engine.setSSOverlay(true);
    }

    // Camera firmly holds on mobile during firing animation
    this.engine.panTo(this.player.x, this.player.y);

    // Compute firing sound
    const mobileDef = MOBILES_DATA[this.player.mobileType] || MOBILES_DATA[0];
    const defaultSound = shotType === 2 ? "12fire" : "11fire";
    const soundFire = (shotType === 2 ? mobileDef.soundSS : shotType === 1 ? mobileDef.sound2 : mobileDef.sound1) || defaultSound;

    // Compute ballistics
    const muzzle = this.player.getMuzzlePosition();
    const params: FireParams = {
      x: muzzle.x,
      y: muzzle.y,
      rawAngle,
      power,
      look: this.player.facing === -1 ? 0 : 1,
      bodyAngle: (this.player.slopeAngle * 180) / Math.PI,
      mobileId: this.player.mobileType,
      shotType,
      windPower: this.windPower,
      windAngle: this.windAngle,
      isPixelSolid: (x, y) => this.terrain.isGround(x, y),
      mapWidth: this.terrain.mapWidth,
      mapHeight: this.terrain.mapHeight,
    };

    const trajectories = BallisticsEngine.simulateShot(params);

    // Firing recoil animation plays FIRST; projectile and sound launch strictly after animation finishes
    const fireAnim = shotType === 2 ? "sfire" : shotType === 1 ? "fire2" : "fire1";
    let launched = false;
    const launchAfterAnimation = () => {
      if (launched) return;
      launched = true;
      this.player.playAnimation("normal");
      AudioManager.play(soundFire, 0.9);
      this.launchTrajectories(trajectories);
    };

    this.player.playAnimation(fireAnim, false, () => {
      launchAfterAnimation();
    });

    // Fallback timer ensures shot launches even if animation sprite is uninitialized
    const recoilFallbackMs = shotType === 2 ? 620 : shotType === 1 ? 520 : 380;
    setTimeout(() => {
      launchAfterAnimation();
    }, recoilFallbackMs);
  }

  private launchTrajectories(trajectories: ShotTrajectory[]) {
    let completedCount = 0;
    const total = trajectories.length;

    const mobileDef = MOBILES_DATA[this.player.mobileType] || MOBILES_DATA[0];
    const defaultSound = this.selectedShotType === 2 ? "12fire" : "11fire";
    const soundFire =
      (this.selectedShotType === 2
        ? mobileDef.soundSS
        : this.selectedShotType === 1
        ? mobileDef.sound2
        : mobileDef.sound1) || defaultSound;

    trajectories.forEach((traj, idx) => {
      const delay = traj.launchDelayMs !== undefined ? traj.launchDelayMs : idx * 60;

      setTimeout(() => {
        // Trigger firing sound on staggered launches (idx > 0)
        if (idx > 0 && delay > 0) {
          AudioManager.play(traj.soundFire || soundFire, 0.75);
        }

        const proj = new ProjectileEntity(
          traj.points,
          this.player.mobileType,
          this.selectedShotType,
          () => {
            this.handleImpact(traj);
          },
          () => {
            const index = this.activeProjectiles.indexOf(proj);
            if (index !== -1) {
              this.activeProjectiles.splice(index, 1);
            }
            this.engine.projectilesContainer.removeChild(proj);
            proj.destroy();

            completedCount++;
            if (completedCount >= total) {
              this.onAllProjectilesFinished();
            }
          },
          traj.subType
        );

        this.activeProjectiles.push(proj);
        this.engine.projectilesContainer.addChild(proj);
      }, delay);
    });
  }

  private handleImpact(traj: ShotTrajectory) {
    const { x, y } = traj.finalPos;

    // 1. Excavate 3D crater on Metamine terrain
    this.terrain.carveCrater(x, y, traj.bungeRadius, traj.bungeRadius * 0.85);

    // Dynamic terrain destruction particle burst (rock debris, sparks, dust)
    this.destructionParticles.spawnExplosionDebris(x, y, traj.bungeRadius, traj.damage);

    // 2. Play detonation blast sound
    const mobileDef = MOBILES_DATA[this.player.mobileType] || MOBILES_DATA[0];
    AudioManager.play(mobileDef.soundExplode || "11blast", 0.9);

    // 3. Screen rumble proportional to crater radius
    const shakeIntensity = traj.bungeRadius > 45 ? 9 : 5;
    this.engine.shakeScreen(shakeIntensity, 340);

    // 4. Special satellite orbital beams (Aduka Thor, ASate, Knight, Lightning)
    this.handleSpecialOrbitalBeams(traj);

    // 5. Bot Dummy collision damage check
    const distToBot = Math.hypot(this.bot.mobile.x - x, this.bot.mobile.y - y);
    const blastRadius = traj.bungeRadius * 1.5;

    if (distToBot <= blastRadius) {
      const falloff = 1 - distToBot / blastRadius;
      const appliedDamage = Math.round(traj.damage * (0.45 + 0.55 * falloff));
      this.bot.takeDamage(appliedDamage, x, y);
    }

    // 6. Player explosion/collision damage check (Splash / Self-damage)
    const distToPlayer = Math.hypot(this.player.x - x, this.player.y - y);
    if (distToPlayer <= blastRadius) {
      const falloff = 1 - distToPlayer / blastRadius;
      const appliedDamage = Math.round(traj.damage * (0.45 + 0.55 * falloff));
      this.damagePlayer(appliedDamage, x, y);
    }
  }

  public damagePlayer(damage: number, impactX: number, _impactY: number) {
    if (this.player.hp <= 0) return;
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.player.updateHpBar();
    this.player.showDamagePopup(damage);

    const isFrontHit =
      (this.player.facing === 1 && impactX >= this.player.x) ||
      (this.player.facing === -1 && impactX <= this.player.x);

    this.player.playAnimation(isFrontHit ? "fdamage" : "bdamage", false, () => {
      if (this.player.hp > 0) {
        this.player.playAnimation("normal");
      }
    });

    if (this.player.hp <= 0) {
      this.player.playAnimation("dead", false);
      AudioManager.play("result_lose.mp3", 0.6);
      setTimeout(() => {
        this.respawnPlayer();
      }, 2000);
    }
  }

  public respawnPlayer() {
    const mapDef = MAPS["metamine"];
    const spawn = mapDef.player1Spawn;
    const groundY = this.terrain.getFirstSolidY(spawn.x) ?? spawn.y;
    this.player.x = spawn.x;
    this.player.y = groundY;
    this.player.hp = this.player.maxHp;
    this.player.alpha = 1.0;
    this.player.updateHpBar();
    this.player.setFacing(1);
    const slope = this.terrain.getSlopeAngle(spawn.x, groundY);
    this.player.setTilt(slope.angle);
    this.player.playAnimation("normal");
  }

  private handleSpecialOrbitalBeams(traj: ShotTrajectory) {
    const { x, y } = traj.finalPos;

    if (traj.subType === "aduka_thor_tracker" || this.player.mobileType === 2) {
      // Aduka: Thor Satellite Orbital Laser descending from ion altitude
      this.drawDescendingLaser(x, y, 0x38bdf8, 10, 360);
      AudioManager.play("82blast", 0.85);
    } else if (traj.subType === "asate_ion_beacon" || this.player.mobileType === 6) {
      // ASate: High Ion Laser Strike
      this.drawDescendingLaser(x, y, 0x60a5fa, 12, 420);
      AudioManager.play("10s1blast", 0.9);
    } else if (traj.subType === "knight_ion_beacon" || this.player.mobileType === 8) {
      // Knight: Energy Sabers descending
      this.drawDescendingLaser(x, y, 0xfacc15, 12, 400);
      AudioManager.play("10s1blast", 0.9);
    } else if (traj.subType === "lightning_strike" || this.player.mobileType === 3) {
      // Lightning: Vertical electric lightning arcs
      this.drawDescendingLaser(x, y, 0xc084fc, 8, 280);
      AudioManager.play("82fire", 0.85);
    }
  }

  private drawDescendingLaser(targetX: number, targetY: number, color: number, width: number, durationMs: number) {
    const beam = new Graphics();
    beam.moveTo(targetX, -400);
    beam.lineTo(targetX, targetY);
    beam.stroke({ width: width * 2, color: 0xffffff, alpha: 0.95 });
    beam.moveTo(targetX, -400);
    beam.lineTo(targetX, targetY);
    beam.stroke({ width, color, alpha: 0.85 });

    this.orbitalEffectsContainer.addChild(beam);

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      beam.alpha = Math.max(0, 1 - elapsed / durationMs);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        this.orbitalEffectsContainer.removeChild(beam);
        beam.destroy();
      }
    }, 16);
  }

  private onAllProjectilesFinished() {
    this.isSimulating = false;
    this.engine.setSSOverlay(false);

    // Randomize wind for next turn
    this.randomizeWind();

    // Pan camera back to player and re-enable aim
    setTimeout(() => {
      this.aimController.enabled = true;
      this.aimController.setActiveMobile(this.player);
      this.engine.panTo(this.player.x + 80, this.player.y - 40);

      if (this.onTurnReady) {
        this.onTurnReady();
      }
    }, 600);
  }

  public resetBot() {
    // Spawn bot at a random position on the map, ALWAYS placed solidly on the ground surface
    const randPos = this.terrain.getRandomGroundPosition(650, Math.min(1250, this.terrain.mapWidth - 150));
    this.bot.spawnAt(randPos.x, randPos.y);
    if (this.onBotHpUpdate) {
      this.onBotHpUpdate(this.bot.mobile.hp, this.bot.mobile.maxHp);
    }
  }

  public resetCamera() {
    this.engine.panTo(700, 520);
    this.engine.setZoom(1.08);
  }

  public async resetMap() {
    this.destructionParticles.clear();
    await this.terrain.loadMap("metamine");
    this.respawnPlayer();
    this.resetBot();
    this.resetCamera();
    this.randomizeWind();
  }

  public destroy() {
    this.aimController.destroy();
  }
}
