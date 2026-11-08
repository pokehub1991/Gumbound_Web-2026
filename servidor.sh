#!/usr/bin/env bash
# ==============================================================================
# Gumbound Web 2026 - Control de Servidores (macOS / Linux)
# Inicia y detiene el Backend en Go (:8080) y el Frontend en Vite (:3000)
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

check_port() {
  lsof -ti :"$1" >/dev/null 2>&1
}

stop_servers() {
  echo ""
  echo "🛑 Deteniendo servidores de Gumbound..."
  
  # Detener puerto 8080 (Go)
  P8080=$(lsof -ti :8080 2>/dev/null)
  if [ -n "$P8080" ]; then
    kill -9 $P8080 2>/dev/null
    echo "  [OK] Backend Go en puerto 8080 detenido."
  fi

  # Detener puerto 3000 (Vite)
  P3000=$(lsof -ti :3000 2>/dev/null)
  if [ -n "$P3000" ]; then
    kill -9 $P3000 2>/dev/null
    echo "  [OK] Cliente Vite en puerto 3000 detenido."
  fi

  sleep 1
  if ! check_port 8080 && ! check_port 3000; then
    echo "  [OK] Todos los servidores han sido detenidos correctamente."
  else
    echo "  [!] Advertencia: algunos procesos aún pueden estar activos."
  fi
}

start_servers() {
  echo ""
  echo "🚀 Iniciando servidores de Gumbound Web 2026..."

  # 1. Backend Go (:8080)
  if ! check_port 8080; then
    echo "  [*] Compilando y levantando Backend Go en puerto 8080..."
    (cd "$ROOT_DIR/apps/server" && nohup go run main.go < /dev/null > /tmp/gumbound_backend.log 2>&1 &)
  else
    echo "  [i] El Backend Go ya está activo en el puerto 8080."
  fi

  # 2. Cliente Vite (:3000)
  if ! check_port 3000; then
    echo "  [*] Levantando Cliente Web en puerto 3000..."
    (cd "$ROOT_DIR/apps/client" && nohup ./node_modules/.bin/vite --port 3000 < /dev/null > /tmp/gumbound_client.log 2>&1 &)
  else
    echo "  [i] El Cliente Web ya está activo en el puerto 3000."
  fi

  # 3. Esperar confirmación
  echo "  [*] Verificando inicio de servicios..."
  for i in {1..10}; do
    sleep 1
    if check_port 8080 && check_port 3000; then
      break
    fi
  done

  echo ""
  if check_port 8080 && check_port 3000; then
    echo "========================================================="
    echo "  🎉 SERVIDORES INICIADOS EXITOSAMENTE"
    echo "========================================================="
    echo "  * Cliente Web:  http://localhost:3000"
    echo "  * Backend Go:   http://localhost:8080 (WS: /ws)"
    echo "========================================================="
  else
    echo "  [!] Advertencia en el arranque:"
    if check_port 8080; then echo "  - Backend (:8080): Activo"; else echo "  - Backend (:8080): No respondió aún (ver /tmp/gumbound_backend.log)"; fi
    if check_port 3000; then echo "  - Cliente (:3000): Activo"; else echo "  - Cliente (:3000): No respondió aún (ver /tmp/gumbound_client.log)"; fi
  fi
}

show_status() {
  echo ""
  echo "📊 Estado de los puertos:"
  if check_port 8080; then
    echo "  - Backend (:8080): ACTIVO (PID: $(lsof -ti :8080 | tr '\n' ' '))"
  else
    echo "  - Backend (:8080): INACTIVO"
  fi
  if check_port 3000; then
    echo "  - Cliente (:3000): ACTIVO (PID: $(lsof -ti :3000 | tr '\n' ' '))"
  else
    echo "  - Cliente (:3000): INACTIVO"
  fi
}

# Si se pasa argumento directamente por consola
case "$1" in
  start)
    start_servers
    exit 0
    ;;
  stop)
    stop_servers
    exit 0
    ;;
  restart)
    stop_servers
    start_servers
    exit 0
    ;;
  status)
    show_status
    exit 0
    ;;
esac

# Menú interactivo si no se pasaron argumentos
while true; do
  echo ""
  echo "========================================================="
  echo "   Gumbound Web 2026 - Administrador de Servidores (Mac)"
  echo "========================================================="
  echo "  1. Iniciar servidores (Backend :8080 + Cliente :3000)"
  echo "  2. Detener servidores"
  echo "  3. Reiniciar servidores"
  echo "  4. Ver estado de servidores"
  echo "  5. Salir"
  echo "========================================================="
  read -p "  Selecciona una opción [1-5]: " OPTION
  case "$OPTION" in
    1) start_servers ;;
    2) stop_servers ;;
    3) stop_servers; start_servers ;;
    4) show_status ;;
    5) echo "Hasta luego."; exit 0 ;;
    *) echo "Opción no válida." ;;
  esac
done
