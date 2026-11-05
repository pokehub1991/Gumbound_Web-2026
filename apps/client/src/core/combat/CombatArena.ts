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
import { DynamicExplosionEngine } from "../effects/DynamicExplosionEngine.js";
import { AutumnLeavesEngine } from "../effects/AutumnLeavesEngine.js";
import { ThorEntity } from "../effects/ThorEntity.js";
import { DeathGhostEntity } from "../effects/DeathGhostEntity.js";
import { ItemPowerupEntity } from "../effects/ItemPowerupEntity.js";

export class CombatArena {
  public engine: GameEngine;
  public terrain: TerrainRenderer;
  public player: MobileEntity;
  public bot: BotDummy;
  public aimController: AimController;

  public backgroundSprite?: Sprite;
  public destructionParticles: DestructionParticles;
  public dynamicExplosionEngine: DynamicExplosionEngine;
  public leavesEngine: AutumnLeavesEngine;
  public thor: ThorEntity;

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
  public onLastPowerUpdate?: (power: number | null) => void;
  public onTurnReady?: () => void;
  public onBotHpUpdate?: (hp: number, maxHp: number) => void;
  public onTurnUpdate?: (info: {
    turnNumber: number;
    maxTurns: number;
    activeTurn: "player" | "bot";
    playerDelay: number;
    botDelay: number;
  }) => void;
  public onActiveItemChange?: (item: "dual" | "teleport" | null) => void;
  public onChatMessage?: (msg: { sender: string; text: string; isSystem?: boolean }) => void;

  // Active Battle Item (Dual, Teleport)
  public activeItem: "dual" | "teleport" | null = null;

  // Turn tracking (Authentic GunBound match turns & delay accumulation)
  public turnNumber: number = 1;
  public maxTurns: number = 40;
  public activeTurn: "player" | "bot" = "player";
  public playerDelay: number = 0;
  public botDelay: number = 960;

  // Fall physics & Death Ghost
  private playerFallVy: number = 0;
  private isPlayerAirborne: boolean = false;
  private isPlayerBunged: boolean = false;
  public playerGhostEntity?: DeathGhostEntity;

  // Wind settings (disabled by default as requested: wind = 0)
  public isWindEnabled: boolean = false;

  // Drag Shoot Mode
  public shootMode: "space" | "drag" = "space";
  public isDraggingAim: boolean = false;
  private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private dragSmoothedPower: number = 0;
  private dragStaticDuration: number = 0;
  private dragLastPointerPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.orbitalEffectsContainer = new Container();
    this.destructionParticles = new DestructionParticles(this.engine.effectsContainer);
    this.dynamicExplosionEngine = new DynamicExplosionEngine(this.engine.effectsContainer);

    const mapDef = MAPS["metamine"];

    // 0. Autumn Leaves (Ambient system layered between background and terrain)
    this.leavesEngine = new AutumnLeavesEngine(undefined, mapDef.width, mapDef.height, 22);
    this.engine.worldContainer.addChildAt(this.leavesEngine.container, 0);

    // 1. Initialize Metamine Terrain (1800x904 px)
    this.terrain = new TerrainRenderer(mapDef.width, mapDef.height);
    this.terrain.onLoadedCallback = () => {
      // Reposition player and bot to true ground surface once map mask finishes loading
      this.respawnPlayer();
      this.resetBot(false);
      this.engine.panTo(704.5, 510, true);
      this.engine.playIntroZoom(0.52, 1.20);
    };
    this.engine.worldContainer.addChildAt(this.terrain, 1);

    // 2. Load Parallax Background
    this.loadBackground(mapDef.bg);

    // 3. Initialize Local Player on Metamine spawn
    const playerSpawn = mapDef.player1Spawn;
    const playerPlacement = this.terrain.getMobileSurfacePlacement(playerSpawn.x, playerSpawn.y);

    this.player = new MobileEntity({
      id: "player_local",
      nickname: "Player [Tú]",
      team: "A",
      mobileType: 0, // Armor by default
      maxHp: 1000,
      hp: 1000,
      x: playerSpawn.x,
      y: playerPlacement.y,
    });
    this.player.setFacing(1); // Face right toward enemy
    this.player.setTilt(playerPlacement.slope.angle);
    this.engine.mobilesContainer.addChild(this.player);

