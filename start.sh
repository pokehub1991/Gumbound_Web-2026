#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Arrancando Gumbound Web 2026 ==="

# Detener instancias previas
pkill -f "gumbound_server" || true
pkill -f "vite.*3000" || true

# Compilar servidor Go
echo "[1/3] Compilando servidor Go..."
cd "$DIR/apps/server"
go build -o gumbound_server main.go

# Iniciar servidor Go en segundo plano (puerto 8080)
echo "[2/3] Iniciando Backend & WebSockets (:8080)..."
nohup ./gumbound_server > /tmp/gumbound_server.log 2>&1 &

# Iniciar Vite dev server en segundo plano (puerto 3000)
echo "[3/3] Iniciando Cliente Web Vite (:3000)..."
cd "$DIR/apps/client"
nohup node ../../node_modules/.pnpm/vite@6.4.5/node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000 < /dev/null > /tmp/gumbound_client.log 2>&1 &

sleep 2
echo "=== Servidores Activos ==="
echo "Cliente Web:  http://localhost:3000"
echo "Servidor Go:  http://localhost:8080 (WS: /ws)"

