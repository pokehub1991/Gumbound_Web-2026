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
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;

  // SS Battlefield Darkening
  private ssOverlay: Graphics;
  private ssTargetAlpha: number = 0;

  // Camera & Zoom (Authentic GunBound battlefield framing at 1.2x, centered on bridge)
  public cameraX: number = 704.5;
  public cameraY: number = 495;
  public targetCameraX: number = 704.5;
  public targetCameraY: number = 495;
  public cameraZoom: number = 0.52;
  public targetZoom: number = 1.2;
  public isIntroZooming: boolean = true;

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
    this.panTo(704.5, 495, true);

    // Frame Ticker
    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // Right-Click Drag to Pan Camera across battlefield (Authentic GunBound glove hand)
    window.addEventListener("contextmenu", (e) => e.preventDefault());

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

  public playIntroZoom(startZoom: number = 0.52, finalZoom: number = 1.20) {
    this.cameraZoom = startZoom;
    this.targetZoom = finalZoom;
    this.isIntroZooming = true;
  }

  public setPresetZoom(zoom: number) {
    this.isIntroZooming = false;
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
      // Smooth cinematic zoom from wide panoramic view to default battlefield framing
      const introZoomSpeed = Math.min(1.0, 0.026 * dt);
      this.cameraZoom += (this.targetZoom - this.cameraZoom) * introZoomSpeed;
      if (Math.abs(this.targetZoom - this.cameraZoom) < 0.012) {
        this.cameraZoom = this.targetZoom;
        this.isIntroZooming = false;
      }
    } else {
      this.cameraZoom += (this.targetZoom - this.cameraZoom) * lerpSpeed;
    }

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

    // Dynamic Panoramic Parallax Engine (Widescreen 16:9 Adapted)
    // 100% Edge-Proof: Mathematically guarantees zero visible borders/margins on any monitor resolution
    if (this.parallaxContainer.children.length > 0) {
      const bg = this.parallaxContainer.children[0] as Sprite;
      if (bg.texture && bg.texture.width > 0) {
        const texW = bg.texture.width;
        const texH = bg.texture.height;
        const texAspect = texW / texH;

        // Ensure background is at least 45% wider and 55% taller than viewport
        // to guarantee ample travel room for high sky shots, deep bottom panning, and widescreen
        const minW = Math.max(screenW * 1.45, 2752);
        const minH = Math.max(screenH * 1.55, 1536);

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
        const worldCenterY = 495; // Metamine bridge surface

        // Smooth Proportional Parallax
        // 1. Horizontal: Far-distance parallax factor (0.28). Centered at worldCenterX
        const dx = this.cameraX - worldCenterX;
        const targetBgX = -slackX * 0.5 - dx * 0.28;

        // 2. Vertical: High-sky & abyss tracking factor (0.22).
        // At battlefield center view (cameraY = 495), background rests at ~70% vertical travel,
        // showcasing the Clock Tower in the upper half and the courtyard in the lower half.
        const dy = this.cameraY - worldCenterY;
        const targetBgY = -slackY * 0.70 - dy * 0.22;

        // STRICT INVIOLABLE SCREEN BOUNDS CLAMP:
        // Guaranteed: bgX <= 0 and bgX + bgW >= screenW
        // Guaranteed: bgY <= 0 and bgY + bgH >= screenH
        // Under ALL conditions (high bullets, manual panning, resizing), zero background borders are EVER exposed!
        let bgX = Math.max(-slackX, Math.min(0, targetBgX));
        let bgY = Math.max(-slackY, Math.min(0, targetBgY));

        // Subtle shake transfer during explosions/screenshake
        if (this.shakeTimer > 0) {
          bgX += (Math.random() - 0.5) * this.shakeIntensity * 0.20;
          bgY += (Math.random() - 0.5) * this.shakeIntensity * 0.20;
          // Re-clamp so shake never reveals borders
          bgX = Math.max(-slackX, Math.min(0, bgX));
          bgY = Math.max(-slackY, Math.min(0, bgY));
        }

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
