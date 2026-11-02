import React from "react";
import ReactDOM from "react-dom/client";
import { GameEngine } from "./core/engine/GameEngine.js";
import { CombatArena } from "./core/combat/CombatArena.js";
import { App } from "./ui/App.js";

async function bootstrap() {
  // 1. Initialize PixiJS 2D Game Engine and Combat Arena
  const canvasContainer = document.getElementById("game-canvas-container");
  if (canvasContainer) {
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
