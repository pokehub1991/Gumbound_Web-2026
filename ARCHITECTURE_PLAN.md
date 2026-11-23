# ARCHITECTURE_PLAN.md — Modern 16-Bit Browser Artillery Engine

Brand working title: **BOOMBOUND** (original IP — GunBound-inspired, no copyrighted assets/names beyond the explicitly permitted original chassis sprites, default avatars, and DragonBound SFX).

Companion to `AUDIT_REPORT.md`. This plan assumes the audit findings (analytic ballistics, per-mobile `by` gravity, alpha-bitmap terrain, delay queue, avatar-offset detachment root cause).

---

## 1. Monorepo Layout (pnpm workspaces + TypeScript)

```
boombound/
  package.json                 # workspaces: ["packages/*","apps/*"]
  pnpm-workspace.yaml
  tsconfig.base.json
  packages/
    shared/                    # 100% deterministic, zero DOM/Node deps
      src/
        physics/               # integrator, wind, true-angle clamp, slope walk
        terrain/               # bitmask, crater carve, dirty-rect diffing
        combat/                # damage, armor/shield, delay, bunge, rewards
        registry/              # MobileRegistry, ItemRegistry, WeatherRegistry
        net/                   # binary schemas (shared client<->server)
        rng/                   # seeded PRNG (determinism + parity tests)
        types/                 # MobileDefinition, ShotPattern, etc.
    apps/
      client/                  # PixiJS v8 + React 19 + Zustand (Vite)
      server/                  # Colyseus + Prisma (tsx/tsup)
  tools/
    qa/                        # Vitest suites + Playwright specs
    vfx/                       # pixelfx-ported shader/particle snippets
```
**Determinism rule:** `packages/shared` imports nothing from Pixi, React, Node, or Colyseus. It is pure TS. Both the server (authority) and client (prediction/interp) run the *same* physics functions on the *same* seed → 0-drift parity is testable in Vitest without a browser.

---

## 2. Core Engine (Phase 1)

### 2.1 Fixed-Timestep Deterministic Integrator
Replaces DragonBound's analytic solve (rationale: `AUDIT_REPORT §10.1`).
- **Physics tick = 120Hz** (`STEP = 1/120`). Accumulator loop decoupled from `requestAnimationFrame`; render interpolates between last two physics states. 60/120/144Hz displays all get smooth pacing.
- Semi-implicit Euler per sub-step:
  ```
  vx += ax*STEP;  vy += ay*STEP
  x  += vx*STEP;  y  += vy*STEP
  ```
- **Trajectory parity:** a calibration test integrates a full max-power arc and asserts landing position within **<1px** of DragonBound's `getPosAtTime(485)` closed form across 20 angles × wind 0..20. The per-mobile `ay`/`by`/`power*234/100` constants are transcribed verbatim, so matching is achievable by tuning `STEP` sub-sampling.
- **Mid-flight forces:** Tornado / Sun-Force / Mirror apply as per-step accel modifiers inside the loop — impossible in the closed form, trivial here.
- Zero-allocation: projectile state is a pooled struct (`x,y,vx,vy,ax,ay,time`), no object churn per step.

### 2.2 Terrain: Alpha Bitmask + Dirty-Rect GPU Uploads
- Load `terreno_metamine.png` (2816×1504) → CPU `Uint8Array` alpha mask (1 byte/px, 4.2MB) + GPU texture.
- `isSolid(x,y)` reads the mask (port of `map.js IsPixel`).
- `carveCrater(cx,cy,rx,ry)` ports `AddGroundHole`: elliptical `k<1` → alpha 0, `1≤k<1.2` → RGB×0.5 scorch rim (preserves the authentic crater shadow, kills the alpha halo).
- **Dirty-rect tracking:** each carve records its bounding rect; per frame, `texture.update()` is called **only on dirty sub-regions** (never the full 2816×1504). Many small craters coalesce into one rect/frame.
- Terrain slope (`getAngle`, `getUnder`, `walkPos`) ported 1:1 from `map.js` — 10px climb limit, `stuck`, `fall_and_fie`.

### 2.3 Rendering (PixiJS v8, WebGL2→WebGPU fallback)
- `scaleMode: 'nearest'` globally; `roundPixels` on for pixel-snap.
- Layers (back→front): parallax-far, parallax-mid, terrain, mobiles+avatars, projectiles+VFX, weather, HUD-canvas.
- **Multi-layer parallax:** `fondo_metamine.jpg` split into ≥2 bands (see audit §8 — JPEG has no alpha). Far band factor ~0.2, mid ~0.5, driven by camera x/y and zoom.
- Custom GLSL/WGSL: pixel-quantize post pass (keeps procedural glow crisp/16-bit), palette-quantize for VFX.

