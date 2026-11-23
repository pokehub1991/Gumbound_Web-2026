# COMBAT_AUDIT_FINDINGS.md — Auditoría del código real

Fuente: lectura directa de `apps/client/**` y `apps/server/**` el 2026-11-22. NO es el `AUDIT_REPORT.md` original (que audita DragonBound); este audita **este repo**.

## Resumen de severidades
- **P0 (rompe gameplay):** 8 hallazgos.
- **P1 (mecánica incompleta):** 11 hallazgos.
- **P2 (calidad/robustez):** 6 hallazgos.

---

## P0 — Críticos

### P0-1. Física de cliente y servidor DIVERGEN
- Servidor: forma cerrada @16ms, signo de viento correcto (`ax = 0 - b0`).
  - `apps/server/internal/physics/projectile.go:114-136`
- Cliente: integrador Euler @8ms, signo de viento **invertido** (`+cos`).
  - `apps/client/src/core/physics/BallisticsEngine.ts:83-85, 335-338`
- Muzzle geometry distinta: server `24/-14` vs client `±11/-26, y-28/-31`.
- Consecuencia: lo que el servidor valida no es lo que el cliente dibuja.

### P0-2. Servidor no valida ángulo
- `apps/server/internal/match/handlers.go:100-128` solo valida `power ∈ [0,100]`.
- Cliente tiene clamp en `MobileEntity.ts:230-236`, trivialmente bypasseable.

### P0-3. `shotType` sin validar
- `handlers.go:101-108` acepta cualquier int; cae a `Shot1Damage` en `match.go:134`.

### P0-4. `PlayerMove` acepta Y arbitraria
- `apps/server/internal/match/match.go:376-400` clamp `x ∈ [40,2360]` pero `y` verbatim → teletransporte libre.
- Sin chequeo de velocidad, terreno o fase de turno.

### P0-5. Items sin server-authority
- Estado de items (`playerItems`, `activateItem`) vive solo en `ArenaScreen.tsx:146-172`.
- No existe opcode `USE_ITEM`. Coste y delay penalización ausentes.

### P0-6. Escudos, avatar-attack-bonus, penalización de equipo: no existen
- `CombatArena.ts:1154-1156` resta HP directo, sin pool de escudo.
- Sin símbolo `avatarAttack` en `apps/`; avatares son cosméticos.
- Self-hit y enemy-hit usan la misma fórmula; sin `team_damage_penalty`.

### P0-7. Armado de proyectil por tiempo, no por distancia
- Server `tMs >= 60` (`projectile.go:156`), cliente `tMs >= 80` (`BallisticsEngine.ts:368`).
- Clásico: 20px de distancia desde `(x0,y0)`.

### P0-8. WS upgrade sin auth
- `apps/server/internal/gateway/gateway.go:46-62` despacha sin exigir JWT.
- `CheckOrigin: return true` (`:29-31`). Handler de lobby/match confían en `c.UserID` vacío.

---

## P1 — Mecánicas incompletas

### P1-1. Weather es teatro cliente
- `WeatherManager.ts`, `WeatherColumnEntity.ts` dibujan; no aplican física.
- Servidor ignora weather (`match.go:82-90` solo maneja viento).
- Thor sin homing por tick.
- Tornado/Sun/Mirror sin efecto en trayectoria.

### P1-2. Sudden Death ausente
- Sin símbolo `suddenDeath|SuddenDeath|bigbomb|Bigbomb` en `apps/`.
- `MatchState` solo `waiting|in_progress|finished` (`state.go:7-13`).

### P1-3. Delay economy incompleta
- `turn.go` ordena por delay pero no usa la tabla real por mobile+shot de DragonBound.
- Sin reducción por avatar (×7/×12.5/×11).

### P1-4. Comportamientos de mobiles divergentes entre cliente y servidor
| Mobile | Server (`match.go`) | Cliente (`BallisticsEngine.ts`) |
|---|---|---|
| BigFoot SS | 20 misiles (`:150`) | 8 (`:811`) |
| Boomer S2 | 10 (`:153`) | 4 (`:1094`) |
| Kalsiddon | ninguno | 2/4/6 (`:1014`) |
| Trico S2 | 3 ✅ | 3 ✅ |
| Raon S2 | 2 ✅ | 2 ✅ |

### P1-5. JD movex no implementado
- `mobiles.ts:166` promete empuje/succión; `BallisticsEngine.ts` no tiene branch para `mobileId === 5`.

### P1-6. Kalsiddon sin MIRV apex-split
- `mobiles.ts:463` "se abren en el cenit"; código solo hace spread.

### P1-7. Nak burrow es solo un label
- `BallisticsEngine.ts:1129-1141` marca `nak_subterranean` sin path subterráneo real.

