# 🎯 GunBound Web (Edición 2026)

Recreación moderna, ligera y de alto rendimiento de **GunBound Season 2 / Thor's Hammer** para la web moderna (2026). Construido sobre **PixiJS 8** (WebGL2/WebGPU), **React 19**, **TypeScript** y un **Servidor Autoritativo en Go 1.23+**.

---

## 🌟 Características Principales

### 🎮 Física y Balística Autoritativa (Inspirada en Thor's Hammer)
* **Simulación en el Servidor:** La trayectoria, el viento, la gravedad y la colisión son calculados al 100% por el servidor en Go, garantizando partidas deterministas e inmunes a trampas de cliente.
* **Calibración Balística Real:**
  * Escala de fuerza en 4 barras ($v_0 = \text{potencia} \times 0.24$).
  * Gravedad calibrada a $g = 0.42\text{ px/tick}^2$ (a $45^\circ$, un tiro a 4 barras recorre $\approx 1370$ px con $1.35$s de tiempo de vuelo).
  * Viento físico vectorial ($a_x = \text{viento}_x \times 0.0035 \times \text{windFactor}$).
  * Constantes específicas por móvil (e.g. Boomer ultraligero con factor de viento $2.2$ para disparos con gancho; Bigfoot con proyectiles pesados de alta gravedad $g = 0.50$).

### 🚀 Gráficos y Animaciones Originales
* **8 Móviles Auténticos:** `Armor`, `Boomer`, `Turtle`, `Mage`, `BigFoot`, `Nak`, `Raon` y `Trico`.
* **Animaciones Completas Fluidas (27–36 FPS):** Estados de reposo (`normal`), desplazamiento con orugas/patas dinámicas (`move`), carga de tiro con retroalimentación en tiempo real (`bfire`), retroceso de disparo (`fire`/`sfire`), reacción al daño (`fdamage`) y animación de destrucción (`dead`).
* **Arsenal Balístico Completo:** 21 spritesheets de proyectiles y 16 spritesheets de explosiones animadas con transparencias y descompresor de tramas EPA.
* **Números de Daño Flotantes:** Indicadores pop-up estilo arcade (`-250`, `-320`) con animación ascendente y desvanecimiento.

### 🎥 Cámara Cinemática Inteligente
* **Zoom $1.35\times$:** Campo de visión optimizado para resaltar los detalles de los tanques y centrar la acción.
* **Seguimiento Balístico en Tiempo Real:** La cámara sigue suavemente al misil en su arco parabólico por los cielos, enfoca el impacto y la excavación del cráter, y regresa fluidamente al móvil en turno.
* **Alineación con el Terreno:** Los móviles calculan la pendiente y se inclinan dinámicamente según las colinas y cráteres excavados.

### 🕹️ Modos de Juego y Sala
* **Modo Práctica / Prueba en Solitario:** Permite a un jugador único disparar infinitamente sin bloqueos de pantalla ni fin de partida; el temporizador de 30s y los controles se reinician automáticamente tras cada disparo.
* **Sistema de Salas y Lobby:** Selector de salas, chat en tiempo real, equipos (Team A vs Team B) y turnos ordenados por *Delay*.

---

## 🏗️ Arquitectura del Proyecto

```
Gumbound_Web-2026/
├── apps/
│   ├── client/                  # Cliente Web Frontend
│   │   ├── public/sprites/      # Spritesheets oficiales (mobiles, bullets, explodes)
│   │   ├── src/
│   │   │   ├── game/            # Motor de juego PixiJS 8 (Game, Mobile, Projectile, Terrain, Camera)
│   │   │   ├── network/         # Conexión WebSocket y protocolo binario
│   │   │   └── ui/              # Interfaz React 19 + Zustand (Login, Lobby, Room, MatchHUD)
│   └── server/                  # Servidor de Juego en Go
│       ├── cmd/                 # Punto de entrada
│       └── internal/
│           ├── auth/            # Autenticación JWT y hash Argon2id
│           ├── gateway/         # Gateway WebSocket y serialización de mensajes
│           ├── lobby/           # Gestor de canales, salas y chat
│           ├── match/           # Motor de partida, gestión de turnos por delay y stats
│           └── physics/         # Simulación balística determinista y TerrainMask
└── packages/
    └── shared/                  # Opcodes, DTOs y tipos compartidos en TypeScript
```

