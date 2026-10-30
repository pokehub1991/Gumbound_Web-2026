# Gumbound Web 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable browser-based GunBound clone with server-authoritative physics, destructible terrain, turn-based multiplayer combat, and a lobby system.

**Architecture:** Go backend (Gateway + Lobby + Match microservices communicating via in-process channels initially, NATS-ready interfaces) serving a TypeScript/PixiJS 8 client over WebSocket with Protobuf binary protocol. PostgreSQL for persistence, Redis for sessions and pub/sub.

**Tech Stack:** Go 1.23+, TypeScript 5.6+, PixiJS 8, React 19, Vite 6, PostgreSQL 16, Redis 7, Protocol Buffers 3, Docker Compose, pnpm 9

**Spec:** `docs/superpowers/specs/2026-10-30-gumbound-web-design.md`

## Global Constraints

- All game physics computed server-side only; client sends angle/power/shotType
- Binary WebSocket protocol using Protobuf; envelope: `[2B length][2B opcode][payload]`
- Deterministic physics: fixed-timestep (60 Hz), no floating-point non-determinism across server ticks
- Go ≥ 1.23, TypeScript ≥ 5.6, Node ≥ 22 LTS, PixiJS 8.x, React 19.x
- Passwords hashed with Argon2id; JWT auth with 15-min access tokens
- All terrain state is a bitmask; destruction = clearing circular regions

## Review Focus

1. **WebSocket disconnect mid-turn** — if the active player disconnects during their turn, the server should auto-skip after timeout and continue the match; remaining players should not be stuck
2. **Terrain mask synchronization** — if a client misses a terrain delta packet, subsequent shots will render incorrectly; client should request full terrain resync on mismatch
3. **Concurrent room mutations** — two players joining the same room simultaneously must not corrupt room state; Go mutex or channel-based serialization required
4. **Projectile out-of-bounds** — a projectile that exits the map boundaries (left, right, top) must be terminated server-side with no damage; bottom boundary = water/death
5. **Turn timer expiration** — if a player does not fire within the time limit (30s), their turn is auto-skipped with no shot; delay counter still advances

---

### Task 1: Project Scaffolding & Monorepo Setup

