# Auditoría Exhaustiva de GameServer (DragonBound / GunBound Classic)
> **Documento Técnico de Referencia de Físicas, Balística, Viento, Animaciones, Colisiones y Mapas**  
> *Generado para el proyecto Gumbound-2026 a partir del análisis del código fuente de GameServer.*

---

## 1. Arquitectura General del Sistema

El ecosistema analizado de **GameServer** consta de dos componentes principales:
1. **GameServer Backend (NodeJS / WebSocket)**:
   - `GameServer/game/game.js`: Control de salas, turnos, retrasos (`delay`), viento, clima (Thor, Lightning, Vortex, etc.) y spawn de proyectiles.
   - `GameServer/game/world.js`: Motor de simulación física paso a paso (`run()`, `update()`), detección de impactos, bunge, cálculos de daño y sustracción de terreno.
   - `GameServer/game/lib/shoot.js`: Clase que encapsula la cinemática de cada proyectil individual, masa, gravedad, bounding boxes y trayectorias.
   - `GameServer/game/lib/map.js`: Parser de máscaras de colisión PNG (`map0.png` a `map49.png`), cálculo de pendiente angular y agujeros en el terreno.
   - `GameServer/game/gametypes.js`: Diccionario maestro de móviles, balas, explosiones, códigos de operación y constantes de daño.
2. **Frontend Web (HTML5 Canvas / WebGL / PixiJS / CSS)**:
   - `GameServer/web/public_html/data/js/1023989.js`: Motor cliente con `ZotataPhysics`, `Shot2`, `AnimatedSprite`, `CGround`, `CPlayer` y sistema de estelas (`trace`).
   - `GameServer/web/public_html/data/images/`: Spritesheets oficiales de móviles (formato EPA 2D), balas (`bullets/`), explosiones (`explodes/`), avatares (`ava/`) y mapas (`maps/`).

---

## 2. Físicas del Viento, Balística y Matemáticas

### 2.1. Conversión de Potencia
En la interfaz del usuario, la barra de tiro se mide en porcentaje (0 a 100). En el momento del disparo, el servidor y el cliente escalan la potencia mediante un factor constante:
```javascript
// Factor de escala de potencia
power = parseInt(power * 234 / 100);
```
Para un tiro al 100%, la velocidad inicial resultante es `power = 234`. En tiros con medidor ampliado de hasta 400 unidades, la velocidad inicial escala proporcionalmente.

---

### 2.2. Descomposición del Viento y Aceleraciones (`ax`, `ay`)
Cada móvil posee dos constantes gravitatorias y aerodinámicas en `Types.MOBILES`:
- `by`: Gravedad vertical base (ejemplo: Armor = 398, Boomer = 244, Mage = 360, Turtle = 389, Bigfoot = 396).
- `bx`: Factor de fricción horizontal (normalmente 0 en móviles estándar).

Cuando existe viento en la partida (`wind_power` > 0 y `wind_angle` en grados):
```javascript
var rad = self.wind_angle * Math.PI / 180;

// Componente horizontal del viento:
var b0 = Math.round(parseInt(Math.cos(rad) * self.wind_power * mobile_data.by)) / 100;

// Componente vertical del viento:
var b1 = Math.round(parseInt(Math.sin(rad) * self.wind_power * mobile_data.by - mobile_data.bx)) / 100;

// Aceleraciones netas aplicadas al proyectil:
var ax = Math.round(0 - b0);           // Aceleración horizontal (empuje del viento)
var ay = Math.round(mobile_data.by - b1); // Aceleración vertical (gravedad menos empuje vertical)

// Si el viento está en calma (0 fuerza):
if (self.wind_power === 0) {
    ax = 0;
    ay = mobile_data.by;
}
```

> **Nota Clave**: 
> Un viento a favor acelera horizontalmente (`ax`). Un viento hacia arriba reduce la aceleración vertical neta (`ay = by - b1`), haciendo que la bala flote y llegue mucho más lejos (comportamiento clásico de Boomer y móviles livianos).

---

