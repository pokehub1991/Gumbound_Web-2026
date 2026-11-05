import { Container, Graphics } from "pixi.js";

interface AutumnLeaf {
  graphic: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVy: number;
  terminalVy: number;
  gravity: number;
  wobbleTime: number;
  wobbleSpeed: number;
  flutterAmpX: number;
  flutterAmpY: number;
  rotSpeed: number;
  baseScale: number;
  color: number;
  isForeground: boolean;
}

/**
 * AutumnLeavesEngine
 * 
 * Dynamic physical simulation of falling autumn leaves:
 * - Gravity & Aerodynamic Physics: Accelerates under gravity with terminal velocity, air resistance, and wind flutter.
 * - Full Vertical Trajectory: Starts dynamically from the top edge of the screen down through the bottom of the world/background.
 * - Multi-layer Depth: Leaves drift both behind and in front of the terrain and vehicles for authentic 3D atmosphere.
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

  // Warm autumn palette: Amber Gold, Deep Autumn Orange, Rust Crimson, Warm Maple, Earthy Ochre
  private readonly leafColors = [
    0xf59e0b,
    0xea580c,
    0xdc2626,
    0xfb923c,
    0xb45309,
  ];

  constructor(parent?: Container, mapWidth: number = 1409, mapHeight: number = 1250, count: number = 28) {
    this.backgroundContainer = new Container();
    this.foregroundContainer = new Container();

    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    if (parent) {
      parent.addChild(this.backgroundContainer);
    }

    this.spawnLeaves(count);
  }

  private spawnLeaves(count: number) {
    // Initial distribution: spread across the entire height from the sky (y ≈ -40) down to the bottom (y ≈ mapHeight)
    // so the battlefield starts with leaves already falling gracefully at every depth.
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = this.leafColors[Math.floor(Math.random() * this.leafColors.length)];
      this.drawLeafShape(g, color);

      // ~30% of leaves fall in foreground (in front of terrain & mobiles)
      const isForeground = Math.random() < 0.30;
      const targetContainer = isForeground ? this.foregroundContainer : this.backgroundContainer;
      targetContainer.addChild(g);

      // Initial scatter across the full world width and vertical span
      const x = -100 + Math.random() * (this.mapWidth + 350);
      const y = -40 + (i / count) * (this.mapHeight + 80);

      const baseScale = isForeground ? (1.10 + Math.random() * 0.35) : (0.75 + Math.random() * 0.35);
      const baseVy = 0.70 + Math.random() * 0.60;
      const terminalVy = baseVy + 0.80 + Math.random() * 0.60;
      const gravity = 0.012 + Math.random() * 0.014;

      this.leaves.push({
        graphic: g,
        x,
        y,
        vx: -(1.2 + Math.random() * 1.5), // Natural leftward autumn wind
        vy: baseVy,
        baseVy,
        terminalVy,
        gravity,
        wobbleTime: Math.random() * 10,
        wobbleSpeed: 0.035 + Math.random() * 0.035,
        flutterAmpX: 1.2 + Math.random() * 0.8,
        flutterAmpY: 0.35 + Math.random() * 0.3,
        rotSpeed: (Math.random() - 0.5) * 0.035,
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
      0,   -9,  // Top tip
      4.0, -3,  // Upper right lobe
      5.5, +2,  // Mid right lobe
      3.0, +6,  // Lower right
      0,   +8,  // Base stem junction
      -3.0,+6,  // Lower left
      -5.5,+2,  // Mid left lobe
      -4.0,-3,  // Upper left lobe
    ]);
    g.fill(color);
    g.stroke({ width: 1.2, color: 0x271406, alpha: 0.85 });

    // Subtle central vein & stem
    g.poly([
      0, -7,
      0, +10,
    ]);
    g.stroke({ width: 0.9, color: 0x451a03, alpha: 0.65 });
  }

  /**
   * Update leaf physics with camera-aware viewport boundaries:
   * Leaves start falling dynamically from the very top border of the screen down through the bottom of the world.
   */
  public update(dt: number, cameraX?: number, cameraY?: number, zoom?: number, screenW?: number, screenH?: number) {
    const camX = cameraX ?? (this.mapWidth / 2);
    const camY = cameraY ?? 420;
    const z = zoom ?? 1.2;
    const sW = screenW ?? 1400;
    const sH = screenH ?? 800;

    const halfW = (sW / 2) / z;
    const halfH = (sH / 2) / z;

    // Visible viewport in world coordinates
    const viewTop = camY - halfH;
    const viewBottom = camY + halfH;
    const viewLeft = camX - halfW;
    const viewRight = camX + halfW;

    // Boundaries:
    // Entry: strictly above the top edge of the visible screen
    // Exit: bottom border of the world/background
    const topSpawnY = viewTop - 35;
    const bottomExitY = Math.max(viewBottom + 60, this.mapHeight + 50);
    const leftExitX = viewLeft - 100;
    const rightEntryX = viewRight + 250;

    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i];

      // Dynamic gravity acceleration with terminal velocity
      leaf.vy = Math.min(leaf.terminalVy, leaf.vy + leaf.gravity * dt);

      leaf.wobbleTime += leaf.wobbleSpeed * dt;

      // Aerodynamic wind drift with flutter
      const flutterX = Math.sin(leaf.wobbleTime) * leaf.flutterAmpX;
      const flutterY = Math.cos(leaf.wobbleTime * 0.8) * leaf.flutterAmpY;

      leaf.x += (leaf.vx + flutterX) * dt;
      leaf.y += (leaf.vy + flutterY) * dt;
      leaf.graphic.rotation += leaf.rotSpeed * dt;

      // 3D tumbling perspective effect in the breeze
      const tumble = Math.sin(leaf.wobbleTime * 1.6);
      leaf.graphic.scale.x = leaf.baseScale * (0.30 + 0.70 * Math.abs(tumble));
      leaf.graphic.scale.y = leaf.baseScale;

      leaf.graphic.position.set(leaf.x, leaf.y);

      // Edge-to-edge wrap around:
      // When leaf passes below the bottom background edge or blows past the left screen edge:
      // Respawn strictly at the upper border of the screen, carried by the leftward wind into view
      if (leaf.y > bottomExitY || leaf.x < leftExitX) {
        leaf.x = viewLeft + Math.random() * (rightEntryX - viewLeft);
        leaf.y = topSpawnY - Math.random() * 45;
        leaf.vy = leaf.baseVy; // reset initial fall velocity

        // Dynamically alternate layers for depth
        const newIsForeground = Math.random() < 0.30;
        if (newIsForeground !== leaf.isForeground) {
          leaf.isForeground = newIsForeground;
          leaf.baseScale = newIsForeground ? (1.10 + Math.random() * 0.35) : (0.75 + Math.random() * 0.35);
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
  }

  public destroy() {
    this.backgroundContainer.destroy({ children: true });
    this.foregroundContainer.destroy({ children: true });
  }
}
