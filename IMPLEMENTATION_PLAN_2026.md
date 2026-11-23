# IMPLEMENTATION_PLAN_2026.md — Combat Parity, Hardening & Future Foundations

> **New plan** produced by comparing `AUDIT_REPORT.md` (DragonBound / GunBound-Decomp audit), `ARCHITECTURE_PLAN.md` (unused BOOMBOUND design), and the actual repository (`apps/client` PixiJS v8 + `apps/server` Go).
> **Factual baseline:** `COMBAT_AUDIT_FINDINGS.md`.
> **Scope decisions:**
> - Character/mobile sprites stay on the current hybrid technique. No Spine2D migration.
> - Avatar **stats/economy foundations** are included. Avatar **visual rig replacement** is not.
> - Multiplayer foundations are included now; full scalable matchmaking is deferred.

---

## 0. Executive summary

The current project is architecturally stronger than the unused BOOMBOUND plan in one key way: it already has an authoritative Go server (not Colyseus+Prisma). Combat modeling, however, is incomplete and client/server trajectories diverge. DragonBound has a coherent closed-form model; this repo implements roughly 40% of it.

P0 gaps:
1. Client/server ballistics disagree (`+cos` vs `-cos` wind; 8ms Euler vs 16ms analytic; different muzzle).
2. Server does not validate angle or shot type.
3. `PlayerMove` accepts arbitrary client `Y` → free teleport.
4. Items, shields, avatar attack bonus, team penalty, Sudden Death missing.
5. WS upgrade accepts anonymous sockets.

The user later confirmed two future goals: **online multiplayer** and an **avatar shop**. Both are viable to prepare now. Adding foundations does not block the engine/combat phase: build contracts that combat already needs (account id, loadout, stat caps, currency ledger, match/session identity), but do not build matchmaking UI, payments, or new avatar rendering in this cycle.

Bot accuracy has been changed to a guaranteed **50-75%** realized band (see `apps/client/src/core/combat/BotDummy.ts`, `botAccuracy.ts`, and `botAccuracy.test.mts`).

---

## 1. Existing plan vs actual project

### 1.1 Already present
| Old plan idea | Actual state |
|---|---|
| pnpm workspaces + TS | ✅ `pnpm-workspace.yaml`, `apps/*`, `packages/shared` |
| Pure `packages/shared` | ⚠️ Exists but only enums; no physics |
| PixiJS v8 + React 19 + Zustand + Vite | ✅ |
| Authoritative server | ✅ Go, not Colyseus — better fit |
| Alpha-mask terrain | ✅ `TerrainMask.ts`, `physics/terrain.go` |
| Elliptical crater + scorch rim | ✅ partial |
| Binary `[len][op][payload]` envelope | ✅ but JSON payload inside frame |
| Multi-layer parallax | ✅ |
| Cinematic camera | ✅ |
| Dual-input power bar | ✅ |

### 1.2 Missing from old plan but worth adding
| Old plan idea | Actual state | Decision |
|---|---|---|
| Deterministic fixed-step physics | ❌ Client Euler, server analytic; diverging | ✅ Critical, Phase 1 |
| Trajectory parity test <1px | ❌ None | ✅ Critical |
| Data-driven mobile registry | ⚠️ `mobiles.ts` data only; behavior in `BallisticsEngine.ts:544-1212` | ✅ High |
| Declarative `ShotPattern` | ❌ Hardcoded | ✅ High |
| Items with cost + delay | ❌ Only DUAL/DUAL/TP, no cost/delay | ✅ Critical |
| Positional weather + mid-flight forces | ❌ Cosmetic client only | ✅ Critical |
| Sudden Death variants | ❌ None | ✅ Medium |
| Ballistics-solving bot | ⚠️ Solver exists; accuracy now fixed to 50-75% | ✅ Validate in QA |
| AntiCheatService | ❌ None | ✅ Critical |
| Sensitive HUD inside canvas | ❌ DOM | ✅ Medium, defer |
| Prisma Avatar Shop | ❌ Postgres `users` only | ✅ Include stat/economy foundations, defer storefront |
| Spine2D mount | ❌ Hybrid | ⏭️ Excluded by user |
| Vitest + Playwright + QA report | ❌ Only 12 Go tests | ✅ High |

### 1.3 Actual repo has things the old plan did not cover
- Go server with gorilla/websocket, Argon2id, JWT.
- 25 mobiles (vs 15 in the old plan).
- Full offline/training arena with local bots.
- Pixel-art HUD theme (`theme.css`).

**Conclusion:** do not replace the base. Add missing combat depth over the existing Go + PixiJS architecture.

---

## 2. Phase 1 — One physics model (P0, ~3-4 days)