---

## ⚡ Guía de Inicio Rápido (Local)

### Requisitos Previos
* **Node.js** v20+ y **pnpm** v9+
* **Go** 1.23+

### 1. Clonar el Repositorio
```bash
git clone https://github.com/pokehub1991/Gumbound_Web-2026.git
cd Gumbound_Web-2026
```

### 2. Instalar Dependencias y Compilar
```bash
# Instalar dependencias del monorepo
pnpm install

# Compilar paquetes compartidos y cliente
pnpm -r build
```

### 3. Iniciar el Servidor de Juego (Go)
```bash
cd apps/server
go run main.go
# El servidor iniciará en http://localhost:8080 (WebSocket en /ws)
```

### 4. Iniciar el Cliente Web (Frontend)
En otra terminal:
```bash
cd apps/client
pnpm dev --port 3000
# Abrir en el navegador: http://localhost:3000
```

---

## 👤 Cuentas de Prueba Preconfiguradas

El servidor inicializa automáticamente las siguientes cuentas de prueba:

| Usuario | Contraseña | Rol |
| :--- | :--- | :--- |
| `player1` | `123456` | Jugador Estándar |
| `player2` | `123456` | Jugador Estándar |
| `admin` | `admin123` | Administrador |

*(También puedes registrar nuevas cuentas directamente desde la pantalla de Login).*

---

## 🎮 Controles en Batalla

| Tecla / Acción | Función |
| :--- | :--- |
| **`A` / `D`** o **`Flechas Izq / Der`** | Desplazarse por el terreno (adapta inclinación y gasta delay) |
| **`W` / `S`** o **`Flechas Arriba / Abajo`** | Ajustar ángulo de tiro |
| **`Barra Espaciadora` (Mantener)** | Cargar barra de potencia (escala de 4 barras, ~3.7 segundos al 100%) |
| **`1`** | Seleccionar **Tiro 1** |
| **`2`** | Seleccionar **Tiro 2** |
| **`3`** | Seleccionar **Super Shot (SS)** |
| **Botón `Salir al Lobby`** | Regresar al menú de salas para cambiar de móvil |

---

## 🗺️ Hoja de Ruta (Roadmap)

- [x] Física autoritativa en Go basada en ingeniería inversa de Thor's Hammer (`colemancda/GunBound-Decomp`).
- [x] Sprites originales de 8 móviles, proyectiles y explosiones con definición EPA.
- [x] Cámara con zoom $1.35\times$ y seguimiento cinemático de disparos.
- [x] Modo de disparo continuo en solitario para pruebas de puntería y daño.
- [ ] **Sincronización Multijugador 4v4:** Partidas multijugador con servidores de relevo y sincronización de espectadores.
- [ ] **Ítems Clásicos de Batalla:** Implementar Dual, Dual+, Teleport, Change Wind y Bunge Shot.
- [ ] **Eventos de Clima / Satélites:** Thor satelital, Rayo eléctrico, Vórtice Tornado, Portal Force y Niebla.
- [ ] **Efectos de Sonido y Música:** Integrar el extractor de audio `.xes` y los 85 sonidos originales de armas y UI.
- [ ] **Tienda y Sistema de Avatares:** Compra y equipamiento de avatares con bonificaciones de stats (Cabeza, Cuerpo, Gafas, Bandera).

---

## 📄 Licencia
Este proyecto es una recreación educativa y de código abierto sin fines de lucro para preservar la arquitectura y el legado técnico del juego original. Los nombres, sonidos y recursos gráficos son propiedad intelectual de Softnyx Co., Ltd.
