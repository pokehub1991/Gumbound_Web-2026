# Gumbound Web 2026 — Design Specification

## 1. Purpose

Recreate GunBound World Champion Season 2 as a modern, browser-native multiplayer artillery game. The game must faithfully reproduce the original mechanics (turn-based ballistic combat with destructible terrain, 20+ mobile types, wind physics, avatar system, rooms/channels) while being built on a modern web stack that supports thousands of concurrent users, server-authoritative physics, and extensibility for future game modes and anti-cheat measures.

## 2. Success Criteria

- A playable web prototype where 2+ players can join a room, pick mobiles, and complete a full match with faithful GunBound mechanics
- Server-authoritative physics — no client-side trajectory or damage calculation
- Destructible terrain rendered in real-time in the browser
- Turn-based combat with delay system, wind, and shot types (Shot 1, Shot 2, SS)
- Lobby system with channels, rooms, chat, and player lists
- Scalable backend supporting horizontal scaling to thousands of concurrent users
- Asset pipeline that can consume original GunBound sprites or custom placeholder sprites
- Architecture that supports future anti-cheat, new game modes, and avatar/shop systems

## 3. Target Users

- GunBound nostalgic community (private server players, Latin American / Korean / Southeast Asian audiences)
- Browser game enthusiasts who want accessible, no-install artillery combat

## 4. Architecture Overview

### 4.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  TypeScript + PixiJS 8 (WebGL2/WebGPU) + React 19 (UI)        │
│  WebSocket connection to Gateway                                │
└─────────────────┬───────────────────────────────────────────────┘
                  │ WSS (TLS 1.3)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GATEWAY SERVICE (Go)                          │
│  WebSocket hub · JWT auth · rate limiting · connection routing   │
│  Routes to: Lobby Service | Match Service                       │
└──────┬──────────────────────────────┬───────────────────────────┘
       │ gRPC / NATS                  │ gRPC / NATS
       ▼                              ▼
┌──────────────┐           ┌──────────────────────────┐
│ LOBBY SERVICE│           │    MATCH SERVICE (Go)     │
│    (Go)      │           │ Authoritative game loop   │
│ Channels     │           │ Physics engine (ballistics│
│ Rooms        │           │  + terrain destruction)   │
│ Chat         │           │ Turn manager (delay system)│
│ Matchmaking  │           │ Per-match state machine   │
└──────┬───────┘           └──────────┬───────────────┘
       │                              │
       ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│  PostgreSQL 16 (users, items, stats, guilds)                    │
│  Redis 7 (sessions, matchmaking queues, leaderboards, pub/sub)  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Monorepo Structure

```
Gumbound_Web-2026/
├── apps/
│   ├── client/          # Vite + TypeScript + PixiJS + React
│   └── server/          # Go backend (Gateway + Lobby + Match)
├── packages/
│   ├── shared/          # Shared TypeScript types/constants (protocol, mobile stats)
│   └── physics/         # Deterministic physics engine (TypeScript, shared)
├── tools/
│   └── asset-pipeline/  # XFS extractor + sprite sheet generator (Python/Node)
├── assets/
│   ├── sprites/         # Extracted/placeholder sprite sheets
│   ├── maps/            # Terrain bitmaps
│   └── sounds/          # Sound effects
├── docs/
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── docker-compose.yml
├── package.json         # pnpm workspace root
└── go.work              # Go workspace
```

### 4.3 Why This Stack

| Choice | Rationale |
|--------|-----------|
| **Go backend** | Goroutine-per-connection scales to thousands of concurrent WebSocket clients with minimal memory. Native concurrency makes game loops trivial. Proven in game servers (Agones, Nakama). |
| **PixiJS 8** | Industry-leading 2D WebGL/WebGPU renderer. Hardware-accelerated sprite batching handles hundreds of animated sprites at 60fps. Supports sprite sheets, particle effects, blend modes. |
| **React 19** | UI overlay (lobby, chat, room list, shop) rendered as DOM on top of the PixiJS canvas. Separation of game rendering from UI. |
| **TypeScript** | Type-safe client. Shared protocol definitions and physics constants between client (prediction) and server (authority). |
| **PostgreSQL 16** | ACID transactions for user accounts, items, currency. JSONB for flexible avatar/config storage. Proven at scale. |
| **Redis 7** | Sub-millisecond pub/sub for real-time events, session tokens, matchmaking queues, leaderboard sorted sets. |
| **pnpm monorepo** | Shared packages (protocol types, physics constants) without publish/version overhead. |
| **Docker Compose** | One-command local development environment (DB, Redis, server, client dev server). |

