# AUDIT_REPORT.md — Phase 0 Reverse-Engineering Audit

Sources audited in `./referencias/`:
- **DragonBound** (`referencias/GameServer/`) — browser JS remake of GunBound. Authoritative game logic.
- **GunBound-Decomp-0.3.0** (`referencias/GunBound-Decomp-0.3.0/`) — decompiled PC client. Docs only (`ARCHITECTURE.md`, `PROTOCOL.md`, `CONSTANTS.md`, `FILEFORMATS.md`) + Ghidra scripts. No readable gameplay math (native/C++; not extracted).

> **Honesty note:** DragonBound is a *reimplementation*, not the original GunBound source. Its numbers are a faithful-but-approximate reconstruction. We treat them as the authoritative baseline because they are the only complete, runnable, per-mobile dataset available, and they reproduce the classic feel. Where classic GunBound behavior is known to differ (e.g. Sudden Death variants), we note it and source from the decomp docs / franchise knowledge instead.

---

## 1. Interconnected Ballistics & Physics Model

**DragonBound uses CLOSED-FORM (analytic) projectile motion, NOT per-tick integration.** This is the single most important architectural finding.

`shoot.js:300-320` — position is solved analytically at any time `t`:

```
a = time / 485                       // 485 ticks = 1 flight-second
x(t) = ceil(x0 + v.x*a + ax*a²/2)
y(t) = ceil(y0 + v.y*a + ay*a²/2)
```

- **Launch velocity** (`shoot.js:315-320`): `v.x = cos(ang)*power`, `v.y = -sin(ang)*power`. Angle in degrees, y-up flipped.
- **`ax`, `ay`** = constant acceleration (gravity + wind), computed once at fire time in `game.js:298-311`.
- **Flight clock**: `shoot.time` increments once per world `update()`; `getPosAtTime()` divides by 485. So the server runs a 485Hz logical sub-tick and samples position each update.

### Gravity + Wind coupling (`game.js:301-311`)
```js
power = parseInt(power * 234 / 100);            // 0..100 UI -> 0..234 engine
b0 = round(cos(wind_angle)*wind_power*mobile.by)/100   // wind X
b1 = round(sin(wind_angle)*wind_power*mobile.by - mobile.bx)/100
ax = 0 - b0                                     // horizontal accel = -windX
ay = mobile.by - b1                             // vertical accel = gravity - windY
if (wind_power === 0) { ax = 0; ay = mobile.by; }      // pure gravity
```
Key couplings:
- **Gravity is per-mobile** (`by` ≈ 329–412, not a global constant). Heavier-feeling mobiles have higher `by`.
- **Wind is scaled by the same per-mobile `by`**, so wind affects heavy mobiles *more* in absolute accel — this is the authentic "Boomer is wind-hooky" feel.
- **`bx` is a per-mobile wind-deadening term** subtracted from vertical wind. All 15 base mobiles have `bx = 0`; Boomer-family uses it for hook physics.
- **`power*234/100`** is the power→velocity curve. Max power = 234.

### Per-mobile physics constants (DragonBound `gametypes.js:515+`, all 15 roster mobiles)

| Mobile | `ax`(muzzle adj) | `ay` | `by`(grav) | min/max ang | true-angle `aim` (per shot) |
|---|---|---|---|---|---|
| Armor (Tank) | 73.5 | 0.74 | 398 | 10–55 | [[52,33],[52,33],[52,33]] |
| Ice (Gum) | 62.5 | 0.625 | 384 | 20–70 | [[58,50],[40,40],[40,40]] |
| Aduka | 65.5 | 0.695 | 392 | 110–170 | [[130,40],[130,40],[130,40]] |
| Lightning (Thunder) | 65 | 0.72 | 393 | 18–40 | [[58,44],…] |
| Bigfoot | – | – | – | – | – |
| JD | – | 0.87 | 395 | – | – |
| A.Sate | – | 0.61 | 398 | – | – |
| Boomer | – | 1.78 | 380 | – | – |
| Dragon | – | 0.867 | 360 | – | – |
| Nak | – | 0.78 | 360 | – | – |
| Trico | – | 1.395 | 244 | – | – |
| Mage | – | 0.72 | 398 | – | – |
| Turtle | – | 0.65 | 398 | – | – |
| Grub | – | 0.74 | 398 | – | – |
| Raon | – | 0.74 | 398 | – | – |

`minang/maxang` = **base aim clamp**. `aim[[low,span],…]` = **true-angle** extension per shot type (S1/S2/SS) — the real green zone shown in the classic UI. We reproduce both: base clamp for the dial, `aim` for the highlighted true-angle band.

