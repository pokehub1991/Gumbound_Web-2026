import { Container, Graphics, Text, TextStyle } from "pixi.js";

export interface MobileConfig {
  id: string;
  name: string;
  nickname: string;
  team: string; // "A" | "B"
  mobileType: number;
  maxHp: number;
  hp: number;
  x: number;
  y: number;
}

export class Mobile extends Container {
  public readonly id: string;
  public nickname: string;
  public team: string;
  public maxHp: number;
  public hp: number;
  public facing: number = 1; // 1 = right, -1 = left
  public angleDeg: number = 45;

  private bodyGraphics: Graphics;
  private turretGraphics: Graphics;
  private hpBarGraphics: Graphics;
  private nameText: Text;

  constructor(config: MobileConfig) {
    super();
    this.id = config.id;
    this.nickname = config.nickname;
    this.team = config.team;
    this.maxHp = config.maxHp;
    this.hp = config.hp;

    this.x = config.x;
    this.y = config.y;

    // Body
    this.bodyGraphics = new Graphics();
    this.turretGraphics = new Graphics();
    this.hpBarGraphics = new Graphics();

    const teamColor = this.team === "A" ? 0x2196f3 : 0xf44336;

    // Tank chassis
    this.bodyGraphics.roundRect(-22, -14, 44, 24, 6);
    this.bodyGraphics.fill(0x37474f);
    this.bodyGraphics.stroke({ width: 2, color: teamColor });

    // Tank tracks/wheels
    this.bodyGraphics.roundRect(-24, 6, 48, 10, 4);
    this.bodyGraphics.fill(0x212121);
    this.bodyGraphics.circle(-14, 11, 4).fill(0x757575);
    this.bodyGraphics.circle(0, 11, 4).fill(0x757575);
    this.bodyGraphics.circle(14, 11, 4).fill(0x757575);

    // Turret / Cannon
    this.turretGraphics.roundRect(0, -4, 28, 8, 3);
    this.turretGraphics.fill(teamColor);
    this.turretGraphics.stroke({ width: 1.5, color: 0xffffff });
    this.turretGraphics.x = 0;
    this.turretGraphics.y = -6;

    // Player Nickname label
    const style = new TextStyle({
      fontFamily: "Arial",
      fontSize: 12,
      fontWeight: "bold",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
    });
    this.nameText = new Text({ text: this.nickname, style });
    this.nameText.anchor.set(0.5, 1);
    this.nameText.y = -32;

    this.addChild(this.bodyGraphics);
    this.addChild(this.turretGraphics);
    this.addChild(this.hpBarGraphics);
    this.addChild(this.nameText);

    this.updateHpBar();
    this.setAngle(this.angleDeg);
  }

  public setAngle(deg: number) {
    this.angleDeg = deg;
    const rad = (deg * Math.PI) / 180;
    // Turret rotates according to angle and facing
    this.turretGraphics.rotation = -rad * this.facing;
  }

  public setFacing(dir: number) {
    this.facing = dir >= 0 ? 1 : -1;
    this.bodyGraphics.scale.x = this.facing;
    this.turretGraphics.scale.x = this.facing;
    this.setAngle(this.angleDeg);
  }

  public setHp(hp: number) {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.updateHpBar();
    if (this.hp === 0) {
      this.alpha = 0.4; // Fallen / dead mobile
    }
  }

  private updateHpBar() {
    this.hpBarGraphics.clear();
    const width = 44;
    const height = 5;
    const x = -width / 2;
    const y = -26;

    // Background bar
    this.hpBarGraphics.rect(x, y, width, height).fill(0x000000);

    // Health fill
    const healthPercent = this.hp / this.maxHp;
    const fillColor = healthPercent > 0.5 ? 0x4caf50 : healthPercent > 0.25 ? 0xffeb3b : 0xf44336;
    this.hpBarGraphics.rect(x + 1, y + 1, (width - 2) * healthPercent, height - 2).fill(fillColor);
  }

  public getMuzzlePosition(): { x: number; y: number } {
    const rad = (this.angleDeg * Math.PI) / 180;
    const barrelLength = 30;
    const offsetX = Math.cos(rad) * barrelLength * this.facing;
    const offsetY = -Math.sin(rad) * barrelLength - 6;
    return {
      x: this.x + offsetX,
      y: this.y + offsetY,
    };
  }
}

