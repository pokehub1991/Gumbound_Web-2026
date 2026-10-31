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
  };
}

export interface MatchEndState {
  winner_team: string;
}