### Slope/terrain geometry (`map.js`)
- `IsPixel(x,y)` = alpha channel > 0 → solid. Terrain is a **raw RGBA bitmap; alpha IS the collision mask**.
- `GetAngle(x,y)` = terrain slope via `GetUnder` sampled ±9px, `atan2` of the delta → drives mobile body tilt.
- `GetPosForWalking` = climb ≤10px up, fall to next solid pixel down, `stuck`/`fall_and_fie` flags. **This is the authoritative movement rule** (climb limit 10px, no-climb-block, fall-off-edge death).
- `GetUnder(x,y)` = first solid pixel below → spawn/stand height.

### Collision & cratering (`map.js:107-136`, `world.js:286-424`)
- `AddGroundHole(cx,cy,rx,ry)` carves an **elliptical** hole: `k = dx²/rx² + dy²/ry²`.
  - `k < 1.0` → alpha = 0 (removed).
  - `1.0 ≤ k < 1.2` → **RGB halved** (scorch rim), alpha kept. This is the authentic crater-shadow ring — critical for the "no alpha-halo" visual requirement.
- Crater radii are **per-bullet-sprite (`shoot.img`)**, hardcoded in `world.js`. Examples: img0 → 57×35, img1 → 37×27, img5 → 44×34, img6 → 74×55 (SS), img11 lightning → 42×30 (only if `is_lightning`).
- Out-of-bounds (`x>map.w || y>map.h`) → projectile completes, **no crater**.

### Damage model (`world.js:437-599`)
```
base = damageshot                              // per mobile+shot, see §2
if (fullcollide)                dm = base                    // direct box hit
if (distf <= 60)                dm = base - distf            // explosion falloff, linear, 60px radius
```
- **Shield absorbs first**: `shdm = shield - dm`. If `shdm==0` → shield broken. If `shdm<0` → shield=0 and `hp -= |shdm|`. Else `shield = shdm`.
- `hp <= 0` → `is_alive = 0`, kill credit.
- **Self/team penalty** (`penalty` flag): same-team hit → `team_damage_penalty` message + negative gold/GP, damage still applies.
- **`canCollide` arming** (`world.js:443-451`): a projectile cannot damage its **shooter** until it has traveled >20px from `x0,y0` (prevents point-blank self-hit). `p2 = 20²`, `p3 = dist²`.
- **`movex`**: JD's S2 (`BULLETS.JD2`) carries `movex` — the magnetic pull/push displacement applied to the victim.
- **Thor scaling** (Aduka): the Thor satellite shot re-aims each tick at the projectile (`world.js:235-244`), angle = `atan2` from current projectile pos to the Thor anchor, so the beam **home-tracks**.

---

## 2. Per-Mobile Base Damage & Bunge (`shoot.js:61-275`)

Avatar bonus: `total_attack = round(ava_attack / 2.5)`, **capped at +50**. `damageshot = base + total_attack`.
`pala_bunge` = base crater depth multiplier, modified by avatar `ava_scratch`: `bunge_jc = round(ava_scratch/5 + pala_bunge)`.

| Mobile | S1 base dmg | S2 base dmg | SS base dmg | bunge |
|---|---|---|---|---|
| Armor | 150 | 150 | 150 (+10 bunge) | 43 |
| Ice | 250 | – | – | 45 |
| Aduka | 190 | – | – | 36 |
| Lightning | 200 | – | – | default |
| Bigfoot | 50 | – | – | 30 |
| JD | 200 | – | – | 39 |
| A.Sate | 330 | – | – | default |
| Dragon | 400 | – | – | default |
| Nak | 330 | – | – | default |
| Trico | 100 | – | – | default |
| Mage | 100 | – | – | 39 |
| Turtle | 230 | – | – | 64 |
| Boomer | 150 | – | – | 30 |
| Grub | 220 | – | – | default |
| Raon | 70 | – | – | 25 |

(DragonBound's `type===0` branch lists every mobile's S1; S2/SS use the same table with different `type`. Full per-type values are in `shoot.js:117-275` — extracted to registry during Phase 2.)

---

## 3. Delay Economy & Turn-Order Queue (`game.js:355-700+`, `room.js`)

Delay decides turn order: **lowest accumulated delay fires next.**