    // 4. Initialize Bot Dummy on Metamine right side
    const botSpawn = mapDef.botSpawn;
    this.bot = new BotDummy(this.terrain, botSpawn.x, botSpawn.y, 1);
    this.engine.mobilesContainer.addChild(this.bot);

    // 5. Orbital Laser & Satellite effects container
    this.engine.worldContainer.addChild(this.orbitalEffectsContainer);

    // Initialize authentic Thor Orbital Satellite in sky
    this.thor = new ThorEntity();
    this.engine.worldContainer.addChild(this.thor);

    // Foreground atmospheric autumn leaves (drifting in front of terrain & mobiles for depth)
    this.engine.worldContainer.addChild(this.leavesEngine.foregroundContainer);

    // 6. Connect AimController
    this.aimController = new AimController(this.terrain);
    this.aimController.setActiveMobile(this.player);

    // Preload firing, impact and movement audio effects so they play with zero network/decoding latency
    AudioManager.preload(["11fire.wav", "12fire.wav", "11blast.wav", "12blast.wav", "1move.wav", "1nmove.wav"]);

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

    // 7. Initial Wind (Disabled by default: 0)
    this.windPower = 0;
    this.windAngle = 0;

    // 8. Center Camera across the battlefield with authentic framing (centering Metamine bridge and framing clock tower at 1.2x)
    this.engine.panTo(704.5, 510, true);

    // 9. Play Battle Music
    AudioManager.playMusic("dbBattleMiramoTown.mp3");

    // 10. Frame Ticker
    this.engine.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // 11. Mouse Drag Shoot Listeners (Slice Shoot mode)
    window.addEventListener("pointerdown", (e) => {
      if (e.button === 0 && this.shootMode === "drag" && !this.isSimulating) {
        // Only trigger if click targets the game canvas directly (not HUD overlays, buttons or menus)
        const target = e.target as HTMLElement;
        if (!target || target.tagName !== "CANVAS") return;
        this.isDraggingAim = true;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.dragLastPointerPos = { x: e.clientX, y: e.clientY };
        this.dragSmoothedPower = 0;
        this.dragStaticDuration = 0;
        this.aimController.startCharging();
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (this.isDraggingAim && this.shootMode === "drag" && !this.isSimulating) {
        const moveDist = Math.hypot(e.clientX - this.dragLastPointerPos.x, e.clientY - this.dragLastPointerPos.y);
        if (moveDist > 1.2) {
          this.dragStaticDuration = 0;
          this.dragLastPointerPos = { x: e.clientX, y: e.clientY };
        }

        const dx = this.dragStartPos.x - e.clientX;
        const dy = this.dragStartPos.y - e.clientY;
        const dist = Math.hypot(dx, dy);
        // Drag span scaled to 360px for high-precision, low-jitter aiming
        const targetPower = Math.max(0, Math.min(100, (dist / 360) * 100));
        // Exponential moving average filter to dampen mouse twitching and jitter
        this.dragSmoothedPower = this.dragSmoothedPower * 0.70 + targetPower * 0.30;
        this.aimController.updateCharging(this.dragSmoothedPower);
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.isDraggingAim) {
        this.isDraggingAim = false;
        this.dragStaticDuration = 0;
        if (this.shootMode === "drag" && !this.isSimulating) {
          this.aimController.releaseFire();
        }
      }
    });
  }

  private async loadBackground(bgPath: string) {
    try {
      const texture = await Assets.load<Texture>(bgPath);
      this.backgroundSprite = new Sprite(texture);
      this.engine.parallaxContainer.addChild(this.backgroundSprite);
    } catch (e) {
      console.warn("[CombatArena] Could not load background image, using ambient clear:", e);
    }
  }

