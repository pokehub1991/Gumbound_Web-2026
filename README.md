# 🎯 GunBound Web (Edición 2026)

Recreación moderna, ligera y de alto rendimiento de **GunBound** / **DragonBound** para navegadores modernos (2026), construida con **PixiJS 8** (WebGL2/WebGPU), **React 19**, **TypeScript** y un **Servidor Autoritativo en Go**.

---

## ⚡ Resumen Rápido del Proyecto

Este proyecto es una reconstrucción fiel desde cero del clásico juego de combate balístico por turnos, unificando los sprites originales, dinámicas de disparo, deformación de terreno por píxeles y animaciones completas con tecnologías web de vanguardia.

### 🎮 Tecnologías Principales:
* **Frontend:** React 19 + TypeScript + PixiJS 8 (Renderizado por hardware WebGL2/WebGPU con antialiasing).
* **Física y Balística:** Motor determinista de cálculo de trayectorias, vector de viento, gravedad ($g = 0.42$) y colisión píxel a píxel.
* **Terreno Dinámico:** Renderizado sobre canvas con máscaras alfa (`destination-out`), cálculo de pendientes a 19 píxeles y excavación de cráteres con bordes quemados.
* **Servidor:** Go 1.23+ con arquitectura de microservicios y sincronización en tiempo real vía WebSockets.

---

## 🌟 Características Implementadas

### 1. 🚜 25 Móviles Canónicos con Spritesheets Originales
* Soporte para los 25 móviles clásicos: **Armor, Boomer, Turtle, Mage, Bigfoot, Nak, Raon, Trico, Ice, Aduka, Lightning, ASate, Knight, Fox, Dragon, Grub, Frog, Kalsiddon, Maya, Phoenix, etc.**
* **Animaciones Completas EPA:**
  * Respiración en reposo suave (`wnormal`).
  * Desplazamiento dinámico (`move` / `wmove`).
  * Preparación y carga de disparo (`bfire` / `bsfire`).
  * Retroceso de disparo sincronizado con el lanzamiento (`fire1`, `fire2`, `sfire`).
  * Física aérea y animación natural de caída al salir de riscos o precipicios (`drop`).
  * Reacción al impacto frontal y posterior (`fdamage` / `bdamage`).
  * Destrucción / K.O. (`dead`).

### 2. 🎯 Balística Avanzada y Mecánicas Especiales
* **Armor:**
  * **S1:** Proyectil penetrante concentrado.
  * **S2:** Misil pesado de alta demolición y bunge.
  * **SS:** Misil que al superar $1540\text{ ms}$ de vuelo ejecuta una pausa dramática en el aire, despliega sus hélices/alas mecánicas con sonido característico y continúa en vuelo acelerado con daño masivo ($580+$ HP) y cráter gigante.
* **BigFoot:** Salvas múltiples escalonadas (4 misiles en S1, 6 en S2 y 8 en SS).
* **Mage y Turtle:** Disparos procedimentales trenzados sinusoidales y bombas temporizadas de 4 fases con reconvergencia.
* **Trico:** 3 coles rotativas con dispersión angular y convergencia en ápice.
* **Aduka y ASate:** Rastreadores balísticos y rayos orbitales de satélite Thor/Iónico desde la estratosfera.
* **Nak:** Misil subterráneo que excava el terreno.
* **Raon:** Minas caminantes autónomas con IA de proximidad.

### 3. 🗺️ Terreno y Cámara Cinemática
* **Mapa Meta Mine Clásico:** Puente desértico con colisión limpia; se eliminaron las colisiones fantasma en cables aéreos para permitir tiros altos limpios.
* **Cámara de Tiros Altos:** Las balas pueden salir de la pantalla por la parte superior. La cámara se mantiene contenida en el límite superior del fondo escénico mientras sigue fluidamente el eje horizontal ($X$) de la bala, y se re-centra en vertical ($Y$) cuando el proyectil desciende hacia el impacto.
* **Modo Panorámico:** Arrastre libre con clic derecho sosteniendo el ratón, con cursor guantelete personalizado de alta definición.
* **Sistema de Zoom Preset:** Botones rápidos de escala `1x`, `1.2x` y `1.4x` para acercar la acción.