```
added_delay = base(mobile, type) - avatar_delay_reduction
S1/S2 : uses one_ava_delay  (×7) or two_ava_delay (×12.5 / ×11 with Dual)
SS    : uses one_ava_delay  (×7)
```
Base S1/S2/SS delays (S1 / S2 / SS), Armor example: **760 / 940 / 1310**. Full table per mobile lives in `game.js:363-700`. The `two_ava_delay` branch is the **Dual / Dual+ item penalty** — using Dual adds the second-shot delay component.

**Avatar delay reduction formula:** `added_delay = base - round(ava_delay * factor)`. Factors: `one_ava_delay*7` (single shot), `two_ava_delay*25/2` (=×12.5, Dual S1), `two_ava_delay*11` (Dual+). These are the **Avatar ON delay stat caps** we must reproduce.

`change_wind_angle` / `change_wind_power` counters (`game.js:2908-2921`) drive **weather rotation cadence**: wind re-rolls every N turns.

---

## 4. Rewards / Gold / GP (`world.js:40-173`)

| Event | Gold | GP |
|---|---|---|
| Kill | 2300 | +2 |
| Good shot (shield-broken) | 50 | 0 |
| Excellent shot (penalty-free full hit) | 100 | 0 |
| Lose | 250 | −3 |
| Self/team damage penalty | −250 | −1 |
| Bunge bonus (kill by digging) | 2300 | +2 |
| Bunge penalty | −250 | −2 |

Event multipliers (×2 `evento200`, ×5 `evento500`) and BOSS-mode variants scale all of these. **Bunge kill = separate bonus track** — a dig-kill pays the same as a damage kill plus the bunge bonus.

---

## 5. Hidden & Essential Mechanics Discovered

1. **Sudden Death** — `game.js:2888-2904` (commented in DragonBound but present in decomp): triggers after a turn threshold (`this.sudden = 40`), chat-announces at −20/−10/−5/0 turns, then applies a global damage/HP modifier. Classic GunBound has **Double Death, SS Death, Bigbomb Death** variants (room-configurable). DragonBound only implements the generic timer. → We implement all 3 variants from franchise spec, room-selectable.
2. **Weather / Force strip** — `active_weathers`, `next_weather_pos`, `thor_x/thor_y/thor_angle` arrays (`game.js:31-37`). Weather slots are **positional anchors on the map** (fixed X/Y per map index), not abstract buffs. Thor is a **real positioned satellite entity** the Aduka beam tracks.
3. **High-Angle / Hook / Backshot** — Boomer `ay=1.78, by=380` (extreme arc) is the hook. High-angle bonuses are a **client-side callout**, not a server damage modifier in DragonBound. → Implement as presentation-layer detection (angle > threshold at fire) for authentic feel, no stat change.
4. **Bunge (dig) kill** — dying by falling out of the destroyed ground (`GetPosForWalking` → `fall_and_fie`) is a distinct death paying the **bunge bonus** track.
5. **Multi-shot spread** — Bigfoot fires 4 projectiles with `ang ±2/+4/+6`, `power ±10/+20`, staggered 100ms (`game.js:1142-1159`). This staggered-spread pattern is the template for all multi-projectile mobiles.
6. **Shot-type transformation mid-flight** — SS shots swap bullet/explosion sprite at `time 1540` (`world.js:749-768`): Armor→img3, Turtle→img49, Boomer→img51/exp40. This is the **split/transform trigger**.
7. **Teleport** — `shoot.img === 10` → on ground collide, moves the shooter to impact point (`world.js:275-284`), no crater.
8. **Lightning** — `is_lightning` flag gates both the vertical bolt (fired at `ang 270`, huge `power 10000`, from `y-1000`) and whether it carves. The bolt is a **downward raycast**, not a ballistic arc.
9. **Avatar stat caps** — attack capped +50, delay reduction via ×7/×11/×12.5, bunge via `ava_scratch/5`. These are the **Avatar ON/OFF balance rails**.
10. **`no_bonus_user` / `event_game_room`** — ranked-purity and penalty-suppression flags that gate GP payouts.

---

## 6. Avatar → Mobile Mounting Audit

DragonBound mounts avatars via **per-mobile hardcoded offsets**:
```
player_x, player_y   // e.g. Armor: 17, -28 ; Ice: -5, -40 ; Aduka: -7, -24
graphics: [[w, h, ox, oy]]   // e.g. Armor: [49,43,24,39]
```
**Root cause of the classic "floating head":** these are flat 2D offsets applied after the chassis is drawn, with **no rotation inheritance** — when the mobile tilts on a slope (`GetAngle`), the chassis rotates but the avatar offset does not, so the head detaches on any incline.

