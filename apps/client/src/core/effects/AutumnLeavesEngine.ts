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
  isForeground: boolean;
}

/**
 * AutumnLeavesEngine
 * 
 * Ambient system of falling autumn leaves with multi-layer depth & realistic aerodynamic drift:
 * - Edge-to-edge trajectory: Spawns from the far background border and drifts all the way across until reaching the opposite background border.
 * - Dual-layer depth: Majority of leaves drift behind the terrain, while dynamic foreground leaves occasionally drift in front of the terrain and vehicles.
 * - Sinusoidal flutter & 3D tumbling rotation with gravity descent and dynamic wind.
 */
export class AutumnLeavesEngine {
  public backgroundContainer: Container;
  public foregroundContainer: Container;
  public get container(): Container {
    return this.backgroundContainer;
  }

  private leaves: AutumnLeaf[] = [];
  private mapWidth: number;
  private mapHeight: number;

  // Extended outer background boundaries to ensure edge-to-edge entry & exit without pop-ins
  private minX: number = -500;
  private maxX: number = 1950;
  private minY: number = -550;
  private maxY: number = 1350;

  // Warm autumn palette: Amber Gold, Deep Autumn Orange, Rust Crimson, Warm Maple, Earthy Ochre
  private readonly leafColors = [
    0xf59e0b,
    0xea580c,
    0xdc2626,
    0xfb923c,
    0xb45309,
  ];

  constructor(parent?: Container, mapWidth: number = 1409, mapHeight: number = 1210, count: number = 28) {
    this.backgroundContainer = new Container();
    this.foregroundContainer = new Container();

    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.updateBounds();

    if (parent) {
      parent.addChild(this.backgroundContainer);
    }

    this.spawnLeaves(count);
  }

  private updateBounds() {
    this.minX = -500;
    this.maxX = this.mapWidth + 550;
    this.minY = -550;
    this.maxY = this.mapHeight + 250;
  }

  private spawnLeaves(count: number) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = this.leafColors[Math.floor(Math.random() * this.leafColors.length)];
      this.drawLeafShape(g, color);

      // ~25% of leaves fall in front of terrain for depth perception
      const isForeground = Math.random() < 0.28;
      const targetContainer = isForeground ? this.foregroundContainer : this.backgroundContainer;
      targetContainer.addChild(g);

      // Spawn strictly above the top edge so they drift into view from above the screen
      const x = this.minX + Math.random() * (this.maxX - this.minX + 350);
      const y = this.minY - Math.random() * 250 - (i / count) * 450;
      const baseScale = isForeground ? (1.15 + Math.random() * 0.35) : (0.80 + Math.random() * 0.35);

      this.leaves.push({
        graphic: g,
        x,
        y,
        vx: -(1.4 + Math.random() * 1.6), // Leftward wind draft
        vy: 0.65 + Math.random() * 0.65, // Gentle gravity fall
        wobbleTime: Math.random() * 10,
        wobbleSpeed: 0.035 + Math.random() * 0.035,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        baseScale,
        color,
        isForeground,
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
      leaf.graphic.scale.x = leaf.baseScale * (0.35 + 0.65 * Math.abs(tumble));
      leaf.graphic.scale.y = leaf.baseScale;

      leaf.graphic.position.set(leaf.x, leaf.y);

      // Edge-to-edge wrap around: only reset once completely past outer background borders
      if (leaf.x < this.minX || leaf.y > this.maxY) {
        // Always respawn strictly above the top edge so leaves cascade downward into the screen from the upper boundary
        leaf.x = this.minX + Math.random() * (this.maxX - this.minX + 350);
        leaf.y = this.minY - Math.random() * 120;

        // Dynamically alternate layers for natural depth
        const newIsForeground = Math.random() < 0.28;
        if (newIsForeground !== leaf.isForeground) {
          leaf.isForeground = newIsForeground;
          leaf.baseScale = newIsForeground ? (1.15 + Math.random() * 0.35) : (0.80 + Math.random() * 0.35);
          if (newIsForeground) {
            this.backgroundContainer.removeChild(leaf.graphic);
            this.foregroundContainer.addChild(leaf.graphic);
          } else {
            this.foregroundContainer.removeChild(leaf.graphic);
            this.backgroundContainer.addChild(leaf.graphic);
          }
        }

        leaf.wobbleTime = Math.random() * 10;
      }
    }
  }

  public setMapBounds(w: number, h: number) {
    this.mapWidth = w;
    this.mapHeight = h;
    this.updateBounds();
  }

  public destroy() {
    this.backgroundContainer.destroy({ children: true });
    this.foregroundContainer.destroy({ children: true });
  }
}
