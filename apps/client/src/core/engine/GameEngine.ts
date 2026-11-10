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

  // Dynamic Impact Screenshake Engine (100% Canvas & Viewport Safe, 60/120 FPS WebGL)
  private shakeTimer: number = 0;       // ms elapsed in current shake
  private shakeDuration: number = 0;    // total ms for current shake
  private shakeAmpX: number = 0;        // current horizontal amplitude (px)
  private shakeAmpY: number = 0;        // current vertical amplitude (px)
  private shakeAngle: number = 0;       // current rotational amplitude (rad)
  private shakeFreq: number = 26;       // oscillation frequency
  public shakeOffsetX: number = 0;
  public shakeOffsetY: number = 0;
  public shakeRotation: number = 0;

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

  /**
   * Authentic GunBound & Pro Game Engine Impact Screenshake:
   * Dynamic calculations based on Shot Type (Tiro 1, Tiro 2, SS), direct mobile hits vs terrain,
   * Dual volley stacking, and impact damage.
   * Completely eliminates CSS DOM canvas translation, guaranteeing 0 black/empty border gaps.
   * Amplitudes are defined in true screen-space pixels for punchy, visceral feedback at any zoom.
   */
  public triggerImpactShake(options: {
    shotType?: number; // 0 = T1, 1 = T2, 2 = SS
    hitMobileDirectly?: boolean;
    isDual?: boolean;
    damage?: number;
    customTrauma?: number;
  }) {
    const isSS = options.shotType === 2;
    const isShot2 = options.shotType === 1;
    const isDirect = !!options.hitMobileDirectly;
    const isDual = !!options.isDual;

    let targetAmpX = 8.0;
    let targetAmpY = 14.0;
    let targetAngle = 0.008;
    let targetDuration = 320;
    let targetFreq = 16;

    if (options.customTrauma !== undefined) {
      const scale = options.customTrauma;
      targetAmpX = 22 * scale;
      targetAmpY = 32 * scale;
      targetAngle = 0.025 * scale;
      targetDuration = 260 + 440 * scale;
      targetFreq = 15;
    } else if (isSS) {
      // SS: Massive tectonic earthquake rumble
      targetAmpX = isDirect ? 28.0 : 22.0;
      targetAmpY = isDirect ? 42.0 : 34.0;
      targetAngle = isDirect ? 0.032 : 0.024; // ~1.8° to 1.4°
      targetDuration = isDirect ? 800 : 680;
      targetFreq = isDirect ? 12 : 13;
    } else if (isShot2) {
      // Tiro 2: Heavy concussive blast with firm vertical shudder
      targetAmpX = isDirect ? 18.0 : 12.0;
      targetAmpY = isDirect ? 28.0 : 20.0;
      targetAngle = isDirect ? 0.018 : 0.012; // ~1.0°
      targetDuration = isDirect ? 500 : 400;
      targetFreq = 14;
    } else {
      // Tiro 1: Crisp, snappy, punchy kick (distinctly felt on every hit!)
      targetAmpX = isDirect ? 12.0 : 8.0;
      targetAmpY = isDirect ? 20.0 : 14.0;
      targetAngle = isDirect ? 0.012 : 0.008; // ~0.7°
      targetDuration = isDirect ? 380 : 320;
      targetFreq = isDirect ? 15 : 16;
    }

    // Dual bonus: +35% boost on amplitude & extended duration
    if (isDual) {
      targetAmpX *= 1.35;
      targetAmpY *= 1.35;
      targetDuration = Math.min(850, targetDuration * 1.30);
    }

    // Damage bonus for high-impact detonations (>300 damage)
    if (options.damage && options.damage > 300) {
      const dmgBonus = Math.min(1.40, 1.0 + (options.damage - 300) / 600);
      targetAmpX *= dmgBonus;
      targetAmpY *= dmgBonus;
    }

    // Multi-hit stacking (Dual volleys, multi-missiles):
    // If already shaking, stack remaining amplitude + 40% of target so volleys kick seamlessly!
    const remainingRatio = this.shakeDuration > 0 ? Math.max(0, 1 - this.shakeTimer / this.shakeDuration) : 0;
    const currentRemainingY = this.shakeAmpY * remainingRatio;

    this.shakeAmpX = Math.min(42, Math.max(this.shakeAmpX * remainingRatio, targetAmpX) + (currentRemainingY > 2 ? targetAmpX * 0.40 : 0));
    this.shakeAmpY = Math.min(54, Math.max(currentRemainingY, targetAmpY) + (currentRemainingY > 2 ? targetAmpY * 0.40 : 0));
    this.shakeAngle = Math.min(0.045, Math.max(this.shakeAngle * remainingRatio, targetAngle) + (currentRemainingY > 2 ? targetAngle * 0.35 : 0));
    this.shakeDuration = Math.max(this.shakeDuration - this.shakeTimer, targetDuration);
    this.shakeFreq = targetFreq;
    this.shakeTimer = 0; // Trigger instant kick at t = 0
  }

  public shakeScreen(intensity: number = 8, _durationMs: number = 380, isDirectHit: boolean = false, isSS: boolean = false) {
    this.triggerImpactShake({
      shotType: isSS ? 2 : isDirectHit ? 1 : 0,
      hitMobileDirectly: isDirectHit,
      customTrauma: isSS ? 1.0 : Math.min(1.0, intensity / 18),
    });
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

    // 2. Dynamic Impact Screenshake Update (Damped Harmonic Oscillator with Instant Attack)
    if (this.shakeTimer < this.shakeDuration && this.shakeDuration > 0) {
      this.shakeTimer += dt * 16.666; // convert to ms
      const progress = Math.min(1.0, this.shakeTimer / this.shakeDuration);

      // Smooth damping envelope: strong initial impulse, decays cleanly without vanishing instantly
      const envelope = (1.0 - progress) * Math.exp(-1.6 * progress);

      // Harmonic oscillation in the 12-16 Hz sweet spot (3 to 5 frames per half-cycle at 60 FPS)
      const timeSec = this.shakeTimer / 1000;
      const omega = this.shakeFreq * Math.PI * 2;

      // Authentic GunBound: primary impact kick is vertical (upward ground impulse), followed by alternating bounce
      const waveY = Math.cos(omega * timeSec);
      // Horizontal jitter has a slight phase lead
      const waveX = Math.sin(omega * 1.15 * timeSec + 0.40);
      // Rotational roll gives physical weight
      const waveRot = Math.sin(omega * 0.85 * timeSec);

      this.shakeOffsetX = waveX * this.shakeAmpX * envelope;
      this.shakeOffsetY = -waveY * this.shakeAmpY * envelope;
      this.shakeRotation = waveRot * this.shakeAngle * envelope;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotation = 0;
      this.shakeDuration = 0;
    }

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // View positioning centered around camera position with true screen-space trauma offset
    this.worldContainer.pivot.set(this.cameraX, this.cameraY);
    this.worldContainer.position.set(screenW / 2 + this.shakeOffsetX, screenH / 2 + this.shakeOffsetY);
    this.worldContainer.scale.set(this.cameraZoom);
    this.worldContainer.rotation = this.shakeRotation;

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

        // Smooth Proportional Parallax factoring camera + subtle shake influence
        const dx = this.cameraX - worldCenterX;
        const dy = this.cameraY - worldCenterY;
        const targetBgX = -slackX * 0.50 - dx * 0.20 + this.shakeOffsetX * 0.20;
        const targetBgY = -slackY * 0.70 - dy * 0.16 + this.shakeOffsetY * 0.20;

        // STRICT INVIOLABLE SCREEN BOUNDS CLAMP:
        // Guaranteed: bgX <= 0 and bgX + bgW >= screenW
        // Guaranteed: bgY <= 0 and bgY + bgH >= screenH
        // Under ALL conditions (high bullets, manual panning, shake, resizing), zero background borders are EVER exposed!
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
