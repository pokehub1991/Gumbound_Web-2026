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
    height: 1250, // 360 sky + 760 bridge + 130 bottom abyss clearance
    fgWidth: 1409,
    fgHeight: 760,
    skyHeight: 360,
    bgcolor: "#634a4a",
    offset_x: 0,
    offset_y: 360, // Bridge raised by 90px so undercarriage has generous clearance above bottom edge
    bgSize: 1300,
    player1Spawn: { x: 260, y: 403 },
    botSpawn: { x: 1140, y: 402 },
  },
};