**Files:**
- Create: `package.json` (pnpm workspace root)
- Create: `pnpm-workspace.yaml`
- Create: `apps/client/package.json`, `apps/client/vite.config.ts`, `apps/client/tsconfig.json`
- Create: `apps/client/index.html`, `apps/client/src/main.ts`
- Create: `apps/server/go.mod`, `apps/server/main.go`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/protocol.ts` (opcode enum stubs)
- Create: `docker-compose.yml` (PostgreSQL 16, Redis 7)
- Create: `.gitignore`, `README.md`

**Interfaces:**
- Produces: pnpm monorepo that builds with `pnpm install && pnpm -r build`; Go server that compiles with `go build ./...`; Docker Compose that starts PostgreSQL and Redis with `docker compose up -d`

- [ ] **Step 1: Create pnpm workspace root**

  `package.json` with `"private": true`, pnpm-workspace.yaml pointing to `apps/*` and `packages/*`.

- [ ] **Step 2: Scaffold Vite + TypeScript client**

  `apps/client/` — Vite 6 with TypeScript template, PixiJS 8 and React 19 as dependencies. `index.html` with a root div. `src/main.ts` that creates a PixiJS Application and mounts it.

- [ ] **Step 3: Scaffold Go server**

  `apps/server/go.mod` with module `gumbound-web/server`. `main.go` that starts an HTTP server on `:8080` with a health check endpoint `GET /health` → `200 OK`.

- [ ] **Step 4: Create shared protocol package**

  `packages/shared/src/protocol.ts` — export enum `Opcode` with initial values: `AUTH_REQUEST = 0x0001`, `AUTH_RESPONSE = 0x0002`, `CHANNEL_JOIN = 0x1000`, `ROOM_CREATE = 0x2000`, `FIRE_SHOT = 0x3000`.

- [ ] **Step 5: Create docker-compose.yml**

  PostgreSQL 16 on port 5432 (user: gumbound, password: dev, db: gumbound_dev), Redis 7 on port 6379.

- [ ] **Step 6: Create .gitignore and README.md**

  Ignore `node_modules/`, `dist/`, Go binaries, `.env`. README with project name and quick start.

- [ ] **Step 7: Verify everything builds**

  Run: `pnpm install && pnpm -r build` — client builds. Run: `cd apps/server && go build ./...` — server compiles.

- [ ] **Step 8: Commit**

  ```bash
  git init && git add -A && git commit -m "feat: scaffold monorepo with client, server, shared packages"
  ```

---

### Task 2: WebSocket Gateway & Binary Protocol

**Files:**
- Create: `apps/server/internal/gateway/gateway.go`
- Create: `apps/server/internal/gateway/connection.go`
- Create: `apps/server/internal/protocol/message.go`
- Create: `apps/server/internal/protocol/opcodes.go`
- Test: `apps/server/internal/protocol/message_test.go`
- Test: `apps/server/internal/gateway/gateway_test.go`
- Modify: `apps/server/main.go`

**Interfaces:**
- Consumes: health check HTTP server from Task 1
- Produces: `Gateway` struct with `HandleWebSocket(w, r)` that upgrades HTTP to WS, reads binary frames as `Message{Opcode uint16, Payload []byte}`, and dispatches to registered handlers. `Connection` struct wraps a gorilla/websocket conn with `Send(msg Message)` and `Close()`.

- [ ] **Step 1: Write test for Message encode/decode**

  ```go
  func TestMessageRoundTrip(t *testing.T) {
      msg := Message{Opcode: 0x3000, Payload: []byte{0x01, 0x02}}
      encoded := msg.Encode()
      decoded, err := DecodeMessage(encoded)
      assert.NoError(t, err)
      assert.Equal(t, msg.Opcode, decoded.Opcode)
      assert.Equal(t, msg.Payload, decoded.Payload)
  }
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `cd apps/server && go test ./internal/protocol/ -v`
  Expected: FAIL — types not defined

- [ ] **Step 3: Implement Message type and Encode/Decode in `protocol/message.go`**

  `Message` struct with `Opcode uint16` and `Payload []byte`. `Encode() []byte` writes `[2B len (big-endian, of opcode+payload)][2B opcode][payload]`. `DecodeMessage([]byte) (Message, error)` reads the same format.

- [ ] **Step 4: Run test to verify it passes**

  Run: `cd apps/server && go test ./internal/protocol/ -v`
  Expected: PASS

- [ ] **Step 5: Implement Gateway and Connection**

  `Gateway` uses `gorilla/websocket` Upgrader. On connection: spawn read goroutine that reads binary frames, decodes Messages, dispatches to handler map `map[uint16]func(*Connection, Message)`. `Connection` has a write goroutine with a buffered channel for outbound messages.

- [ ] **Step 6: Write gateway integration test**

  Test that connects a websocket client, sends an encoded Message, and verifies the gateway calls the registered handler.

- [ ] **Step 7: Run gateway test**

  Run: `cd apps/server && go test ./internal/gateway/ -v -race`
  Expected: PASS

- [ ] **Step 8: Wire Gateway into main.go**

  Mount `gateway.HandleWebSocket` at `/ws` alongside the existing `/health` endpoint.

- [ ] **Step 9: Commit**

  ```bash
  git add -A && git commit -m "feat: WebSocket gateway with binary message protocol"
  ```

---

### Task 3: Database Schema & User Authentication

**Files:**
- Create: `apps/server/internal/db/postgres.go`
- Create: `apps/server/internal/db/migrations/001_users.sql`
- Create: `apps/server/internal/auth/auth.go`
- Create: `apps/server/internal/auth/jwt.go`
- Create: `apps/server/internal/auth/handlers.go`
- Test: `apps/server/internal/auth/auth_test.go`

**Interfaces:**
- Consumes: `Gateway` from Task 2 to register auth handlers on opcodes `0x0001` (AuthRequest)
- Produces: `AuthService` with `Register(username, password, email) (User, error)`, `Login(username, password) (accessToken, refreshToken, error)`, `ValidateToken(token) (UserID, error)`. HTTP endpoints `POST /api/register`, `POST /api/login` (REST for initial auth), then WebSocket uses JWT for session.

- [ ] **Step 1: Write migration SQL**

  ```sql
  CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(16) UNIQUE NOT NULL,
      nickname VARCHAR(16) UNIQUE NOT NULL,
      email VARCHAR(100) NOT NULL,
      password_hash TEXT NOT NULL,
      country CHAR(3) DEFAULT '',
      gold INTEGER DEFAULT 10000,
      gp INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 1000,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      authority SMALLINT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] **Step 2: Write auth test**

  ```go
  func TestRegisterAndLogin(t *testing.T) {
      svc := NewAuthService(testDB)
      user, err := svc.Register("testuser", "securepass123", "test@test.com")
      assert.NoError(t, err)
      assert.Equal(t, "testuser", user.Username)
      token, _, err := svc.Login("testuser", "securepass123")
      assert.NoError(t, err)
      userID, err := svc.ValidateToken(token)
      assert.NoError(t, err)
      assert.Equal(t, user.ID, userID)
  }
  ```

- [ ] **Step 3: Run test to verify it fails**

  Run: `cd apps/server && go test ./internal/auth/ -v`
  Expected: FAIL

- [ ] **Step 4: Implement AuthService**

  `Register`: hash password with Argon2id, insert into users table. `Login`: fetch user, verify Argon2id hash, generate JWT (15-min, HS256). `ValidateToken`: parse and validate JWT claims.

- [ ] **Step 5: Run test to verify it passes**

  Run: `cd apps/server && go test ./internal/auth/ -v`
  Expected: PASS

- [ ] **Step 6: Wire auth HTTP endpoints and WebSocket handler**

  `POST /api/register`, `POST /api/login` return JSON with tokens. WebSocket opcode `0x0001` AuthRequest validates token and associates Connection with UserID.

- [ ] **Step 7: Commit**

  ```bash
  git add -A && git commit -m "feat: user registration, login, JWT auth with Argon2id"
  ```

---

### Task 4: Lobby System (Channels, Rooms, Chat)

**Files:**
- Create: `apps/server/internal/lobby/channel.go`
- Create: `apps/server/internal/lobby/room.go`
- Create: `apps/server/internal/lobby/chat.go`
- Create: `apps/server/internal/lobby/handlers.go`
- Test: `apps/server/internal/lobby/room_test.go`
- Test: `apps/server/internal/lobby/channel_test.go`

**Interfaces:**
- Consumes: `Gateway`/`Connection` from Task 2, `AuthService.ValidateToken` from Task 3
- Produces: `Channel` struct managing a list of rooms and connected players. `Room` struct with `Join(player)`, `Leave(player)`, `SetMobile(player, mobileID)`, `ToggleReady(player)`, `StartMatch() error` (returns error if not all ready). `ChatService` that broadcasts messages within a room or channel.

- [ ] **Step 1: Write test for Room join/leave/ready**

  ```go
  func TestRoomLifecycle(t *testing.T) {
      room := NewRoom("Test Room", 8, "plains", HostPlayer)
      err := room.Join(Player2)
      assert.NoError(t, err)
      assert.Equal(t, 2, room.PlayerCount())
      room.SetMobile(Player2.ID, MobileArmor)
      room.ToggleReady(Player2.ID)
      assert.True(t, room.IsPlayerReady(Player2.ID))
      room.Leave(Player2.ID)
      assert.Equal(t, 1, room.PlayerCount())
  }
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `cd apps/server && go test ./internal/lobby/ -v`
  Expected: FAIL

- [ ] **Step 3: Implement Room struct**

  Room has: ID, Name, MaxPlayers, MapID, Host, Players map, Teams (A/B), mutex for concurrent access. `Join` checks capacity and assigns team. `ToggleReady` flips player ready state. `StartMatch` validates all players ready, at least 2 players, balanced teams.

- [ ] **Step 4: Implement Channel struct**

  Channel has: ID, Name, Rooms map, ConnectedPlayers map. `CreateRoom`, `RemoveRoom`, `ListRooms`, `BroadcastRoomList`.

- [ ] **Step 5: Write channel test**

  Test creating rooms, listing them, and removing them.

- [ ] **Step 6: Run all lobby tests**

  Run: `cd apps/server && go test ./internal/lobby/ -v -race`
  Expected: PASS

- [ ] **Step 7: Implement WebSocket handlers for lobby opcodes**

  Register handlers: `0x1000` ChannelJoin, `0x1001` ChannelState, `0x2000` RoomCreate, `0x2001` RoomJoin, `0x2002` RoomLeave, `0x2003` SelectMobile, `0x2004` ToggleReady, `0x2005` ChatMessage.

- [ ] **Step 8: Commit**

  ```bash
  git add -A && git commit -m "feat: lobby system with channels, rooms, chat"
  ```

---

### Task 5: Physics Engine (Ballistics + Terrain Destruction)

**Files:**
- Create: `apps/server/internal/physics/projectile.go`
- Create: `apps/server/internal/physics/terrain.go`
- Create: `apps/server/internal/physics/collision.go`
- Create: `apps/server/internal/physics/constants.go`
- Test: `apps/server/internal/physics/projectile_test.go`
- Test: `apps/server/internal/physics/terrain_test.go`

**Interfaces:**
- Produces: `SimulateProjectile(origin Vec2, angle float64, power float64, wind Vec2, gravity float64, terrain *TerrainMask, mobiles []MobilePos) ProjectileResult`. `ProjectileResult` contains: trajectory points, hit type (terrain/mobile/oob/water), impact position, damage map, terrain delta (circle to clear). `TerrainMask` with `IsGround(x, y) bool`, `ClearCircle(cx, cy, radius int)`, `Encode() []byte`, `ApplyDelta(delta TerrainDelta)`.

- [ ] **Step 1: Write test for projectile trajectory (no wind, flat terrain)**

  ```go
  func TestProjectileStraightShot(t *testing.T) {
      terrain := NewFlatTerrain(800, 600, groundY: 500)
      result := SimulateProjectile(
          Vec2{100, 450}, // origin
          45.0,           // angle degrees
          50.0,           // power
          Vec2{0, 0},     // no wind
          0.15,           // gravity
          terrain,
          nil,            // no mobile targets
      )
      assert.Equal(t, HitTerrain, result.HitType)
      assert.True(t, result.ImpactPos.X > 100) // moved right
      assert.True(t, result.ImpactPos.Y >= 499) // hit ground
      assert.True(t, len(result.Trajectory) > 10) // has trajectory points
  }
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `cd apps/server && go test ./internal/physics/ -v`
  Expected: FAIL

- [ ] **Step 3: Implement SimulateProjectile**

  Fixed-timestep loop (dt = 1/60). Each tick: update velocity with gravity+wind, update position. Check terrain collision with `terrain.IsGround(x, y)` pixel check. Check mobile bounding box collision. If projectile exits map bounds → HitOOB. If y > map height → HitWater. Collect trajectory points every N ticks for client rendering. Return on first collision.

- [ ] **Step 4: Run trajectory test**

  Run: `cd apps/server && go test ./internal/physics/ -run TestProjectileStraightShot -v`
  Expected: PASS

- [ ] **Step 5: Write test for terrain destruction**

  ```go
  func TestTerrainClearCircle(t *testing.T) {
      terrain := NewFlatTerrain(200, 200, groundY: 150)
      assert.True(t, terrain.IsGround(100, 160))
      terrain.ClearCircle(100, 160, 20)
      assert.False(t, terrain.IsGround(100, 160))
      assert.True(t, terrain.IsGround(100, 190)) // outside radius
  }
  ```

- [ ] **Step 6: Implement TerrainMask**

  Bitmask backed by `[]byte` (1 bit per pixel). `IsGround(x,y)` checks bit. `ClearCircle(cx,cy,r)` iterates pixels in bounding box, clears those within radius. `Encode()`/`Decode()` for serialization. `GenerateFlat(width, height, groundY)` for testing.

- [ ] **Step 7: Run terrain test**

  Run: `cd apps/server && go test ./internal/physics/ -run TestTerrainClearCircle -v`
  Expected: PASS

- [ ] **Step 8: Write test for projectile with wind**

  Test that with positive wind_x, projectile lands further right than without wind.

- [ ] **Step 9: Run all physics tests**

  Run: `cd apps/server && go test ./internal/physics/ -v -race`
  Expected: PASS

- [ ] **Step 10: Commit**

  ```bash
  git add -A && git commit -m "feat: server-authoritative physics engine with ballistics and terrain destruction"
  ```

---

### Task 6: Match Engine (Game Loop, Turn System, Delay)

**Files:**
- Create: `apps/server/internal/match/match.go`
- Create: `apps/server/internal/match/turn.go`
- Create: `apps/server/internal/match/mobile.go`
- Create: `apps/server/internal/match/state.go`
- Test: `apps/server/internal/match/match_test.go`
- Test: `apps/server/internal/match/turn_test.go`

**Interfaces:**
- Consumes: `SimulateProjectile` and `TerrainMask` from Task 5, `Room` from Task 4
- Produces: `Match` struct with `Start(room Room)`, `HandleFireShot(playerID, angle, power, shotType)`, `GetState() MatchState`. State machine: `WaitingForPlayers → InProgress → Finished`. `TurnManager` that tracks delay counters and determines next player. `MobileRegistry` with stats for 8 core mobiles (HP, damage tables, delay values, projectile types).

- [ ] **Step 1: Write test for turn order with delay system**

  ```go
  func TestTurnOrderByDelay(t *testing.T) {
      tm := NewTurnManager([]MatchPlayer{
          {ID: "p1", Mobile: MobileNak, Delay: 0},    // Nak = fast (low delay)
          {ID: "p2", Mobile: MobileBigFoot, Delay: 0}, // BigFoot = slow (high delay)
      })
      first := tm.NextPlayer()
      assert.Equal(t, "p1", first.ID) // both 0, p1 is first by order
      tm.AddDelay("p1", MobileNak.BaseDelay + MobileNak.Shot1Delay)
      tm.AddDelay("p2", MobileBigFoot.BaseDelay + MobileBigFoot.Shot1Delay)
      second := tm.NextPlayer()
      assert.Equal(t, "p1", second.ID) // Nak has lower accumulated delay
  }
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `cd apps/server && go test ./internal/match/ -v`
  Expected: FAIL

- [ ] **Step 3: Implement MobileRegistry**

  Define 8 mobile types with: `Name`, `HP`, `BaseDelay`, `Shot1Delay`, `Shot2Delay`, `SSDelay`, `Shot1Damage`, `Shot2Damage`, `SSDamage`, `BlastRadius` per shot type. Values based on original GunBound data.

- [ ] **Step 4: Implement TurnManager**

  Tracks `delayCounters map[string]int`. `NextPlayer()` returns player with lowest delay counter. `AddDelay(playerID, amount)` increments counter. Handles ties by round-robin order.

- [ ] **Step 5: Implement Match state machine**

  `Match` struct: state enum, players, terrain, turn manager, wind generator. `Start()`: generate terrain, assign spawn positions, set initial wind, transition to InProgress, notify clients of MatchStart. `HandleFireShot()`: validate it's the player's turn, call `SimulateProjectile`, apply damage, update terrain, advance turn, check win condition, broadcast results. `30-second turn timer` using Go timer.

- [ ] **Step 6: Write integration test for a 2-player match**

  Create match, simulate 2 players taking alternating turns until one is eliminated.

- [ ] **Step 7: Run all match tests**

  Run: `cd apps/server && go test ./internal/match/ -v -race`
  Expected: PASS

- [ ] **Step 8: Wire Match into Gateway handlers**

  When all players in a Room are ready and host triggers start: create Match, register opcode `0x3000` FireShot handler routed to the match instance. Match broadcasts `0x3001` TurnStart, `0x3002` ProjectileResult, `0x3003` TurnEnd, `0x3004` MatchEnd.

- [ ] **Step 9: Commit**

  ```bash
  git add -A && git commit -m "feat: match engine with turn system, delay mechanics, and mobile stats"
  ```

---

### Task 7: Client — Game Renderer (PixiJS Canvas + Terrain)

**Files:**
- Create: `apps/client/src/game/Game.ts`
- Create: `apps/client/src/game/TerrainRenderer.ts`
- Create: `apps/client/src/game/Background.ts`
- Create: `apps/client/src/game/Camera.ts`
- Modify: `apps/client/src/main.ts`

**Interfaces:**
- Consumes: PixiJS Application from Task 1 scaffold
- Produces: `Game` class that initializes a PixiJS stage with layers: Background (parallax), Terrain (destructible canvas), Mobiles, Projectiles, UI. `TerrainRenderer` that renders a terrain bitmask onto a PixiJS `RenderTexture` and supports `clearCircle(x, y, radius)` for destruction. `Camera` with follow and zoom capabilities.

- [ ] **Step 1: Implement TerrainRenderer**

  Create class that takes a width/height, generates a flat terrain bitmap (Canvas2D), converts to PixiJS Texture, renders as a Sprite. `clearCircle(cx, cy, r)` draws a transparent circle on the canvas using `globalCompositeOperation = 'destination-out'`, then updates the texture. Procedurally generate a hilly terrain profile using sine waves for the prototype.

- [ ] **Step 2: Implement Background layer**

  Simple gradient sky background (PixiJS Graphics). Parallax scroll relative to camera position.

- [ ] **Step 3: Implement Camera**

  Camera class that controls the PixiJS container's `x`, `y`, `scale`. Supports `panTo(x, y)`, `followTarget(sprite)`, smooth interpolation. Mouse wheel zoom.

- [ ] **Step 4: Implement Game class**

  Creates the PixiJS Application (800x600, WebGL2). Sets up layer hierarchy: background → terrain → mobiles → projectiles → UI overlay. Initializes Camera. Runs a 60fps game loop via PixiJS ticker.

- [ ] **Step 5: Wire Game into main.ts**

  Mount the PixiJS canvas in the `#app` div. Show the terrain rendering on screen.

- [ ] **Step 6: Visual verification**

  Run: `cd apps/client && pnpm dev` — open browser, see rendered terrain with gradient sky.

- [ ] **Step 7: Commit**

  ```bash
  git add -A && git commit -m "feat: client game renderer with destructible terrain and camera"
  ```

---

### Task 8: Client — Mobile Sprites & Aiming System

**Files:**
- Create: `apps/client/src/game/Mobile.ts`
- Create: `apps/client/src/game/Projectile.ts`
- Create: `apps/client/src/game/AimController.ts`
- Create: `apps/client/src/game/PowerBar.ts`
- Create: `apps/client/src/game/WindIndicator.ts`

**Interfaces:**
- Consumes: `Game` and `TerrainRenderer` from Task 7
- Produces: `Mobile` class (PixiJS Container with body sprite + turret sprite that rotates). `AimController` that handles mouse/keyboard input to set angle (turret rotation) and power (power bar fill). `Projectile` class that animates along a trajectory received from the server. `PowerBar` UI component. `WindIndicator` UI component.

- [ ] **Step 1: Implement Mobile class**

  PixiJS Container with: body sprite (colored rectangle placeholder, 40x30px), turret sprite (line/rectangle, rotates around pivot). `setAngle(degrees)` rotates turret. `setPosition(x, y)` places on terrain. `takeDamage(amount)` reduces HP bar. HP bar rendered as PixiJS Graphics above the mobile.

- [ ] **Step 2: Implement AimController**

  Keyboard controls: Left/Right arrow = adjust angle (1° per press, hold for continuous), Up/Down = adjust power. Space = fire (hold for power bar charge, release to fire — or toggle mode). Mouse: click-drag on turret to aim. Produces `{angle, power, shotType}` on fire. Tab cycles shot type (Shot 1 → Shot 2 → SS if available).

- [ ] **Step 3: Implement PowerBar**

  PixiJS Graphics bar at bottom of screen. Fills left-to-right as power increases. Color gradient: green (low) → yellow → red (max). Displays numeric power value.

- [ ] **Step 4: Implement WindIndicator**

  Arrow sprite that rotates to show wind direction. Scale/length indicates magnitude. Numeric display of wind strength (0-26).

- [ ] **Step 5: Implement Projectile animation**

  Receives array of trajectory points from server. Animates a sprite along those points at game speed. On impact: play explosion animation (circular expanding sprite), trigger `terrainRenderer.clearCircle()` with received radius.

- [ ] **Step 6: Integration — place 2 mobiles on terrain, aim and see trajectory preview**

  Dotted-line trajectory preview (client-side prediction) that updates in real-time as angle/power changes.

- [ ] **Step 7: Visual verification**

  Run dev server, see 2 mobiles on terrain, aim turret, see power bar and wind indicator, fire shows projectile animation and terrain destruction.

- [ ] **Step 8: Commit**

  ```bash
  git add -A && git commit -m "feat: mobile sprites, aiming system, projectile animation, power bar, wind indicator"
  ```

---

### Task 9: Client — WebSocket Connection & Protocol

**Files:**
- Create: `apps/client/src/network/Connection.ts`
- Create: `apps/client/src/network/MessageHandler.ts`
- Create: `apps/client/src/network/protocol.ts`
- Create: `packages/shared/src/opcodes.ts`
- Create: `packages/shared/src/types.ts`

**Interfaces:**
- Consumes: Shared protocol types from `packages/shared`
- Produces: `Connection` class that connects to WSS, sends/receives binary messages with `[2B len][2B opcode][payload]` envelope. `MessageHandler` with `on(opcode, callback)` registration and dispatch. Protocol encode/decode helpers for each message type.

- [ ] **Step 1: Define shared opcodes and types**

  In `packages/shared/src/opcodes.ts`: all opcodes as const enum. In `types.ts`: TypeScript interfaces for all message payloads (AuthRequest, RoomState, FireShot, ProjectileResult, etc.).

- [ ] **Step 2: Implement Connection class**

  Opens `WebSocket(url)` in binary mode. `send(opcode, payload)` encodes envelope and sends. `onMessage` parses envelope and dispatches to `MessageHandler`. Auto-reconnect with exponential backoff. Connection state management (connecting, connected, disconnected).

- [ ] **Step 3: Implement protocol encode/decode**

  For each message type: `encodeFireShot(angle, power, shotType) → Uint8Array`, `decodeProjectileResult(buffer) → {trajectory, hitType, damage, terrainDelta}`. Use DataView for binary read/write.

- [ ] **Step 4: Integration test with local server**

  Connect client to server WebSocket, send AuthRequest, receive AuthResponse.

- [ ] **Step 5: Commit**

  ```bash
  git add -A && git commit -m "feat: client WebSocket connection with binary protocol"
  ```

---

### Task 10: Client — Lobby UI (React Overlay)

**Files:**
- Create: `apps/client/src/ui/App.tsx`
- Create: `apps/client/src/ui/screens/LoginScreen.tsx`
- Create: `apps/client/src/ui/screens/LobbyScreen.tsx`
- Create: `apps/client/src/ui/screens/RoomScreen.tsx`
- Create: `apps/client/src/ui/components/RoomList.tsx`
- Create: `apps/client/src/ui/components/PlayerList.tsx`
- Create: `apps/client/src/ui/components/ChatBox.tsx`
- Create: `apps/client/src/ui/components/MobileSelector.tsx`
- Create: `apps/client/src/ui/store.ts` (Zustand state management)
- Modify: `apps/client/src/main.ts`

**Interfaces:**
- Consumes: `Connection` from Task 9, shared types from Task 9
- Produces: React component tree rendered as DOM overlay on top of the PixiJS canvas. `LoginScreen` → `LobbyScreen` (room list + chat) → `RoomScreen` (team setup + mobile selection + ready button). State managed by Zustand store with slices for auth, lobby, room, match.

- [ ] **Step 1: Set up React rendering alongside PixiJS**

  In `main.ts`: create PixiJS app in one div, render React `<App/>` in an overlay div with `pointer-events: none` (except for UI elements). Use Zustand for shared state.

- [ ] **Step 2: Implement LoginScreen**

  Username/password form, Register/Login buttons. Calls `POST /api/login` or `/api/register`. On success: store JWT, connect WebSocket, navigate to lobby.

- [ ] **Step 3: Implement LobbyScreen**

  Left panel: room list (from server ChannelState). Each room shows: name, player count, map, host. Create Room button opens dialog. Right panel: chat box. Click room → join room → navigate to RoomScreen.

- [ ] **Step 4: Implement RoomScreen**

  Two team columns (Team A / Team B). Each player slot shows: nickname, selected mobile icon, ready status. Mobile selector: grid of 8 mobile icons (placeholders). Ready button. Start button (host only, enabled when all ready). Chat box for room chat.

- [ ] **Step 5: Implement ChatBox component**

  Scrollable message list. Input field at bottom. Sends ChatMessage opcode on enter. Receives and displays ChatBroadcast messages.

- [ ] **Step 6: Wire UI to WebSocket messages**

  Zustand store subscribes to MessageHandler events. Server messages update store → React re-renders. User actions → Connection.send().

- [ ] **Step 7: Visual verification**

  Full flow: Login → see lobby with rooms → create room → see room screen → select mobile → toggle ready.

- [ ] **Step 8: Commit**

  ```bash
  git add -A && git commit -m "feat: lobby UI with login, room list, room setup, chat"
  ```

---

### Task 11: End-to-End Match Flow Integration

**Files:**
- Create: `apps/client/src/game/MatchController.ts`
- Modify: `apps/client/src/game/Game.ts`
- Modify: `apps/client/src/ui/store.ts`
- Create: `apps/client/src/ui/screens/MatchHUD.tsx`

**Interfaces:**
- Consumes: All previous tasks — Gateway, Auth, Lobby, Match Engine (server); Game renderer, AimController, Connection (client)
- Produces: `MatchController` that orchestrates the full match lifecycle on the client: receives MatchStart → initializes terrain and mobiles → handles TurnStart (enable/disable aim controls) → sends FireShot → receives ProjectileResult → animates projectile → applies terrain destruction → receives TurnEnd → loops → receives MatchEnd → shows results. `MatchHUD` React component showing turn indicator, player HP bars, delay order, timer.

- [ ] **Step 1: Implement MatchController**

  On `MatchStart` message: decode terrain bitmask, create TerrainRenderer, spawn Mobile instances at positions, set initial wind. On `TurnStart`: if it's my turn, enable AimController; else disable. On my fire: send `FireShot` opcode with angle/power/shotType. On `ProjectileResult`: animate projectile along trajectory, play explosion, apply terrain delta, update HP bars. On `MatchEnd`: show victory/defeat screen.

- [ ] **Step 2: Implement MatchHUD**

  React overlay showing: current turn indicator (whose turn + timer countdown), all player HP bars (team colored), wind indicator, shot type selector, delay queue visualization.

- [ ] **Step 3: Server-side: trigger match start from room**

  When host clicks Start and all ready: server creates Match, sends MatchStart to all room players, transitions them from lobby to match context.

- [ ] **Step 4: End-to-end test**

  Open 2 browser tabs, login with different users, join same room, select mobiles, ready up, start match, take turns firing, destroy terrain, eliminate opponent, see match end.

- [ ] **Step 5: Handle edge cases**

  - Player disconnect: server auto-skips their turns, marks them as "disconnected" in match
  - Turn timeout: 30-second timer, auto-skip on expiry
  - Projectile OOB: no damage, turn advances normally

- [ ] **Step 6: Commit**

  ```bash
  git add -A && git commit -m "feat: end-to-end match flow — full playable game loop"
  ```

---

### Task 12: Maps, Polish & Dev Deployment

**Files:**
- Create: `assets/maps/plains.json` (terrain profile + metadata)
- Create: `assets/maps/canyon.json`
- Create: `assets/maps/island.json`
- Create: `apps/server/internal/maps/loader.go`
- Create: `apps/client/src/game/MapLoader.ts`
- Create: `Dockerfile.server`, `Dockerfile.client`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: TerrainMask from Task 5, TerrainRenderer from Task 7
- Produces: 3 procedurally-generated map definitions with distinct terrain profiles. `MapLoader` on both server and client that generates terrain bitmask from profile data. Docker multi-stage builds for both services. Complete `docker-compose.yml` that runs the full stack.

- [ ] **Step 1: Define map format**

  JSON schema: `{ name, width, height, groundProfile: number[] (y-values per x), spawnPositions: [{x,y}], backgroundColor, gravity }`. Generate 3 maps with distinct profiles.

- [ ] **Step 2: Implement server MapLoader**

  `LoadMap(mapID) → TerrainMask` — generates bitmask from ground profile. Fill all pixels below profile line as ground.

- [ ] **Step 3: Implement client MapLoader**

  Generates the visual terrain (canvas with grass-green fill above profile) and collision mask from the same profile data.

- [ ] **Step 4: Create Dockerfiles**

  Server: multi-stage Go build. Client: Vite build + nginx static serve.

- [ ] **Step 5: Complete docker-compose.yml**

  Full stack: PostgreSQL, Redis, server (port 8080), client (port 3000). Environment variables for DB connection, JWT secret, etc.

- [ ] **Step 6: Verify full stack runs with `docker compose up`**

  Run: `docker compose up --build` — all services start, client accessible at `localhost:3000`, WebSocket connects to server.

- [ ] **Step 7: Commit**

  ```bash
  git add -A && git commit -m "feat: 3 maps, Docker deployment, full-stack compose"
  ```

---

