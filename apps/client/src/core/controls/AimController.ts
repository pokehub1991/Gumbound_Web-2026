import { MobileEntity } from "../entities/MobileEntity.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { AudioManager } from "../audio/AudioManager.js";
import { MOBILE_WALK_SPEEDS, MOBILES_DATA } from "../constants/mobiles.js";

export class AimController {
  public terrain: TerrainRenderer;
  public activeMobile?: MobileEntity;

  public enabled: boolean = true;
  public shotType: number = 0; // 0 = Shot 1, 1 = Shot 2, 2 = SS
  public power: number = 0;
  public isCharging: boolean = false;
  public isAirborne: boolean = false;
  public shootMode: "space" | "drag" = "space"; // Strict mutual exclusivity: space OR drag
  private chargeSpeed: number = 26; // 0 to 100 in ~3.8 seconds (slower epic charging pace)

  // Keyboard state
  private keysPressed: Record<string, boolean> = {};
  private walkAccumulator: number = 0;
  private angleAccumulator: number = 0;
  private isCurrentlyMoving: boolean = false;

  // Event callbacks
  public onFireCallback?: (angle: number, power: number, shotType: number) => void;
  public onAngleChange?: (angle: number) => void;
  public onPowerChange?: (power: number) => void;
  public onShotTypeChange?: (shotType: number) => void;
  public onMobileMove?: (x: number, y: number) => void;