  public update(dt: number) {
    this.aimController.update(dt);
    this.player.update(dt);
    this.bot.update(dt);
    this.bot.checkGroundFall(dt);
    this.destructionParticles.update(dt);
    this.dynamicExplosionEngine.update(dt * 16.66);
    this.leavesEngine.update(dt);
    this.thor.update(dt);

    // Authentic Gunbound Slice/Drag mechanic:
    // If user holds cursor static without releasing left click, power indicator oscillates/vibrates
    if (this.isDraggingAim && this.shootMode === "drag" && !this.isSimulating) {
      this.dragStaticDuration += dt * 16.66;
      if (this.dragStaticDuration > 80 && this.dragSmoothedPower > 0) {
        const intensity = Math.min(1.0, (this.dragStaticDuration - 80) / 120);
        // Multi-frequency tremor: makes pinpoint pixel-perfect static holding difficult
        const tremor = (Math.sin(Date.now() * 0.038) * 1.8 + Math.cos(Date.now() * 0.083) * 0.9) * intensity;
        const vibratedPower = Math.max(0, Math.min(100, this.dragSmoothedPower + tremor));
        this.aimController.updateCharging(vibratedPower);
      }
    }

    // If bunged / fallen into the abyss, continue falling down into the void
    if (this.isPlayerBunged) {
      if (this.player.visible) {
        this.playerFallVy = Math.min(8.5, this.playerFallVy + 0.35 * dt);
        this.player.y += this.playerFallVy * dt;

        if (!this.engine.userHasManualCamera) {
          this.engine.panTo(this.player.x, Math.min(this.terrain.mapHeight + 60, this.player.y));
        }

        // Once the fallen mobile exits the bottom edge of the screen, change sprite to random.png and fly up!
        if (this.player.y >= this.terrain.mapHeight + 60) {
          this.player.visible = false;
          if (this.playerGhostEntity) {
            this.playerGhostEntity.cleanup();
          }
          this.playerGhostEntity = new DeathGhostEntity(this.player.x, this.terrain.mapHeight + 50);
          this.engine.effectsContainer.addChild(this.playerGhostEntity);
        }
      } else if (this.playerGhostEntity) {
        // Ghost ascends smoothly through the map to the top of the sky
        const active = this.playerGhostEntity.update(dt);
        if (!active) {
          this.playerGhostEntity = undefined;
        } else if (!this.engine.userHasManualCamera) {
          this.engine.panTo(this.player.x, Math.max(200, this.playerGhostEntity.y));
        }
      }
      return;
    }

    // If dead on terrain, handle player ghost ascending to heaven
    if (this.player.hp <= 0) {
      if (this.playerGhostEntity) {
        const active = this.playerGhostEntity.update(dt);
        if (!active) {
          this.playerGhostEntity = undefined;
        } else if (!this.engine.userHasManualCamera) {
          this.engine.panTo(this.player.x, Math.max(220, this.playerGhostEntity.y));
        }
      } else {
        const pPlacement = this.terrain.getMobileSurfacePlacement(this.player.x, this.player.y);
        this.player.y = pPlacement.y;
        this.player.setTilt(pPlacement.slope.angle);
      }
      return;
    }

    // Instant ground fall: whenever terrain beneath is destroyed, mobile falls immediately!
    const pPlacement = this.terrain.getMobileSurfacePlacement(this.player.x, this.player.y);
    const dropDistance = pPlacement.y - this.player.y;

    if (dropDistance > 3) {
      // Airborne gravity fall with authentic 'drop' animation
      if (!this.isPlayerAirborne) {
        this.isPlayerAirborne = true;
        this.aimController.isAirborne = true;
        this.player.playAnimation("drop", true);
      }
      this.playerFallVy = Math.min(6.5, this.playerFallVy + 0.25 * dt);
      this.player.y = Math.min(pPlacement.y, this.player.y + this.playerFallVy * dt);

      // Subtle natural tilt during air fall
      const targetFallTilt = this.player.facing * 0.10;
      this.player.setTilt(targetFallTilt);
    } else {
      if (this.isPlayerAirborne) {
        // Landing impact
        this.isPlayerAirborne = false;
        this.aimController.isAirborne = false;
        if (this.playerFallVy > 2.2) {
          AudioManager.play("click", 0.5);
          this.engine.shakeScreen(3, 140);
        }
        this.playerFallVy = 0;
        this.player.playAnimation("normal", true);
      }
      this.player.y = pPlacement.y;
      this.player.setTilt(pPlacement.slope.angle);
    }

    // Check player fall off map bottom or sides (bunge / void abyss fall)
    if (!this.isPlayerBunged && (this.player.y >= this.terrain.mapHeight - 30 || this.player.x < -30 || this.player.x > this.terrain.mapWidth + 30)) {
      this.isPlayerBunged = true;
      this.player.hp = 0;
      this.player.updateHpBar();
      this.isPlayerAirborne = true;
      this.aimController.enabled = false;
      this.aimController.stopMoving();
      this.player.playAnimation("drop", true);
      AudioManager.play("result_lose.mp3", 0.6);
      setTimeout(() => {
        this.respawnPlayer();
      }, 5000);
      return;
    }

    // Update active flying projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const proj = this.activeProjectiles[i];
      proj.update(dt);
    }

