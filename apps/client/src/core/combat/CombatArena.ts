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

export const PLAYABLE_BOT_MOBILES: number[] = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 22, 23, 24];
import { DestructionParticles } from "../effects/DestructionParticles.js";
import { DynamicExplosionEngine } from "../effects/DynamicExplosionEngine.js";
import { AutumnLeavesEngine } from "../effects/AutumnLeavesEngine.js";
import { ThorEntity } from "../effects/ThorEntity.js";
import { DeathGhostEntity } from "../effects/DeathGhostEntity.js";
import { FloatingParticlePowerupEntity } from "../effects/FloatingParticlePowerupEntity.js";
import { WeatherManager, WeatherDefinition, WeatherType, WeatherSlotItem, ActiveWeatherColumn, WeatherRoundInfo } from "../weather/WeatherManager.js";
import { WeatherColumnEntity } from "../weather/WeatherColumnEntity.js";
import { WeatherSkyMarker } from "../weather/WeatherSkyMarker.js";

export class CombatArena {
  public engine: GameEngine;
  public terrain: TerrainRenderer;
  public player: MobileEntity;
  public bots: BotDummy[] = [];
  public get bot(): BotDummy {
    return this.bots[0];
  }
  public set bot(b: BotDummy) {
    this.bots[0] = b;
  }
  public actingBot: BotDummy | null = null;
  public aimController: AimController;

  public backgroundSprite?: Sprite;
  public destructionParticles: DestructionParticles;
  public dynamicExplosionEngine: DynamicExplosionEngine;
  public leavesEngine: AutumnLeavesEngine;
  public thor: ThorEntity;
  public weatherManager: WeatherManager;
  public weatherSkyMarker: WeatherSkyMarker;
  private weatherContainer: Container;
  private activeColumnEntity?: WeatherColumnEntity;
  private fadingColumnEntities: WeatherColumnEntity[] = [];

  public windPower: number = 8;
  public windAngle: number = 45;

  public selectedShotType: number = 0; // 0 = Shot 1, 1 = Shot 2, 2 = SS
  public isSimulating: boolean = false;
  public isTurnAdvancing: boolean = false;

  private activeProjectiles: ProjectileEntity[] = [];
  private orbitalEffectsContainer: Container;

  // UI callbacks for React state synchronization
  public onWeatherUpdate?: (
    weather: WeatherDefinition,
    tapeSlice: WeatherSlotItem[],
    column: ActiveWeatherColumn | null,
    roundInfo?: WeatherRoundInfo,
    didChangeWeather?: boolean
  ) => void;
  public onWindUpdate?: (power: number, angle: number) => void;
  public onPlayerAngleUpdate?: (angle: number) => void;
  public onPlayerPowerUpdate?: (power: number) => void;
  public onLastPowerUpdate?: (power: number | null) => void;
  public onTurnReady?: () => void;
  public onBotHpUpdate?: (hp: number, maxHp: number) => void;
  public onBotCountChange?: (count: number) => void;
  public onBotChat?: (nickname: string, text: string) => void;
  public onTurnUpdate?: (info: {
    turnNumber: number;
    maxTurns: number;
    activeTurn: "player" | "bot";
    actingBotId?: string;
    playerDelay: number;
    botDelay: number;
    bots: Array<{
      id: string;
      nickname: string;
      mobileType: number;
      delay: number;
      hp: number;
      maxHp: number;
      isDead: boolean;
      isImmortal: boolean;
    }>;
  }) => void;
  public onActiveItemChange?: (item: "dual" | "teleport" | null) => void;
  public onItemUsedThisTurnChange?: (used: boolean) => void;
  public onPlayerItemsChange?: (items: ("dual" | "teleport" | null)[]) => void;
  public onMatchReset?: () => void;
  public onChatMessage?: (msg: { sender: string; text: string; isSystem?: boolean }) => void;
  public onBattleIntro?: (phase: "ready" | "fight" | null) => void;
  public onTurnTimerFreeze?: () => void;
  public onTurnTimerReset?: (seconds?: number) => void;
  public battleIntroPhase: "ready" | "fight" | null = null;
  public hasStartedIntro: boolean = false;
  public isBattleIntroActive: boolean = false;
  private introTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Active Battle Item (Dual, Teleport)
  public playerItems: ("dual" | "teleport" | null)[] = ["dual", "dual", "teleport"];
  public activeItem: "dual" | "teleport" | null = null;
  public activeItemSlotIndex: number | null = null;
  public hasUsedItemThisTurn: boolean = false;
  private botActionTimer: ReturnType<typeof setTimeout> | null = null;
  public activePowerups: FloatingParticlePowerupEntity[] = [];

  // Turn tracking (Authentic GunBound match turns & delay accumulation)
  public turnNumber: number = 1;
  public maxTurns: number = 40;
  public activeTurn: "player" | "bot" = "player";
  public playerDelay: number = 0;
  public botDelay: number = 10;
  public isTurnTimerFrozen: boolean = false;
  public turnStartTime: number = Date.now();
  public turnMovementDistance: number = 0;
  private lastPlayerMoveX: number = 0;
  private hasStartedBattleMusic: boolean = false;

  // Fall physics & Death Ghost
  private playerFallVy: number = 0;
  private isPlayerAirborne: boolean = false;
  private isPlayerBunged: boolean = false;
  public playerGhostEntity?: DeathGhostEntity;

  // Wind settings (active by default in combat)
  public isWindEnabled: boolean = true;

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

    // Weather container (rendered BEHIND terrain so terrain bridge covers weather columns)
    this.weatherContainer = new Container();
    this.engine.worldContainer.addChildAt(this.weatherContainer, 1);

