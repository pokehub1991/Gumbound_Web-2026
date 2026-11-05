import { create } from "zustand";
import { RoomState, UserInfo } from "@gumbound/shared";
import { Connection } from "../network/Connection.js";

export interface ChatEntry {
  sender: string;
  text: string;
  scope: string;
  time: string;
}

export type ActiveGameFont = "Silkscreen" | "EditUndo" | "Pixeboy";

const ALL_FONTS: ActiveGameFont[] = ["Silkscreen", "EditUndo", "Pixeboy"];

const getInitialFont = (): ActiveGameFont => {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("gumbound_font") as ActiveGameFont;
    if (ALL_FONTS.includes(saved)) {
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-font", saved.toLowerCase());
      }
      return saved;
    }
  }
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-font", "silkscreen");
  }
  return "Silkscreen";
};

export interface UIState {
  screen: "arena" | "login" | "lobby" | "room" | "match";
  token?: string;
  user?: UserInfo;
  connection: Connection;
  rooms: RoomState[];
  currentRoom?: RoomState;
  chatMessages: ChatEntry[];
  gameFont: ActiveGameFont;

  setScreen: (screen: "arena" | "login" | "lobby" | "room" | "match") => void;
  setAuth: (token: string, user: UserInfo) => void;
  setRooms: (rooms: RoomState[]) => void;
  setCurrentRoom: (room?: RoomState) => void;
  addChatMessage: (msg: ChatEntry) => void;
  setGameFont: (font: ActiveGameFont) => void;
  toggleGameFont: () => void;
}

export const useStore = create<UIState>((set) => ({
  screen: "arena",
  connection: new Connection(),
  rooms: [],
  chatMessages: [],
  gameFont: getInitialFont(),

  setScreen: (screen) => set({ screen }),
  setAuth: (token, user) => set({ token, user }),
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-80), msg],
    })),
  setGameFont: (font) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("gumbound_font", font);
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-font", font.toLowerCase());
    }
    set({ gameFont: font });
  },
  toggleGameFont: () => {
    set((state) => {
      const currentIndex = ALL_FONTS.indexOf(state.gameFont);
      const nextFont = ALL_FONTS[(currentIndex + 1) % ALL_FONTS.length];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("gumbound_font", nextFont);
      }
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-font", nextFont.toLowerCase());
      }
      return { gameFont: nextFont };
    });
  },
}));

