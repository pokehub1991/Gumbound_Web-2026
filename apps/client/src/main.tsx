import React from "react";
import ReactDOM from "react-dom/client";
import "./ui/theme.css";
import { GameEngine } from "./core/engine/GameEngine.js";
import { CombatArena } from "./core/combat/CombatArena.js";
import { App } from "./ui/App.js";

// Prevent browser zooming via keyboard shortcuts (Ctrl + Plus, Ctrl + Minus, Ctrl + 0)
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (
      e.key === "+" ||
      e.key === "-" ||
      e.key === "=" ||
      e.key === "_" ||
      e.key === "0" ||
      e.code === "NumpadAdd" ||
      e.code === "NumpadSubtract" ||
      e.code === "Digit0" ||
      e.code === "Equal" ||
      e.code === "Minus"
    ) {
      e.preventDefault();
    }
  }
});

// Prevent browser zoom via mouse wheel + Ctrl
window.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  },
  { passive: false }
);

// Prevent multi-touch gesture zooming on touchpads and touchscreens
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());

// Enhanced Anti-Zoom Engine (Adapted and upgraded from DragonBound reference):
// Counteracts any browser zoom initiated from the Chrome 3-dot menu (+/- zoom levels like 33%, 50%, 150%)
let lastAppliedZoom = 1.0;

function applyAntiBrowserZoom() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const innerW = window.innerWidth;
  const outerW = window.outerWidth;
  const innerH = window.innerHeight;
  if (!innerW || !outerW || !innerH) return;

  const appEl = document.getElementById("app");
  if (!appEl) return;

  // In Chromium browsers (Chrome, Edge, Opera), outerWidth / innerWidth measures the exact browser menu zoom factor
  const rawRatio = outerW / innerW;

  // If within normal 100% boundary (within 3% tolerance)
  if (Math.abs(rawRatio - 1.0) <= 0.03) {
    if (lastAppliedZoom !== 1.0) {
      lastAppliedZoom = 1.0;
      appEl.style.position = "fixed";
      appEl.style.left = "0";
      appEl.style.top = "0";
      appEl.style.width = "100vw";
      appEl.style.height = "100vh";
      appEl.style.transform = "none";
      const engine = (window as unknown as { __engine?: GameEngine }).__engine;
      if (engine) engine.handleResize();
    }
    return;
  }

  // If browser menu zoom is active (e.g. 33%, 50%, 150%, 200%)
  if (rawRatio > 0.15 && rawRatio < 6.0) {
    const inv = 1 / rawRatio;
    if (Math.abs(lastAppliedZoom - rawRatio) > 0.02) {
      lastAppliedZoom = rawRatio;
      const nominalW = Math.round(innerW * rawRatio);
      const nominalH = Math.round(innerH * rawRatio);
      appEl.style.position = "fixed";
      appEl.style.left = "0";
      appEl.style.top = "0";
      appEl.style.width = `${nominalW}px`;
      appEl.style.height = `${nominalH}px`;
      appEl.style.transformOrigin = "top left";
      appEl.style.transform = `scale(${inv})`;

      const engine = (window as unknown as { __engine?: GameEngine }).__engine;
      if (engine) {
        engine.handleResize();
      }
    }
  }
}

window.addEventListener("resize", applyAntiBrowserZoom);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", applyAntiBrowserZoom);
}
setInterval(applyAntiBrowserZoom, 400);
applyAntiBrowserZoom();

async function bootstrap() {
  // 1. Initialize PixiJS 2D Game Engine and Combat Arena
  const canvasContainer = document.getElementById("game-canvas-container");
  if (canvasContainer) {
    // Clean up any pre-existing engine instance (prevents duplicate canvases/tickers on HMR)
    const existing = window as unknown as { __arena?: CombatArena; __engine?: GameEngine };
    if (existing.__engine) {
      try {
        existing.__engine.destroy();
      } catch (e) {
        console.warn("[bootstrap] Cleaned up previous engine instance:", e);
      }
      existing.__engine = undefined;
      existing.__arena = undefined;
    }
    canvasContainer.innerHTML = "";

    const engine = new GameEngine();
    await engine.init(canvasContainer);
    const arena = new CombatArena(engine);
    (window as unknown as { __arena: CombatArena; __engine: GameEngine }).__arena = arena;
    (window as unknown as { __arena: CombatArena; __engine: GameEngine }).__engine = engine;
  }

  // 2. Initialize React UI Overlay
  const uiContainer = document.getElementById("ui-overlay");
  if (uiContainer) {
    const root = ReactDOM.createRoot(uiContainer);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }

  console.log("Gumbound Web 2026 Engine & UI initialized successfully!");
}

bootstrap().catch(console.error);

const hotMeta = (import.meta as unknown as { hot?: { dispose: (cb: () => void) => void } }).hot;
if (hotMeta) {
  hotMeta.dispose(() => {
    const existing = window as unknown as { __arena?: CombatArena; __engine?: GameEngine };
    if (existing.__engine) {
      try {
        existing.__engine.destroy();
      } catch (e) {}
      existing.__engine = undefined;
      existing.__arena = undefined;
    }
    const canvasContainer = document.getElementById("game-canvas-container");
    if (canvasContainer) {
      canvasContainer.innerHTML = "";
    }
  });
}
