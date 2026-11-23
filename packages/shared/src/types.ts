export interface UserInfo {
  id: string;
  username: string;
  nickname: string;
  gold: number;
  gp: number;
  authority: number;
}

export interface RoomPlayerState {
  id: string;
  nickname: string;
  mobile: number;
  team: string; // "A" | "B"
  ready: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  max_players: number;
  map_id: string;
  host_id: string;
  players: Record<string, RoomPlayerState>;
}

export interface ChannelState {
  channel_id: string;
  channel_name: string;
  rooms: RoomState[];
}

export interface Point2D {
  x: number;
  y: number;
}

export interface WindState {
  angle_deg: number;
  magnitude: number;
  vector: Point2D;
}

export interface MatchPlayerState {
  id: string;
  nickname: string;
  mobile_id: number;
  team: string;
  hp: number;
  max_hp: number;
  pos: Point2D;
  delay: number;
  alive: boolean;
}

export interface MatchStartState {
  match_id: string;
  map_id: string;
  players: MatchPlayerState[];
  wind: WindState;
  active_id: string;
}

export interface TurnStartState {
  active_id: string;
  turn_number: number;
  wind: WindState;
  delay_queue: { id: string; delay: number }[];
}

export interface ProjectileResultState {
  shooter_id?: string;
  mobile_type?: number;
  shot_type?: number;
  trajectory: Point2D[];
  hit_type: string;
  impact_pos: Point2D;
  damages: Record<string, number>;
  terrain_delta?: {
    x: number;
    y: number;
    radius: number;
    // Vertical (squashed) crater radius. Canonical GunBound aspect is 1 : 0.85.
    radius_y?: number;
  };
  sub_shots?: ProjectileResultState[];
}

export interface MatchEndState {
  winner_team: string;
}

// Multiplayer foundations
export type MatchID = string;
export type RoomID = string;
export type PlayerID = string;

export interface ClientIntentBase {
  match_id: MatchID;
  room_id: RoomID;
  protocol_version: number;
}

export type ClientIntent =
  | (ClientIntentBase & { type: "MOVE_START"; x: number; y: number; facing: number })
  | (ClientIntentBase & { type: "MOVE_STOP" })
  | (ClientIntentBase & { type: "AIM_ANGLE"; angle: number })
  | (ClientIntentBase & { type: "SELECT_SHOT"; shot_type: 0 | 1 | 2 })
  | (ClientIntentBase & { type: "USE_ITEM"; item_id: string })
  | (ClientIntentBase & { type: "FIRE_SHOT"; angle: number; power: number; facing: number; shot_type: 0 | 1 | 2 });

// Avatar shop foundations — stat-only, no visual payloads.
export interface AvatarEquippedStats {
  attack: number;
  delay: number;
  scratch: number;
}

export interface AvatarLoadout {
  avatar_on: boolean;
  equipped: Record<string, string>; // slot -> avatar_id
  stats: AvatarEquippedStats;
}

export interface RoomConfig {
  map_id: string;
  item_set: string;
  wind_mode: string;
  avatar_on: boolean;
  turn_timer_seconds: number;
  sudden_death: string;
}

// Canonical 8 GunBound items (plan §4.6).
// Effects and costs are mirrored 1:1 in apps/server/internal/match/items.go.
export type ItemID =
  | "dual"
  | "dual_plus"
  | "teleport"
  | "wind_change"
  | "power_up"
  | "blood"
  | "bunge_shot"
  | "team_teleport";

export interface ItemMeta {
  id: ItemID;
  name: string;
  cost: number;      // gold price deducted on use
  extra_delay: number; // added to the player's accumulated delay
}

// Sudden Death (plan §4.8).
export type SuddenDeathKind = "" | "generic" | "double" | "ss" | "bigbomb";

export interface SuddenDeathConfig {
  kind: SuddenDeathKind;
  start_turn: number;
  active: boolean;
}

// Weather physics foundations (plan §4.7).
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

export interface ActiveWeatherState {
  type: WeatherType;
  x: number;
  width: number;
  power: number; // effect strength 0..100
}

export interface WeatherState {
  active: ActiveWeatherState[];
  next_positions: { x: number; type: WeatherType }[];
  turn_in_round: number;
  turns_per_round: number;
}

export const ITEM_CATALOG: Record<ItemID, ItemMeta> = {
  dual:           { id: "dual",           name: "Dual",            cost: 200, extra_delay: 250 },
  dual_plus:      { id: "dual_plus",      name: "Dual+",           cost: 300, extra_delay: 275 },
  teleport:       { id: "teleport",       name: "Teleport",        cost: 150, extra_delay: 200 },
  wind_change:    { id: "wind_change",    name: "Wind Change",     cost: 100, extra_delay: 150 },
  power_up:       { id: "power_up",       name: "Power Up",        cost: 150, extra_delay: 200 },
  blood:          { id: "blood",          name: "Blood",           cost: 150, extra_delay: 100 },
  bunge_shot:     { id: "bunge_shot",     name: "Bunge Shot",      cost: 200, extra_delay: 100 },
  team_teleport:  { id: "team_teleport",  name: "Team Teleport",   cost: 250, extra_delay: 250 },
};

