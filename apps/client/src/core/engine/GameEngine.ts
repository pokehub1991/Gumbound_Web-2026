import { Application, Container, Graphics, Sprite } from "pixi.js";

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
  private cssShakeTimeout: ReturnType<typeof setTimeout> | null = null;

  // SS Battlefield Darkening
  private ssOverlay: Graphics;
  private ssTargetAlpha: number = 0;

  // Camera & Zoom (Authentic GunBound battlefield framing at 1.2x, centered on bridge)
  public cameraX: number = 704.5;
  public cameraY: number = 510;
  public targetCameraX: number = 704.5;
  public targetCameraY: number = 510;
  public cameraZoom: number = 0.52;
  public targetZoom: number = 1.2;
  public isIntroZooming: boolean = true;
  private introZoomProgress: number = 0;
  private introZoomDuration: number = 1800; // Smooth 1.8s cinematic glide
  private introZoomStart: number = 0.52;

  // Mouse pan controls (Right-click Glove Hand)
  public isDraggingCamera: boolean = false;
  public userHasManualCamera: boolean = false;
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

  public get screenW(): number {
    return this.app.screen.width;
  }

  public get screenH(): number {
    return this.app.screen.height;
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

    // Initial camera placement framed nicely across the battlefield at 1.2x
    this.panTo(704.5, 420, true);

    // Frame Ticker
    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // Right-Click Drag to Pan Camera across battlefield (Authentic GunBound glove hand)
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    // Completely lock manual mouse wheel scrolling and zooming
    window.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );

    // Prevent manual keyboard browser/page zoom shortcuts (Ctrl +/- / 0)
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.ctrlKey && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener("pointerdown", (e) => {
      if (e.button === 2) {
        this.isDraggingCamera = true;
        this.userHasManualCamera = true;
        // Synchronize target camera to current camera to prevent any sudden teleport/jump
        this.targetCameraX = this.cameraX;
        this.targetCameraY = this.cameraY;
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
        // Clearing manual camera state allows the camera to seamlessly resume tracking active projectiles
        this.userHasManualCamera = false;
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
    this.userHasManualCamera = true;
    // Smooth panoramic panning limits across the extended battlefield
    const minCamX = 150;
    const maxCamX = Math.max(minCamX + 10, this.worldWidth - 150);
    // Allow panning up into the sky (-400) and down to the terrain base (860)
    const minCamY = -400;
    const maxCamY = 860;

    // Direct delta from current camera position avoids any disparity with flying bullet targets
    this.cameraX = Math.max(minCamX, Math.min(maxCamX, this.cameraX + dx));
    this.cameraY = Math.max(minCamY, Math.min(maxCamY, this.cameraY + dy));
    this.targetCameraX = this.cameraX;
    this.targetCameraY = this.cameraY;
  }

  public playIntroZoom(startZoom: number = 0.50, finalZoom: number = 1.20, durationMs: number = 4200) {
    this.introZoomStart = startZoom;
    this.cameraZoom = startZoom;
    this.targetZoom = finalZoom;
    this.introZoomDuration = Math.max(100, durationMs);
    this.introZoomProgress = 0;
    this.isIntroZooming = true;
  }

  public setPresetZoom(zoom: number) {
    this.isIntroZooming = false;
    this.setZoom(zoom);
  }

  public setZoom(zoom: number) {
    this.targetZoom = Math.max(0.45, Math.min(1.60, zoom));
  }

  public shakeScreen(_intensity: number = 8, _durationMs: number = 380, isDirectHit: boolean = false, isSS: boolean = false) {
    // Authentic DragonBound / GunBound Screen Shake via CSS Keyframes on DOM Canvas
    if (typeof document !== "undefined") {
      const el = document.getElementById("game-canvas-container") || (this.app?.canvas as HTMLElement | undefined);
      if (el) {
        el.classList.remove("shake_anim", "shake_anim_hit", "shake_anim_ss");
        void el.offsetWidth; // Force synchronous reflow to ensure instant replay
        const animClass = isSS ? "shake_anim_ss" : isDirectHit ? "shake_anim_hit" : "shake_anim";
        el.classList.add(animClass);

        if (this.cssShakeTimeout) clearTimeout(this.cssShakeTimeout);
        const timeoutMs = isSS ? 750 : isDirectHit ? 540 : 340;
        this.cssShakeTimeout = setTimeout(() => {
          el.classList.remove("shake_anim", "shake_anim_hit", "shake_anim_ss");
          this.cssShakeTimeout = null;
        }, timeoutMs);
      }
    }
  }

  public setSSOverlay(active: boolean) {
    this.ssTargetAlpha = active ? 0.75 : 0;
  }

  public isPointOnScreen(worldX: number, worldY: number, margin: number = 40): boolean {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const sx = screenW / 2 + (worldX - this.cameraX) * this.cameraZoom;
    const sy = screenH / 2 + (worldY - this.cameraY) * this.cameraZoom;
    return sx >= -margin && sx <= screenW + margin && sy >= -margin && sy <= screenH + margin;
  }

  public update(dt: number) {
    // 1. Smooth Camera Tracking with Viewport Bounds Clamping
    const lerpSpeed = Math.min(1.0, 0.12 * dt);
    this.cameraX += (this.targetCameraX - this.cameraX) * lerpSpeed;
    this.cameraY += (this.targetCameraY - this.cameraY) * lerpSpeed;

    if (this.isIntroZooming) {
      // Smooth cinematic ease-out: starts with motion, smoothly decelerates to exactly 0 velocity at target zoom
      this.introZoomProgress += dt * 16.666;
      const t = Math.min(1.0, this.introZoomProgress / this.introZoomDuration);
      const ease = 1 - Math.pow(1 - t, 3);
      this.cameraZoom = this.introZoomStart + (this.targetZoom - this.introZoomStart) * ease;

      if (t >= 1.0) {
        this.cameraZoom = this.targetZoom;
        this.isIntroZooming = false;
      }
    } else {
      this.cameraZoom += (this.targetZoom - this.cameraZoom) * lerpSpeed;
      if (Math.abs(this.targetZoom - this.cameraZoom) < 0.0005) {
        this.cameraZoom = this.targetZoom;
      }
    }

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // View positioning centered around camera position (GunBound / DragonBound free panning)
    const viewX = screenW / 2 - this.cameraX * this.cameraZoom;
    const viewY = screenH / 2 - this.cameraY * this.cameraZoom;

    this.worldContainer.position.set(viewX, viewY);
    this.worldContainer.scale.set(this.cameraZoom);

    // Dynamic Panoramic Parallax Engine (Widescreen 16:9 Adapted)
    // 100% Edge-Proof: Mathematically guarantees zero visible borders/margins on any monitor resolution
    if (this.parallaxContainer.children.length > 0) {
      const bg = this.parallaxContainer.children[0] as Sprite;
      if (bg.texture && bg.texture.width > 0) {
        const texW = bg.texture.width;
        const texH = bg.texture.height;
        const texAspect = texW / texH;

        // Pulled back / zoomed out scale so more background elements (mountain silhouettes,
        // steampunk towers, factories, and vast sky) are visible at once across the widescreen monitor.
        const minW = Math.max(screenW * 1.30, 2150);
        const minH = Math.max(screenH * 1.40, 1320);

        let bgW = minW;
        let bgH = bgW / texAspect;
        if (bgH < minH) {
          bgH = minH;
          bgW = bgH * texAspect;
        }

        bg.width = bgW;
        bg.height = bgH;

        // Total available parallax travel slack
        const slackX = bgW - screenW;
        const slackY = bgH - screenH;

        // World anchor references
        const worldCenterX = this.worldWidth / 2; // 704.5
        const worldCenterY = 420; // Metamine bridge surface (raised by 90px)

        // Smooth Proportional Parallax
        // 1. Horizontal: Far-distance parallax factor (0.20). Centered at worldCenterX
        const dx = this.cameraX - worldCenterX;
        const targetBgX = -slackX * 0.50 - dx * 0.20;

        // 2. Vertical: High-sky & abyss tracking factor (0.16).
        // Anchored with generous upper-sky and lower-abyss clearance, keeping landmarks
        // framed cleanly across the horizon above the bridge.
        const dy = this.cameraY - worldCenterY;
        const targetBgY = -slackY * 0.70 - dy * 0.16;

        // STRICT INVIOLABLE SCREEN BOUNDS CLAMP:
        // Guaranteed: bgX <= 0 and bgX + bgW >= screenW
        // Guaranteed: bgY <= 0 and bgY + bgH >= screenH
        // Under ALL conditions (high bullets, manual panning, resizing), zero background borders are EVER exposed!
        const bgX = Math.max(-slackX, Math.min(0, targetBgX));
        const bgY = Math.max(-slackY, Math.min(0, targetBgY));

        bg.position.set(bgX, bgY);
      }
    }

    // 2. Smooth Battlefield Darkness during SS
    this.ssOverlay.alpha += (this.ssTargetAlpha - this.ssOverlay.alpha) * Math.min(1.0, 0.14 * dt);
  }

  public destroy() {
    this.app.destroy(true, { children: true, texture: false });
  }
}