### 2.3. Muzzle Offset y Ángulo de Salida
Antes de salir, el ángulo y el punto de disparo se ajustan según la orientación del móvil (`look`), la inclinación del terreno (`body`) y la altura del cañón:
```javascript
var dis = 0;
if (look === 0) { // Mirando hacia la izquierda
    ang = 180 - ang;
    dis = (account.player.mobile === Types.MOBILE.ADUKA) ? 26 : -11;
} else {          // Mirando hacia la derecha
    dis = (account.player.mobile === Types.MOBILE.ADUKA) ? -26 : 11;
}

// Resta el ángulo de inclinación del terreno bajo el móvil:
ang -= body;

var point = {
    x: x + dis,
    y: (account.player.mobile === Types.MOBILE.ADUKA) ? y - 31 : y - 28
};

// Rotación del punto de salida alrededor del centro del móvil según la pendiente:
var pfinal = self.rotatePoint(point, { x: x, y: y }, body);
```

---

### 2.4. Ecuaciones de Movimiento Cuadráticas (`ZotataPhysics`)
En el cliente y servidor, la posición en cualquier milisegundo `time` se calcula analíticamente:
```javascript
// Velocidades iniciales descompuestas:
var vx = Math.cos(ang * Math.PI / 180) * power;
var vy = -Math.sin(ang * Math.PI / 180) * power;

// Tiempo transcurrido en segundos:
var p = time / 1000; // o time / 485 según la escala del tick del servidor

// Posición cinemática:
var x = x0 + vx * p + (ax * p * p) / 2;
var y = y0 + vy * p + (ay * p * p) / 2;

// Ángulo tangente de rotación del proyectil:
var prev_p = p - 0.005;
var prev_x = x0 + vx * prev_p + (ax * prev_p * prev_p) / 2;
var prev_y = y0 + vy * prev_p + (ay * prev_p * prev_p) / 2;
var tangentAngle = Math.atan2(y - prev_y, x - prev_x) * 180 / Math.PI;
```

---

## 3. Físicas Especiales por Móvil

### 3.1. Mage (Mago)
- **Tiro 1 (`MAGE1`)**:
  - Proyectil simple con estela cónica (`trace: 8, traceY: 32, traceH: 16, traceTime: 500`).
  - Velocidad y trayectoria balística estándar.
- **Tiro 2 (`MAGE2A` y `MAGE2B`)**:
  - Dos balas disparadas simultáneamente con onda sinusoidal perpendicular (`wave = 1` y `wave = 2`).
  - Función de onda:
    ```javascript
    dist = 15 * Math.sin(t / 60);
    offsetAngle = -tangentAngle + (wave === 1 ? 90 : -90);
    posWave = CalcOrbitPoint(pos.x, pos.y, dist, offsetAngle);
    ```
  - Ambas balas se cruzan rítmicamente en el aire y dejan dos estelas complementarias (`trace: 16, traceTime: 500`).
- **SS (`MAGESS`)**:
  - Bola de fuego mística que gira sobre su propio eje.
  - Velocidad angular moderada (en `1023989.js` y `Projectile.ts`: factor `0.12`).
  - Causa 400 + total_attack de daño en impacto directo.

---

### 3.2. Turtle (Tortuga)
- **Tiro 1 (`TURTLE1`)**:
  - Bala de agua/vapor con estela ancha (`trace: 8, traceH: 32, traceTime: 800, traceAlter: 8`).
- **Tiro 2 (`TURTLE2A` y `TURTLE2B`) - TimeBomb**:
  - Ondas de separación temporal (`wave = 3` y `wave = 4`):
    ```javascript
    offsetAngle = -tangentAngle + (wave === 3 ? 90 : -90);
    if (t < 400) {
        // Fase 1: Separación inicial gradual
        dist = (t / 400) * 25;
    } else if (t < 2200) {
        // Fase 2: Oscilación abierta en paralelo
        dist = 25 * Math.cos((t - 400) / 95);
    } else if (t < 2600) {
        // Fase 3: Reconvergencia hacia el centro
        dist = 25 - ((t - 2200) / 400) * 22;
    } else {
        // Fase 4: Impacto unificado (dist = 3)
        dist = 3;
    }
    ```
- **SS (`TURTLESS` -> `TURTLESS2`)**:
  - Disparo de proyectil con forma de caparazón cerrado (`turtleSSclose.png`).
  - En `t >= 1540 ms`, se abre en el aire transformándose en `turtleSSopen.png` (`Types.BULLETS.TURTLESS2 = 49`), duplicando su radio de bunge y daño.

---