Goal: client and server compute the same trajectory, matching DragonBound.

- Move ballistics into `packages/shared/src/physics/` as pure deterministic TypeScript.
- Use the closed form from `AUDIT_REPORT.md` §1:
  ```
  a   = t / 485
  x(t)= ceil(x0 + vx*a + ax*a²/2)
  y(t)= ceil(y0 + vy*a + ay*a²/2)
  ```
- Fix client wind sign: `ax = -round(cos(windAngle)*windPower*by)/100`.
- Add missing client `bx` term: `ay = by - round(sin(...)*windPower*by - bx)/100`.
- Unify muzzle origin (server `24/-14` vs client `±11/-26`, `y-28/-31`).
- Port same functions to Go or generate from one canonical source.
- Add parity tests: 20 angles × 21 wind values, <1px vs DragonBound `getPosAtTime(485)`, and TS↔Go equality.
- **Exit criterion:** same `x,y` at same `t` in TS and Go, <1px from DragonBound.

---

## 3. Phase 2 — Hard server validation (P0, ~2 days)

- `apps/server/internal/match/handlers.go:100-128`:
  - reject angle outside `[mobile.MinAngle, mobile.MaxAngle]`;
  - validate `shotType ∈ {0,1,2}`;
  - validate mobile id against registry.
- `match.go:376-400` (`HandleMove`):
  - validate `Y` against terrain;
  - cap distance per turn and move count per turn.
- Add per-opcode token bucket in `gateway.dispatch`: `FIRE_SHOT` 1/turn, `MOVE` 20/s, `CHAT` 5/s, others 30/s.
- Require JWT before non-AUTH dispatch; reject empty `c.UserID`.
- Register orphan opcodes `OpcodeRoomLeave` (0x2002) and `OpcodeTurnEnd` (0x3004).
- **Exit criterion:** modified clients cannot fire out of turn, with invalid angle/shot type, teleport by Y, or connect anonymously.

---

## 4. Phase 3 — Complete combat mechanics (P0-P1, ~5-7 days)

### 4.1 Damage / shield / armor (P0)
New `apps/server/internal/match/combat.go`:
- `base = damageshot` per mobile+shot.
- Full collision → full base damage.
- Splash ≤60px → `dm = base - dist` (linear; replaces `0.45 + 0.55*falloff`).
- Shield first: `shdm = shield - dm`; break at zero, overflow to HP.
- 20px distance arming instead of time-based 60/80ms.
- Same-team hit: damage applies, −250 gold, −1 GP.
- `hp <= 0` → dead + kill credit.

### 4.2 Bunge kill (P0)
- `fall_and_fie` = distinct death.
- Bunge bonus +2300 gold / +2 GP; bunge penalty −250 / −2.

### 4.3 Rewards (P1)
Kill 2300/+2, good shot 50, excellent 100, lose 250/−3, bunge 2300/+2, team penalty −250/−1; event multipliers ×2/×5.

### 4.4 Avatar stats (P1 — stats only, no sprite/rig changes)
- `total_attack = round(ava_attack/2.5)`, capped +50.
- `damageshot = base + total_attack`.
- `added_delay = base - round(ava_delay * factor)`; factors `×7`, `×12.5` (Dual), `×11` (Dual+).
- `bunge_jc = round(ava_scratch/5 + pala_bunge)`.
- Server re-validates every stat on hit/delay/bunge paths.
- This is also the first foundation block for the avatar shop (see §8).

### 4.5 Delay economy (P0)
- Full per-mobile S1/S2/SS delay table in `mobile.go`.
- Lowest accumulated delay fires next (verify `turn.go` uses real table).
- Apply avatar delay reduction.
- Wind re-roll cadence from `change_wind_angle` / `change_wind_power`.

### 4.6 Items (P0)
| Item | Effect | Extra delay | Cost |
|---|---|---:|---:|
| Dual | Second shot this turn | `two_ava_delay*12.5` | 200 |
| Dual+ | Dual with reduced delay | `two_ava_delay*11` | 300 |
| Teleport | Move to impact point | +200 | 150 |
| Wind Change | Re-roll wind | +150 | 100 |
| Power Up | +20% power | +200 | 150 |
| Blood | +HP, −damage | +100 | 150 |
| Bunge Shot | +crater radius | +100 | 200 |
| Team Teleport | Teleport to ally | +250 | 250 |

New `OpcodeUseItem` (0x3007). All effects server-side with gold/turn validation.

### 4.7 Weather with physics (P1)
- Positional anchors `active_weathers`, `next_weather_pos` as map X/Y arrays.
- Thor as real positional satellite; Aduka beam tracks per tick.
- Tornado / Sun / Mirror as per-step acceleration modifiers.
- Wind Change item updates `wind_angle` / `wind_power`.
- Guard/Weakness damage modifiers.
- Sync anchors via `TurnStart`.

