import { Application, Container } from "pixi.js";
import { Background } from "./Background.js";
import { TerrainRenderer } from "./TerrainRenderer.js";
import { Camera } from "./Camera.js";

export class Game {
  public app: Application;
  public worldContainer: Container;
  public background: Background;
  public terrain: TerrainRenderer;
  public camera: Camera;
  public mobilesContainer: Container;
  public projectilesContainer: Container;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.mobilesContainer = new Container();
    this.projectilesContainer = new Container();
    this.background = new Background(2400, 800);
    this.terrain = new TerrainRenderer(2400, 800);
    this.camera = new Camera(this.worldContainer, 800, 600);
  }

  public async init(containerElement: HTMLElement) {
    await this.app.init({
      width: 800,
      height: 600,
      backgroundColor: 0x111921,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    containerElement.appendChild(this.app.canvas);

    // Layer hierarchy in world container
    this.worldContainer.addChild(this.background);
    this.worldContainer.addChild(this.terrain);
    this.worldContainer.addChild(this.mobilesContainer);
    this.worldContainer.addChild(this.projectilesContainer);

    this.app.stage.addChild(this.worldContainer);

    // Center camera initially around middle of map
    this.camera.panTo(600, 450);

    // Ticker loop
    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // Resize handler
    window.addEventListener("resize", () => {
      this.handleResize();
    });
    this.handleResize();
  }

  private handleResize() {
    const parent = this.app.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 800;
    const h = parent.clientHeight || 600;
    this.app.renderer.resize(w, h);
  }

  public update(dt: number) {
    this.camera.update(dt);
  }
}