### 3.3. Armor (Tanque Blindado)
- **Tiro 1 (`ARMOR1`)**: Misil penetrante simple (150 daño, pala_bunge = 43).
- **Tiro 2 (`ARMOR2`)**: Doble misil consecutivo (153 daño cada uno, retardos desfasados).
- **SS (`ARMORSS` -> `ARMORSS2`) - Misil en 2 Fases**:
  - **Fase 1 (Disparo)**: Misil cerrado (`armorSS.png`, id 2).
  - **Fase 2 (Apertura en el aire)**: Al alcanzar `t = 1540 ms`, el servidor y cliente activan el evento `change`:
    ```javascript
    change: {
        at: 1540,          // milisegundos de vuelo requeridos
        img: 3,            // Types.BULLETS.ARMORSS2 (armorSSopen.png)
        exp: 2             // Types.EXPLODE.ARMORSS
    }
    ```
  - **Mecánica de Daño**: Si el misil impacta antes de los 1540 ms (fase cerrada), produce daño bajo (~200); si impacta abierto tras armarse, causa daño devastador (400 a 560+ daño y cráter de 80x60 px).

---

### 3.4. Bigfoot
- **Físicas y Peso**: Móvil pesado (`by = 396`, `ax = 88`, `ay = 0.74`).
- **Tiro 2 (Racimo de 6 Misiles)**:
  - Físicas de racimo en doble columna con 6 proyectiles desfasados en tiempo y ángulo:
    ```javascript
    // Columna 1 (t = 0 ms):
    shoot[0]: ang,       power
    shoot[1]: ang + 5,   power + 15
    shoot[2]: ang + 10,  power + 30

    // Columna 2 (t = 100 ms):
    shoot[3]: ang,       power
    shoot[4]: ang + 5,   power + 15
    shoot[5]: ang + 10,  power + 30
    ```
  - Daño por bala: 70 + ataque. Si impactan las 6, daño total > 420.
- **SS (Bombardeo Concentrado)**:
  - Reducido a 15 proyectiles en abanico denso (`stagger = 35 ms`).
  - Corrección de red: la trama del protocolo binario fue actualizada a un prefijo de longitud de 32 bits (`uint32`), permitiendo paquetes de más de 65 KB sin truncamiento de JSON.

---

### 3.5. Raon Launcher
- **Tiro 1 (`RAON1`)**:
  - 2 orbes que vuelan entrelazados como una doble hélice de ADN (`wave = 1` y `wave = 2`).
  - Animación con sprite de 40 fotogramas (`raon1.png`) que rotan mostrando el pulso eléctrico y dejan eco de estela.
- **Tiro 2 (`RAON2` y `RAONMINE`) - Minas Caminantes**:
  - El cañón lanza 2 proyectiles cilíndricos (`raon2.png`).
  - Al hacer contacto con el suelo, no explotan: se convierten en `raonmine.png` en estado `normal` (idle).
  - Tienen su propio ciclo de IA / búsqueda:
    1. Si detectan un enemigo en un radio de ~300 píxeles, pasan al estado `move`.
    2. Caminan sobre el contorno del terreno usando `GetPosForWalking` (hasta 10px de desnivel por paso).
    3. Al tocar al enemigo o alcanzar el tiempo límite, detonan causando 100 + ataque cada una.
- **SS (`RAONSS` y `RAONSS_WALKER`) - Baby Raon Caminante**:
  - Dispara un robot andante que desciende con retrocohete.
  - Al aterrizar, despliega patas mecánicas con sonido continuo de marcha (`AUDIO_RAON_WALKER = "71move"`).
  - Camina hacia el enemigo más cercano y detona con radio destructivo masivo (400 daño).

---

## 4. Sistema de Estelas ("Estela / Trail") Original

En GunBound / DragonBound, las estelas de **Mage** y **Turtle** no son líneas geométricas simples ni esferas, sino un encadenamiento de divs / sprites rectangulares con textura mapeada que se deforman siguiendo la curvatura de la trayectoria:

```javascript
BULLET[BULLETS.MAGE1] = {
    file: "mage1",
    trace: 8,          // 8 segmentos en el rastro
    traceY: 32,        // Coordenada Y en la textura de la estela
    traceH: 16,        // Altura del segmento
    traceTime: 500,    // Duración total de persistencia (500 ms)
    sound: AUDIO_MAGE_FIRE
};

BULLET[BULLETS.MAGE2A] = {
    file: "mage2a",
    trace: 16,         // 16 segmentos
    traceY: 0,
    traceH: 16,
    traceTime: 500,
    sound: AUDIO_MAGE_FIRE
};

BULLET[BULLETS.TURTLE1] = {
    file: "turtle12a",
    trace: 8,
    traceY: 0,
    traceH: 32,
    traceTime: 800,    // 800 ms de persistencia
    traceAlter: 8,     // Variación de fotograma de la estela
    sound: AUDIO_TURTLE_FIRE
};
```

### Algoritmo de Deformación de la Estela:
```javascript
// Para cada segmento m desde 0 hasta trace_divs.length - 1:
var e = b.traceTime / this.trace_divs.length;
var h = 256 / this.trace_divs.length;
var n = currentTime - m * e;

var p = this.GetPosAtTime(n);       // Posición en la cabeza del segmento
var f = this.GetPosAtTime(n - e);   // Posición en la cola del segmento
var dist = Dist2Points(p.x, p.y, f.x, f.y); // Longitud real

// Deformación visual:
segment.scaleX = dist / h;                 // Estiramiento longitudinal
segment.scaleY = (1 - (m / trace_divs.length) * 0.7); // Disminución de grosor hacia la cola
segment.rotation = AngleBetween(p, f);     // Alineación tangente perfecta
```
El resultado visual es una cabeza redondeada brillante y una cola cónica que se afina suavemente hasta desvanecerse en el aire.

---

## 5. Sistema de Terreno, Colisiones y Bunge

### 5.1. Detección de Colisiones Pixel-Perfect
El terreno de cada mapa se almacena como un mapa de bits RGBA (en el servidor derivado de `mapX.png` y en el cliente decodificado de cadenas RLE):
```javascript
IsPixel: function (x, y) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return false;
    // Canal Alpha > 0 indica que hay tierra sólida
    return (this.data[4 * (y * this.w + x) + 3] > 0);
}
```

---

### 5.2. Cálculo de la Pendiente del Terreno (`GetAngle`)
Para orientar los móviles según las colinas del mapa, se toma una muestra transversal de 19 píxeles centrada en el móvil:
```javascript
GetAngle: function (a, b) {
    if (this.IsPixel(a, b)) return 0;
    var c = this.GetUnder(a, b, 5);
    if (c === undefined || c !== b) return 0;

    var sumLeft = c, countLeft = 1;
    var sumRight = c, countRight = 1;

    for (var k = 1; k <= 9; k++) {
        var underL = this.GetUnder(a - k, b - 5, 20);
        if (underL !== undefined) { sumLeft += underL; countLeft++; }
        var underR = this.GetUnder(a + k, b - 5, 20);
        if (underR !== undefined) { sumRight += underR; countRight++; }
    }

    var avgLeft = countLeft > 0 ? sumLeft / countLeft : b;
    var avgRight = countRight > 0 ? sumRight / countRight : b;

    // Ángulo en grados de la pendiente:
    return Math.round(RadToAngle(Math.atan2(avgRight - avgLeft, 19)));
}
```

---

### 5.3. Navegación y Caminata (`GetPosForWalking`)
Cuando un móvil avanza hacia la izquierda o derecha:
```javascript
GetPosForWalking: function (x, y, dir) {
    var targetX = (dir === 0) ? x - 1 : x + 1;
    if (targetX < 0 || targetX >= this.w) return { x: x, y: y, stuck: true };

    // Si hay tierra en el píxel de destino (subida):
    if (this.IsPixel(targetX, y)) {
        // Puede subir una cuesta de hasta 10 píxeles de desnivel:
        for (var stepY = y; stepY > y - 10; stepY--) {
            if (!this.IsPixel(targetX, stepY)) {
                return { x: targetX, y: stepY };
            }
        }
        // Si el muro tiene más de 10 píxeles verticales, se atasca:
        return { x: x, y: y, stuck: true };
    }

    // Si hay aire en el píxel de destino (bajada):
    for (var fallY = y + 1; fallY < this.h; fallY++) {
        if (this.IsPixel(targetX, fallY)) {
            return { x: targetX, y: fallY - 1 };
        }
    }

    // Si no encuentra tierra abajo, cae al vacío (muerte por bunge):
    return { x: targetX, y: this.h + 100, fall_and_die: true };
}
```