**Fix for our engine:** replace flat offsets with a `cockpitMount` anchor **bone inside the Spine skeleton**, parented to the chassis root, so it inherits slope tilt, suspension, recoil and flinch as one rigid hierarchy (full spec in `ARCHITECTURE_PLAN.md` §3).

---

## 7. Audio Catalog (`referencias/GameServer/web/public_html/data/audio/`)

**237 files**, 4 formats each (`.ogg` 72, `.flac` 61, `.wav` 61, `.mp3` 43). Naming: `<mobileId><shotType><event>`:
- `<n>move` — movement
- `<n>s1fire` / `<n>s1blast` — S1 fire / impact
- `<n>blast` — generic impact
- `<n>1fire`/`<n>2fire` variants

Mobile IDs map to the `MOBILE` enum (Armor=0 … RAON=19). Load `.ogg` (smallest, widest browser support) via Howler.js with `html5: false` for Web Audio panning. We use **original DragonBound SFX** (explicitly permitted).

---

## 8. Metamine Materials (`./materiales/`)

| File | Format | Dimensions | Notes |
|---|---|---|---|
| `terreno_metamine.png` | PNG (RGBA) | **2816 × 1504** | Destructible terrain. **Alpha channel = collision mask** (matches `map.js IsPixel`). |
| `fondo_metamine.jpg` | JPEG | ~373 KB | Background/parallax layer. **JPEG = no alpha → cannot be a single transparency layer; must be split into ≥2 solid parallax bands** (far sky + mid). |

Map is **2816×1504** — larger than a single viewport, confirming the parallax + clamped-camera requirement.

---

## 9. Toolchain / Skills Audit (action required → reported)

Verified live on 2026-11-20:

| Tool | Status | Stars | Requirement for us |
|---|---|---|---|
| `gamedev-skills/awesome-gamedev-agent-skills` | OK | 9.6k | Optional reference skills (Godot/Unity/Phaser/three.js routers). **None required — we are PixiJS, not covered by its engine routers.** |
| `vercel-labs/skills` (`npx skills`) | OK | 40k | Skill-discovery CLI. Optional. |
| `aldegad/sprite-gen` | OK | 4.2k | 2D sprite/animation-atlas generator skill (Codex/Claude). Useful for AI avatar-part atlases later. |
| `patch-gg/pixelfx` | OK | 8.3k | 244 pixel-art effects, each "a small piece of code" + a skill to author your own. **Best fit for our procedural VFX** — we adapt patterns into PixiJS v8 shaders/particles. |

**Local runtime check:** `node v24.19.0` ✓, `pnpm 12.21.0` ✓, `python 3.10.0` ✓.

### Required configuration / dependencies to proceed — REPORT
**None are blocking.** No API keys, no CUDA, no extra env vars are required for Phase 0–3.
- `sprite-gen` and `pixelfx` are **skills (prompt/macro packs) and code-pattern libraries**, not services — they run locally, no keys.
- Optional, only needed for the **future AI-avatar-part pipeline** (Phase 2 polish / Avatar Shop): an image-generation API key (ChatGPT / Nano Banana). **Not needed to build or test the engine**, because the prompt permits using **original chassis sprites + original default avatars** and **procedural VFX** for everything else.
- `pixelfx` effects are standalone code snippets we port to PixiJS v8 — no runtime dependency.

**Decision:** we do NOT add `sprite-gen`/`pixelfx` as runtime deps. We reference `pixelfx` patterns when authoring `ProceduralVFXEngine` (Phase 2). No environment changes required from you to start Phase 1.

---

## 10. Deviations From The Original We Will Make (and why)
1. **Analytic → fixed-step integrator.** DragonBound's closed-form solve is exact but cannot be paused, rewound, or interpolated for the cinematic camera, and cannot host mid-flight weather forces (Tornado). We switch to a **deterministic fixed-timestep (120Hz) semi-implicit Euler integrator** tuned to reproduce DragonBound's trajectory to <1px over a full arc, validated by a parity test (see QA plan). Same feel, camera- and weather-compatible.
2. **Authoritative server owns the bitmap.** DragonBound mutates the PNG in-place on the server and ships the whole diff. We keep the same alpha-mask model but sync via **dirty-rect sub-uploads**.
3. **Per-mobile hardcoded logic → data registry.** DragonBound's `game.js` is a 2,960-line `if (mobile===X && type===Y)` cascade. We extract every branch into a `MobileDefinition` registry + declarative `ShotPattern` (spread/stagger/transform), so adding mobile 16+ is data-only. **Zero behavior change** — the registry is populated by transcribing the audited branches above.