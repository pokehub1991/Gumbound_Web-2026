import { Container, Graphics, Text, TextStyle } from "pixi.js";

export class PowerBar extends Container {
  private barGraphics: Graphics;
  private powerText: Text;
  public power: number = 0; // 0 to 100

  constructor(width: number = 360, height: number = 22) {
    super();

    this.barGraphics = new Graphics();
    this.addChild(this.barGraphics);

    const style = new TextStyle({
      fontFamily: "Arial",
      fontSize: 13,
      fontWeight: "bold",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
    });
    this.powerText = new Text({ text: "POWER: 0.0%", style });
    this.powerText.anchor.set(0.5, 0.5);
    this.powerText.x = width / 2;
    this.powerText.y = height / 2;
    this.addChild(this.powerText);

    this.renderBar(width, height);
  }

  public setPower(power: number) {
    this.power = Math.max(0, Math.min(100, power));
    this.renderBar(360, 22);
    this.powerText.text = `POWER: ${this.power.toFixed(1)}%`;
  }

  private renderBar(w: number, h: number) {
    this.barGraphics.clear();

    // Outer frame
    this.barGraphics.roundRect(-2, -2, w + 4, h + 4, 4).fill(0x1a1a1a);
    this.barGraphics.roundRect(-2, -2, w + 4, h + 4, 4).stroke({ width: 2, color: 0x555555 });

    // Background track
    this.barGraphics.rect(0, 0, w, h).fill(0x0a0a0a);

    // Quarter notches
    for (let i = 1; i < 4; i++) {
      const notchX = (w / 4) * i;
      this.barGraphics.rect(notchX - 1, 0, 2, h).fill(0x333333);
    }

    // Power fill
    const fillW = (w * this.power) / 100;
    if (fillW > 0) {
      const color = this.power < 50 ? 0x00bcd4 : this.power < 80 ? 0xffeb3b : 0xf44336;
      this.barGraphics.rect(0, 0, fillW, h).fill(color);
    }
  }
}

