import assert from "node:assert/strict";
import { TerrainMask } from "../src/core/terrain/TerrainMask.ts";
import { MOBILES_DATA } from "../src/core/constants/mobiles.ts";

/**
 * Character test for the bunge / terrain-destruction pipeline (plan task 6).
 *
 * Validates the collision-mask half of the crater (the visual half lives in
 * TerrainRenderer.carveCrater and needs a DOM canvas; covered by eye in the
 * validation criteria). What we can prove here:
 *   1. carveHole excavates an area that scales with rx*ry.
 *   2. After excavation the crater center is air, and the first solid pixel
 *      below it sits at or beyond cy + ry (so the crater is not floating).
 *   3. Every mobile has a positive palaBunge for all three shots, so the
 *      unified table lookup never returns 0 / NaN.
 */

const W = 400;
const H = 400;

function makeFlatMask(): TerrainMask {
  const mask = new TerrainMask(W, H);
  // Fill everything below y=300 as solid terrain
  for (let y = 300; y < H; y++) {
    for (let x = 0; x < W; x++) {
      mask.maskData[(y * W + x) * 4 + 3] = 255;
    }
  }
  return mask;
}

// --- 1. Excavated area scales with rx*ry ------------------------------------
{
  // Fully solid mask so the whole ellipse fits inside the map.
  const make = () => {
    const m = new TerrainMask(W, H);
    for (let i = 3; i < m.maskData.length; i += 4) m.maskData[i] = 255;
    return m;
  };
  const countCarved = (m: TerrainMask) => {
    let n = 0;
    for (let i = 3; i < m.maskData.length; i += 4) if (m.maskData[i] === 0) n++;
    return n;
  };

  const small = make();
  small.carveHole(200, 200, 20, 17);
  const smallArea = countCarved(small);

  const big = make();
  big.carveHole(200, 200, 40, 34);
  const bigArea = countCarved(big);

  const ratio = bigArea / smallArea;
  // Double radius → 4x ellipse area. Allow boundary rounding slack.
  assert.ok(
    ratio > 3.2 && ratio < 4.8,
    `area ratio for 2x radius should be ~4, got ${ratio.toFixed(2)}`
  );
}

// --- 2. Crater is not floating: surface projection reaches its floor ---------
{
  const mask = makeFlatMask();
  const surfaceBefore = mask.findSurfaceY(200, 0);
  assert.equal(surfaceBefore, 299, "flat terrain surface should be y=299");

  const rx = 30;
  const ry = Math.round(rx * 0.85);
  // Center on the surface — the P0-A invariant.
  mask.carveHole(200, surfaceBefore, rx, ry);

  // After carving, the center pixel itself is air...
  assert.equal(mask.isPixelSolid(200, surfaceBefore), false, "crater center must be air");
  // ...and the first solid pixel below the center is at least ry deeper.
  const surfaceAfter = mask.findSurfaceY(200, 0);
  assert.ok(
    surfaceAfter >= surfaceBefore + ry - 2,
    `crater too shallow: surface moved ${surfaceAfter - surfaceBefore}px, expected ~${ry}px`
  );
}

// --- 3. Every mobile exposes a usable palaBunge table ------------------------
{
  for (const [id, m] of Object.entries(MOBILES_DATA)) {
    for (const shot of ["shot1", "shot2", "ss"] as const) {
      const r = m.palaBunge[shot];
      assert.ok(
        Number.isFinite(r) && r > 0,
        `mobile ${id} (${m.name}) has invalid palaBunge.${shot}: ${r}`
      );
    }
  }
}