### 4.8 Sudden Death (P2)
- Generic timer (`sudden = 40` turns) + Double / SS / Bigbomb room-selectable variants.
- Chat announcements at −20 / −10 / −5 / 0.

### 4.9 Missing mobile behaviors (P1)
JD movex; Kalsiddon MIRV apex split; Nak real burrow; Grub real bounce; Raon SS Baby walker; Aduka per-tracker Thor homing. Resolve server/client count mismatches (BigFoot SS 20 vs 8, Boomer S2 10 vs 4) using DragonBound values.

### 4.10 Data-driven registry (P2)
Extract `BallisticsEngine.ts:544-1212` cascade into `MobileDefinition.shots.{s1,s2,ss}: ShotPattern` with `{ count, angOffsets[], powOffsets[], staggerMs[], transformAt?, behavior? }`. Canonical JSON in `packages/shared/data/mobiles.json`, consumed by TS and Go.

**Exit criterion:** 25 mobiles × 3 shots validated by automated damage/delay/bunge/trajectory matrix.

---

## 5. Phase 4 — Anti-cheat + hardening (P0, ~2 days)

- Remove seed accounts from `main.go:53-56` or gate to development only.
- Require `JWT_SECRET` env; fail fast when unset (`main.go:32`).
- Move `docker-compose.yml` secrets to `.env`; rotate Postgres dev password.
- TLS/WSS in production; specific CORS origin; real `CheckOrigin` allowlist.
- Add CSP / `X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy`; SRI on third-party assets.
- `Dockerfile.server`: `golang:1.26-alpine` to match `go.mod`.
- New `internal/anticheat/`: impossible precision, uniform charge timing (macro), instant angle snaps, out-of-turn/invalid packets → flag + log.
- Chat: server-side 200-char cap and server-side mute.
- Optional P2: move sensitive wind/aim HUD readouts into WebGL canvas.

---

## 6. Phase 5 — Multiplayer foundations (P0 contracts / P1 capacity / P2 full product)

### 6.1 Viability decision
**Viable to add foundations now.** The codebase already has channels, rooms, teams, ready state, host migration, JWT, and a WS protocol. What is missing is protocol/state contracts that prevent offline-only assumptions from leaking into online play. Full matchmaking, region sharding, and Elo/ranked ladder are **later**.

### 6.2 Include now (P0-P1)
- Canonical `MatchID`, `RoomID`, `PlayerID`, `TeamID` in `packages/shared/src/types.ts` and Go protocol; stop using nickname/string identity for combat.
- `ClientIntent` schema (move/aim/select-shot/use-item/fire) as the only allowed client→server combat message. Replace any payload carrying computed damage, HP, crater, wind, or turn result with authoritative state from server.
- Server session registry: connection ID ↔ account ID ↔ room ID ↔ active match ID, with disconnect/reconnect grace window and snapshot resync.
- Deterministic match seed per match, stored in `MatchState`. Seed PRNG used for wind, weather, item rolls, and bot dispersion. This is required for replay/anti-cheat later.
- Room config contract: map, item set, wind mode, avatar ON/OFF, turn timer, Sudden Death rules (already partially in Phase 4).
- Server authority test: two simulated clients fire in the same turn; only the turn owner's intent is accepted.
- Protocol version field in envelope so future multiplayer changes can be rolled out without breaking old clients.

### 6.3 Defer (P2)
- Matchmaking queue + skill tiers.
- Region servers / sharding.
- Replays and spectator mode.
- Ranked ladder, season resets, party invites.
- Full 4v4 capacity stress targets.

### 6.4 Multiplayer exit criterion
All combat intents validated through one typed schema; identity is account ID; disconnect/reconnect restores match state; protocol version present; no client-authored damage/HP/wind/terrain accepted.

---

## 7. Phase 6 — Avatar shop foundations (P1 contracts / P2 storefront)

### 7.1 Viability decision
**Viable to add foundations now, but not the shop itself.** Phase 4 already needs avatar stats and caps. Adding persistence/economy contracts now avoids a painful schema migration later. Avatar visuals remain hybrid; no Spine2D work.

### 7.2 Include now (P1)
- Extend `users` with `avatar_attack`, `avatar_delay`, `avatar_scratch`, `avatar_on` (already in §4.4).
- New tables in Postgres migration:
  - `avatar_catalog (id, slot, name, rarity, price_gold, price_cash, stat_attack, stat_delay, stat_scratch, sprite_ref)`
  - `inventory (player_id, avatar_id, acquired_at, expires_at?)`
  - `equipped (player_id, slot, avatar_id)`
  - `currency_ledger (id, player_id, delta, currency, reason, match_id?)`
