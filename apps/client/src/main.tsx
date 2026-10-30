import React from "react";
import ReactDOM from "react-dom/client";
import { Game } from "./game/Game.js";
import { App } from "./ui/App.js";

async function bootstrap() {
  // 1. Initialize PixiJS 2D Engine
  const canvasContainer = document.getElementById("game-canvas-container");
  if (canvasContainer) {
    const game = new Game();
    await game.init(canvasContainer);
    (window as unknown as { __game: Game }).__game = game;
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