## 5. Game Mechanics (Faithful to GunBound WC S2)

### 5.1 Core Gameplay Loop

1. **Lobby** → Player joins a channel, sees room list
2. **Room** → Player creates/joins a room (1v1 to 4v4), selects mobile and team
3. **Loading** → Server assigns spawn positions on terrain, sends initial state
4. **Turn Phase** → Active player aims (angle 0-360°), sets power (0-100%), chooses shot type
5. **Fire Phase** → Server simulates projectile trajectory with wind, gravity, terrain collision
6. **Damage Phase** → Server calculates damage, terrain destruction, knockback
7. **Next Turn** → Delay system determines next player. Repeat from step 4.
8. **Victory** → Last team standing wins. GP/Gold rewards calculated.

### 5.2 Physics Model (Server-Authoritative)

**Projectile trajectory** (deterministic, fixed-point arithmetic):
- Position update per tick (60 Hz):
  - `x(t+dt) = x(t) + vx * dt`
  - `y(t+dt) = y(t) + vy * dt`
  - `vx(t+dt) = vx(t) + wind_x * dt`
  - `vy(t+dt) = vy(t) + gravity * dt + wind_y * dt`
- Gravity constant: configurable per map (default ~9.8 scaled to pixel space)
- Wind: random direction and magnitude per turn, uniform across the map
- Collision detection: pixel-perfect against terrain bitmask + bounding-box against mobiles

**Terrain destruction:**
- Terrain is a 1-bit alpha mask (same resolution as the visible terrain bitmap)
- Explosion creates a circular hole: all mask pixels within blast radius are cleared
- Mask is authoritative on server; client receives mask delta patches (RLE-encoded circles)

**Damage calculation:**
- Damage = base_damage × distance_falloff(center_to_target) × avatar_modifiers
- Each mobile has distinct damage tables for Shot 1, Shot 2, SS
- SS (Super Shot) requires the SS gauge to be full (fills by dealing/receiving damage)

### 5.3 Delay / Turn Order System

- Each mobile has a base delay value
- After firing, the player's delay counter increases by: `base_delay + shot_delay + avatar_delay_modifier`
- Next turn goes to the player with the lowest accumulated delay
- This creates the "speed vs. power" tradeoff that defines GunBound strategy

### 5.4 Mobile Types (Initial Set — 8 Core Mobiles)

For the development prototype, implement 8 representative mobiles:

| Mobile | Shot 1 | Shot 2 | SS | Archetype |
|--------|--------|--------|-----|-----------|
| Armor | Single shell | 2 shells | Beam | Balanced |
| Mage | Energy bolt | 3 bolts | Meteor | Splash |
| Nak | Bullet | Dual bullets | Lightning | Fast |
| Trico | Bomb | Cluster bomb | Tornado | Area |
| Big Foot | Cannonball | Dual cannon | Earthquake | Heavy |
| Boomer | Boomerang | Dual boomerang | Storm | Curved |
| Raon | Mines | Mine field | Missile rain | Trap |
| Turtle | Missile | Dual missile | Laser | Sniper |

Each mobile: unique sprite sheet, distinct projectile behavior, different delay values, different HP.

### 5.5 Wind System

