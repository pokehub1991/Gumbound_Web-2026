import { Container, Sprite, Texture } from "pixi.js";
import { TerrainMask, SlopeInfo, WalkResult } from "./TerrainMask.js";
import { MAPS } from "../constants/maps.js";

export class TerrainRenderer extends Container {
  public readonly mapWidth: number;
  public readonly mapHeight: number;
  public collisionMask: TerrainMask;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprite: Sprite;
  private texture: Texture;

  public isMapLoaded: boolean = false;
  public onLoadedCallback?: () => void;

  constructor(mapWidth: number = 1409, mapHeight: number = 1210) {
    super();
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.canvas = document.createElement("canvas");
    this.canvas.width = mapWidth;
    this.canvas.height = mapHeight;

    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not acquire 2D context for terrain");
    this.ctx = ctx;

    this.collisionMask = new TerrainMask(mapWidth, mapHeight);

    this.texture = Texture.from(this.canvas);
    this.sprite = new Sprite(this.texture);
    this.addChild(this.sprite);

    // Load Metamine map by default
    this.loadMap("metamine");
  }

  public async loadMap(mapKey: string = "metamine") {
    const mapDef = MAPS[mapKey] || MAPS["metamine"];

    try {
      // 1. Load Foreground image & Collision Mask in parallel
      const fgImg = await this.loadImage(mapDef.fg);
      const maskImg = await this.loadImage(mapDef.mask);

      const offsetY = mapDef.offset_y || 0;
      const fgW = mapDef.fgWidth || fgImg.width;
      const fgH = mapDef.fgHeight || fgImg.height;

      // 2. Clear canvas
      this.ctx.clearRect(0, 0, this.mapWidth, this.mapHeight);

      // 3. Render foreground bridge onto canvas at offset_y
      this.ctx.drawImage(fgImg, 0, offsetY, fgW, fgH);

      // 4. Composite collision mask using destination-in on the bridge region
      this.ctx.save();
      this.ctx.globalCompositeOperation = "destination-in";
      this.ctx.drawImage(maskImg, 0, offsetY, fgW, fgH);
      this.ctx.restore();

      // 5. Extract pixel buffer into in-memory collisionMask for instantaneous collision checks
      const imgData = this.ctx.getImageData(0, 0, this.mapWidth, this.mapHeight);

      // Clear any non-terrain pixels in the sky region (y < 475) so suspension arches, cables, and air
      // never cause high-flying bullets to collide in mid-air
      const clearSkyY = Math.min(this.mapHeight, 475);
      for (let y = 0; y < clearSkyY; y++) {
        const rowStart = y * this.mapWidth * 4;
        for (let x = 0; x < this.mapWidth; x++) {
          imgData.data[rowStart + x * 4 + 3] = 0;
        }
      }

      this.collisionMask.maskData.set(imgData.data);

      this.texture.source.update();
      this.isMapLoaded = true;

      if (this.onLoadedCallback) {
        this.onLoadedCallback();
      }
    } catch (err) {
      console.error("[TerrainRenderer] Error loading map textures, generating fallback terrain:", err);
      this.generateFallbackTerrain();
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  public generateFallbackTerrain() {
    this.ctx.clearRect(0, 0, this.mapWidth, this.mapHeight);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.mapHeight);

    for (let x = 0; x <= this.mapWidth; x++) {
      const y = Math.round(560 + Math.sin(x * 0.008) * 65 + Math.sin(x * 0.02) * 20);
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(this.mapWidth, this.mapHeight);
    this.ctx.closePath();

    this.ctx.fillStyle = "#593a1d";
    this.ctx.fill();

    const imgData = this.ctx.getImageData(0, 0, this.mapWidth, this.mapHeight);
    this.collisionMask.maskData.set(imgData.data);
    this.texture.source.update();
    this.isMapLoaded = true;
  }

  /**
   * 3D crater cutout with burn outline and solid mask update.
   */
  public clearCircle(cx: number, cy: number, radius: number) {
    this.carveCrater(cx, cy, radius, radius * 0.85);
  }

  public carveCrater(cx: number, cy: number, rx: number, ry: number) {
    // 1. Excavate visible crater on canvas
    this.ctx.save();
    this.ctx.globalCompositeOperation = "destination-out";
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // 2. Add realistic dark burn rim around crater
    this.ctx.save();
    this.ctx.globalCompositeOperation = "source-atop";
    this.ctx.strokeStyle = "rgba(18, 12, 10, 0.55)";
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // 3. Update collision mask
    this.collisionMask.carveHole(cx, cy, rx, ry);

    // 4. Update GPU texture
    this.texture.source.update();
  }

  public isGround(x: number, y: number): boolean {
    if (y < 475) return false;
    return this.collisionMask.isPixelSolid(x, y);
  }

  public getSlopeAngle(x: number, y: number): SlopeInfo {
    return this.collisionMask.getSlopeAngle(x, y);
  }

  public findSurfaceY(x: number, startY: number): number {
    return this.collisionMask.findSurfaceY(x, startY);
  }

  public walk(x: number, y: number, dir: number): WalkResult {
    return this.collisionMask.walk(x, y, dir);
  }

  public getFirstSolidY(x: number): number | null {
    return this.collisionMask.getFirstSolidY(x);
  }

  public getRandomGroundPosition(minX?: number, maxX?: number): { x: number; y: number } {
    return this.collisionMask.getRandomGroundPosition(minX, maxX);
  }
}
