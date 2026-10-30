import { Container, Graphics, Text, TextStyle } from "pixi.js";

export class WindIndicator extends Container {
  private dialGraphics: Graphics;
  private arrowGraphics: Graphics;
  private text: Text;

  public magnitude: number = 0;
  public angleDeg: number = 0;

  constructor() {
    super();

    this.dialGraphics = new Graphics();
    // Dial circle background
    this.dialGraphics.circle(0, 0, 28).fill(0x1a242f);
    this.dialGraphics.circle(0, 0, 28).stroke({ width: 2, color: 0x64b5f6 });
    this.addChild(this.dialGraphics);

    this.arrowGraphics = new Graphics();
    this.addChild(this.arrowGraphics);

    const style = new TextStyle({
      fontFamily: "Arial",
      fontSize: 14,
      fontWeight: "bold",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
    });
    this.text = new Text({ text: "00", style });
    this.text.anchor.set(0.5, 0.5);
    this.addChild(this.text);

    this.setWind(0, 0);
  }

  public setWind(magnitude: number, angleDeg: number) {
    this.magnitude = magnitude;
    this.angleDeg = angleDeg;

    this.text.text = `${Math.round(magnitude)}`;

    this.arrowGraphics.clear();
    if (magnitude > 0) {
      const rad = (angleDeg * Math.PI) / 180;
      const arrowLength = 22;
      const tipX = Math.cos(rad) * arrowLength;
      const tipY = Math.sin(rad) * arrowLength;

      this.arrowGraphics.moveTo(0, 0);
      this.arrowGraphics.lineTo(tipX, tipY);
      this.arrowGraphics.stroke({ width: 3, color: 0xffeb3b });

      // Arrowhead
      const headAngle = Math.PI / 6;
      const headLen = 7;
      this.arrowGraphics.lineTo(
        tipX - headLen * Math.cos(rad - headAngle),
        tipY - headLen * Math.sin(rad - headAngle)
      );
      this.arrowGraphics.moveTo(tipX, tipY);
      this.arrowGraphics.lineTo(
        tipX - headLen * Math.cos(rad + headAngle),
        tipY - headLen * Math.sin(rad + headAngle)
      );
      this.arrowGraphics.stroke({ width: 3, color: 0xffeb3b });
    }
  }
}