### 4. 🎛️ HUD Moderno y Compacto
* **Botones de Tiro Compactos:** Botones **S1**, **S2** y **SS** estilizados con colores temáticos e iluminación de selección.
* **Selector Rápido de Móvil:** Botón píldora con icono de tanque que permite cambiar entre los 25 móviles al instante.
* **Barra de Potencia 60 FPS:** Barra de tiro de ancho completo con sensibilidad clásica, medidor numérico y marcador de memoria del último tiro.
* **Goniómetro / Transportador:** Sector angular en verde GunBound y aguja roja orientada al pivote del cañón, renderizada detrás del chasis para no tapar el móvil en pendientes.

---

## 📁 Estructura del Código

```
Gumbound-2026/
├── apps/
│   ├── client/                      # Cliente Frontend React + PixiJS
│   │   ├── public/
│   │   │   ├── audio/               # Efectos de sonido y BGM oficiales
│   │   │   ├── maps/metamine/       # Texturas de fondo y máscara de terreno
│   │   │   └── sprites/             # Sprites de móviles, proyectiles y explosiones
│   │   └── src/
│   │       ├── core/                # Motor de Juego Refactorizado y Limpio
│   │       │   ├── animation/       # Gestores de sprites EPA (MobileSpriteManager, ProjectileSpriteManager)
│   │       │   ├── audio/           # AudioManager para efectos y música
│   │       │   ├── combat/          # CombatArena, BotDummy
│   │       │   ├── constants/       # MOBILES_DATA, mapas, definiciones JSON
│   │       │   ├── controls/        # AimController (teclado, disparo, inclinación)
│   │       │   ├── effects/         # DestructionParticles (rocas, chispas, polvo)
│   │       │   ├── engine/          # GameEngine (Pixi App, cámara, parallax, zoom, screen shake)
│   │       │   ├── entities/        # MobileEntity, ProjectileEntity
│   │       │   ├── physics/         # BallisticsEngine (simulación de proyectiles)
│   │       │   └── terrain/         # TerrainRenderer, TerrainMask (destrucción de terreno)
│   │       └── ui/                  # Componentes React (ArenaScreen, MobileSelector, HUD)
│   └── server/                      # Servidor Autoritativo en Go
│       ├── cmd/server/              # Punto de entrada
│       └── internal/                # Lógica de juego, física y salas
└── packages/
    └── shared/                      # Tipos compartidos
```

---

## 🚀 Cómo Ejecutar el Proyecto (Para Continuar Mañana)

### 1. Iniciar el Cliente Web:
```bash
# En la raíz del proyecto
pnpm install
pnpm --filter client dev
```
Abre en tu navegador: [http://localhost:3000](http://localhost:3000)

### 2. Iniciar el Servidor Go (Opcional para multijugador):
```bash
cd apps/server
go run ./cmd/server
```
Servidor activo en: [http://localhost:8080](http://localhost:8080)

### 3. Compilar para Producción / Validar Código:
```bash
pnpm --filter client build
```

---

## 📌 Próximos Pasos para Mañana
1. **Lobby y Salas Multijugador:** Conectar el cliente con los sockets del servidor Go para matchmaking y partidas 1v1 y 2v2.
2. **Sistema de Turnos y Delay:** Implementar la barra lateral de orden de turnos según el delay acumulado de cada móvil y tiro utilizado.
3. **Mapas Adicionales:** Incorporar mapas clásicos como Miramo Town, Sea of Hero, Nirvana y Cozy Tower con sus máscaras de colisión.
4. **Ítems Clásicos:** Dual, Dual+, Teleport, Energy Bunge y Blood.

---
*Desarrollado para la comunidad de GunBound.*
