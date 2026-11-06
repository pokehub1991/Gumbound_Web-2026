import { AudioManager } from "../audio/AudioManager.js";

export type WeatherType =
  | "thor"
  | "wind"
  | "no_items"
  | "sun"
  | "lightning"
  | "black"
  | "random"
  | "mirror"
  | "tornado";

export interface WeatherDefinition {
  id: number;
  type: WeatherType;
  name: string;
  nameEs: string;
  description: string;
  iconActive: string;
  iconInactive: string;
  hasColumn: boolean;
  columnTexture?: string;
  color: string;
}

export interface ActiveWeatherColumn {
  id: number;
  type: WeatherType;
  name: string;
  x: number;
  width: number;
  power: number;
}

export interface WeatherSlotItem {
  id: number;
  type: WeatherType;
  name: string;
  iconActive: string;
  iconInactive: string;
  isActive: boolean;
  isPast: boolean;
  slotIndex: number; // 0 = past, 1 = current active, 2..4 = upcoming
}

export const WEATHER_DEFINITIONS: Record<number, WeatherDefinition> = {
  0: {
    id: 0,
    type: "thor",
    name: "Thor",
    nameEs: "Satélite Thor",
    description: "El satélite Thor dispara rayos orbitales en todos los impactos de proyectiles.",
    iconActive: "/sprites/weather/weather_0_active.png",
    iconInactive: "/sprites/weather/weather_0_inactive.png",
    hasColumn: false,
    color: "#38bdf8",
  },
  1: {
    id: 1,
    type: "wind",
    name: "Wind",
    nameEs: "Cambio de Viento",
    description: "Modifica dinámicamente la fuerza y dirección de las ráfagas de viento.",
    iconActive: "/sprites/weather/weather_1_active.png",
    iconInactive: "/sprites/weather/weather_1_inactive.png",
    hasColumn: false,
    color: "#4ade80",
  },
  2: {
    id: 2,
    type: "no_items",
    name: "No Items",
    nameEs: "Bloqueo de Ítems",
    description: "El uso de ítems de combate (Dual, Teleport) queda deshabilitado este turno.",
    iconActive: "/sprites/weather/weather_2_active.png",
    iconInactive: "/sprites/weather/weather_2_inactive.png",
    hasColumn: false,
    color: "#f87171",
  },
  3: {
    id: 3,
    type: "sun",
    name: "Force / Sun",
    nameEs: "Rayo de Sol / Fuerza",
    description: "Aumenta el daño (+35%) y el radio de explosión a proyectiles que crucen el rayo.",
    iconActive: "/sprites/weather/weather_3_active.png",
    iconInactive: "/sprites/weather/weather_3_inactive.png",
    hasColumn: true,
    columnTexture: "/sprites/weather/sunforce.png",
    color: "#facc15",
  },
  4: {
    id: 4,
    type: "lightning",
    name: "Lightning",
    nameEs: "Rayo Eléctrico",
    description: "Carga los proyectiles con alto voltaje. Al impactar cae un rayo con +75 de daño.",
    iconActive: "/sprites/weather/weather_4_active.png",
    iconInactive: "/sprites/weather/weather_4_inactive.png",
    hasColumn: true,
    columnTexture: "/sprites/weather/lightningforce.png",
    color: "#60a5fa",
  },
  5: {
    id: 5,
    type: "black",
    name: "Black / Eclipse",
    nameEs: "Eclipse / Vórtice Oscuro",
    description: "Zona gravitatoria oscura que reduce la fuerza y daño de proyectiles que la crucen.",
    iconActive: "/sprites/weather/weather_5_active.png",
    iconInactive: "/sprites/weather/weather_5_inactive.png",
    hasColumn: true,
    columnTexture: "/sprites/weather/blackforce.png",
    color: "#a855f7",
  },
  6: {
    id: 6,
    type: "random",
    name: "Random / Comet",
    nameEs: "Cometa / Fuerza Aleatoria",
    description: "Anomalía cósmica impredecible. Concede efectos aleatorios (Fuerza Solar o Rayo) a disparos que la crucen.",
    iconActive: "/sprites/weather/weather_6_active.png",
    iconInactive: "/sprites/weather/weather_6_inactive.png",
    hasColumn: true,
    columnTexture: "/sprites/weather/randomforce.png",
    color: "#f97316",
  },
  7: {
    id: 7,
    type: "mirror",
    name: "Mirror",
    nameEs: "Fuerza Espejo",
    description: "Columna reflectante que invierte el sentido horizontal de los proyectiles que chocan.",
    iconActive: "/sprites/weather/weather_7_active.png",
    iconInactive: "/sprites/weather/weather_7_inactive.png",
    hasColumn: true,
    columnTexture: "/sprites/weather/mirrorforce.png",
    color: "#fb923c",
  },
  8: {
    id: 8,
    type: "tornado",
    name: "Tornado",
    nameEs: "Tornado",
    description: "Vórtice ciclónico que succiona y desvía la trayectoria parabólica de los disparos.",
    iconActive: "/sprites/weather/weather_8_active.png",
    iconInactive: "/sprites/weather/weather_8_inactive.png",
    hasColumn: true,
    columnTexture: "/sprites/weather/tornado.png",
    color: "#38bdf8",
  },
};

export function getWeatherColumnWidth(type: WeatherType): number {
  switch (type) {
    case "tornado": return 54;
    case "sun": return 42;
    case "lightning": return 38;
    case "mirror": return 28;
    case "black": return 36;
    case "random": return 38;
    default: return 40;
  }
}