- Stat caps enforced in `packages/shared` and re-checked server-side on every loadout change:
  - attack cap +50;
  - delay reduction factors as in §4.4;
  - bunge `avatar_scratch/5`.
- `AvatarLoadout` included in `RoomConfig` as `avatar_on` + equipped stat bundle (IDs only, not visual assets).
- No payment integration. Cash currency exists only as a ledger column; real-money purchase is out of scope.

### 7.3 Defer (P2)
- Storefront UI, rarity gacha, seasonal catalog.
- Avatar preview in lobby (visual, not stats).
- Payments / receipts / refunds.
- AI-generated sprite parts / Spine rigs.

### 7.4 Avatar exit criterion
Server validates equipped stats and caps; purchases/equips write to ledger and inventory; combat uses server-validated stat bundle even if client tampers with visuals.

---

## 8. Phase 7 — Lobby/HUD polish (P2)

- Multiple channels (currently one hardcoded `ch1`).
- Bot slots in room (bots currently offline-only).
- Room selectors: item set, wind mode, avatar ON/OFF, turn timer, Sudden Death rules.
- Map selector in `RoomList.tsx` (currently `map_id: "plains"` hardcoded).
- HUD: per-item cost/delay, damage/gold log, All/Team chat tabs, rotary angle dial.
- Consume server `OpcodeTurnStart` `delay_queue` instead of local-only state.

---

## 9. Phase 8 — QA + CI (P1, ~2 days)

### 9.1 TypeScript tests
- Physics parity (Phase 1).
- 25 mobiles × 3 shots registry matrix (Phase 3).
- Delay queue + avatar caps (Phase 3/7).
- Item cost/delay applied (Phase 3).
- Bot accuracy 50-75% (already present: `apps/client/src/core/combat/botAccuracy.test.mts`).

### 9.2 Go tests
- `match/handlers_test.go`: out-of-turn, power > 100, invalid angle/shotType, invalid move Y.
- `gateway/ratelimit_test.go`, `gateway/auth_test.go`.
- `auth/jwt_test.go`: expired, `alg=none`, tampered signature.
- `anticheat/*_test.go`.
- Multiplayer: two-client intent validation, reconnect snapshot.

### 9.3 Playwright (P2)
Lobby→victory flow; zero JS exceptions/React warnings/404s; screenshots at 1280×720 / 1920×1080; worst-case particles 60 FPS.

### 9.4 `QA_TEST_REPORT.md`
Generated at phase close with result matrix.

---

## 10. Tools / skills

- `aldegad/sprite-gen`: avatar atlas generation, not needed (no avatar visuals in scope).
- `patch-gg/pixelfx`: VFX pattern reference, no runtime dep; consult only if improving VFX later.
- `vercel-labs/skills` and `awesome-gamedev-agent-skills`: not applicable to PixiJS.
- **Decision:** install nothing. Local toolchain sufficient: Node v24.19.0, pnpm 12.16.1, Go 1.27.0, Python 3.10.0.

---

## 11. Execution order

| Phase | Name | Priority | Estimate |
|---|---|---|---:|
| 1 | Shared physics + parity | P0 | 3-4 d |
| 2 | Hard server validation | P0 | 2 d |
| 3 | Combat completion | P0-P1 | 5-7 d |
| 4 | Anti-cheat + hardening | P0 | 2 d |
| 5 | Multiplayer foundations | P0-P1 contracts / P2 scale | 3-4 d |
| 6 | Avatar shop foundations | P1 contracts / P2 storefront | 2-3 d |
| 7 | Lobby/HUD polish | P2 | 3-5 d |
| 8 | QA + CI | P1 | 2 d |

P0 core: ~12-15 days. With foundations: ~17-22 days. Full P2: ~25-32 days.

---

## 12. Success metrics

1. Physics parity <1px across 20 angles × 21 wind values.
2. 0 unauthenticated opcodes processed by gateway.
3. 100% of `FIRE_SHOT` validated for angle/shot type/mobile id.
4. 8/8 items implemented with cost and delay, server-authoritative.
5. 25 mobiles × 3 shots validated by automated matrix.
6. Weather forces applied server-side and synced to client.
7. Bot realized hit rate statistically in **50-75%** over 200+ shots.
8. Multiplayer intents use typed schemas and account IDs; reconnect restores state.
9. Avatar stat caps and ledger/equip tables enforced server-side; no storefront/payments yet.
10. Argon2id + JWT + rate limit + CSP in production.
11. No hardcoded secrets.
12. Vitest, `botAccuracy.test.mts`, Go tests, and Playwright results recorded in `QA_TEST_REPORT.md`.
