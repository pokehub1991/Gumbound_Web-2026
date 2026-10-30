import { Game } from "./game/Game.js";

async function bootstrap() {
  const container = document.getElementById("game-canvas-container");
  if (!container) return;

  const game = new Game();
  await game.init(container);

  // Expose for debugging/inspection in dev
  (window as unknown as { __game: Game }).__game = game;
  console.log("Gumbound Web 2026 Game Engine initialized successfully!");
}

bootstrap().catch(console.error);