---

### 5.4. Destrucción de Terreno (`AddGroundHole`)
Cada bala excava un cráter elíptico en la máscara de píxeles:
```javascript
AddGroundHole: function (a, b, radiusX, radiusY) {
    var m = radiusX * radiusX;
    var n = radiusY * radiusY;

    for (var e = a - radiusX - 10; e <= a; e++) {
        for (var c = b - radiusY - 10; c < b; c++) {
            var f = e - a;
            var h = c - b;
            var k = (f * f) / m + (h * h) / n;

            // Borde de sombra (volumen 3D del cráter):
            if (k < 1.2 && k >= 1.0) {
                this.AddGroundShadowColumn(e, c, b - h);
                if (f !== 0) this.AddGroundShadowColumn(a - f, c, b - h);
            } 
            // Vaciado total de tierra:
            else if (k < 1.0) {
                this.AddGroundHoleColumn(e, c, b - h);
                if (f !== 0) this.AddGroundHoleColumn(a - f, c, b - h);
                break;
            }
        }
    }
}
```

---

## 6. Estructura y Composición de los Mapas

Los mapas de GunBound / DragonBound están compuestos por 4 capas:
1. **Fondo Escénico (`_bg.jpg`)**:
   - Resolución estándar: 1000x1000 o 1300x1000 píxeles.
   - Efecto Parallax con scroll suave según la posición de la cámara.
2. **Terreno Visual (`_fg.jpg`)**:
   - Imagen fotorrealista que representa el suelo (roca, césped, hielo, metal).
   - Dimensiones idénticas a la máscara de colisión (ej. 1766x456 px en Miramo Town).
3. **Máscara de Colisión (`mapX.png` / RLE string)**:
   - Archivo PNG de 1-bit / 8-bit Alpha donde los píxeles opacos (`Alpha > 0`) representan suelo sólido destructible.
4. **Archivo de Definición y Metadatos**:
   - Dimensiones (`w`, `h`).
   - Puntos de spawn de los jugadores.
   - Pista de audio musical de fondo.

### Mapa de Prueba Copiado al Proyecto:
Se ha copiado **Miramo Town (Clásico Map 0)** a las carpetas del proyecto:
- **Cliente**: `apps/client/public/maps/miramo/`
  - `miramo_bg.jpg` (Fondo del cielo y montañas de Miramo)
  - `miramo_fg.jpg` (Terreno de tierra y ruinas de 1766x456 px)
  - `collision_mask.png` (Máscara de píxeles exacta del servidor)
- **Metadatos**: `assets/maps/miramo.json`

---

## 7. Animaciones de Móviles (Formato EPA) y Fotogramas por Segundo (FPS)

### 7.1. Frecuencias de Cuadros (FPS)
- **Animaciones de Balas y Proyectiles**: `BULLET_ANIM_FPS = 20`.
- **Animaciones de Móviles y Avatares**: 20 FPS base modulado por tiempos de espera (`hold ticks`).

### 7.2. Estructura de Spritesheets EPA y Anclaje Estable
En DragonBound, cada móvil cuenta con estados:
- `normal`: Respiración / idle en el lugar.
- `move`: Desplazamiento / caminata.
- `wnormal` / `wmove`: Posturas de espera y apuntado.
- `fire1` / `fire2`: Secuencia de retroceso y fogonazo del cañón.
- `item`: Gesto de activación de ítem.

Cada cuadro del arreglo `g` contiene 6 valores clave:
```
[width, height, cx, cy, holdSpotX, holdSpotY]
```
- `cx, cy`: Centro de masa del móvil.
- `holdSpotX, holdSpotY`: Punto exacto sobre el cual se monta el avatar o jinete.