### 2.4 Cinematic Camera
- Turn start: ease zoom-in to active mobile.
- Projectile flight: track leader; auto zoom-out when arc apex/spread exceeds frame.
- Impact: brief hitstop on SS/direct, directional shake ∝ damage.
- Manual: mouse-drag / edge-scroll, clamped to map bounds.
- All camera state lives outside `window` (anti-scrape).

### 2.5 Controls (WASD + dual-input power bar)
- `A`/`D` move (respect climb limit + per-turn fuel/delay). `W`/`S` angle within `minang/maxang` base clamp; true-angle `aim[]` band highlighted.
- `Space` hold-release charge+fire (Slice & Drag). Mouse hold on power bar = same. Prev-shot power + angle markers.
- All inputs → **intent packets only** (anti-cheat §6).

---

## 3. Skeletal Avatar System + Zero-Floating-Head (Phase 2)

**Root cause** (audit §6): DragonBound applies flat `player_x/player_y` offsets with no rotation inheritance → head detaches on slopes.

**Fix — bone-anchored mount:**
- `@esotericsoftware/spine-pixi-v8` runtime. Each `MobileDefinition` declares:
  ```
  cockpitMount: { bone:'cockpit', x:17, y:-28, inheritRotation:true,
                  zMask:'cockpit_front', zBack:'cockpit_back' }
  ```
- Avatar skeleton root is a **child of the chassis `cockpit` bone**. Slope tilt (`getAngle`), suspension bounce, recoil, flinch all propagate through the single hierarchy → the head physically cannot detach.
- Standardized sockets: `head_socket`, `body_socket`, `eyes_socket`, `flag_socket`. AI-generated PNG parts drop onto fixed pivots — no frame-by-frame work → Avatar Shop ready.
- **Avatar ON/OFF** toggle hooks + stat caps from audit (attack ≤ +50, delay ×7/×11/×12.5, bunge `/5`).
- Chassis sprites: original (permitted). Avatars: original defaults for baseline, Spine rig for the modern system.

---

## 4. 15 Mobiles — Data-Driven Registry (Phase 2)

`MobileRegistry` keyed by the audited enum (Armor 0 … Raon 19). Each entry transcribes the audit tables verbatim:
```
{ id, name, file, playerMount, graphics, minang, maxang, ax, ay, bx, by,
  aim:[[low,span]x3], bullets[], explodes[], damage:{s1,s2,ss}, bunge,
  delay:{s1,s2,ss,dualS1,dualPlus},
  shots:{ s1:ShotPattern, s2:ShotPattern, ss:ShotPattern } }
```
`ShotPattern` = declarative `{ count, angOffsets[], powOffsets[], staggerMs[], transformAt?, behavior? }` — covers Bigfoot spread (audit §5.5), SS mid-flight transform (§5.6), Aduka Thor homing (§1 Thor), Lightning downward bolt (§5.8), JD `movex` pull (§1), Nak inversion, Trico orbital, Turtle split, Raon mines, Grub rollers.
**Adding mobile 16+ = new config + asset bundle. Zero engine change.**

### ProceduralVFXEngine (PixiJS v8, pixelfx-inspired)
- **No static sprites** for curved/energy/elemental mobiles (Mage, Turtle, Lightning, Aduka, Grub, Dragon, A.Sate, Ice, JD). Original sprites only for chassis + linear shots (Armor missile).
- Ribbons (velocity-aligned pixel trails), swirling energy arcs (Mage), bubble clusters (Turtle), jagged procedural bolts (Lightning/Aduka), ember plumes (Dragon), frost shards (Ice), magnetic pulse rings (JD).
- Impact juice: layered pixel explosions, gravity-bounced debris chunks, scorch rims, shake, hitstop, weather VFX (Tornado vortex, Sun column, Thor beam).
- Pixel-art coherence: quantize/pixel-snap passes so glow never blurs.
- **Object pooling** for particles/trails/debris/damage-numbers → zero GC spikes.

---

## 5. Combat Loop, Items, Weather, Bot (Phase 3)

- **Turn/Delay queue:** port audited delay table + `lowest-delay-next` ordering, wind/weather rotation cadence (`change_wind_angle`/`change_wind_power`).
- **Damage/shield/armor:** port §1 formulas incl. shield-first absorption, 60px linear falloff, 20px self-arm, team penalty, bunge-kill bonus track, rewards table (§4).
- **Sudden Death:** Double / SS / Bigbomb variants (franchise spec — DragonBound only had the generic timer), room-selectable.
- **Items:** 6-slot, cost+delay penalty, Dual/Dual+/Teleport/Wind Change/Power Up/Blood/Bunge Shot/Team Teleport.
- **Weather:** Tornado, Sun/Force, Lightning, Mirror, Wind Change, Thor, Guard/Weakness — positional anchors + physics coupling from audit §5.2.
- **Server-side Bot:** solves real 2D ballistics (wind, gravity, drag, terrain, weather, true-angle) via the shared engine; picks S1/S2/SS + tactical items. **Humanized 50–80% accuracy** by injecting seeded dispersion after solving; validated by 200+ shot simulation test.

