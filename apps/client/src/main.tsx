import React from "react";
import ReactDOM from "react-dom/client";
import "./ui/theme.css";
import { GameEngine } from "./core/engine/GameEngine.js";
import { CombatArena } from "./core/combat/CombatArena.js";
import { App } from "./ui/App.js";

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