// --- 4. Canonical per-shot bunge values (P1 parity lock) ---------------------
// Client table (mobiles.ts palaBunge) is the decomp source of truth. The server
// (mobile.go Shot1/Shot2/SSBlastRadius) must match exactly — these numbers are
// locked on all three shots so any future edit fails loudly on either side.
const expectedShot1: Record<string, number> = {
  Armor: 43,
  Ice: 45,
  Aduka: 36,
  Lightning: 35,
  Bigfoot: 30,
  "J.D": 39,
  "A.Sate": 40,
  Random: 38,
  Knight: 42,
  Fox: 38,
  Dragon: 45,
  Nak: 38,
  Trico: 30,
  Mage: 39,
  Turtle: 64,
  Boomer: 30,
  Grub: 36,
  "Raon Launcher": 25,
  Frog: 35,
  Kalsiddon: 32,
  Maya: 45,
  Phoenix: 40,
};

const expectedShot2: Record<string, number> = {
  Armor: 45,
  Ice: 42,
  Aduka: 27,
  Lightning: 38,
  Bigfoot: 29,
  "J.D": 33,
  "A.Sate": 45,
  Random: 38,
  Knight: 44,
  Fox: 40,
  Dragon: 50,
  Nak: 40,
  Trico: 25,
  Mage: 36,
  Turtle: 45,
  Boomer: 25,
  Grub: 32,
  "Raon Launcher": 10,
  Frog: 38,
  Kalsiddon: 30,
  Maya: 45,
  Phoenix: 42,
};

const expectedSS: Record<string, number> = {
  Armor: 50,
  Ice: 53,
  Aduka: 40,
  Lightning: 45,
  Bigfoot: 28,
  "J.D": 38,
  "A.Sate": 50,
  Random: 45,
  Knight: 48,
  Fox: 45,
  Dragon: 60,
  Nak: 48,
  Trico: 45,
  Mage: 48,
  Turtle: 65,
  Boomer: 42,
  Grub: 45,
  "Raon Launcher": 45,
  Frog: 55,
  Kalsiddon: 45,
  Maya: 60,
  Phoenix: 52,
};
{
  const byName = new Map(Object.values(MOBILES_DATA).map((m) => [m.name, m]));
  // Every mobile in the table is covered by the parity check above.
  for (const m of Object.values(MOBILES_DATA)) {
    assert.ok(
      m.name in expectedShot2,
      `mobile ${m.name} added to MOBILES_DATA but not to expectedShot2 parity check`
    );
  }
  // Parameterize so a future shot1/ss edit fails as loudly as shot2.
  const tables = [
    { key: "shot1" as const, expected: expectedShot1 },
    { key: "shot2" as const, expected: expectedShot2 },
    { key: "ss" as const, expected: expectedSS },
  ];
  for (const { key, expected } of tables) {
    for (const [name, want] of Object.entries(expected)) {
      const m = byName.get(name);
      assert.ok(m, `mobile ${name} missing from client table`);
      assert.equal(
        m!.palaBunge[key],
        want,
        `${name} ${key} bunge drifted from canonical value`
      );
    }
    for (const m of Object.values(MOBILES_DATA)) {
      assert.ok(
        m.name in expected,
        `mobile ${m.name} added to MOBILES_DATA but not to ${key} parity check`
      );
    }
  }
}

// --- 5. Armor double blast must deepen the crater ----------------------------
// DetonateShot2_Bullet2 runs two detonation passes on the same column. The
// second pass must re-project to the current surface (the floor left by the
// first blast) — otherwise it only clears pixels that are already air and the
// hole ends up single-depth.
{
  const mask = makeFlatMask();
  const surface = mask.findSurfaceY(200, 0); // 299
  const rx = 30;
  const ry = Math.round(rx * 0.85); // 26 (0.85 canonical)

  // First blast, centered on the surface (P0-A invariant).
  mask.carveHole(200, surface, rx, ry);
  const afterFirst = mask.findSurfaceY(200, 0);
  assert.ok(
    afterFirst >= surface + ry - 2,
    `first blast should deepen by ~${ry}, moved ${afterFirst - surface}`
  );

  // Second blast: original (buggy) behavior — carve again at the same Y.
  const shallow = makeFlatMask();
  const s0 = shallow.findSurfaceY(200, 0);
  shallow.carveHole(200, s0, rx, ry);
  shallow.carveHole(200, s0, rx, ry); // same Y, no re-projection
  const shallowSurface = shallow.findSurfaceY(200, 0);

  // Correct behavior — re-project to current surface before second carve.
  mask.carveHole(200, mask.findSurfaceY(200, 0), rx, ry);
  const afterSecond = mask.findSurfaceY(200, 0);

  assert.ok(
    afterSecond > afterFirst + ry - 2,
    `second blast with re-projection should deepen by another ~${ry}, only moved ${afterSecond - afterFirst}`
  );
  assert.ok(
    afterSecond > shallowSurface + 5,
    `re-projected second blast (${afterSecond}) should be meaningfully deeper than same-Y second blast (${shallowSurface})`
  );
}