### Causa del Salto de Sprites y Solución Implementada:
- **Error común**: En implementaciones simples, se fija el `anchor` de PixiJS en `(0.5, 0.5)` o en el primer cuadro. Como cada frame de un sprite EPA tiene dimensiones y centros `(cx, cy)` variables según la postura, el sprite da saltos bruscos en cada frame.
- **Solución oficial DragonBound**: El contenedor principal del móvil se coloca en las coordenadas del suelo `(x, y)`. En cada cambio de cuadro, la posición interna del sprite se actualiza a:
  ```javascript
  sprite.position.x = -cx;
  sprite.position.y = -cy;
  ```
  Esto garantiza que el móvil permanezca perfectamente fijo sobre su eje sin vibrar ni saltar. Además, el avatar se posiciona en:
  ```javascript
  avatar.position.x = holdSpotX - cx;
  avatar.position.y = holdSpotY - cy;
  ```
  haciendo que el jinete se mueva en perfecta armonía con la respiración y animación del móvil.

---

## 8. Tabla Comparativa de Móviles Clásicos

| Móvil | Min Ang | Max Ang | Gravedad (`by`) | Peso (`ax`) | Viento (`ay`) | Balas | Daño Tiro 1 | Daño Tiro 2 | Daño SS |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Armor** | 10° | 55° | 398 | 73.5 | 0.740 | 1 penetrante, 2 misiles, SS 2 fases | 150 | 153x2 | 400 (abierto) |
| **Ice** | 20° | 70° | 384 | 62.5 | 0.625 | Hielo congelante / reductor de def | 250 | 250 | 400 |
| **Aduka** | 110° | 170° | 392 | 65.5 | 0.695 | Disparo satélite Thor sincronizado | 190 | 100 + Thor | 400 |
| **Lightning** | 18° | 40° | 393 | 65.0 | 0.720 | Rayo eléctrico con descarga vertical | 200 | 250 | 400 |
| **Bigfoot** | 20° | 45° | 396 | 88.0 | 0.740 | 4 cohetes (T1), 6 cohetes (T2), 15 cohetes (SS) | 50x4 | 70x6 | 120x15 |
| **J.D** | 15° | 65° | 387 | 62.5 | 0.625 | Bola electromagnética con atracción / empuje | 200 | 200 | 400 |
| **A.Sate** | 20° | 60° | 412 | 76.0 | 0.765 | Láser satelital Ion beam | 330 | 250 | 400 |
| **Knight** | 20° | 60° | 360 | 65.5 | 0.695 | Sable de luz y rayos convergentes | 330 | 250 | 400 |
| **Mage** | 15° | 50° | 360 | 71.5 | 0.780 | Tiro 1 estela, Tiro 2 doble hélice, SS vórtice | 100 | 100x2 | 400 |
| **Turtle** | 25° | 50° | 389 | 73.5 | 0.740 | Tiro 1 estela ancha, Tiro 2 TimeBomb forked, SS shell | 230 | 150x2 | 170x6 |
| **Boomer** | 10° | 90° | 244 | 62.5 | 1.395 | Bumerán ultraliviano con gancho de viento | 150 | 120x4 | 400 |
| **Raon** | 30° | 60° | 398 | 73.5 | 0.740 | Tiro 1 ADN, Tiro 2 minas caminantes, SS Baby Raon | 70x2 | 100x2 (minas) | 400 (walker) |
| **Grub** | 30° | 60° | 398 | 61.0 | 0.650 | Bolas rodantes que saltan según el terreno | 220 | 110x4 | 400 |
| **Trico** | 10° | 60° | 395 | 84.0 | 0.870 | Bolas triples en órbita tridimensional | 100x3 | 100x3 | 400 |

---

## 9. Próximos Pasos Recomendados para Gumbound-2026

1. **Adoptar el formato de mapas bitmap clásicos**:
   - Integrar `miramo.json` cargando `collision_mask.png` en el servidor Go mediante decodificación PNG para sustituir la fórmula de altura procedimental.
2. **Cargar texturas de fondo y primer plano**:
   - Renderizar `miramo_bg.jpg` con scroll parallax en el cliente PixiJS y `miramo_fg.jpg` enmascarado con la textura de la tierra destructible.
3. **Audio clásico con efectos .mp3 / .ogg**:
   - Integrar los sonidos extraídos de DragonBound (`AUDIO_MAGE_FIRE`, `AUDIO_ARMOR_FIRE`, `AUDIO_BIGFOOT_FIRE1`, `AUDIO_TURTLE_FIRE`, `AUDIO_RAON_WALKER`).
4. **Ítems del inventario de combate**:
   - Implementar el consumo y retraso de turnos para: Dual (+250 delay), Dual+ (+350 delay), Teleport (+100 delay) y Bunge shot.
