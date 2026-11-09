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

export interface WeatherRoundInfo {
  turnInRound: number;
  turnsPerRound: number;
  turnsRemaining: number;
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
    name: "Energy",
    nameEs: "Energía",
    description: "Rayo de energía solar pura que aumenta el daño (+35%) y el radio de explosión a proyectiles que lo crucen.",
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
    name: "Random",
    nameEs: "Clima Aleatorio",
    description: "Columna de energía con íconos de clima descendiendo. Otorga el efecto del ícono impactado.",
    iconActive: "/sprites/weather/weather_6_active.png",
    iconInactive: "/sprites/weather/weather_6_inactive.png",
    hasColumn: true,
    columnTexture: "/sprites/weather/randomforce.png",
    color: "#e879f9",
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
    case "tornado": return 56;
    case "sun": return 44; // Ancho ligeramente reducido a pedido del usuario
    case "lightning": return 52; // Ancho ampliado y reforzado con más arcos y chispas
    case "mirror": return 32; // Ancho esbelto y auténtico para la barrera de espejo
    case "black": return 38;
    case "random": return 38;
    default: return 40;
  }
}

// Balanced weighted distribution ensuring all classic weathers (Thor, Wind, No Items, Sun, Lightning, Black, Mirror, Tornado) appear regularly
const WEATHER_WEIGHTS: number[] = [
  0, 0, // Thor (2x)
  1, 1, // Wind (2x)
  2,    // No Items (1x)
  3, 3, // Sun / Force (2x)
  4, 4, // Lightning (2x)
  5, 5, // Black / Eclipse (2x)
  7, 7, // Mirror (2x)
  8, 8, // Tornado (2x)
];

export class WeatherManager {
  private tape: number[] = [];
  private tapeIndex: number = 0;
  private mapWidth: number = 1409;

  // Authentic GunBound Round-Based Weather Epoch
  // In GunBound, weather lasts for a full round across participants (in 1v1 = 2 turns).
  public turnsPerRound: number = 2;
  public currentTurnInRound: number = 1;

  public activeWeather: WeatherDefinition = WEATHER_DEFINITIONS[0];
  public activeColumn: ActiveWeatherColumn | null = null;

  public onWeatherChange?: (
    current: WeatherDefinition,
    tapeSlice: WeatherSlotItem[],
    column: ActiveWeatherColumn | null,
    roundInfo: WeatherRoundInfo,
    didChangeWeather: boolean
  ) => void;

  constructor(mapWidth: number = 1409, turnsPerRound: number = 2) {
    this.mapWidth = mapWidth;
    this.turnsPerRound = Math.max(1, turnsPerRound);
    this.currentTurnInRound = 1;
    this.generateTape();
    this.syncCurrentWeather(false, true);
  }

  public setMapWidth(width: number) {
    this.mapWidth = width;
  }

  public setTurnsPerRound(turns: number) {
    this.turnsPerRound = Math.max(1, Math.min(8, turns));
    if (this.currentTurnInRound > this.turnsPerRound) {
      this.currentTurnInRound = 1;
    }
    if (this.onWeatherChange) {
      this.onWeatherChange(
        this.activeWeather,
        this.getTapeSlice(),
        this.activeColumn,
        this.getRoundInfo(),
        false
      );
    }
  }

  public getRoundInfo(): WeatherRoundInfo {
    return {
      turnInRound: this.currentTurnInRound,
      turnsPerRound: this.turnsPerRound,
      turnsRemaining: Math.max(0, this.turnsPerRound - this.currentTurnInRound),
    };
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
   * Advances the weather turn based on authentic GunBound match rounds.
   * In GunBound, weather does NOT change on every single individual shot.
   * Each weather lasts for a full round (in 1v1 = 2 turns, so both players get a shot under the same weather).
   */
  public advanceTurn(): {
    weather: WeatherDefinition;
    didChange: boolean;
    roundInfo: WeatherRoundInfo;
  } {
    let didChange = false;
    this.currentTurnInRound++;

    if (this.currentTurnInRound > this.turnsPerRound) {
      // Weather round completed! Advance tape to the next weather slot
      this.currentTurnInRound = 1;
      this.tapeIndex++;
      didChange = true;

      if (this.tapeIndex >= this.tape.length - 5) {
        // Extend tape if needed
        for (let i = 0; i < 30; i++) {
          const randIdx = Math.floor(Math.random() * WEATHER_WEIGHTS.length);
          this.tape.push(WEATHER_WEIGHTS[randIdx]);
        }
      }

      // Play authentic GunBound weather transition sound ONLY when tape actually advances!
      AudioManager.play("4moon.ogg", 0.85);
      this.syncCurrentWeather(true, true);
    } else {
      // Still in current weather round: keep column in place and notify UI of turn pip update
      this.syncCurrentWeather(true, false);
    }

    return {
      weather: this.activeWeather,
      didChange,
      roundInfo: this.getRoundInfo(),
    };
  }

  /**
   * Directly sets the current weather slot (ideal for testing, sandbox, and practice).
   */
  public setWeatherId(id: number, forcedX?: number) {
    this.currentTurnInRound = 1;
    if (this.tapeIndex < this.tape.length) {
      this.tape[this.tapeIndex] = id;
    }
    this.syncCurrentWeather(true, true, forcedX);
  }

  public setWeatherType(type: WeatherType, forcedX?: number) {
    const entry = Object.values(WEATHER_DEFINITIONS).find((w) => w.type === type);
    if (entry) {
      this.setWeatherId(entry.id, forcedX);
    }
  }

  private syncCurrentWeather(notify: boolean = true, didChange: boolean = true, forcedX?: number) {
    const weatherId = this.tape[this.tapeIndex] ?? 0;
    this.activeWeather = WEATHER_DEFINITIONS[weatherId] || WEATHER_DEFINITIONS[0];

    // Handle in-world column positioning for column weathers (Sun, Lightning, Black, Mirror, Tornado, Random)
    if (this.activeWeather.hasColumn) {
      if (didChange || !this.activeColumn) {
        const minX = 260;
        const maxX = Math.max(minX + 200, this.mapWidth - 260);
        const posX = forcedX !== undefined ? forcedX : Math.floor(minX + Math.random() * (maxX - minX));
        const colWidth = getWeatherColumnWidth(this.activeWeather.type);

        this.activeColumn = {
          id: this.activeWeather.id,
          type: this.activeWeather.type,
          name: this.activeWeather.nameEs,
          x: posX,
          width: colWidth,
          power: 100,
        };
      }
      // If !didChange, this.activeColumn retains its exact position and state across the round!
    } else {
      this.activeColumn = null;
    }

    if (notify && this.onWeatherChange) {
      this.onWeatherChange(
        this.activeWeather,
        this.getTapeSlice(),
        this.activeColumn,
        this.getRoundInfo(),
        didChange
      );
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
    this.currentTurnInRound = 1;
    this.generateTape();
    this.syncCurrentWeather(true, true);
  }
}

