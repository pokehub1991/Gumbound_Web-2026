import { TerrainRenderer } from "./TerrainRenderer.js";

export interface ClientMapConfig {
  id: string;
  name: string;
  groundBaseY: number;
  roughness: number;
  amplitude: number;
  groundColor: string;
  grassColor: string;
}

export const ClientMaps: Record<string, ClientMapConfig> = {
  plains: {
    id: "plains",
    name: "Miramo Plains",
    groundBaseY: 560,
    roughness: 0.008,
    amplitude: 65,
    groundColor: "#593a1d",
    grassColor: "#4da333",
  },
  canyon: {
    id: "canyon",
    name: "Nirvana Canyon",
    groundBaseY: 510,
    roughness: 0.015,
    amplitude: 120,
    groundColor: "#8a421d",
    grassColor: "#d48b3b",
  },
  island: {
    id: "island",
    name: "Sky Island",
    groundBaseY: 480,
    roughness: 0.02,
    amplitude: 90,
    groundColor: "#3d4852",
    grassColor: "#38bdf8",
  },
};

export function applyMapTerrain(terrain: TerrainRenderer, mapId: string) {
  const cfg = ClientMaps[mapId] || ClientMaps.plains;
  terrain.generateDefaultTerrain(cfg.groundBaseY);
}

