import { MobileEntity } from "../entities/MobileEntity.js";
import { TerrainRenderer } from "../terrain/TerrainRenderer.js";
import { AudioManager } from "../audio/AudioManager.js";

export class AimController {
  public terrain: TerrainRenderer;
  public activeMobile?: MobileEntity;

  public enabled: boolean = true;
  public shotType: number = 0; // 0 = Shot 1, 1 = Shot 2, 2 = SS
  public power: number = 0;
  public isCharging: boolean = false;
  private chargeSpeed: number = 36; // 0 to 100 in ~2.7 seconds (authentic GunBound/DragonBound charging sensitivity)

  // Keyboard state
  private keysPressed: Record<string, boolean> = {};
  private walkAccumulator: number = 0;
  private angleAccumulator: number = 0;

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

  public update(dt: number) {
    if (!this.enabled || !this.activeMobile) return;

    // 1. Mobile Movement along terrain contour (Authentic DragonBound WALK_SPEED = 50px/sec)
    const isLeft = this.keysPressed["ArrowLeft"] || this.keysPressed["KeyA"];
    const isRight = this.keysPressed["ArrowRight"] || this.keysPressed["KeyD"];

    if (isLeft && !isRight) {
      this.walkAccumulator += dt * 0.833;
      while (this.walkAccumulator >= 1) {
        this.stepMobile(-1);
        this.walkAccumulator -= 1;
      }
    } else if (isRight && !isLeft) {
      this.walkAccumulator += dt * 0.833;
      while (this.walkAccumulator >= 1) {
        this.stepMobile(1);
        this.walkAccumulator -= 1;
      }
    } else {
      this.walkAccumulator = 0;
    }

    // 2. Smooth aim angle adjustments when key is held down (~17 deg/sec)
    const isUp = this.keysPressed["ArrowUp"] || this.keysPressed["KeyW"];
    const isDown = this.keysPressed["ArrowDown"] || this.keysPressed["KeyS"];

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

    // 3. Spacebar Power Charging
    if (this.isCharging) {
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

  private stepMobile(dir: number) {
    if (!this.activeMobile) return;

    this.activeMobile.setFacing(dir);

    // Terrain walking step with ground incline tracking
    const walkRes = this.terrain.walk(this.activeMobile.x, this.activeMobile.y, dir);
    this.activeMobile.x = walkRes.x;
    this.activeMobile.y = walkRes.y;

    const slope = this.terrain.getSlopeAngle(this.activeMobile.x, this.activeMobile.y);
    this.activeMobile.setTilt(slope.angle);

    this.activeMobile.playAnimation("move");

    if (this.onMobileMove) {
      this.onMobileMove(this.activeMobile.x, this.activeMobile.y);
    }
  }

  public adjustAngle(delta: number) {
    if (!this.activeMobile) return;
    const newAngle = Math.round(this.activeMobile.angleDeg + delta);
    this.activeMobile.setAngle(newAngle);
    if (this.onAngleChange) {
      this.onAngleChange(this.activeMobile.angleDeg);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled || !this.activeMobile) return;

    // Prevent default scrolling for game controls
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }

    if (this.keysPressed[e.code]) return;
    this.keysPressed[e.code] = true;

    // Angle adjustment on tap: exactly 1 degree per tap!
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      this.adjustAngle(1);
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
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

    // Spacebar start charge
    if (e.code === "Space" && !this.isCharging) {
      this.isCharging = true;
      this.power = 0;
      const chargeAnim = this.shotType === 2 ? "bsfire" : this.shotType === 1 ? "bfire2" : "bfire1";
      this.activeMobile.playAnimation(chargeAnim);
      AudioManager.play("power_charge", 0.7);
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keysPressed[e.code] = false;

    // Stop walking animation when arrow keys released
    if (
      (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowRight" || e.code === "KeyD") &&
      this.activeMobile &&
      !this.isCharging
    ) {
      this.activeMobile.playAnimation("normal");
    }

    // Spacebar release fire
    if (e.code === "Space" && this.isCharging) {
      this.releaseFire();
    }
  }

  private releaseFire() {
    if (!this.isCharging || !this.activeMobile) return;
    this.isCharging = false;

    const firedAngle = this.activeMobile.angleDeg;
    const firedPower = Math.max(5, this.power);

    if (this.onPowerChange) {
      this.onPowerChange(0);
    }

    if (this.onFireCallback) {
      this.onFireCallback(firedAngle, firedPower, this.shotType);
    }
  }

  public destroy() {
    window.removeEventListener("keydown", (e) => this.handleKeyDown(e));
    window.removeEventListener("keyup", (e) => this.handleKeyUp(e));
  }
}