// Balanced weighted distribution ensuring all 9 weathers (Thor, Wind, No Items, Sun, Lightning, Black, Random, Mirror, Tornado) appear regularly
const WEATHER_WEIGHTS: number[] = [
  0, 0, // Thor (2x)
  1, 1, // Wind (2x)
  2,    // No Items (1x)
  3, 3, // Sun / Force (2x)
  4, 4, // Lightning (2x)
  5, 5, // Black / Eclipse (2x)
  6, 6, // Random / Comet (2x)
  7, 7, // Mirror (2x)
  8, 8, // Tornado (2x)
];

export class WeatherManager {
  private tape: number[] = [];
  private tapeIndex: number = 0;
  private mapWidth: number = 1409;

  public activeWeather: WeatherDefinition = WEATHER_DEFINITIONS[0];
  public activeColumn: ActiveWeatherColumn | null = null;

  public onWeatherChange?: (
    current: WeatherDefinition,
    tapeSlice: WeatherSlotItem[],
    column: ActiveWeatherColumn | null
  ) => void;

  constructor(mapWidth: number = 1409) {
    this.mapWidth = mapWidth;
    this.generateTape();
    this.syncCurrentWeather(false);
  }

  public setMapWidth(width: number) {
    this.mapWidth = width;
  }

  /**
   * Generates a 60-turn authentic weather sequence.
   */
  public generateTape() {
    this.tape = [];
    // Ensure turn 1 starts with a classic weather (e.g. Thor or Wind)
    this.tape.push(0); // Slot 0 (past)
    this.tape.push(1); // Slot 1 (active first turn = Wind)

    for (let i = 2; i < 70; i++) {
      const randIdx = Math.floor(Math.random() * WEATHER_WEIGHTS.length);
      this.tape.push(WEATHER_WEIGHTS[randIdx]);
    }

    this.tapeIndex = 1; // Current active is index 1
  }

  /**
   * Advances the weather tape by 1 turn.
   * Plays authentic GunBound weather sound 4moon.ogg!
   */
  public advanceTurn(): WeatherDefinition {
    this.tapeIndex++;
    if (this.tapeIndex >= this.tape.length - 5) {
      // Extend tape if needed
      for (let i = 0; i < 30; i++) {
        const randIdx = Math.floor(Math.random() * WEATHER_WEIGHTS.length);
        this.tape.push(WEATHER_WEIGHTS[randIdx]);
      }
    }

    // Play authentic weather transition sound
    AudioManager.play("4moon.ogg", 0.85);

    this.syncCurrentWeather(true);
    return this.activeWeather;
  }

  /**
   * Directly sets the current weather slot (ideal for testing, sandbox, and practice).
   */
  public setWeatherId(id: number) {
    if (this.tapeIndex < this.tape.length) {
      this.tape[this.tapeIndex] = id;
    }
    this.syncCurrentWeather(true);
  }

  public setWeatherType(type: WeatherType) {
    const entry = Object.values(WEATHER_DEFINITIONS).find((w) => w.type === type);
    if (entry) {
      this.setWeatherId(entry.id);
    }
  }

  private syncCurrentWeather(notify: boolean = true) {
    const weatherId = this.tape[this.tapeIndex] ?? 0;
    this.activeWeather = WEATHER_DEFINITIONS[weatherId] || WEATHER_DEFINITIONS[0];

    // Handle in-world column positioning for column weathers (Sun, Lightning, Black, Mirror, Tornado)
    if (this.activeWeather.hasColumn) {
      const minX = 260;
      const maxX = Math.max(minX + 200, this.mapWidth - 260);
      const posX = Math.floor(minX + Math.random() * (maxX - minX));
      const colWidth = getWeatherColumnWidth(this.activeWeather.type);

      this.activeColumn = {
        id: this.activeWeather.id,
        type: this.activeWeather.type,
        name: this.activeWeather.nameEs,
        x: posX,
        width: colWidth,
        power: 100,
      };
    } else {
      this.activeColumn = null;
    }

    if (notify && this.onWeatherChange) {
      this.onWeatherChange(this.activeWeather, this.getTapeSlice(), this.activeColumn);
    }
  }

  /**
   * Returns exactly 5 slots for the HUD weather capsule tape:
   * [0] = Past turn (dimmed / grayscale)
   * [1] = CURRENT ACTIVE TURN (framed in vibrant purple with inward yellow arrows)
   * [2..4] = Upcoming turns (preview)
   */
  public getTapeSlice(): WeatherSlotItem[] {
    const slots: WeatherSlotItem[] = [];

    for (let offset = -1; offset <= 3; offset++) {
      const idx = this.tapeIndex + offset;
      const id = idx >= 0 && idx < this.tape.length ? this.tape[idx] : 0;
      const def = WEATHER_DEFINITIONS[id] || WEATHER_DEFINITIONS[0];
      const slotIndex = offset + 1; // 0, 1, 2, 3, 4

      slots.push({
        id: def.id,
        type: def.type,
        name: def.nameEs,
        iconActive: def.iconActive,
        iconInactive: def.iconInactive,
        isActive: offset === 0,
        isPast: offset < 0,
        slotIndex,
      });
    }

    return slots;
  }

  public isThorActive(): boolean {
    return this.activeWeather.type === "thor";
  }

  public isItemsLocked(): boolean {
    return this.activeWeather.type === "no_items";
  }

  public isWindWeather(): boolean {
    return this.activeWeather.type === "wind";
  }

  public triggerInitialSync() {
    this.syncCurrentWeather(true);
  }

  public reset() {
    this.generateTape();
    this.syncCurrentWeather(true);
  }
}

