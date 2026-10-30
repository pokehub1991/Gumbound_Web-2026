import { Application, Container } from "pixi.js";
import { Background } from "./Background.js";
import { TerrainRenderer } from "./TerrainRenderer.js";
import { Camera } from "./Camera.js";
import { Mobile } from "./Mobile.js";
import { PowerBar } from "./PowerBar.js";
import { WindIndicator } from "./WindIndicator.js";
import { AimController } from "./AimController.js";
import { Projectile } from "./Projectile.js";

export class Game {
  public app: Application;
  public worldContainer: Container;
  public uiContainer: Container;
  public background: Background;
  public terrain: TerrainRenderer;
  public camera: Camera;
  public mobilesContainer: Container;
  public projectilesContainer: Container;

  public powerBar: PowerBar;
  public windIndicator: WindIndicator;
  public aimController: AimController;

  public mobiles: Map<string, Mobile> = new Map();
  public activeProjectile?: Projectile;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.uiContainer = new Container();
    this.mobilesContainer = new Container();
    this.projectilesContainer = new Container();
    this.background = new Background(2400, 800);
    this.terrain = new TerrainRenderer(2400, 800);
    this.camera = new Camera(this.worldContainer, 800, 600);

    this.powerBar = new PowerBar(360, 22);
    this.windIndicator = new WindIndicator();
    this.aimController = new AimController(this.powerBar, this.terrain);
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
    this.worldContainer.addChild(this.aimController);
    this.worldContainer.addChild(this.mobilesContainer);
    this.worldContainer.addChild(this.projectilesContainer);

    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.uiContainer);

    // Position UI HUD elements in screen coordinates
    this.uiContainer.addChild(this.powerBar);
    this.uiContainer.addChild(this.windIndicator);
    this.powerBar.x = 220;
    this.powerBar.y = 560;

    this.windIndicator.x = 60;
    this.windIndicator.y = 550;

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

    // Keep HUD at bottom
    this.powerBar.x = Math.max(20, (w - 360) / 2);
    this.powerBar.y = h - 40;
    this.windIndicator.x = 60;
    this.windIndicator.y = h - 45;
  }

  public addMobile(config: {
    id: string;
    nickname: string;
    team: string;
    mobileType: number;
    maxHp: number;
    hp: number;
    x: number;
    y: number;
  }): Mobile {
    const mobile = new Mobile({
      ...config,
      name: `Mobile-${config.mobileType}`,
    });
    this.mobiles.set(config.id, mobile);
    this.mobilesContainer.addChild(mobile);
    return mobile;
  }

  public fireProjectile(points: { x: number; y: number }[], onImpact?: () => void) {
    if (this.activeProjectile) {
      this.projectilesContainer.removeChild(this.activeProjectile);
    }

    const proj = new Projectile(points, () => {
      if (onImpact) onImpact();
      this.projectilesContainer.removeChild(proj);
      this.activeProjectile = undefined;
    });

    this.activeProjectile = proj;
    this.projectilesContainer.addChild(proj);
  }

  public update(dt: number) {
    this.camera.update(dt);
    this.aimController.update(dt);
    if (this.activeProjectile) {
      this.activeProjectile.update(dt);
    }
  }
}
