# Gumbound Web 2026

Modern, high-performance web recreation of GunBound Season 2 (GBWC).

## Architecture
- **Client**: PixiJS 8 (WebGL2/WebGPU) + React 19 + TypeScript + Vite.
- **Server**: Go (WebSocket Gateway, Turn-based Match Engine, Authoritative Physics).
- **Protocol**: Binary WebSocket envelope `[2B len][2B opcode][payload]`.
- **Database**: PostgreSQL 16 + Redis 7.

## Quick Start
```bash
# 1. Install frontend dependencies and build
pnpm install
pnpm -r build

# 2. Run Go server
cd apps/server
go run main.go

# 3. Run Web client
pnpm dev
```
