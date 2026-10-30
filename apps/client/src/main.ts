import { Application } from "pixi.js";
import { Opcode } from "@gumbound/shared";

console.log("Gumbound Web 2026 initializing... Initial opcode test:", Opcode.AUTH_REQUEST);

async function init() {
  const container = document.getElementById("game-canvas-container");
  if (!container) return;

  const app = new Application();
  await app.init({
    width: 800,
    height: 600,
    backgroundColor: 0x1a2b3c,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });

  container.appendChild(app.canvas);
  console.log("PixiJS Application ready!");
}

init().catch(console.error);
