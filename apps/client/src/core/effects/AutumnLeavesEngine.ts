import { Container, Graphics } from "pixi.js";

interface AutumnLeaf {
  graphic: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobbleTime: number;
  wobbleSpeed: number;
  rotSpeed: number;
  baseScale: number;
  color: number;
}

/**
 * AutumnLeavesEngine
 * 
 * Ambient system of falling autumn leaves with realistic aerodynamic drift:
 * - Gravity fall.
 * - Dynamic wind blow towards the left.
 * - Sinusoidal flutter & 3D tumbling rotation.
 * - Layered between the panoramic background and foreground terrain.
 */
export class AutumnLeavesEngine {
  public container: Container;
  private leaves: AutumnLeaf[] = [];
  private mapWidth: number;
  private mapHeight: number;

  // Warm autumn palette: Golden Yellow, Amber Orange, Rust Red, Warm Maple
  private readonly leafColors = [
    0xf59e0b, // Amber Gold
    0xea580c, // Deep Autumn Orange
    0xdc2626, // Rust Crimson
    0xfb923c, // Warm Maple
    0xb45309, // Earthy Ochre
  ];

  constructor(parent?: Container, mapWidth: number = 1409, mapHeight: number = 1210, count: number = 24) {
    this.container = new Container();
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    if (parent) {
      parent.addChild(this.container);
    }

    this.spawnLeaves(count);
  }

  private spawnLeaves(count: number) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = this.leafColors[Math.floor(Math.random() * this.leafColors.length)];
      this.drawLeafShape(g, color);

      this.container.addChild(g);

      // Random initial distribution across battlefield sky
      const x = Math.random() * (this.mapWidth + 300) - 100;
      const y = Math.random() * (this.mapHeight * 0.85) - 80;
      const baseScale = 0.85 + Math.random() * 0.45;

      this.leaves.push({
        graphic: g,
        x,
        y,
        vx: -(1.4 + Math.random() * 1.6), // Dynamic leftward wind draft
        vy: 0.6 + Math.random() * 0.65,  // Gentle gravity descent
        wobbleTime: Math.random() * 10,
        wobbleSpeed: 0.04 + Math.random() * 0.035,
        rotSpeed: (Math.random() - 0.5) * 0.035,
        baseScale,
        color,
      });

      g.position.set(x, y);
      g.scale.set(baseScale);
      g.rotation = Math.random() * Math.PI * 2;
    }
  }

  /**
   * Draw cartoon stylized maple / pointed autumn leaf with stem and vein
   */
  private drawLeafShape(g: Graphics, color: number) {
    g.clear();

    // Stylized pointed leaf polygon
    g.poly([
      0,   -10, // Top tip
      4.5, -4,  // Upper right lobe
      6.0, +2,  // Mid right lobe
      3.5, +7,  // Lower right
      0,   +9,  // Base stem junction
      -3.5,+7,  // Lower left
      -6.0,+2,  // Mid left lobe
      -4.5,-4,  // Upper left lobe
    ]);
    g.fill(color);
    g.stroke({ width: 1.2, color: 0x271406, alpha: 0.85 });

    // Subtle central vein
    g.poly([
      0, -8,
      0, +10, // Extends as stem
    ]);
    g.stroke({ width: 0.9, color: 0x451a03, alpha: 0.65 });
  }

  public update(dt: number) {
    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i];

      leaf.wobbleTime += leaf.wobbleSpeed * dt;

      // Dynamic wind blown to the left with sinusoidal flutter
      const flutterX = Math.sin(leaf.wobbleTime) * 1.1;
      const flutterY = Math.cos(leaf.wobbleTime * 0.8) * 0.35;

      leaf.x += (leaf.vx + flutterX) * dt;
      leaf.y += (leaf.vy + flutterY) * dt;
      leaf.graphic.rotation += leaf.rotSpeed * dt;

      // 3D tumbling perspective effect in the wind
      const tumble = Math.sin(leaf.wobbleTime * 1.8);
      leaf.graphic.scale.x = leaf.baseScale * (0.4 + 0.6 * Math.abs(tumble));
      leaf.graphic.scale.y = leaf.baseScale;

      leaf.graphic.position.set(leaf.x, leaf.y);

      // Wrap around when exiting left or bottom
      if (leaf.x < -80 || leaf.y > this.mapHeight + 40) {
        leaf.x = this.mapWidth + 60 + Math.random() * 180;
        leaf.y = Math.random() * (this.mapHeight * 0.5) - 60;
        leaf.wobbleTime = Math.random() * 10;
      }
    }
  }

  public setMapBounds(w: number, h: number) {
    this.mapWidth = w;
    this.mapHeight = h;
  }

  public destroy() {
    this.container.destroy({ children: true });
  }
}