---

## 6. Anti-Cheat & Browser Hardening (Day 1)

- **Server-authoritative:** clients send `MOVE_START/STOP, AIM_ANGLE, SELECT_SHOT, USE_ITEM, FIRE_SHOT` only. Server owns terrain mask, wind, timer, integration, craters, damage.
- **No global state leaks:** runtime in closure-scoped modules; production bundle minified/obfuscated. Sensitive HUD (wind needle/value, aiming readouts) rendered **inside the WebGL canvas**, not DOM text.
- **Binary protocol:** `@colyseus/schema` (no plain JSON).
- **AntiCheatService heuristics:** impossible precision across winds/distances, inhumanly consistent charge durations (macros), instant angle-snaps, out-of-turn/invalid packets → flag + log.
- **Browser:** global `contextmenu` prevent, `user-select:none`, no drag; server rate-limit; Zod schema validation; chat XSS sanitize; CSP headers; anti-DevTools hooks auto-disabled when `NODE_ENV=development`.

---

## 7. Prisma Schema (Avatar Shop + persistence, designed upfront)

```
Player        { id, username, passwordHash, gold, cash, gp, rank, createdAt }
AvatarCatalog { id, partSlot(HEAD|HAIR|BODY|EYES|FLAG), name, rarity, priceGold,
                priceCash, statAttack, statDefense, statHp, statDelay,
                statBunge, statPopularity, spriteRef, spineSlot }
Inventory     { id, playerId, avatarId, acquiredAt, expiresAt? }
Equipped      { playerId, slot, avatarId }        // one per slot
CurrencyLedger{ id, playerId, delta, currency, reason, matchId? }
MatchHistory  { id, roomName, mapId, mode, winnerTeam, players[], endedAt }
MatchPlayer   { matchId, playerId, mobile, kills, damage, goldEarned, gpDelta }
```
Caps enforced in `shared` (audit §5.9) and re-validated server-side.

---

## 8. Lobby & 16-Bit HUD (Phase 4)

- **Lobby:** Team A vs B (≤4v4), `+`/`−` bot slots, Master badge, Ready, mobile/item/map selectors, wind mode, Avatar ON/OFF, turn timer (20s), Sudden Death rules, chat, live avatar-in-mobile preview, Start Match.
- **HUD widgets** (vivid crisp pixel theme, sharp borders, pixel fonts, no subpixel blur): Turn Timer (+ overhead indicator), Turn Order delay queue + round, Chat (All/Team + pixel bubbles), Weather & Wind Compass (animated needle, upcoming strip), Items hotbar (cost/delay/lock), Shot Console (S1/S2/SS, angle dial + green true-angle zone, damage/gold log, dual-input Power Bar).
- React 19 + Zustand; pixel theme via CSS (image-rendering pixelated, integer font sizes).

---

## 9. QA Protocol (Phase 5) — mapped to `QA_TEST_REPORT.md`

**Vitest:** physics determinism/parity (<1px), wind/grav coupling, true-angle clamp, slope walk, crater carve, bunge death, **15-mobile × S1/S2/SS matrix** (no NaN, valid splits, correct delay/damage/shield), **bot 200+ shot accuracy ∈ [50%,80%]**, anti-cheat (out-of-turn, forged power/angle, rate-limit, XSS, context-menu block).

**Playwright:** boot server+client, full lobby→victory loops. Assert **zero** JS exceptions, React warnings, 404s, audio decode errors, shader warnings. Screenshots @1280×720 / 1920×1080 / ultrawide → inspect avatar mounting on steep L/R slopes + move/recoil/flinch, nearest-neighbor crispness, alpha-halo, parallax seams, VFX despawn, HUD overlap/clipping. Edge cases: cliffs/craters/map edges, both power-bar inputs, Slice & Drag, off-screen/tornado/multi-split camera, item usage, Sudden Death, disconnect/reconnect, match-end→lobby reset (no ghost timers). Perf: worst-case particle load (Dual SS / Bigfoot / Dragon + Tornado) sustained 60+ FPS, no heap leak across consecutive matches.

**Fix-and-retest loop** until clean → `QA_TEST_REPORT.md`.

---

## 10. Execution Order
- **Phase 1:** scaffold monorepo, integrator + parity calibration, terrain bitmask + dirty-rect, parallax, cinematic camera, WASD movement, dual-input power bar.
- **Phase 2:** Spine avatar mount (zero-detach), 15-mobile registry + ProceduralVFXEngine + DragonBound SFX.
- **Phase 3:** full combat loop, delay/damage/shield/sudden-death, items, weather, calibrated bot + accuracy proof.
- **Phase 4:** lobby, HUD widgets, anti-cheat + hardening.
- **Phase 5:** full QA, visual audit, perf stabilization, `QA_TEST_REPORT.md`.

**No code is written until you approve this plan and the audit.**