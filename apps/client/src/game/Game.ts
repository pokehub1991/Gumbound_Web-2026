import { Application, Container, Graphics } from "pixi.js";
import { Background } from "./Background.js";
import { TerrainRenderer } from "./TerrainRenderer.js";
import { TerrainDebrisManager } from "./TerrainDebrisManager.js";
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
  public debrisManager: TerrainDebrisManager;
  public camera: Camera;
  public mobilesContainer: Container;
  public projectilesContainer: Container;

  public powerBar: PowerBar;
  public windIndicator: WindIndicator;
  public aimController: AimController;

  public mobiles: Map<string, Mobile> = new Map();
  public activeProjectiles: Projectile[] = [];

  public get activeProjectile(): Projectile | undefined {
    return this.activeProjectiles[0];
  }

  public get hasActiveProjectiles(): boolean {
    return this.activeProjectiles.length > 0;
  }

  private ssOverlay: Graphics;
  private ssTargetAlpha: number = 0;
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.uiContainer = new Container();
    this.mobilesContainer = new Container();
    this.projectilesContainer = new Container();
    this.ssOverlay = new Graphics();
    this.background = new Background(2400, 800);
    this.terrain = new TerrainRenderer(2400, 800);
    this.debrisManager = new TerrainDebrisManager();
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
    this.worldContainer.addChild(this.debrisManager);

    // Dramatic SS darkening filter: covers world while SS projectile & aura fly on top
    this.ssOverlay.rect(-1000, -1000, 5000, 4000).fill({ color: 0x030712, alpha: 0.70 });
    this.ssOverlay.alpha = 0;
    this.worldContainer.addChild(this.ssOverlay);

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

  public fireProjectile(
    points: { x: number; y: number }[],
    mobileType: number = 0,
    shotType: number = 0,
    onImpact?: () => void,
    onFinished?: () => void
  ): Projectile {
    const proj = new Projectile(
      points,
      mobileType,
      shotType,
      () => {
        if (onImpact) onImpact();
      },
      () => {
        const idx = this.activeProjectiles.indexOf(proj);
        if (idx !== -1) {
          this.activeProjectiles.splice(idx, 1);
        }
        this.projectilesContainer.removeChild(proj);
        if (onFinished) onFinished();
      }
    );

    this.activeProjectiles.push(proj);
    this.projectilesContainer.addChild(proj);
    return proj;
  }

  public setSSMode(active: boolean) {
    this.ssTargetAlpha = active ? 0.70 : 0;
  }

  public shakeScreen(intensity: number = 7, durationMs: number = 400) {
    this.shakeIntensity = intensity;
    this.shakeDuration = Math.max(1, durationMs);
    this.shakeTimer = durationMs;
  }

  public update(dt: number) {
    // Update active projectiles and camera tracking
    if (this.activeProjectiles.length > 0) {
      // Follow active flying projectile in the salvo, or last exploding
      const activeFlyer = this.activeProjectiles.find((p) => !p.isExplodingState) || this.activeProjectiles[0];
      const pos = activeFlyer.currentPosition;
      this.camera.panTo(pos.x, pos.y);

      for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
        const p = this.activeProjectiles[i];
        p.update(dt);
      }
    } else {
      const activeMob = this.aimController.activeMobile;
      if (activeMob) {
        this.camera.panTo(activeMob.x, activeMob.y - 30);
      }
    }

    this.debrisManager.update(dt);
    this.camera.update(dt);
    this.aimController.update(dt);

    // Smooth transition for battlefield darkening
    this.ssOverlay.alpha += (this.ssTargetAlpha - this.ssOverlay.alpha) * Math.min(1.0, 0.12 * dt);

    // Screen rumble / earthquake effect on detonations
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 16.66;
      const factor = Math.max(0, this.shakeTimer / this.shakeDuration);
      const ox = (Math.random() - 0.5) * 2 * this.shakeIntensity * factor;
      const oy = (Math.random() - 0.5) * 2 * this.shakeIntensity * factor;
      this.worldContainer.x += ox;
      this.worldContainer.y += oy;
    }
  }
}
