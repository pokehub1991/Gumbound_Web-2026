import assert from "node:assert/strict";
import { botHitThreshold } from "../src/core/combat/botAccuracy.ts";

const difficulties = [0.5, 0.61, 0.64, 0.68, 0.7, 0.9];
const distances = [0, 300, 800, 1200, 2400];
const winds = [0, 5, 13, 26, 99];

for (const d of difficulties) {
  for (const dist of distances) {
    for (const wind of winds) {
      const p = botHitThreshold(d, dist, wind);
      assert.ok(p >= 0.5 && p <= 0.75, `threshold ${p} outside [0.50, 0.75]`);
    }
  }
}

// Sample 100k rolls at worst case and assert observed rate stays in band.
for (const d of [0.5, 0.64, 0.9]) {
  const p = botHitThreshold(d, 1200, 26);
  let hits = 0;
  for (let i = 0; i < 100_000; i++) if (Math.random() < p) hits++;
  const observed = hits / 100_000;
  assert.ok(observed >= 0.485 && observed <= 0.765, `observed ${observed} outside band for p=${p}`);
}

console.log("bot accuracy band 50-75%: OK");