    // 1. Initialize Metamine Terrain (1800x904 px)
    this.terrain = new TerrainRenderer(mapDef.width, mapDef.height);
    this.terrain.onLoadedCallback = () => {
      // Reposition player vertically to true ground surface once map mask finishes loading
      // IMPORTANT: Preserve player's current horizontal position (player.x) so moving during match intro NEVER snaps back!
      if (this.player && this.player.hp > 0 && !this.isPlayerBunged) {
        const placement = this.terrain.getMobileSurfacePlacement(this.player.x, mapDef.player1Spawn.y);
        this.player.y = placement.y;
        this.player.setTilt(placement.slope.angle);
      } else {
        this.respawnPlayer();
      }
      this.resetBot(false);
    };
    this.engine.worldContainer.addChildAt(this.terrain, 2);

    // 2. Load Parallax Background
    this.loadBackground(mapDef.bg);

    // 3. Initialize Local Player on Metamine spawn
    const playerSpawn = mapDef.player1Spawn;
    this.player = new MobileEntity({
      id: "player_local",
      nickname: "Player [Tú]",
      team: "A",
      gender: "male",
      mobileType: 0, // Armor by default
      maxHp: 1000,
      hp: 1000,
      x: playerSpawn.x,
      y: playerSpawn.y,
    });
    this.player.setFacing(1); // Face right toward enemy
    this.player.setTilt(0);
    this.engine.mobilesContainer.addChild(this.player);

    // 4. Initialize Default Bot on Metamine right side with random playable mobile
    const botSpawn = mapDef.botSpawn;
    const initialBotMobile = PLAYABLE_BOT_MOBILES[Math.floor(Math.random() * PLAYABLE_BOT_MOBILES.length)];
    const defaultBot = new BotDummy(this.terrain, botSpawn.x, botSpawn.y, initialBotMobile, "Haris Pilton", 0);
    this.bots = [defaultBot];
    this.engine.mobilesContainer.addChild(defaultBot);

    // 5. Orbital Laser & Satellite effects container
    this.engine.worldContainer.addChild(this.orbitalEffectsContainer);

    // Initialize authentic Thor Orbital Satellite in sky (elevated high in celestial sky)
    this.thor = new ThorEntity();
    this.engine.worldContainer.addChild(this.thor);

    // Initialize screen-space weather indicator marker pinned at monitor top edge
    this.weatherSkyMarker = new WeatherSkyMarker();
    this.engine.uiContainer.addChild(this.weatherSkyMarker);

    // Initialize authentic GunBound Weather System (2 turns per round for 1v1 match)
    this.weatherManager = new WeatherManager(this.terrain.mapWidth, 2);
    this.weatherManager.onWeatherChange = (weather, tapeSlice, column, roundInfo, didChangeWeather) => {
      if (didChangeWeather) {
        // Clean up previous active column immediately on weather transition
        this.weatherContainer.removeChildren();
        if (this.activeColumnEntity) {
          this.activeColumnEntity.cleanup();
          this.activeColumnEntity = undefined;
        }
        for (const oldCol of this.fadingColumnEntities) {
          oldCol.cleanup();
        }
        this.fadingColumnEntities = [];

        if (column && weather.hasColumn) {
          this.activeColumnEntity = new WeatherColumnEntity({
            type: column.type,
            x: column.x,
            width: column.width,
            mapHeight: this.terrain.mapHeight,
          });
          // Render inside dedicated weatherContainer (never disturbs worldContainer indices)
          this.weatherContainer.addChild(this.activeColumnEntity);
        }

        if (this.thor) {
          this.thor.setWeatherActive(weather.type === "thor");
        }
      }

      if (this.onWeatherUpdate) {
        this.onWeatherUpdate(weather, tapeSlice, column, roundInfo, didChangeWeather);
      }
    };

    // Trigger initial weather sync now that listener is attached
    this.weatherManager.triggerInitialSync();

    // Foreground atmospheric autumn leaves (drifting in front of terrain & mobiles for depth)
    this.engine.worldContainer.addChild(this.leavesEngine.foregroundContainer);

    // 6. Connect AimController
    this.aimController = new AimController(this.terrain);
    this.aimController.setActiveMobile(this.player);

    // Expose arena instance on window for testing & debugging
    if (typeof window !== "undefined") {
      (window as any).__ARENA__ = this;
    }

    // Preload firing, impact, movement and weather audio effects
    AudioManager.preload(["11fire.wav", "12fire.wav", "11blast.wav", "12blast.wav", "1move.wav", "1nmove.wav", "4moon.ogg", "dual_snd.ogg"]);

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

    this.lastPlayerMoveX = this.player.x;
    this.aimController.onMobileMove = (x: number) => {
      const dx = Math.abs(x - this.lastPlayerMoveX);
      this.turnMovementDistance += dx;
      this.lastPlayerMoveX = x;
    };

    // 7. Initial Wind (Active by default in combat)
    this.isWindEnabled = true;
    this.randomizeWind();

    // 8. Center Camera across the battlefield with authentic framing and start smooth cinematic intro zoom from frame 1
    this.engine.panTo(704.5, 420, true);
    this.engine.playIntroZoom(0.50, 1.20, 4200);

    // Start epic battle intro sequence with title banner ("¿ESTÁS LISTO?" -> "¡A COMBATIR!")
    this.startBattleIntroSequence();