### P1-8. Grub sin rebote
- `mobiles.ts:398` promete rebote; `simulateGrubShot2` (`:937`) no lo implementa.

### P1-9. Aduka Thor tracking parcial
- 3 trackers (`:1143-1170`) pero solo el primer impacto dispara el beam (`CombatArena.ts:1243-1250`).

### P1-10. Raon SS Baby walker ausente
- `mobiles.ts:420` promete caminante; solo S2 twin mines (`:1113-1127`).

### P1-11. Daño por explosión usa fórmula no-canónica
- Cliente: `0.45 + 0.55*falloff` con radio `bungeRadius*1.5+14` (`CombatArena.ts:1106-1116`).
- Servidor: `1 - dist/blastRadius`, floor 10 (`collision.go:21-37`).
- Clásico: `dm = base - dist`, radio fijo 60.

---

## P2 — Calidad / robustez

### P2-1. Opcodes huérfanos
- `OpcodeRoomLeave` (0x2002) y `OpcodeTurnEnd` (0x3004) definidos pero sin handler registrado.

### P2-2. Servidor nunca llama `room.CanStartMatch()`
- `room.go:143-158` existe pero `match/handlers.go:35-97` no lo usa → inicia con 1 jugador.

### P2-3. Hot-swap de mobile a mitad de partida
- `match/handlers.go:166-186` permite cambiar `MobileID` sin validar contra `MapDefinitions`.

### P2-4. HUD completamente en DOM
- Timer, turn list, angle badge, power bar, items, chat todos en DOM (`ArenaScreen.tsx`).
- Editable desde DevTools.

### P2-5. Window globals expuestos
- `window.__engine`, `window.__arena` (`main.tsx:127-128`).
- Usuario puede congelar timer, mutar HP de bots.

### P2-6. Secretos en repo
- `main.go:32` JWT el servicio default.
- `main.go:53-56` seed accounts (`player1/123456`, `admin/admin123`).
- `docker-compose.yml:37` `JWT_el servicio: "gumbound_production_..."`.

---

## Seguridad (higiene)
- ✅ Argon2id sólido (`auth/jwt.go:39-60`), constant-time compare (`:96`).
- ✅ SQL parametrizado, sin inyección (`db/postgres.go`).
- ✅ React escapa chat (no `dangerouslySetInnerHTML`).
- ❌ CORS `*` (`main.go:18`), WS `CheckOrigin true`.
- ❌ Sin TLS/WSS (`main.go:89`, `Connection.ts:14`, `LoginScreen.tsx:26`).
- ❌ Sin CSP, sin SRI, sin security headers (`index.html`, `Dockerfile.client`).
- ❌ Sin rate limit por conexión ni por opcode.
- ❌ Dockerfile.server: Go 1.23 vs `go.mod` 1.26 (build romperá).
- ❌ Registro filtra error verbatim (`auth/handlers.go:54`).

---

## Tests existentes (Go only, 12 casos)
- `protocol/message_test.go` — roundtrip envelope, short buffer.
- `gateway/gateway_test.go` — dispatch binario. **No testea auth ni rate limit.**
- `auth/auth_test.go` — Argon2id roundtrip, JWT issue/validate. **No testea expiración ni alg=none.**
- `lobby/room_test.go`, `channel_test.go` — ciclo de vida.
- `physics/projectile_test.go`, `terrain_test.go`, `terrain_mask_verify_test.go`.
- `match/match_test.go`, `turn_test.go`.
- `maps/loader_test.go`.

**No hay tests de:** `match/handlers.go`, `lobby/handlers.go`, `auth/handlers.go`, `db/postgres.go`, rate limit, chat, anticuario, ni NINGÚN test de cliente TS.

---

## Arquitectura real vs `ARCHITECTURE_PLAN.md` viejo
| Dimensión | Plan viejo | Real |
|---|---|---|
| Servidor | Colyseus (Node) + Prisma | Go + gorilla/websocket + lib/pq |
| DB | PostgreSQL vía Prisma | PostgreSQL vía lib/pq |
| Protocolo | `@colyseus/schema` binario | `[len][op][JSON payload]` |
| Shared | `packages/shared/{physics,terrain,combat,registry,net,rng,types}` | `packages/shared/{index,protocol,types}` (solo enums) |
| Avatares | Spine2D bone-anchored | Híbrido (PNG sobre chassis) — **explícitamente fuera de alcance** |
| QA | Vitest + Playwright + `QA_TEST_REPORT.md` | Solo `go test` (12 casos) |
| Mobiles | 15 (Armor…Raon) | 25 (incluye Knight, Fox, Kalsiddon, Maya, Phoenix, Frog) |

**Veredicto:** la base real (Go autoritativo + PixiJS v8) es **mejor** que la propuesta BOOMBOUND en control de trampas. Lo que falta es **profundidad de combate**, no cambio de arquitectura.
