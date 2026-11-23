import assert from "node:assert/strict";
import {
  computeAccelerations,
  computeLaunchSpeed,
  positionAtTime,
} from "../src/physics.ts";

const cases = [
  { by: 398, bx: 0, wind: 0, angle: 0, expected: { ax: 0, ay: 398 } },
  { by: 398, bx: 0, wind: 12, angle: 0, expected: { ax: -48, ay: 398 } },
  { by: 380, bx: 0, wind: 20, angle: 90, expected: { ax: 0, ay: 304 } },
  { by: 244, bx: 0, wind: 15, angle: 180, expected: { ax: 37, ay: 244 } },
  { by: 398, bx: 50, wind: 10, angle: 90, expected: { ax: 0, ay: 359 } },
];

for (const c of cases) {
  const actual = computeAccelerations({ by: c.by, bx: c.bx }, c.wind, c.angle);
  assert.deepEqual(actual, c.expected, `acceleration mismatch for ${JSON.stringify(c)}`);
}

assert.equal(computeLaunchSpeed(100), 936);
assert.equal(computeLaunchSpeed(50), 468);
assert.equal(computeLaunchSpeed(0), 234);

const p = positionAtTime(100, 300, 400, -200, -10, 398, 485);
assert.deepEqual(p, { x: 495, y: 299 });

console.log("shared ballistics parity: OK");