    // Camera follow active projectile: continuously track bullet horizontally (X) and vertically (Y)
    // Follows high sky arcs up to -1600 Y, and frames battlefield edges so bullet visibly flies off screen
    // PRIORITY: If the user uses right-click drag ("la manito"), manual camera control overrides bullet tracking!
    if (this.activeProjectiles.length > 0) {
      const leadProj = this.activeProjectiles.find((p) => !p.isExploding) || this.activeProjectiles[0];

      if (!this.engine.isDraggingCamera && !this.engine.userHasManualCamera) {
        // Smooth horizontal panning: clamp camera near map edges so camera stops and bullet flies off screen
        const minCamX = 220;
        const maxCamX = Math.max(1409, this.terrain.mapWidth) - 220;
        const targetX = Math.max(minCamX, Math.min(maxCamX, leadProj.currentX));

        // Vertical panning: track high sky shots up to -1600 and down into lower abyss
        const minCamY = -1600;
        const maxCamY = this.terrain.mapHeight - 140;
        const targetY = Math.max(minCamY, Math.min(maxCamY, leadProj.currentY));

        this.engine.panTo(targetX, targetY);
      }

      // If an out-of-bounds bullet has physically exited the visible screen, declare it lost and conclude turn
      for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
        const proj = this.activeProjectiles[i];
        if (proj.hitType === "oob" && !this.engine.isPointOnScreen(proj.currentX, proj.currentY, 60)) {
          proj.forceFinish();
        }
      }
    }

    if (this.onBotHpUpdate) {
      this.onBotHpUpdate(this.bot.mobile.hp, this.bot.mobile.maxHp);
    }
  }

  public setPlayerMobile(mobileId: number) {
    this.player.setMobileType(mobileId);
    this.aimController.setActiveMobile(this.player);

    const mobDef = MOBILES_DATA[mobileId];
    if (mobDef) {
      const soundsToPreload: string[] = [];
      if (mobDef.sound1) soundsToPreload.push(mobDef.sound1);
      if (mobDef.sound2) soundsToPreload.push(mobDef.sound2);
      if (mobDef.soundSS) soundsToPreload.push(mobDef.soundSS);
      if (mobDef.soundExplode) soundsToPreload.push(mobDef.soundExplode);
      if (mobDef.soundMove) soundsToPreload.push(mobDef.soundMove);
      if (mobDef.soundStop) soundsToPreload.push(mobDef.soundStop);
      if (soundsToPreload.length > 0) {
        AudioManager.preload(soundsToPreload);
      }
    }
  }

  public setBotMobile(mobileId: number) {
    this.bot.setMobileType(mobileId);
  }

  public setShootMode(mode: "space" | "drag") {
    this.shootMode = mode;
    this.aimController.shootMode = mode;
    if (mode === "space" && this.isDraggingAim) {
      this.isDraggingAim = false;
    }
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
    if (!this.isWindEnabled) {
      this.windPower = 0;
      this.windAngle = 0;
      if (this.onWindUpdate) this.onWindUpdate(0, 0);
      return;
    }
    const power = 1 + Math.floor(Math.random() * 25);
    const angle = Math.floor(Math.random() * 360);
    this.setWind(power, angle);
  }

  public toggleWind(): boolean {
    this.isWindEnabled = !this.isWindEnabled;
    if (this.isWindEnabled) {
      const power = 1 + Math.floor(Math.random() * 25);
      const angle = Math.floor(Math.random() * 360);
      this.setWind(power, angle);
    } else {
      this.setWind(0, this.windAngle);
    }
    return this.isWindEnabled;
  }

  public toggleBotImmortality(): boolean {
    const isImmortal = this.bot.toggleImmortal();
    if (this.onBotHpUpdate) {
      this.onBotHpUpdate(this.bot.mobile.hp, this.bot.mobile.maxHp);
    }
    return isImmortal;
  }

  public activateItem(item: "dual" | "teleport" | null) {
    this.activeItem = item;
    if (this.onActiveItemChange) {
      this.onActiveItemChange(item);
    }
    if (item !== null) {
      // Spawn authentic circular USEITEM glow
      const powerup = new ItemPowerupEntity(this.player.x, this.player.y - 10);
      this.engine.effectsContainer.addChild(powerup);

      // Play original item activation sound
      AudioManager.play("dual_snd", 0.9);

      // Trigger mobile item animation if supported
      this.player.playAnimation("item", false, () => {
        this.player.playAnimation("normal", true);
      });
    }
  }

  public fireShot(rawAngle: number, power: number, shotType: number) {
    if (this.isSimulating) return;
    this.isSimulating = true;
    this.aimController.enabled = false;

    // Report last shot power for power bar guide marker
    if (this.onLastPowerUpdate) {
      this.onLastPowerUpdate(power);
    }

    const itemUsed = this.activeItem;
    if (itemUsed) {
      this.activeItem = null;
      if (this.onActiveItemChange) {
        this.onActiveItemChange(null);
      }
    }

    // Update delay points for turn order
    let delayCost = shotType === 2 ? 1200 : shotType === 1 ? 900 : 740;
    if (itemUsed === "dual") {
      delayCost += 600; // Classic Dual delay penalty
    }
    this.playerDelay += delayCost;
    if (this.onTurnUpdate) {
      this.onTurnUpdate({
        turnNumber: this.turnNumber,
        maxTurns: this.maxTurns,
        activeTurn: this.activeTurn,
        playerDelay: this.playerDelay,
        botDelay: this.botDelay,
      });
    }

    // Trigger SS battlefield darkness if Shot 2 / SS
    if (shotType === 2) {
      this.engine.setSSOverlay(true);
    }

    // Camera firmly holds on mobile during firing animation and resets manual camera override
    this.engine.userHasManualCamera = false;
    this.engine.panTo(this.player.x, this.player.y);

    // Compute ballistics from mobile root coordinates (computeMuzzle calculates exact cannon pivot)
    const params: FireParams = {
      x: this.player.x,
      y: this.player.y,
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
      targets: !this.bot.isDead && this.bot.mobile.hp > 0
        ? [{ id: "bot", x: this.bot.mobile.x, y: this.bot.mobile.y - 14, radius: 26 }]
        : [],
    };

    const trajectories = BallisticsEngine.simulateShot(params);

    // 1. Transition pause: +10ms delay per shot type (Tiro 1: 10ms, Tiro 2: 110ms [+10ms], SS: 90ms)
    const fireAnim = shotType === 2 ? "sfire" : shotType === 1 ? "fire2" : "fire1";
    const chargeToFireDelayMs = shotType === 0 ? 10 : shotType === 1 ? 110 : 90;

    const startFiringAnimation = () => {
      this.player.playAnimation(fireAnim, false, () => {
        this.player.playAnimation("normal");
      });
    };

    const isTeleport = itemUsed === "teleport";

    if (itemUsed === "dual") {
      let completedVolleys = 0;
      const onVolleyDone = () => {
        completedVolleys++;
        if (completedVolleys >= 2) {
          this.onAllProjectilesFinished();
        }
      };

      // Volley 1 Firing Animation & Launch
      if (chargeToFireDelayMs > 0) {
        setTimeout(startFiringAnimation, chargeToFireDelayMs);
      } else {
        startFiringAnimation();
      }

      const blastDelayMs = chargeToFireDelayMs + (shotType === 2 ? 780 : shotType === 1 ? 620 : 220);
      setTimeout(() => {
        this.launchTrajectories(trajectories, onVolleyDone, false);
      }, blastDelayMs);

      // Volley 2 Firing Animation & Launch (Authentic GunBound ~600ms rhythm)
      const volley2Start = blastDelayMs + 600;
      setTimeout(() => {
        startFiringAnimation();
        setTimeout(() => {
          this.launchTrajectories(trajectories, onVolleyDone, false);
        }, 180);
      }, volley2Start);
      return;
    }

    if (chargeToFireDelayMs > 0) {
      setTimeout(startFiringAnimation, chargeToFireDelayMs);
    } else {
      startFiringAnimation();
    }

    // 2. Projectile ejection blast timing (transition delay + recoil animation timing)
    const blastDelayMs = chargeToFireDelayMs + (shotType === 2 ? 780 : shotType === 1 ? 620 : 220);

    setTimeout(() => {
      // 3. Real shot trigger: Projectiles launch with synchronized firing audio and muzzle blast effect
      this.launchTrajectories(trajectories, undefined, isTeleport);
    }, blastDelayMs);
  }

  private launchTrajectories(trajectories: ShotTrajectory[], onFinish?: () => void, isTeleport: boolean = false) {
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
        // Trigger firing sound synchronized EXACTLY when projectile shoots out
        const soundToPlay = traj.soundFire || soundFire;
        const volume = idx === 0 ? 0.9 : 0.75;
        AudioManager.play(soundToPlay, volume);

        // Trigger firing visual effect (muzzle flash, sparks and smoke) synchronized at muzzle position
        const launchPos = traj.points[0] || { x: this.player.x, y: this.player.y };
        const launchAngle = traj.points.length > 1
          ? (Math.atan2(traj.points[1].y - traj.points[0].y, traj.points[1].x - traj.points[0].x) * 180) / Math.PI
          : this.player.angleDeg;
        this.destructionParticles.spawnMuzzleBlast(launchPos.x, launchPos.y, launchAngle, this.selectedShotType);

        const proj = new ProjectileEntity(
          traj.points,
          this.player.mobileType,
          this.selectedShotType,
          () => {
            if (isTeleport) {
              this.handleTeleportImpact(traj);
            } else {
              this.handleImpact(traj);
            }
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
              if (onFinish) {
                onFinish();
              } else {
                this.onAllProjectilesFinished();
              }
            }
          },
          traj.subType,
          traj.hitType,
          traj.bungeRadius,
          traj.damage
        );

        this.activeProjectiles.push(proj);
        this.engine.projectilesContainer.addChild(proj);
      }, delay);
    });
  }

  private handleTeleportImpact(traj: ShotTrajectory) {
    if (!traj.finalPos) return;
    const impact = traj.finalPos;
    if (impact.x >= 0 && impact.x <= this.terrain.mapWidth && impact.y < this.terrain.mapHeight) {
      const place = this.terrain.getMobileSurfacePlacement(impact.x, impact.y);
      this.player.x = impact.x;
      this.player.y = place.y;
      this.player.setTilt(place.slope.angle);

      // Spawn teleport circular explosion effect
      const teleportEffect = new ItemPowerupEntity(impact.x, place.y - 10);
      this.engine.effectsContainer.addChild(teleportEffect);
      AudioManager.play("11blast", 0.9);

      if (!this.engine.userHasManualCamera) {
        this.engine.panTo(impact.x, place.y);
      }
    }
  }

  private handleImpact(traj: ShotTrajectory) {
    // Out-of-bounds shots vanish into the void without detonating an explosion, hole, or sound in the sky
    if (traj.hitType === "oob") {
      return;
    }

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
    if (this.player.hp <= 0 || this.isPlayerBunged) return;
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.player.updateHpBar();
    this.player.showDamagePopup(damage);

    if (this.player.hp <= 0) {
      this.isPlayerAirborne = false;
      this.aimController.isAirborne = false;
      this.aimController.stopMoving();
      this.player.setTilt(0);

      // Play authentic GunBound surrender/defeat animation while staying in place for 2 seconds
      this.player.playAnimation("dead", true);
      AudioManager.play("result_lose.mp3", 0.6);

      // Retraso de 2 segundos antes de que el móvil desaparezca y el fantasma vuele al cielo
      setTimeout(() => {
        if (this.player.hp > 0) return;
        this.player.visible = false;

        // Dedicated animated death ghost ascends straight up to heaven
        if (this.playerGhostEntity) {
          this.playerGhostEntity.cleanup();
        }
        this.playerGhostEntity = new DeathGhostEntity(this.player.x, this.player.y);
        this.engine.effectsContainer.addChild(this.playerGhostEntity);

        // Respawn player once the ghost has completed its ascension
        setTimeout(() => {
          this.respawnPlayer();
        }, 2800);
      }, 2000);

      return;
    }

    const isFrontHit =
      (this.player.facing === 1 && impactX >= this.player.x) ||
      (this.player.facing === -1 && impactX <= this.player.x);

    this.player.playAnimation(isFrontHit ? "fdamage" : "bdamage", false, () => {
      if (this.player.hp > 0) {
        this.player.playAnimation("normal");
      }
    });
  }

  public respawnPlayer() {
    this.isPlayerBunged = false;
    this.playerFallVy = 0;
    this.isPlayerAirborne = false;
    this.aimController.enabled = true;
    this.aimController.isAirborne = false;
    if (this.playerGhostEntity) {
      this.playerGhostEntity.cleanup();
      this.playerGhostEntity = undefined;
    }
    const mapDef = MAPS["metamine"];
    const spawn = mapDef.player1Spawn;
    const placement = this.terrain.getMobileSurfacePlacement(spawn.x, spawn.y);
    this.player.x = spawn.x;
    this.player.y = placement.y;
    this.player.hp = this.player.maxHp;
    this.player.alpha = 1.0;
    this.player.visible = true;
    this.player.updateHpBar();
    this.player.setFacing(1);
    this.player.setTilt(placement.slope.angle);
    this.player.playAnimation("normal");
  }

  private handleSpecialOrbitalBeams(traj: ShotTrajectory) {
    const { x, y } = traj.finalPos;

    if (traj.subType === "aduka_thor_tracker" || this.player.mobileType === 2) {
      // Aduka: Authentic Thor Satellite Orbital Laser strike
      if (this.thor) {
        this.thor.fireBeam(x, y, traj.damage);
      } else {
        this.drawDescendingLaser(x, y, 0x38bdf8, 10, 360);
        AudioManager.play("82blast", 0.85);
      }
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

    // Turn advancement and bot delay progression
    this.turnNumber = Math.min(this.maxTurns, this.turnNumber + 1);
    this.botDelay += 850;
    if (this.onTurnUpdate) {
      this.onTurnUpdate({
        turnNumber: this.turnNumber,
        maxTurns: this.maxTurns,
        activeTurn: this.activeTurn,
        playerDelay: this.playerDelay,
        botDelay: this.botDelay,
      });
    }

    // Randomize wind for next turn
    this.randomizeWind();

    // Pan camera back to player and re-enable aim
    setTimeout(() => {
      this.engine.userHasManualCamera = false;
      this.aimController.enabled = true;
      this.aimController.setActiveMobile(this.player);
      this.engine.panTo(this.player.x + 80, this.player.y - 40);

      if (this.onTurnReady) {
        this.onTurnReady();
      }
    }, 600);
  }

  public resetBot(useRandomPos: boolean = false) {
    const mapDef = MAPS["metamine"];
    const botSpawn = mapDef.botSpawn;
    const groundPos = useRandomPos
      ? this.terrain.getRandomGroundPosition(250, Math.min(1300, this.terrain.mapWidth - 200))
      : botSpawn;
    const placement = this.terrain.getMobileSurfacePlacement(groundPos.x, groundPos.y);
    this.bot.spawnAt(groundPos.x, placement.y);
    if (this.onBotHpUpdate) {
      this.onBotHpUpdate(this.bot.mobile.hp, this.bot.mobile.maxHp);
    }
  }

  public resetCamera() {
    this.engine.panTo(704.5, 510);
    this.engine.playIntroZoom(0.52, 1.20);
  }

  public async resetMap() {
    this.turnNumber = 1;
    this.playerDelay = 0;
    this.botDelay = 960;
    this.activeTurn = "player";
    this.isPlayerBunged = false;
    if (this.playerGhostEntity) {
      this.playerGhostEntity.cleanup();
      this.playerGhostEntity = undefined;
    }
    this.activeItem = null;
    if (this.onActiveItemChange) {
      this.onActiveItemChange(null);
    }
    if (this.onLastPowerUpdate) {
      this.onLastPowerUpdate(null as unknown as number);
    }
    if (this.onTurnUpdate) {
      this.onTurnUpdate({
        turnNumber: this.turnNumber,
        maxTurns: this.maxTurns,
        activeTurn: this.activeTurn,
        playerDelay: this.playerDelay,
        botDelay: this.botDelay,
      });
    }

    this.destructionParticles.clear();
    this.dynamicExplosionEngine.clear();
    await this.terrain.loadMap("metamine");
    this.leavesEngine.setMapBounds(this.terrain.mapWidth, this.terrain.mapHeight);
    this.respawnPlayer();
    this.resetBot(false);
    this.resetCamera();
    this.randomizeWind();
  }

  public setDynamicExplosions(enabled: boolean) {
    DynamicExplosionEngine.isDynamicEnabled = enabled;
  }

  public destroy() {
    this.aimController.destroy();
    this.dynamicExplosionEngine.clear();
    this.destructionParticles.clear();
    this.leavesEngine.destroy();
    this.thor.destroy();
  }
}