- Wind magnitude: 0-26 (displayed as wind gauge)
- Wind direction: 0-359° (displayed as arrow)
- Changes randomly each turn
- Affects projectile horizontal and vertical velocity proportionally
- Some projectiles have different wind affinity (e.g., Boomer's boomerang is heavily affected)

### 5.6 Maps / Stages

For prototype, create 3 maps with destructible terrain:
1. **Plains** — flat terrain with gentle hills
2. **Canyon** — deep valleys and high peaks
3. **Island** — floating islands with gaps

Each map: terrain bitmap (visual) + terrain mask (collision/destruction) + background image + spawn positions.

## 6. Networking Protocol

### 6.1 Transport

- **WebSocket** over TLS 1.3 for all client-server communication
- Binary protocol using **Protocol Buffers v3** for serialization
- Message envelope: `[2B length][2B opcode][payload]`

### 6.2 Key Message Types

```
// Authentication
C→S: AuthRequest { token: string }
S→C: AuthResponse { user_id, nickname, stats }

// Lobby
C→S: ChannelJoin { channel_id }
S→C: ChannelState { rooms[], players[] }
C→S: RoomCreate { name, max_players, map_id, mode }
C→S: RoomJoin { room_id }
S→C: RoomState { players[], teams[], ready_states[] }
C→S: SelectMobile { mobile_id }
C→S: ToggleReady {}
C→S: ChatMessage { text }
S→C: ChatBroadcast { sender, text }

// Match
S→C: MatchStart { terrain_data, spawn_positions, wind }
S→C: TurnStart { active_player_id, wind, time_limit }
C→S: FireShot { angle: float32, power: float32, shot_type: u8 }
S→C: ProjectileTrajectory { points[], hit_type, damage[], terrain_delta }
S→C: TurnEnd { player_states[], delay_order[] }
S→C: MatchEnd { winner_team, rewards }
```

### 6.3 Client-Side Prediction

The client performs local trajectory rendering for the active player's shot preview (dotted line), but the authoritative result always comes from the server. If prediction diverges from server result, client snaps to server state.

## 7. Security & Anti-Cheat Architecture

### 7.1 Server-Authoritative Design (Primary Anti-Cheat)

- **All physics, damage, and game state computed server-side**
- Client sends ONLY: angle, power, shot_type
- Server validates: is it this player's turn? Is the angle/power in valid range? Is the shot type available?
- No client-side game state is trusted

### 7.2 Input Validation

- Rate limiting on all inputs (max 1 fire per turn, max chat messages per second)
- Angle: 0.0-360.0, Power: 0.0-100.0, ShotType: 0|1|2
- Any invalid input = turn skip + warning

### 7.3 Anti-Extension / Anti-Tampermonkey Architecture

- **Content Security Policy (CSP)** headers that block inline scripts and unauthorized origins
- **Subresource Integrity (SRI)** on all loaded scripts
- **Canvas fingerprinting** — detect if DOM overlay elements are injected
- **Server-side aim analysis** — statistical detection of perfect-angle patterns over many games (aimbot detection)
- **Future:** WebSocket message signing with session-derived keys; replay analysis pipeline

### 7.4 Authentication

- **JWT** access tokens (15 min expiry) + refresh tokens (7 day, httpOnly cookie)
- Passwords hashed with **Argon2id** (memory=64MB, iterations=3, parallelism=4)
- Rate-limited login attempts (5 per minute per IP)

## 8. Scalability Design

### 8.1 Horizontal Scaling

- Gateway: stateless, horizontally scalable behind a load balancer
- Lobby: sharded by channel (each channel = isolated state)
- Match: each match runs in an isolated goroutine; matches distributed across match-server instances
- NATS JetStream for cross-service communication (match results → lobby, user events)

### 8.2 Capacity Targets

- Single match-server instance: ~500 concurrent matches (1000-4000 players)
- Single gateway instance: ~10,000 concurrent WebSocket connections
- Database: connection pooling via PgBouncer, read replicas for leaderboards

## 9. Asset Pipeline

### 9.1 XFS Extraction (Tool)

A Python tool in `tools/asset-pipeline/` that:
1. Parses the Softnyx NW/XFS container format from `GunBound.xfs`
2. Extracts sprite frames, terrain bitmaps, sound files
3. Generates sprite sheet atlases (TexturePacker-compatible JSON + PNG)
4. Outputs PixiJS-compatible sprite sheet manifests

### 9.2 Placeholder Assets

For initial development, create simple geometric placeholder sprites:
- Colored rectangles for mobiles
- Simple circles for projectiles
- Procedurally generated terrain masks
- These are progressively replaced with extracted/original sprites

## 10. Technology Versions

| Technology | Version | Purpose |
|-----------|---------|---------|
| Go | 1.23+ | Backend services |
| TypeScript | 5.6+ | Client + shared packages |
| Node.js | 22 LTS | Build tooling, dev server |
| PixiJS | 8.x | 2D game rendering |
| React | 19.x | UI overlay |
| Vite | 6.x | Client build/dev |
| PostgreSQL | 16+ | Primary database |
| Redis | 7.4+ | Cache, pub/sub, sessions |
| Protocol Buffers | 3 | Network serialization |
| Docker | 27+ | Containerized deployment |
| pnpm | 9+ | Package manager |

## 11. Out of Scope (Future Phases)

- Full avatar/shop system with real items from original DB
- Guild system
- Grand Prix tournament mode
- Replay system
- Mobile app (PWA wrapper)
- Voice chat integration
- Full extraction of all 20+ original mobiles (phase 1 = 8 mobiles)
- Payment/microtransaction system