// --- 6. Vertical wall: crater must bite SIDEWAYS at the contact Y ------------
// Regression lock for the user report "hace hueco verticalmente pero
// horizontalmente no". A shell into a cliff face at mid-height must center the
// ellipse on the trajectory CONTACT point (last air pixel before solid), not on
// the column top. Column-top projection (findSurfaceY + Math.min) lifts the
// center to the crest and the horizontal half of the ellipse carves open air.
{
  const mask = new TerrainMask(W, H);
  // Plateau at y>=150 for x>=250 (cliff face on the left wall x=250),
  // plus a floor at y>=350 across the map.
  for (let y = 150; y < H; y++) {
    for (let x = 250; x < W; x++) mask.maskData[(y * W + x) * 4 + 3] = 255;
  }
  for (let y = 350; y < H; y++) {
    for (let x = 0; x < 250; x++) mask.maskData[(y * W + x) * 4 + 3] = 255;
  }

  const contactX = 250; // solid face pixel the shell touched, mid-face
  const contactY = 280;
  assert.ok(mask.isPixelSolid(contactX, contactY), "face pixel must be solid");

  // Old (buggy) column-top lift: findSurfaceY scans column 250 upward past the
  // plateau edge → 149, Math.min(280, 149) = 149.
  const liftedY = Math.min(contactY, mask.findSurfaceY(contactX, contactY));
  assert.equal(liftedY, 149, "old behavior lifts the center to the crest");

  // Fixed behavior: center on the contact point (last air pixel = contact-1).
  const cx = contactX - 1;
  const cy = contactY;
  const rx = 30;
  const ry = Math.round(rx * 0.85);
  mask.carveHole(cx, cy, rx, ry);

  // Horizontal bite: count carved cells at cy on the wall side (x >= contactX).
  let horizontalCarved = 0;
  for (let x = contactX; x <= cx + rx; x++) {
    if (!mask.isPixelSolid(x, cy)) horizontalCarved++;
  }
  assert.ok(
    horizontalCarved > rx / 2,
    `crater must excavate solid wall pixels horizontally at the contact Y, only ${horizontalCarved}`
  );

  // Contrast: the lifted (crest-centered) carve reaches nothing at contact Y.
  const liftedMask = new TerrainMask(W, H);
  for (let y = 150; y < H; y++) {
    for (let x = 250; x < W; x++) liftedMask.maskData[(y * W + x) * 4 + 3] = 255;
  }
  for (let y = 350; y < H; y++) {
    for (let x = 0; x < 250; x++) liftedMask.maskData[(y * W + x) * 4 + 3] = 255;
  }
  liftedMask.carveHole(contactX, liftedY, rx, ry);
  let liftedBite = 0;
  for (let x = contactX; x <= contactX + rx; x++) {
    if (!liftedMask.isPixelSolid(x, cy)) liftedBite++;
  }
  assert.equal(liftedBite, 0, "crest-centered crater does not bite the wall at contact height");
}

console.log("bunge terrain-destruction character test: OK");
