import { Container, Text, TextStyle } from "pixi.js";
import { MobileEntity } from "../entities/MobileEntity.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { DeathGhostEntity } from "../effects/DeathGhostEntity.js";
import { BallisticsEngine } from "../physics/BallisticsEngine.js";

export interface BotShotSolution {
  angle: number;
  power: number;
  shotType: number;
  facing: number;
  chatMessage: string;
  expectedHit: boolean;
}

export class BotDummy extends Container {
  public mobile: MobileEntity;
  private terrain: TerrainRenderer;
  public spawnX: number;
  public spawnY: number;

  public botIndex: number = 0;
  public delay: number = 960;
  public ssCooldown: number = 0;
  public difficulty: number = 0.88; // 88% accuracy base with humanized variance

  public isDead: boolean = false;
  public isImmortal: boolean = true;
  private isBotBunged: boolean = false;
  private ghostEntity?: DeathGhostEntity;
  private damageNumbersContainer: Container;
  private botFallVy: number = 0;
  private isBotAirborne: boolean = false;

  constructor(
    terrain: TerrainRenderer,
    spawnX: number = 1140,
    spawnY: number = 402,
    mobileType: number = 1,
    nickname: string = "Haris Pilton",
    botIndex: number = 0
  ) {
    super();
    this.terrain = terrain;
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.botIndex = botIndex;
    this.delay = 960 + botIndex * 40;

    this.damageNumbersContainer = new Container();

    const groundY = this.terrain.findSurfaceY(spawnX, spawnY);
    this.mobile = new MobileEntity({
      id: `bot_${botIndex}`,
      nickname: nickname,
      team: "B",
      mobileType: mobileType,
      maxHp: 1000,
      hp: 1000,
      x: spawnX,
      y: groundY,
    });

    this.mobile.setFacing(-1); // Faces left toward player by default
    this.mobile.aimContainer.visible = false; // Reticle hidden on AI mobile
    const slope = this.terrain.getSlopeAngle(spawnX, groundY);
    this.mobile.setTilt(slope.angle);

    this.addChild(this.mobile);
    this.addChild(this.damageNumbersContainer);
  }

