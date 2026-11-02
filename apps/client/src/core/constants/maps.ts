export interface MapDef {
  id: number;
  key: string;
  name: string;
  fg: string;
  bg: string;
  mask: string;
  width: number;
  height: number;
  fgWidth: number;
  fgHeight: number;
  skyHeight: number;
  bgcolor: string;
  offset_x: number;
  offset_y: number;
  bgSize: number;
  player1Spawn: { x: number; y: number };
  botSpawn: { x: number; y: number };
}

export const MAPS: Record<string, MapDef> = {
  metamine: {
    id: 9,
    key: "metamine",
    name: "Meta Mine",
    fg: "/maps/metamine/metamine_fg.jpg",
    bg: "/maps/metamine/metamine_bg.jpg",
    mask: "/maps/metamine/metamine_mask.png",
    width: 1409,
    height: 1210, // 450 sky + 760 bridge
    fgWidth: 1409,
    fgHeight: 760,
    skyHeight: 450,
    bgcolor: "#634a4a",
    offset_x: 0,
    offset_y: 450, // Bridge placed below sky
    bgSize: 1300,
    player1Spawn: { x: 260, y: 493 },
    botSpawn: { x: 1140, y: 492 },
  },
};
