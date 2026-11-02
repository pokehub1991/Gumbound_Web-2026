import { Application, Container, Graphics, ColorMatrixFilter } from "pixi.js";

export class GameEngine {
  public app: Application;
  public worldContainer: Container;
  public uiContainer: Container;
  public mobilesContainer: Container;
  public projectilesContainer: Container;
  public effectsContainer: Container;

  // Background and World dimensions (Metamine 1409x1210: 450 sky + 760 bridge)
  public readonly worldWidth: number = 1409;
  public readonly worldHeight: number = 1210;

  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;

  // SS Battlefield Darkening
  private ssOverlay: Graphics;
  private ssTargetAlpha: number = 0;

  // Camera & Zoom (Default 1.2x POV as requested)
  public cameraX: number = 700;
  public cameraY: number = 520;
  public targetCameraX: number = 700;
  public targetCameraY: number = 520;
  public cameraZoom: number = 1.20;
  public targetZoom: number = 1.20;

  // Mouse pan controls
  private isDraggingCamera: boolean = false;
  private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };

  public parallaxContainer: Container;

  constructor() {
    this.app = new Application();
    this.parallaxContainer = new Container();
    this.worldContainer = new Container();
    this.uiContainer = new Container();
    this.mobilesContainer = new Container();
    this.projectilesContainer = new Container();
    this.effectsContainer = new Container();
    this.ssOverlay = new Graphics();
  }

  public async init(containerElement: HTMLElement) {
    const parentWidth = containerElement.clientWidth || 800;
    const parentHeight = containerElement.clientHeight || 600;

    await this.app.init({
      width: parentWidth,
      height: parentHeight,
      backgroundColor: 0xdca04c, // Metamine desert golden sky
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      roundPixels: false,
    });

    containerElement.appendChild(this.app.canvas);

    // Build stage hierarchy: Parallax Background -> World Battlefield -> UI
    this.ssOverlay.rect(-2000, -2000, 8000, 6000).fill({ color: 0x050811, alpha: 0.72 });
    this.ssOverlay.alpha = 0;

    this.worldContainer.addChild(this.mobilesContainer);
    this.worldContainer.addChild(this.ssOverlay);
    this.worldContainer.addChild(this.effectsContainer);
    this.worldContainer.addChild(this.projectilesContainer);

    this.app.stage.addChild(this.parallaxContainer);
    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.uiContainer);

    // Apply retro contrast & saturation boost on mobile sprites
    this.setSpriteContrast(true);

    // Initial camera placement framed nicely across the battlefield
    this.panTo(700, 520, true);

    // Frame Ticker
    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // Right-Click Drag to Pan Camera across battlefield (Authentic GunBound glove hand)
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("pointerdown", (e) => {
      if (e.button === 2) {
        this.isDraggingCamera = true;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        document.body.classList.add("is-grabbing");
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (this.isDraggingCamera) {
        const dx = e.clientX - this.dragStartPos.x;
        const dy = e.clientY - this.dragStartPos.y;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.panBy(-dx / this.cameraZoom, -dy / this.cameraZoom);
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (e.button === 2) {
        this.isDraggingCamera = false;
        document.body.classList.remove("is-grabbing");
      }
    });

    // Handle Window Resizing
    window.addEventListener("resize", () => this.handleResize());
    this.handleResize();
  }

  public handleResize() {
    const parent = this.app.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 800;
    const h = parent.clientHeight || 600;
    this.app.renderer.resize(w, h);
  }

  public panTo(worldX: number, worldY: number, instant: boolean = false) {
    this.targetCameraX = worldX;
    this.targetCameraY = worldY;
    if (instant) {
      this.cameraX = worldX;
      this.cameraY = worldY;
    }
  }

  public panBy(dx: number, dy: number) {
    this.targetCameraX = Math.max(100, Math.min(this.worldWidth - 100, this.targetCameraX + dx));
    this.targetCameraY = Math.max(100, Math.min(this.worldHeight - 100, this.targetCameraY + dy));
    this.cameraX = this.targetCameraX;
    this.cameraY = this.targetCameraY;
  }

  public setPresetZoom(zoom: number) {
    this.setZoom(zoom);
  }

  public setZoom(zoom: number) {
    this.targetZoom = Math.max(0.45, Math.min(1.60, zoom));
  }

  public shakeScreen(intensity: number = 8, durationMs: number = 380) {
    this.shakeIntensity = intensity;
    this.shakeDuration = Math.max(1, durationMs);
    this.shakeTimer = durationMs;
  }

  public setSSOverlay(active: boolean) {
    this.ssTargetAlpha = active ? 0.75 : 0;
  }

  public update(dt: number) {
    // 1. Smooth Camera Tracking with Viewport Bounds Clamping
    const lerpSpeed = Math.min(1.0, 0.12 * dt);
    this.cameraX += (this.targetCameraX - this.cameraX) * lerpSpeed;
    this.cameraY += (this.targetCameraY - this.cameraY) * lerpSpeed;
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * lerpSpeed;

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // View positioning centered around camera position (GunBound / DragonBound free panning)
    const rawViewX = screenW / 2 - this.cameraX * this.cameraZoom;
    const rawViewY = screenH / 2 - this.cameraY * this.cameraZoom;

    let viewX = rawViewX;
    let viewY = rawViewY;

    // Screen Shake Offset
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 16.66;
      const decay = Math.max(0, this.shakeTimer / this.shakeDuration);
      const ox = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
      const oy = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
      viewX += ox;
      viewY += oy;
    }

    this.worldContainer.position.set(viewX, viewY);
    this.worldContainer.scale.set(this.cameraZoom);

    // Parallax background bounded so edges are never revealed during panoramic drag
    const parallaxFactor = 0.18;
    const maxShiftX = 220;
    const maxShiftY = 140;
    const px = Math.max(-maxShiftX, Math.min(maxShiftX, viewX * parallaxFactor));
    const py = Math.max(-maxShiftY, Math.min(maxShiftY, viewY * parallaxFactor));
    this.parallaxContainer.position.set(px, py);
    this.parallaxContainer.scale.set(this.cameraZoom);

    // 2. Smooth Battlefield Darkness during SS
    this.ssOverlay.alpha += (this.ssTargetAlpha - this.ssOverlay.alpha) * Math.min(1.0, 0.14 * dt);
  }

  public isContrastBoosted: boolean = true;

  public setSpriteContrast(enabled: boolean) {
    this.isContrastBoosted = enabled;
    if (enabled) {
      const filter = new ColorMatrixFilter();
      filter.contrast(0.24, true); // +24% contrast boost for sharp retro outlines
      filter.saturate(0.20, true); // +20% saturation boost for vibrant pixel art colors
      this.mobilesContainer.filters = [filter];
    } else {
      this.mobilesContainer.filters = [];
    }
  }

  public destroy() {
    this.app.destroy(true, { children: true, texture: false });
  }
}