  constructor(terrain: TerrainRenderer) {
    this.terrain = terrain;

    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));
  }

  public setActiveMobile(mobile?: MobileEntity) {
    this.stopMoving();
    this.activeMobile = mobile;
    if (this.activeMobile && this.onAngleChange) {
      this.onAngleChange(this.activeMobile.angleDeg);
    }
  }

  public setShotType(type: number) {
    this.shotType = Math.max(0, Math.min(2, type));
    if (this.onShotTypeChange) {
      this.onShotTypeChange(this.shotType);
    }
  }

  public startMoving() {
    if (this.isCurrentlyMoving || !this.activeMobile) return;
    this.isCurrentlyMoving = true;
    const mobDef = MOBILES_DATA[this.activeMobile.mobileType] || MOBILES_DATA[0];
    const soundMove = mobDef.soundMove || "1move";
    AudioManager.startMoveLoop(soundMove, 0.65);
  }

  public stopMoving() {
    if (!this.isCurrentlyMoving) return;
    this.isCurrentlyMoving = false;
    const mobDef = this.activeMobile
      ? (MOBILES_DATA[this.activeMobile.mobileType] || MOBILES_DATA[0])
      : MOBILES_DATA[0];
    AudioManager.stopMoveLoop(mobDef?.soundStop);
  }

  public update(dt: number) {
    if (!this.enabled || !this.activeMobile) {
      this.stopMoving();
      return;
    }

    // 1. Mobile Movement along terrain contour with WASD standard (A = Left, D = Right)
    // Dynamic per-vehicle mobility speed matching GunBound / DragonBound statmov
    const mobType = this.activeMobile.mobileType ?? 0;
    const speedRate = MOBILE_WALK_SPEEDS[mobType] ?? 0.85;

    const isLeft = !!this.keysPressed["KeyA"];
    const isRight = !!this.keysPressed["KeyD"];

    if (isLeft && !isRight) {
      this.walkAccumulator += dt * speedRate;
      let moved = false;
      while (this.walkAccumulator >= 1) {
        if (this.stepMobile(-1)) {
          moved = true;
        }
        this.walkAccumulator -= 1;
      }
      if (moved || !this.isAirborne) {
        this.startMoving();
      }
    } else if (isRight && !isLeft) {
      this.walkAccumulator += dt * speedRate;
      let moved = false;
      while (this.walkAccumulator >= 1) {
        if (this.stepMobile(1)) {
          moved = true;
        }
        this.walkAccumulator -= 1;
      }
      if (moved || !this.isAirborne) {
        this.startMoving();
      }
    } else {
      this.walkAccumulator = 0;
      this.stopMoving();
    }

    // 2. Smooth aim angle adjustments with WASD standard (W = Up, S = Down) (~17 deg/sec)
    const isUp = !!this.keysPressed["KeyW"];
    const isDown = !!this.keysPressed["KeyS"];

    if (isUp && !isDown) {
      this.angleAccumulator += dt * 0.28;
      while (this.angleAccumulator >= 1) {
        this.adjustAngle(1);
        this.angleAccumulator -= 1;
      }
    } else if (isDown && !isUp) {
      this.angleAccumulator += dt * 0.28;
      while (this.angleAccumulator >= 1) {
        this.adjustAngle(-1);
        this.angleAccumulator -= 1;
      }
    } else {
      this.angleAccumulator = 0;
    }

    // 3. Power Charging (Automatic timer increment strictly reserved for Spacebar mode; Drag mode uses pointermove)
    if (this.isCharging && this.shootMode === "space") {
      this.power += this.chargeSpeed * (dt / 60);
      if (this.power >= 100) {
        this.power = 100;
        // Auto-release at 100 max power
        this.releaseFire();
      }
      if (this.onPowerChange) {
        this.onPowerChange(this.power);
      }
    }
  }

  private stepMobile(dir: number): boolean {
    if (!this.activeMobile) return false;

    this.activeMobile.setFacing(dir);

    // If airborne, permit horizontal air-drift so mobile never freezes or gets stuck on cliff edge!
    if (this.isAirborne) {
      this.activeMobile.x += dir * 0.75;
      if (this.onMobileMove) {
        this.onMobileMove(this.activeMobile.x, this.activeMobile.y);
      }
      return true;
    }

    // Terrain walking step with ground incline tracking
    const walkRes = this.terrain.walk(this.activeMobile.x, this.activeMobile.y, dir);
    if (walkRes.stuck) {
      return false;
    }

    this.activeMobile.x = walkRes.x;
    this.activeMobile.y = walkRes.y;

    if (walkRes.isAirborne) {
      // Stepped off a ledge or cliff: mobile advances horizontally and gravity handles the fall
      this.isAirborne = true;
      if (this.onMobileMove) {
        this.onMobileMove(this.activeMobile.x, this.activeMobile.y);
      }
      return true;
    }

    const placement = this.terrain.getMobileSurfacePlacement(this.activeMobile.x, this.activeMobile.y);
    this.activeMobile.y = placement.y;
    this.activeMobile.setTilt(placement.slope.angle);

    this.activeMobile.playAnimation("move");

    if (this.onMobileMove) {
      this.onMobileMove(this.activeMobile.x, this.activeMobile.y);
    }
    return true;
  }

  public adjustAngle(delta: number) {
    if (!this.activeMobile) return;
    const newAngle = Math.round(this.activeMobile.angleDeg + delta);
    this.activeMobile.setAngle(newAngle);
    if (this.onAngleChange) {
      this.onAngleChange(this.activeMobile.angleDeg);
    }
  }

  public startCharging() {
    if (this.isCharging || !this.activeMobile) return;
    this.stopMoving();
    this.isCharging = true;
    this.power = 0;
    const chargeAnim = this.shotType === 2 ? "bsfire" : this.shotType === 1 ? "bfire2" : "bfire1";
    this.activeMobile.playAnimation(chargeAnim, true);
    AudioManager.play("power_charge", 0.7);
  }

  public updateCharging(power: number) {
    if (!this.activeMobile) return;
    this.power = Math.max(0, Math.min(100, power));
    if (this.onPowerChange) {
      this.onPowerChange(this.power);
    }
  }

  public stopCharging() {
    this.isCharging = false;
  }

  public releaseFire() {
    if (!this.activeMobile) return;
    const firedAngle = this.activeMobile.angleDeg;
    const firedPower = Math.max(5, this.power);

    this.stopCharging();

    // Note: Do not reset onPowerChange(0) here so power bar stays filled until turn resets!

    if (this.onFireCallback) {
      this.onFireCallback(firedAngle, firedPower, this.shotType);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled || !this.activeMobile) return;

    // Prevent default scrolling for standard game controls (WASD and Space)
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code)) {
      e.preventDefault();
    }

    if (this.keysPressed[e.code]) return;
    this.keysPressed[e.code] = true;

    // Angle adjustment on tap with W / S: exactly 1 degree per tap!
    if (e.code === "KeyW") {
      this.adjustAngle(1);
    } else if (e.code === "KeyS") {
      this.adjustAngle(-1);
    }

    // Shot Selection Hotkeys (1 = Shot 1, 2 = Shot 2, 3 / F = SS)
    if (e.code === "Digit1" || e.code === "Numpad1") {
      this.setShotType(0);
    } else if (e.code === "Digit2" || e.code === "Numpad2") {
      this.setShotType(1);
    } else if (e.code === "Digit3" || e.code === "Numpad3" || e.code === "KeyF") {
      this.setShotType(2);
    }

    // Spacebar start charge (only allowed if shootMode === 'space')
    if (e.code === "Space" && !this.isCharging && this.shootMode === "space") {
      this.startCharging();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keysPressed[e.code] = false;

    // Stop walking animation and movement sound when A or D keys released
    if (e.code === "KeyA" || e.code === "KeyD") {
      this.stopMoving();
      if (
        this.activeMobile &&
        !this.isCharging &&
        !this.isAirborne
      ) {
        this.activeMobile.playAnimation("normal");
      }
    }

    // Spacebar release fire (only allowed if shootMode === 'space')
    if (e.code === "Space" && this.isCharging && this.shootMode === "space") {
      this.releaseFire();
    }
  }

  public destroy() {
    this.stopMoving();
    window.removeEventListener("keydown", (e) => this.handleKeyDown(e));
    window.removeEventListener("keyup", (e) => this.handleKeyUp(e));
  }
}