  /**
   * DragonBound-Style Ballistics AI Solver:
   * Analyzes target distance, slope angle, wind vector (power + angle) and terrain geometry
   * to determine optimal firing angle, power charge, and shot type (S1, S2, SS).
   */
  public calculateShot(
    target: { x: number; y: number; hp: number; maxHp: number; radius?: number },
    windPower: number,
    windAngle: number,
    activeWeatherColumn?: any
  ): BotShotSolution {
    const dx = target.x - this.mobile.x;
    const facing = dx >= 0 ? 1 : -1;
    const look = facing === 1 ? 1 : 0;
    const bodyAngle = (this.mobile.slopeAngle * 180) / Math.PI;
    const targetRadius = target.radius || 26;
    const targetY = target.y - 14;

    // 1. Tactical Shot Selection (Authentic DragonBound AI behavior)
    let shotType = 0;
    let chatMessage = "";

    if (target.hp < 550 && this.ssCooldown <= 0) {
      shotType = 2; // Super Shot (SS) finisher
      this.ssCooldown = 4;
      const ssQuotes = [
        "¡Te matare maldito desperdicio de oxigeno -_-",
        "¡Prueba mi SS supremo! 💥",
        "Hasta la vista, baby 😎",
        "¡Sayonara, amigo! 🚀",
        "¡Fin del juego para ti! ⚡",
      ];
      chatMessage = ssQuotes[Math.floor(Math.random() * ssQuotes.length)];
    } else if (target.hp < 800) {
      shotType = 1; // Heavy Shot 2
      if (this.ssCooldown > 0) this.ssCooldown--;
      const s2Quotes = [
        "¡Toma esto! 🎯",
        "¡Cálculo balístico perfecto! 📐",
        "A ver si esquivas esto 😉",
        "¡Fuego pesado entrante! 💣",
        "¡Directo al blanco! 💥",
      ];
      chatMessage = Math.random() < 0.65 ? s2Quotes[Math.floor(Math.random() * s2Quotes.length)] : "";
    } else {
      shotType = 0; // Standard Shot 1
      if (this.ssCooldown > 0) this.ssCooldown--;
      const s1Quotes = [
        "Alineando coordenadas... 🎯",
        "Probando la fuerza del viento 💨",
        "¡No te muevas! 🤖",
        "Primer aviso 💥",
      ];
      chatMessage = Math.random() < 0.35 ? s1Quotes[Math.floor(Math.random() * s1Quotes.length)] : "";
    }

    // 2. Coarse Ballistics Search across candidate trajectory arcs
    let bestDist = Infinity;
    let bestAngle = 48;
    let bestPower = 60;
    let directHitFound = false;

    // Test low, medium, and high GunBound lob angles
    const candidateAngles = [28, 32, 36, 40, 45, 50, 55, 60, 65, 70, 75];

    for (const ang of candidateAngles) {
      for (let p = 25; p <= 100; p += 5) {
        const trajectories = BallisticsEngine.simulateShot({
          x: this.mobile.x,
          y: this.mobile.y,
          rawAngle: ang,
          power: p,
          look,
          bodyAngle,
          mobileId: this.mobile.mobileType,
          shotType,
          windPower,
          windAngle,
          isPixelSolid: (x, y) => this.terrain.isGround(x, y),
          mapWidth: this.terrain.mapWidth,
          mapHeight: this.terrain.mapHeight,
          targets: [{ id: "target", x: target.x, y: targetY, radius: targetRadius }],
          activeWeatherColumn,
        });

        const first = trajectories[0];
        if (!first || !first.finalPos) continue;

        if (first.hitType === "player") {
          bestDist = 0;
          bestAngle = ang;
          bestPower = p;
          directHitFound = true;
          break;
        }

        const d = Math.hypot(first.finalPos.x - target.x, first.finalPos.y - targetY);
        if (d < bestDist) {
          bestDist = d;
          bestAngle = ang;
          bestPower = p;
        }
      }
      if (directHitFound) break;
    }

    // 3. Fine-Tuning Power Pass (1% increments around candidate)
    for (let dp = -4; dp <= 4; dp++) {
      const testP = Math.max(15, Math.min(100, bestPower + dp));
      const trajectories = BallisticsEngine.simulateShot({
        x: this.mobile.x,
        y: this.mobile.y,
        rawAngle: bestAngle,
        power: testP,
        look,
        bodyAngle,
        mobileId: this.mobile.mobileType,
        shotType,
        windPower,
        windAngle,
        isPixelSolid: (x, y) => this.terrain.isGround(x, y),
        mapWidth: this.terrain.mapWidth,
        mapHeight: this.terrain.mapHeight,
        targets: [{ id: "target", x: target.x, y: targetY, radius: targetRadius }],
        activeWeatherColumn,
      });

      const first = trajectories[0];
      if (!first || !first.finalPos) continue;

      if (first.hitType === "player") {
        bestPower = testP;
        bestDist = 0;
        break;
      }

      const d = Math.hypot(first.finalPos.x - target.x, first.finalPos.y - targetY);
      if (d < bestDist) {
        bestDist = d;
        bestPower = testP;
      }
    }

    // 4. Humanized Precision Jitter (simulates competitive player execution)
    const maxPowerJitter = (1.0 - this.difficulty) * 7.0; // +/- 0.8% with 0.88 difficulty
    const jitter = (Math.random() - 0.5) * maxPowerJitter;
    const finalPower = Math.max(15, Math.min(100, Math.round(bestPower + jitter)));
    const finalAngle = bestAngle;

    return {
      angle: finalAngle,
      power: finalPower,
      shotType,
      facing,
      chatMessage,
      expectedHit: bestDist <= 35,
    };
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

    // Occasional reactionary banter
    if (!this.isDead && Math.random() < 0.35) {
      const hurtQuotes = [
        "¡Auch! ¡Te va a costar caro! 😡",
        "¡Buen tiro, pero sigo aquí! 🛡️",
        "¡Oye, con cuidado! 💢",
        "¡Eso fue pura suerte! 😒",
        "¡El próximo no fallará! ⚡",
      ];
      this.mobile.showChatBubble(hurtQuotes[Math.floor(Math.random() * hurtQuotes.length)], 2800);
    }
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

    // Falling into abyss: falls off bottom screen, transforms into ghost and ascends to sky once
    // Does NOT auto-respawn in a loop; manual respawn available in UI widget
  }

  public triggerAscension() {
    if (!this.isDead || this.ghostEntity || this.isBotBunged) return;
    this.mobile.visible = false;
    this.ghostEntity = new DeathGhostEntity(this.mobile.x, this.mobile.y);
    this.addChild(this.ghostEntity);
  }

  private handleDeath(reason: string) {
    if (this.isDead) return;
    this.isDead = true;
    this.isBotBunged = false;

    // Mobile stays in place showing surrender / defeat animation
    this.mobile.playAnimation("dead", true);
    this.isBotAirborne = false;
    this.mobile.setTilt(0);

    const deathQuotes = [
      "¡Volveré por venganza...! 👻",
      "GG WP... 💀",
      "¡Un lagazo me mató! 📡",
      "¡Nooo, mi racha! 💥",
    ];
    this.mobile.showChatBubble(deathQuotes[Math.floor(Math.random() * deathQuotes.length)], 3000);

    this.spawnFloatingDamage(0, this.mobile.x, this.mobile.y - 20, reason);

    // Ascension starts as soon as turn / camera transitions (~600ms)
    setTimeout(() => {
      this.triggerAscension();
    }, 600);
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

  public respawnRandom() {
    // Respawn stably at a random playable ground position
    const randPos = this.terrain.getRandomGroundPosition(250, Math.min(1300, this.terrain.mapWidth - 200));
    const placement = this.terrain.getMobileSurfacePlacement(randPos.x, randPos.y);
    this.spawnAt(randPos.x, placement.y);
  }

  public setMobileType(type: number) {
    this.mobile.setMobileType(type);
    this.mobile.setFacing(-1);
  }

  private spawnFloatingDamage(amount: number, x: number, y: number, label?: string) {
    const textStyle = new TextStyle({
      fontFamily: label ? ["Pixelify Sans", "sans-serif"] : ["Silkscreen", "sans-serif"],
      fontSize: label ? 20 : 16,
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
