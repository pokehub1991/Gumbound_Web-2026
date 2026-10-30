import { Container, Graphics } from "pixi.js";
import { Mobile } from "./Mobile.js";
import { PowerBar } from "./PowerBar.js";
import { TerrainRenderer } from "./TerrainRenderer.js";

export class AimController extends Container {
  public enabled: boolean = false;
  public currentAngle: number = 45;
  public power: number = 0;
  public shotType: number = 0; // 0 = Shot 1, 1 = Shot 2, 2 = SS
  private charging: boolean = false;
  private chargeDirection: number = 1;

  private trajectoryPreview: Graphics;
  private activeMobile?: Mobile;
  private powerBar: PowerBar;
  private terrain: TerrainRenderer;

  private activeKeys: Set<string> = new Set();
  private lastMoveSendTime: number = 0;

  public onFireCallback?: (angle: number, power: number, shotType: number) => void;
  public onMoveCallback?: (x: number, y: number, facing: number) => void;

  constructor(powerBar: PowerBar, terrain: TerrainRenderer) {
    super();
    this.powerBar = powerBar;
    this.terrain = terrain;
    this.trajectoryPreview = new Graphics();
    this.addChild(this.trajectoryPreview);

    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
  }

  public setActiveMobile(mobile?: Mobile) {
    this.activeMobile = mobile;
    this.activeKeys.clear();
    if (mobile) {
      this.currentAngle = mobile.angleDeg;
      mobile.playAnimation("normal");
      this.updatePreview();
    } else {
      this.trajectoryPreview.clear();
    }
  }

  public update(dt: number) {
    if (!this.enabled || !this.activeMobile) return;

    if (this.charging) {
      // Charge power bar continuously
      this.power += 1.2 * dt * this.chargeDirection;
      if (this.power >= 100) {
        this.power = 100;
        this.chargeDirection = -1; // Bounce back
      } else if (this.power <= 0) {
        this.power = 0;
        this.chargeDirection = 1;
      }
      this.powerBar.setPower(this.power);
      this.updatePreview();
      return;
    }

    // Movement handling (Left / Right or A / D)
    const moveLeft = this.activeKeys.has("ArrowLeft") || this.activeKeys.has("KeyA");
    const moveRight = this.activeKeys.has("ArrowRight") || this.activeKeys.has("KeyD");

    if (moveLeft && !moveRight) {
      this.performMove(-1, dt);
    } else if (moveRight && !moveLeft) {
      this.performMove(1, dt);
    } else {
      this.activeMobile.playAnimation("normal");
    }
  }

  private performMove(dir: number, dt: number) {
    if (!this.activeMobile) return;

    this.activeMobile.setFacing(dir);
    this.activeMobile.playAnimation("move");

    const moveSpeed = 90; // Pixels per second
    const deltaX = dir * moveSpeed * (dt / 60);
    const newX = Math.max(50, Math.min(this.terrain.mapWidth - 50, this.activeMobile.x + deltaX));

    // Dynamic terrain height snapping
    const newY = this.terrain.findSurfaceY(newX, this.activeMobile.y);

    this.activeMobile.x = newX;
    this.activeMobile.y = newY;
    this.updatePreview();

    // Throttled position sync
    const now = Date.now();
    if (now - this.lastMoveSendTime > 120) {
      this.lastMoveSendTime = now;
      if (this.onMoveCallback) {
        this.onMoveCallback(newX, newY, dir);
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled || !this.activeMobile) return;

    this.activeKeys.add(e.code);

    if (e.code === "ArrowUp" || e.code === "KeyW") {
      this.currentAngle = Math.min(85, this.currentAngle + 1);
      this.activeMobile.setAngle(this.currentAngle);
      this.updatePreview();
      e.preventDefault();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      this.currentAngle = Math.max(10, this.currentAngle - 1);
      this.activeMobile.setAngle(this.currentAngle);
      this.updatePreview();
      e.preventDefault();
    } else if (e.code === "Space" && !this.charging && !e.repeat) {
      this.charging = true;
      this.power = 0;
      this.chargeDirection = 1;
      this.activeMobile.playAnimation("normal");
      e.preventDefault();
    } else if (e.code === "Digit1") {
      this.shotType = 0;
    } else if (e.code === "Digit2") {
      this.shotType = 1;
    } else if (e.code === "Digit3") {
      this.shotType = 2;
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.activeKeys.delete(e.code);

    if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "KeyA" || e.code === "KeyD") {
      const remainingMove =
        this.activeKeys.has("ArrowLeft") ||
        this.activeKeys.has("ArrowRight") ||
        this.activeKeys.has("KeyA") ||
        this.activeKeys.has("KeyD");

      if (!remainingMove && this.activeMobile) {
        this.activeMobile.playAnimation("normal");
        if (this.onMoveCallback) {
          this.onMoveCallback(this.activeMobile.x, this.activeMobile.y, this.activeMobile.facing);
        }
      }
    }

    if (!this.enabled || !this.activeMobile) return;

    if (e.code === "Space" && this.charging) {
      this.charging = false;
      e.preventDefault();
      if (this.onFireCallback) {
        this.onFireCallback(this.currentAngle, this.power, this.shotType);
      }
      this.enabled = false; // Disable controls while shot executes
      this.activeKeys.clear();
      this.trajectoryPreview.clear();
      this.powerBar.setPower(0);
    }
  }

  private updatePreview() {
    this.trajectoryPreview.clear();
    if (!this.activeMobile) return;

    const muzzle = this.activeMobile.getMuzzlePosition();
    const rad = (this.currentAngle * Math.PI) / 180;
    const len = 45;
    const endX = muzzle.x + Math.cos(rad) * len * this.activeMobile.facing;
    const endY = muzzle.y - Math.sin(rad) * len;

    // Reticle line
    this.trajectoryPreview.moveTo(muzzle.x, muzzle.y);
    this.trajectoryPreview.lineTo(endX, endY);
    this.trajectoryPreview.stroke({ width: 2, color: 0x38bdf8 });

    // Arrow tip
    this.trajectoryPreview.circle(endX, endY, 3.5);
    this.trajectoryPreview.fill(0x38bdf8);
  }
}
