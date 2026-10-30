import { create } from "zustand";
import { RoomState, UserInfo } from "@gumbound/shared";
import { Connection } from "../network/Connection.js";

export interface ChatEntry {
  sender: string;
  text: string;
  scope: string;
  time: string;
}

export interface UIState {
  screen: "login" | "lobby" | "room" | "match";
  token?: string;
  user?: UserInfo;
  connection: Connection;
  rooms: RoomState[];
  currentRoom?: RoomState;
  chatMessages: ChatEntry[];

  setScreen: (screen: "login" | "lobby" | "room" | "match") => void;
  setAuth: (token: string, user: UserInfo) => void;
  setRooms: (rooms: RoomState[]) => void;
  setCurrentRoom: (room?: RoomState) => void;
  addChatMessage: (msg: ChatEntry) => void;
}

export const useStore = create<UIState>((set) => ({
  screen: "login",
  connection: new Connection(),
  rooms: [],
  chatMessages: [],

  setScreen: (screen) => set({ screen }),
  setAuth: (token, user) => set({ token, user }),
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-80), msg],
    })),
}));
