import { Container, Graphics } from "pixi.js";
import { Mobile } from "./Mobile.js";
import { PowerBar } from "./PowerBar.js";

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

  public onFireCallback?: (angle: number, power: number, shotType: number) => void;

  constructor(powerBar: PowerBar) {
    super();
    this.powerBar = powerBar;
    this.trajectoryPreview = new Graphics();
    this.addChild(this.trajectoryPreview);

    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
  }

  public setActiveMobile(mobile?: Mobile) {
    this.activeMobile = mobile;
    if (mobile) {
      this.currentAngle = mobile.angleDeg;
      this.updatePreview();
    }
  }

  public update(dt: number) {
    if (!this.enabled) return;

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
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled || !this.activeMobile) return;

    if (e.code === "ArrowUp") {
      this.currentAngle = Math.min(85, this.currentAngle + 1);
      this.activeMobile.setAngle(this.currentAngle);
      this.updatePreview();
      e.preventDefault();
    } else if (e.code === "ArrowDown") {
      this.currentAngle = Math.max(10, this.currentAngle - 1);
      this.activeMobile.setAngle(this.currentAngle);
      this.updatePreview();
      e.preventDefault();
    } else if (e.code === "ArrowLeft") {
      this.activeMobile.setFacing(-1);
      this.updatePreview();
      e.preventDefault();
    } else if (e.code === "ArrowRight") {
      this.activeMobile.setFacing(1);
      this.updatePreview();
      e.preventDefault();
    } else if (e.code === "Space" && !this.charging && !e.repeat) {
      this.charging = true;
      this.power = 0;
      this.chargeDirection = 1;
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
    if (!this.enabled || !this.activeMobile) return;

    if (e.code === "Space" && this.charging) {
      this.charging = false;
      e.preventDefault();
      if (this.onFireCallback) {
        this.onFireCallback(this.currentAngle, this.power, this.shotType);
      }
      this.enabled = false; // Disable controls while shot executes
      this.trajectoryPreview.clear();
    }
  }

  private updatePreview() {
    this.trajectoryPreview.clear();
    if (!this.activeMobile || !this.enabled) return;

    const muzzle = this.activeMobile.getMuzzlePosition();
    const rad = (this.currentAngle * Math.PI) / 180;
    const facing = this.activeMobile.facing;

    // Draw small aiming guide arc
    const length = 45;
    const tipX = muzzle.x + Math.cos(rad) * length * facing;
    const tipY = muzzle.y - Math.sin(rad) * length;

    this.trajectoryPreview.moveTo(muzzle.x, muzzle.y);
    this.trajectoryPreview.lineTo(tipX, tipY);
    this.trajectoryPreview.stroke({ width: 1.5, color: 0x00e676, alpha: 0.6 });
  }
}
