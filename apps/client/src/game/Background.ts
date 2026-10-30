import { Container, Graphics } from "pixi.js";

export class Background extends Container {
  private sky: Graphics;

  constructor(width: number = 2400, height: number = 800) {
    super();

    this.sky = new Graphics();
    // Sky blue to horizon warm tone
    this.sky.rect(0, 0, width, height);
    this.sky.fill(0x4a90e2);

    // Sun / Moon
    this.sky.circle(width * 0.75, 180, 50);
    this.sky.fill({ color: 0xfff3a0, alpha: 0.85 });

    // Distant mountain silhouette
    this.sky.moveTo(0, height);
    for (let x = 0; x <= width; x += 150) {
      const hillHeight = 250 + Math.sin(x * 0.005) * 80 + Math.cos(x * 0.02) * 30;
      this.sky.lineTo(x, height - hillHeight);
    }
    this.sky.lineTo(width, height);
    this.sky.closePath();
    this.sky.fill({ color: 0x3b6e8c, alpha: 0.6 });

    this.addChild(this.sky);
  }
}