    // 10. Frame Ticker
    this.engine.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // 11. Mouse Drag Shoot Listeners (Slice Shoot mode) - Strictly locked to active player turn
    window.addEventListener("pointerdown", (e) => {
      if (
        e.button === 0 &&
        this.shootMode === "drag" &&
        this.activeTurn === "player" &&
        !this.isSimulating &&
        !this.isBattleIntroActive &&
        !this.isTurnAdvancing &&
        this.aimController.enabled
      ) {
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
      if (
        this.isDraggingAim &&
        this.shootMode === "drag" &&
        this.activeTurn === "player" &&
        !this.isSimulating &&
        !this.isBattleIntroActive
      ) {
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
        if (
          this.shootMode === "drag" &&
          this.activeTurn === "player" &&
          !this.isSimulating &&
          !this.isBattleIntroActive &&
          !this.isTurnAdvancing
        ) {
          this.aimController.releaseFire();
        } else {
          this.aimController.stopCharging();
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
    for (const b of this.bots) {
      b.update(dt);
      b.checkGroundFall(dt);
    }
    this.destructionParticles.update(dt);
    this.dynamicExplosionEngine.update(dt * 16.66);
    this.leavesEngine.update(
      dt,
      this.engine.cameraX,
      this.engine.cameraY,
      this.engine.cameraZoom,
      this.engine.screenW,
      this.engine.screenH
    );
    this.thor.update(dt);
    this.activeColumnEntity?.update(dt);
    for (let i = this.fadingColumnEntities.length - 1; i >= 0; i--) {
      const col = this.fadingColumnEntities[i];
      col.update(dt);
      if (col.isDestroyed) {
        this.fadingColumnEntities.splice(i, 1);
      }
    }

    // Update active fluid powerup particle effects
    for (let i = this.activePowerups.length - 1; i >= 0; i--) {
      const p = this.activePowerups[i];
      p.update(dt);
      if (p.isFinished()) {
        this.activePowerups.splice(i, 1);
      }
    }

    // Update screen-space sky marker tracking the active column
    this.weatherSkyMarker.update(
      dt,
      this.engine.cameraX,
      this.engine.cameraZoom,
      this.engine.screenW,
      this.weatherManager.activeColumn
    );

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

    if (this.onBotHpUpdate && this.bots[0]) {
      this.onBotHpUpdate(this.bots[0].mobile.hp, this.bots[0].mobile.maxHp);
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

  public setPlayerGender(gender: "male" | "female") {
    this.player.pilot.setGender(gender);
  }

  public setBotMobile(mobileId: number, botIndex: number = 0) {
    const targetBot = this.bots[botIndex] || this.bots[0];
    if (targetBot) {
      targetBot.setMobileType(mobileId);
    }
  }

  public broadcastTurnUpdate() {
    if (this.onTurnUpdate) {
      this.onTurnUpdate({
        turnNumber: this.turnNumber,
        maxTurns: this.maxTurns,
        activeTurn: this.activeTurn,
        actingBotId: this.actingBot?.mobile.id,
        playerDelay: this.playerDelay,
        botDelay: this.bots[0]?.delay ?? 960,
        bots: this.bots.map((b) => ({
          id: b.mobile.id,
          nickname: b.mobile.nickname,
          mobileType: b.mobile.mobileType,
          delay: b.delay,
          hp: b.mobile.hp,
          maxHp: b.mobile.maxHp,
          isDead: b.isDead,
          isImmortal: b.isImmortal,
        })),
      });
    }
  }

  public addBot(mobileType?: number, nickname?: string): BotDummy | null {
    if (this.bots.length >= 3) return null;
    const botIndex = this.bots.length;
    const spawnPositions = [1140, 880, 640];
    const spawnX = spawnPositions[botIndex] || (800 + botIndex * 150);
    const groundY = this.terrain.findSurfaceY(spawnX, 402);
    const placement = this.terrain.getMobileSurfacePlacement(spawnX, groundY);

    const mobType = mobileType !== undefined
      ? mobileType
      : PLAYABLE_BOT_MOBILES[Math.floor(Math.random() * PLAYABLE_BOT_MOBILES.length)];
    const defaultNames = ["Haris Pilton", "CyberTroll", "BungeMaster", "AimGod_007", "DragonBot"];
    const name = nickname || defaultNames[botIndex % defaultNames.length];

    const newBot = new BotDummy(this.terrain, spawnX, placement.y, mobType, name, botIndex);
    newBot.isImmortal = false;
    newBot.delay = (botIndex + 1) * 10;
    newBot.mobile.maxHp = 1000;
    newBot.mobile.hp = 1000;
    newBot.mobile.updateHpBar();

    this.bots.push(newBot);
    this.engine.mobilesContainer.addChild(newBot);

    if (this.onBotCountChange) {
      this.onBotCountChange(this.bots.length);
    }
    this.broadcastTurnUpdate();
    return newBot;
  }

  public removeBot(): boolean {
    if (this.bots.length <= 1) return false;
    const removed = this.bots.pop();
    if (removed) {
      this.engine.mobilesContainer.removeChild(removed);
      removed.destroy({ children: true });
    }
    if (this.onBotCountChange) {
      this.onBotCountChange(this.bots.length);
    }
    this.broadcastTurnUpdate();
    return true;
  }

  public setBotCount(count: number) {
    const target = Math.max(1, Math.min(3, count));
    while (this.bots.length < target) {
      this.addBot();
    }
    while (this.bots.length > target) {
      this.removeBot();
    }
  }

  public resetToSingleBot() {
    while (this.bots.length > 1) {
      const removed = this.bots.pop();
      if (removed) {
        this.engine.mobilesContainer.removeChild(removed);
        removed.destroy({ children: true });
      }
    }
    this.resetBot(false);
    if (this.onBotCountChange) {
      this.onBotCountChange(this.bots.length);
    }
    this.broadcastTurnUpdate();
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

  public evolveWind() {
    if (!this.isWindEnabled) {
      this.windPower = 0;
      this.windAngle = 0;
      if (this.onWindUpdate) this.onWindUpdate(0, 0);
      return;
    }
    // Turn-to-turn organic breeze evolution matching GunBound / DragonBound:
    // Angle drifts smoothly (+/- 15° to 25°)
    const angleDelta = Math.round((Math.random() - 0.5) * 30);
    const newAngle = (this.windAngle + angleDelta + 360) % 360;
    // Power drifts smoothly (+/- 1 to 3, bounded 1 to 26)
    const powerDelta = Math.round((Math.random() - 0.5) * 4);
    const newPower = Math.max(1, Math.min(26, this.windPower + powerDelta));
    this.setWind(newPower, newAngle);
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
    let isImmortal = false;
    for (const b of this.bots) {
      isImmortal = b.toggleImmortal();
    }
    if (this.onBotHpUpdate && this.bots[0]) {
      this.onBotHpUpdate(this.bots[0].mobile.hp, this.bots[0].mobile.maxHp);
    }
    this.broadcastTurnUpdate();
    return isImmortal;
  }

  public activateItem(item: "dual" | "teleport" | null, slotIndex: number | null = null) {
    if (item === null) {
      this.activeItem = null;
      this.activeItemSlotIndex = null;
      if (this.onActiveItemChange) {
        this.onActiveItemChange(null);
      }
      return;
    }

    // Strict turn locking: only the active player can activate items
    if (this.activeTurn !== "player" || this.isSimulating || this.isBattleIntroActive || this.isTurnAdvancing) {
      AudioManager.play("turntick1s", 0.8);
      return;
    }

    // Check if slot has already been consumed / hollow socket
    if (slotIndex !== null && this.playerItems[slotIndex] === null) {
      AudioManager.play("turntick1s", 0.8);
      return;
    }

    if (this.weatherManager.isItemsLocked() || this.hasUsedItemThisTurn) {
      AudioManager.play("turntick1s", 0.8);
      return;
    }

    this.activeItem = item;
    this.activeItemSlotIndex = slotIndex;
    if (this.onActiveItemChange) {
      this.onActiveItemChange(item);
    }

    // Immediately trigger synchronized powerup particle effect and mobile powerup animation
    if (!this.isSimulating) {
      const powerup = new FloatingParticlePowerupEntity(this.player.x, this.player.y, item);
      this.engine.effectsContainer.addChild(powerup);
      this.activePowerups.push(powerup);
      this.player.triggerPowerupEffect(item);
    }
  }

  public fireShot(rawAngle: number, power: number, shotType: number) {
    if (this.activeTurn !== "player" || this.isSimulating || this.isBattleIntroActive || this.isTurnAdvancing) {
      return;
    }
    this.isSimulating = true;
    this.isTurnTimerFrozen = true;
    if (this.onTurnTimerFreeze) {
      this.onTurnTimerFreeze();
    }
    this.aimController.enabled = false;

    // Report last shot power for power bar guide marker
    if (this.onLastPowerUpdate) {
      this.onLastPowerUpdate(power);
    }

    const itemUsed = this.activeItem;
    if (itemUsed) {
      // Consumed item: deducted permanently from player's inventory for the match!
      this.hasUsedItemThisTurn = true;
      if (this.activeItemSlotIndex !== null) {
        this.playerItems[this.activeItemSlotIndex] = null;
      }
      this.activeItem = null;
      this.activeItemSlotIndex = null;
      if (this.onActiveItemChange) {
        this.onActiveItemChange(null);
      }
      if (this.onPlayerItemsChange) {
        this.onPlayerItemsChange([...this.playerItems]);
      }
      if (this.onItemUsedThisTurnChange) {
        this.onItemUsedThisTurnChange(true);
      }
    }

    // Update delay points using mobile definitions and item costs
    const playerDef = MOBILES_DATA[this.player.mobileType] || MOBILES_DATA[0];
    let delayCost = shotType === 2
      ? playerDef.delays.ss
      : shotType === 1
      ? playerDef.delays.shot2
      : playerDef.delays.shot1;

    if (itemUsed === "dual") {
      delayCost += 550; // Authentic GunBound Dual item delay
    } else if (itemUsed === "teleport") {
      delayCost += 400; // Authentic GunBound Teleport item delay
    }

    // Authentic GunBound time penalty: +10 delay per second spent aiming
    const turnElapsedSec = Math.max(0, (Date.now() - this.turnStartTime) / 1000);
    const timeDelay = Math.min(200, Math.round(turnElapsedSec * 10));

    // Authentic GunBound movement penalty: +2 delay per pixel walked
    const moveDelay = Math.min(200, Math.round(this.turnMovementDistance * 2));
    this.turnMovementDistance = 0;

    this.playerDelay += delayCost + timeDelay + moveDelay;
    this.broadcastTurnUpdate();

    // Trigger SS battlefield darkness if Shot 2 / SS
    if (shotType === 2) {
      this.engine.setSSOverlay(true);
    }

    // Camera firmly holds on mobile during firing animation and resets manual camera override
    this.engine.userHasManualCamera = false;
    this.engine.panTo(this.player.x, this.player.y);

    const allTargets = this.bots
      .filter((b) => !b.isDead && b.mobile.hp > 0)
      .map((b) => ({ id: b.mobile.id, x: b.mobile.x, y: b.mobile.y - 14, radius: 26 }));

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
      targets: allTargets,
      activeWeatherColumn: this.weatherManager.activeColumn,
    };

    const trajectories = BallisticsEngine.simulateShot(params);

    // 1. Transition pause: +10ms delay per shot type (Tiro 1: 10ms, Tiro 2: 120ms [+10ms], SS: 90ms)
    const fireAnim = shotType === 2 ? "sfire" : shotType === 1 ? "fire2" : "fire1";
    const chargeToFireDelayMs = shotType === 0 ? 10 : shotType === 1 ? 120 : 90;

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
      this.launchTrajectoriesFromMobile(this.player, trajectories, this.selectedShotType, undefined, isTeleport);
    }, blastDelayMs);
  }

  private launchTrajectories(trajectories: ShotTrajectory[], onFinish?: () => void, isTeleport: boolean = false) {
    this.launchTrajectoriesFromMobile(this.player, trajectories, this.selectedShotType, onFinish, isTeleport);
  }

  public launchTrajectoriesFromMobile(
    shooter: MobileEntity,
    trajectories: ShotTrajectory[],
    shotType: number,
    onFinish?: () => void,
    isTeleport: boolean = false
  ) {
    let completedCount = 0;
    let hasInvokedFinish = false;
    const total = trajectories.length;

    const mobileDef = MOBILES_DATA[shooter.mobileType] || MOBILES_DATA[0];
    const defaultSound = shotType === 2 ? "12fire" : "11fire";
    const soundFire =
      (shotType === 2
        ? mobileDef.soundSS
        : shotType === 1
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
        const launchPos = traj.points[0] || { x: shooter.x, y: shooter.y };
        const launchAngle = traj.points.length > 1
          ? (Math.atan2(traj.points[1].y - traj.points[0].y, traj.points[1].x - traj.points[0].x) * 180) / Math.PI
          : shooter.angleDeg;
        this.destructionParticles.spawnMuzzleBlast(launchPos.x, launchPos.y, launchAngle, shotType);

        const proj = new ProjectileEntity(
          traj.points,
          shooter.mobileType,
          shotType,
          () => {
            if (isTeleport && shooter === this.player) {
              this.handleTeleportImpact(traj);
            } else {
              this.handleImpact(traj, shooter);
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
            if (completedCount >= total && !hasInvokedFinish) {
              hasInvokedFinish = true;
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

      // Trigger authentic fluid teleport powerup particles directly on mobile at arrival
      const powerup = new FloatingParticlePowerupEntity(impact.x, place.y, "teleport");
      this.engine.effectsContainer.addChild(powerup);
      this.activePowerups.push(powerup);
      this.player.triggerPowerupEffect("teleport");
      AudioManager.play("11blast", 0.9);

      if (!this.engine.userHasManualCamera) {
        this.engine.panTo(impact.x, place.y);
      }
    }
  }

  private handleImpact(traj: ShotTrajectory, shooter: MobileEntity = this.player) {
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
    const mobileDef = MOBILES_DATA[shooter.mobileType] || MOBILES_DATA[0];
    AudioManager.play(mobileDef.soundExplode || "11blast", 0.9);

    // 3. Screen rumble proportional to crater radius
    const shakeIntensity = traj.bungeRadius > 45 ? 9 : 5;
    this.engine.shakeScreen(shakeIntensity, 340);

    // 4. Special satellite orbital beams (Aduka Thor, ASate, Knight, Lightning)
    this.handleSpecialOrbitalBeams(traj);

    // 5. Bot damage check across all active bots
    const blastRadius = traj.bungeRadius * 1.5;
    for (const b of this.bots) {
      if (b.isDead || b.mobile.hp <= 0) continue;
      const distToBot = Math.hypot(b.mobile.x - x, b.mobile.y - y);

      if (distToBot <= blastRadius) {
        const falloff = 1 - distToBot / blastRadius;
        const appliedDamage = Math.round(traj.damage * (0.45 + 0.55 * falloff));
        b.takeDamage(appliedDamage, x, y);
      }
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

      // Iniciar la animación de volar al cielo sincronizada cuando cambia el turno (~600ms)
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
      }, 600);

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
    this.aimController.enabled = !this.isBattleIntroActive;
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

    // 1. If Thor Weather is active, Thor fires orbital laser on ANY projectile hit!
    if (this.weatherManager.isThorActive()) {
      if (this.thor) {
        const thorDamage = 75 + this.thor.level * 25;
        this.thor.fireBeam(x, y, thorDamage, this.engine.effectsContainer);
        for (const b of this.bots) {
          if (!b.isDead && b.mobile.hp > 0 && Math.hypot(b.mobile.x - x, b.mobile.y - y) <= 45) {
            b.takeDamage(thorDamage, x, y);
          }
        }
        if (Math.hypot(this.player.x - x, this.player.y - y) <= 45) {
          this.damagePlayer(thorDamage, x, y);
        }
      }
    } else if (traj.subType === "aduka_thor_tracker" || this.player.mobileType === 2) {
      // Aduka: Authentic Thor Satellite Orbital Laser strike
      if (this.thor) {
        this.thor.fireBeam(x, y, traj.damage, this.engine.effectsContainer);
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

    // 2. If projectile is lightning-charged from passing through Lightning weather column
    if (traj.isLightningCharged) {
      this.drawDescendingLaser(x, y, 0x60a5fa, 12, 300);
      AudioManager.play("12blast", 0.9);
      for (const b of this.bots) {
        if (!b.isDead && b.mobile.hp > 0 && Math.hypot(b.mobile.x - x, b.mobile.y - y) <= 40) {
          b.takeDamage(55, x, y);
        }
      }
      if (Math.hypot(this.player.x - x, this.player.y - y) <= 40) {
        this.damagePlayer(55, x, y);
      }
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
    if (this.isTurnAdvancing) return;
    this.isTurnAdvancing = true;

    this.isSimulating = false;
    this.engine.setSSOverlay(false);

    // Turn advancement
    this.turnNumber = Math.min(this.maxTurns, this.turnNumber + 1);
    this.broadcastTurnUpdate();

    // Trigger ascension for any dead bots
    for (const b of this.bots) {
      if (b.isDead) {
        b.triggerAscension();
      }
    }

    // Wait 2.0s strategic pause between turns (breathing time for combatants & explosions to settle)
    setTimeout(() => {
      // 1. Advance authentic GunBound weather round in the HUD roulette
      const { weather: nextWeather, didChange } = this.weatherManager.advanceTurn();
      if (didChange && nextWeather.type === "wind") {
        this.randomizeWind();
      } else if (this.isWindEnabled) {
        this.evolveWind();
      }

      // 2. Identify combatants alive
      const isPlayerAlive = this.player.hp > 0 && !this.isPlayerBunged;
      const aliveBots = this.bots.filter((b) => !b.isDead && b.mobile.hp > 0);

      // A. If no bots are alive, player takes the turn
      if (aliveBots.length === 0) {
        this.switchToPlayerTurn();
        return;
      }

      // B. If player is dead, bot with lowest delay takes turn
      if (!isPlayerAlive) {
        const nextBot = aliveBots.reduce((min, b) => (b.delay < min.delay ? b : min), aliveBots[0]);
        this.isTurnAdvancing = false;
        this.executeBotTurn(nextBot);
        return;
      }

      // C. Both player and bots are alive: whoever has lowest total accumulated delay goes next!
      const minBot = aliveBots.reduce((min, b) => (b.delay < min.delay ? b : min), aliveBots[0]);
      if (this.playerDelay <= minBot.delay) {
        this.switchToPlayerTurn();
      } else {
        this.isTurnAdvancing = false;
        this.executeBotTurn(minBot);
      }
    }, 2000);
  }

  public handleTurnTimeout() {
    if (this.isSimulating || this.isTurnAdvancing) return;

    this.isTurnTimerFrozen = true;
    if (this.onTurnTimerFreeze) this.onTurnTimerFreeze();

    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }

    if (this.activeTurn === "player") {
      this.aimController.stopCharging();
      this.aimController.stopMoving();
      this.aimController.enabled = false;
      this.player.playAnimation("normal");

      // Authentic GunBound timeout penalty delay
      this.playerDelay += 350;
      this.activeItem = null;
      this.activeItemSlotIndex = null;
      this.hasUsedItemThisTurn = false;
      if (this.onActiveItemChange) this.onActiveItemChange(null);
      if (this.onItemUsedThisTurnChange) this.onItemUsedThisTurnChange(false);

      if (this.onChatMessage) {
        this.onChatMessage({
          sender: "Sistema",
          text: "⏳ ¡Tiempo de turno agotado! El turno pasa automáticamente al siguiente combatiente.",
          isSystem: true,
        });
      }
      AudioManager.play("ding.mp3", 0.85);
    } else if (this.actingBot) {
      this.actingBot.delay += 350;
      this.actingBot.mobile.playAnimation("normal");
      if (this.onChatMessage) {
        this.onChatMessage({
          sender: "Sistema",
          text: `⏳ ¡Tiempo de turno agotado para ${this.actingBot.mobile.nickname}!`,
          isSystem: true,
        });
      }
    }

    this.broadcastTurnUpdate();
    this.onAllProjectilesFinished();
  }

  public passTurn() {
    if (this.activeTurn !== "player" || this.isSimulating || this.isBattleIntroActive || this.isTurnAdvancing) {
      return;
    }

    this.isTurnTimerFrozen = true;
    if (this.onTurnTimerFreeze) this.onTurnTimerFreeze();

    this.aimController.stopCharging();
    this.aimController.stopMoving();
    this.aimController.enabled = false;
    this.player.playAnimation("normal");

    // Authentic GunBound Pass Turn Penalty (+510 delay)
    this.playerDelay += 510;
    this.activeItem = null;
    this.activeItemSlotIndex = null;
    this.hasUsedItemThisTurn = false;
    if (this.onActiveItemChange) this.onActiveItemChange(null);
    if (this.onItemUsedThisTurnChange) this.onItemUsedThisTurnChange(false);

    if (this.onChatMessage) {
      this.onChatMessage({
        sender: "Sistema",
        text: "⏭️ ¡Has pasado tu turno! (+510 delay)",
        isSystem: true,
      });
    }
    AudioManager.play("turntick1s", 0.9);

    this.broadcastTurnUpdate();
    this.onAllProjectilesFinished();
  }

  private switchToPlayerTurn() {
    this.activeTurn = "player";
    this.actingBot = null;
    this.isTurnTimerFrozen = false;
    this.turnStartTime = Date.now();
    this.turnMovementDistance = 0;
    this.lastPlayerMoveX = this.player.x;
    this.hasUsedItemThisTurn = false;
    if (this.onItemUsedThisTurnChange) {
      this.onItemUsedThisTurnChange(false);
    }
    this.broadcastTurnUpdate();

    // Start epic battle background music on the very first turn of battle with smooth fade-in
    if (!this.hasStartedBattleMusic) {
      this.hasStartedBattleMusic = true;
      AudioManager.playMusic("dbBattleMiramoTown.mp3", true);
    }

    // Authentic GunBound turn alert sound
    AudioManager.play("turn.ogg", 0.95);

    // 1. Pan camera to active player
    this.engine.userHasManualCamera = false;
    this.engine.panTo(this.player.x + 80, this.player.y - 40);

    // 2. Re-enable player aim controller
    setTimeout(() => {
      this.aimController.enabled = true;
      this.aimController.setActiveMobile(this.player);
      this.isTurnAdvancing = false;

      if (this.onTurnTimerReset) {
        this.onTurnTimerReset(20);
      }
      if (this.onTurnReady) {
        this.onTurnReady();
      }
    }, 400);
  }

  public executeBotTurn(bot: BotDummy) {
    if (this.isSimulating) return;
    this.activeTurn = "bot";
    this.actingBot = bot;
    this.isTurnTimerFrozen = false;
    this.isSimulating = false;
    this.turnStartTime = Date.now();
    if (this.onTurnTimerReset) {
      this.onTurnTimerReset(20);
    }

    // Authentic GunBound turn alert sound
    AudioManager.play("turn.ogg", 0.95);

    this.broadcastTurnUpdate();
    this.aimController.enabled = false;
    this.broadcastTurnUpdate();

    // 1. Pan camera to acting bot
    this.engine.userHasManualCamera = false;
    this.engine.panTo(bot.mobile.x, bot.mobile.y);

    // 2. Select target (Player or another Bot)
    const isPlayerAlive = this.player.hp > 0 && !this.isPlayerBunged;
    const otherAliveBots = this.bots.filter((b) => b !== bot && !b.isDead && b.mobile.hp > 0);

    let targetMobile: { x: number; y: number; hp: number; maxHp: number; radius?: number };
    if (isPlayerAlive && otherAliveBots.length > 0) {
      if (Math.random() < 0.75) {
        targetMobile = { x: this.player.x, y: this.player.y, hp: this.player.hp, maxHp: this.player.maxHp, radius: 26 };
      } else {
        const randOther = otherAliveBots[Math.floor(Math.random() * otherAliveBots.length)];
        targetMobile = { x: randOther.mobile.x, y: randOther.mobile.y, hp: randOther.mobile.hp, maxHp: randOther.mobile.maxHp, radius: 26 };
      }
    } else if (isPlayerAlive) {
      targetMobile = { x: this.player.x, y: this.player.y, hp: this.player.hp, maxHp: this.player.maxHp, radius: 26 };
    } else if (otherAliveBots.length > 0) {
      const randOther = otherAliveBots[Math.floor(Math.random() * otherAliveBots.length)];
      targetMobile = { x: randOther.mobile.x, y: randOther.mobile.y, hp: randOther.mobile.hp, maxHp: randOther.mobile.maxHp, radius: 26 };
    } else {
      setTimeout(() => {
        this.onAllProjectilesFinished();
      }, 800);
      return;
    }

    // 3. Bot calculates shot trajectory taking wind and gravity into account
    const solution = bot.calculateShot(
      targetMobile,
      this.windPower,
      this.windAngle,
      this.weatherManager.activeColumn
    );

    // 4. Orient mobile facing and cannon angle
    bot.mobile.setFacing(solution.facing);
    bot.mobile.setAngle(solution.angle);

    // 5. Display chat bubble if taunt is generated
    if (solution.chatMessage) {
      bot.mobile.showChatBubble(solution.chatMessage, 3200);
      if (this.onBotChat) {
        this.onBotChat(bot.mobile.nickname, solution.chatMessage);
      }
    }

    // 6. Humanized thinking delay (~1100ms) before releasing fire
    this.botActionTimer = setTimeout(() => {
      this.botActionTimer = null;
      if (bot.isDead || this.activeTurn !== "bot" || this.actingBot !== bot) {
        return;
      }

      // Freeze turn timer immediately when bot releases shot
      this.isSimulating = true;
      this.isTurnTimerFrozen = true;
      if (this.onTurnTimerFreeze) {
        this.onTurnTimerFreeze();
      }

      // Update bot delay using authentic mobile delay definitions + time spent
      const botDef = MOBILES_DATA[bot.mobile.mobileType] || MOBILES_DATA[0];
      const delayCost = solution.shotType === 2
        ? botDef.delays.ss
        : solution.shotType === 1
        ? botDef.delays.shot2
        : botDef.delays.shot1;

      const botElapsedSec = Math.max(0, (Date.now() - this.turnStartTime) / 1000);
      const botTimeDelay = Math.min(200, Math.round(botElapsedSec * 10));

      bot.delay += delayCost + botTimeDelay;
      this.broadcastTurnUpdate();

      // Trigger SS darkness overlay if SS
      if (solution.shotType === 2) {
        this.engine.setSSOverlay(true);
      }

      // Play firing animation
      const fireAnim = solution.shotType === 2 ? "sfire" : solution.shotType === 1 ? "fire2" : "fire1";
      const chargeToFireDelayMs = solution.shotType === 0 ? 10 : solution.shotType === 1 ? 120 : 90;

      const startFiring = () => {
        bot.mobile.playAnimation(fireAnim, false, () => {
          bot.mobile.playAnimation("normal");
        });
      };

      if (chargeToFireDelayMs > 0) {
        setTimeout(startFiring, chargeToFireDelayMs);
      } else {
        startFiring();
      }

      // Simulate ballistics
      const allTargets = [
        ...(this.player.hp > 0 && !this.isPlayerBunged
          ? [{ id: "player", x: this.player.x, y: this.player.y - 14, radius: 26 }]
          : []),
        ...this.bots
          .filter((b) => b !== bot && !b.isDead && b.mobile.hp > 0)
          .map((b) => ({ id: b.mobile.id, x: b.mobile.x, y: b.mobile.y - 14, radius: 26 })),
      ];

      const params: FireParams = {
        x: bot.mobile.x,
        y: bot.mobile.y,
        rawAngle: solution.angle,
        power: solution.power,
        look: solution.facing === -1 ? 0 : 1,
        bodyAngle: (bot.mobile.slopeAngle * 180) / Math.PI,
        mobileId: bot.mobile.mobileType,
        shotType: solution.shotType,
        windPower: this.windPower,
        windAngle: this.windAngle,
        isPixelSolid: (x, y) => this.terrain.isGround(x, y),
        mapWidth: this.terrain.mapWidth,
        mapHeight: this.terrain.mapHeight,
        targets: allTargets,
        activeWeatherColumn: this.weatherManager.activeColumn,
      };

      const trajectories = BallisticsEngine.simulateShot(params);
      const blastDelayMs = chargeToFireDelayMs + (solution.shotType === 2 ? 780 : solution.shotType === 1 ? 620 : 220);

      const useDual = !this.weatherManager.isItemsLocked() && bot.items.includes("dual") && Math.random() < 0.28;
      if (useDual) {
        bot.consumeItem("dual");
        bot.delay += 550;
        if (this.onChatMessage) {
          this.onChatMessage({
            sender: "Sistema",
            text: `⚔️ ¡${bot.mobile.nickname} ha usado su ítem DUAL!`,
            isSystem: true,
          });
        }
        const powerup = new FloatingParticlePowerupEntity(bot.mobile.x, bot.mobile.y, "dual");
        this.engine.effectsContainer.addChild(powerup);
        this.activePowerups.push(powerup);
        bot.mobile.triggerPowerupEffect("dual");

        let completedVolleys = 0;
        const onVolleyDone = () => {
          completedVolleys++;
          if (completedVolleys >= 2) {
            this.onAllProjectilesFinished();
          }
        };

        // Volley 1
        setTimeout(() => {
          this.launchTrajectoriesFromMobile(bot.mobile, trajectories, solution.shotType, onVolleyDone, false);
        }, blastDelayMs);

        // Volley 2 (Authentic GunBound volley timing)
        const volley2Start = blastDelayMs + 600;
        setTimeout(() => {
          startFiring();
          setTimeout(() => {
            this.launchTrajectoriesFromMobile(bot.mobile, trajectories, solution.shotType, onVolleyDone, false);
          }, 180);
        }, volley2Start);
        return;
      }

      setTimeout(() => {
        this.launchTrajectoriesFromMobile(bot.mobile, trajectories, solution.shotType);
      }, blastDelayMs);
    }, 1100);
  }

  public resetBot(useRandomPos: boolean = false, changeMobile: boolean = true) {
    const mapDef = MAPS["metamine"];
    const spawnPositions = [mapDef.botSpawn.x, 880, 640];

    this.bots.forEach((b, idx) => {
      if (changeMobile) {
        const nextMob = PLAYABLE_BOT_MOBILES[Math.floor(Math.random() * PLAYABLE_BOT_MOBILES.length)];
        b.setMobileType(nextMob);
      }
      const defaultX = spawnPositions[idx] || (800 + idx * 150);
      const groundPos = useRandomPos
        ? this.terrain.getRandomGroundPosition(350, Math.min(1300, this.terrain.mapWidth - 150))
        : { x: defaultX, y: 402 };
      const placement = this.terrain.getMobileSurfacePlacement(groundPos.x, groundPos.y);
      b.spawnAt(groundPos.x, placement.y);
    });

    if (this.onBotHpUpdate && this.bots[0]) {
      this.onBotHpUpdate(this.bots[0].mobile.hp, this.bots[0].mobile.maxHp);
    }
    this.broadcastTurnUpdate();
  }

  public resetCamera() {
    this.engine.panTo(704.5, 420);
    this.engine.playIntroZoom(0.50, 1.20, 4200);
  }

  public setWeather(idOrType: number | WeatherType, forcedX?: number) {
    if (typeof idOrType === "number") {
      this.weatherManager.setWeatherId(idOrType, forcedX);
    } else {
      this.weatherManager.setWeatherType(idOrType, forcedX);
    }
  }

  public setCenterHudBounds(left: number, right: number, bottom: number) {
    if (this.weatherSkyMarker) {
      this.weatherSkyMarker.setCenterHudBounds(left, right, bottom);
    }
  }

  public startBattleIntroSequence() {
    this.introTimeouts.forEach((t) => clearTimeout(t));
    this.introTimeouts = [];

    this.hasStartedIntro = true;
    this.isBattleIntroActive = true;
    this.battleIntroPhase = "ready";
    this.aimController.enabled = false;
    this.aimController.stopMoving();
    this.aimController.stopCharging();
    this.isSimulating = true;
    this.isTurnTimerFrozen = true;

    // Ambient/waiting background music during the pre-match countdown
    AudioManager.playMusic("dbWaiting2020.ogg", false);

    // Play classic GunBound battle start fanfare
    AudioManager.play("start.mp3", 0.95);

    if (this.onBattleIntro) {
      this.onBattleIntro("ready");
    }

    this.introTimeouts.push(
      setTimeout(() => {
        this.battleIntroPhase = "fight";
        if (this.onBattleIntro) {
          this.onBattleIntro("fight");
        }
        AudioManager.play("11fire", 0.7);
      }, 2200)
    );

    this.introTimeouts.push(
      setTimeout(() => {
        this.battleIntroPhase = null;
        if (this.onBattleIntro) {
          this.onBattleIntro(null);
        }
      }, 4200)
    );

    this.introTimeouts.push(
      setTimeout(() => {
        this.isBattleIntroActive = false;
        this.isSimulating = false;
        this.switchToPlayerTurn();
      }, 4500)
    );
  }

  public async resetMap() {
    this.introTimeouts.forEach((t) => clearTimeout(t));
    this.introTimeouts = [];
    this.isBattleIntroActive = true;
    this.aimController.enabled = false;
    this.aimController.stopMoving();
    this.aimController.stopCharging();

    this.turnNumber = 1;
    this.playerDelay = 0;
    this.botDelay = 10;
    this.isTurnTimerFrozen = true;
    this.turnMovementDistance = 0;
    this.lastPlayerMoveX = this.player.x;
    this.hasStartedBattleMusic = false;
    this.activeTurn = "player";
    this.actingBot = null;
    this.isPlayerBunged = false;
    for (const b of this.bots) {
      b.delay = (b.botIndex + 1) * 10;
      b.resetItems();
    }
    if (this.playerGhostEntity) {
      this.playerGhostEntity.cleanup();
      this.playerGhostEntity = undefined;
    }
    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }
    this.playerItems = ["dual", "dual", "teleport"];
    this.activeItem = null;
    this.activeItemSlotIndex = null;
    this.hasUsedItemThisTurn = false;
    if (this.onPlayerItemsChange) {
      this.onPlayerItemsChange([...this.playerItems]);
    }
    if (this.onActiveItemChange) {
      this.onActiveItemChange(null);
    }
    if (this.onItemUsedThisTurnChange) {
      this.onItemUsedThisTurnChange(false);
    }
    if (this.onLastPowerUpdate) {
      this.onLastPowerUpdate(null as unknown as number);
    }
    if (this.onMatchReset) {
      this.onMatchReset();
    }
    this.broadcastTurnUpdate();

    this.destructionParticles.clear();
    this.dynamicExplosionEngine.clear();

    // Clean up active and fading weather columns
    if (this.activeColumnEntity) {
      this.activeColumnEntity.cleanup();
      this.activeColumnEntity = undefined;
    }
    for (const col of this.fadingColumnEntities) {
      col.cleanup();
    }
    this.fadingColumnEntities = [];

    this.weatherManager.reset();
    await this.terrain.loadMap("metamine");
    this.leavesEngine.setMapBounds(this.terrain.mapWidth, this.terrain.mapHeight);
    this.respawnPlayer();
    this.resetBot(false);
    this.resetCamera();
    this.randomizeWind();
    this.startBattleIntroSequence();
  }

  public setDynamicExplosions(enabled: boolean) {
    DynamicExplosionEngine.isDynamicEnabled = enabled;
  }

  public destroy() {
    this.introTimeouts.forEach((t) => clearTimeout(t));
    this.introTimeouts = [];
    this.aimController.destroy();
    this.dynamicExplosionEngine.clear();
    this.destructionParticles.clear();
    this.leavesEngine.destroy();
    this.thor.destroy();
    this.weatherSkyMarker.cleanup();
    this.weatherContainer.destroy({ children: true });
    if (this.activeColumnEntity) {
      this.activeColumnEntity.cleanup();
      this.activeColumnEntity = undefined;
    }
    for (const col of this.fadingColumnEntities) {
      col.cleanup();
    }
    this.fadingColumnEntities = [];
    for (const b of this.bots) {
      b.destroy({ children: true });
    }
    this.bots = [];
  }
}
