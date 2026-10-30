import React, { useEffect } from "react";
import { useStore } from "./store.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { Opcode, ChannelState, RoomState } from "@gumbound/shared";

export const App: React.FC = () => {
  const { screen, connection, setRooms, setCurrentRoom, addChatMessage, setScreen } = useStore();

  useEffect(() => {
    // Register global WebSocket event handlers into Zustand store
    connection.handler.on(Opcode.CHANNEL_STATE, (msg) => {
      const data = msg.json<ChannelState>();
      setRooms(data.rooms || []);
    });

    connection.handler.on(Opcode.ROOM_STATE, (msg) => {
      const room = msg.json<RoomState>();
      setCurrentRoom(room);
      setScreen("room");
    });

    connection.handler.on(Opcode.CHAT_BROADCAST, (msg) => {
      const chat = msg.json<{ sender_nick: string; text: string; scope: string; timestamp: string }>();
      addChatMessage({
        sender: chat.sender_nick || "Desconocido",
        text: chat.text,
        scope: chat.scope,
        time: new Date(chat.timestamp).toLocaleTimeString(),
      });
    });

    connection.handler.on(Opcode.MATCH_START, () => {
      setScreen("match");
    });
  }, [connection, setRooms, setCurrentRoom, addChatMessage, setScreen]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {screen === "login" && <LoginScreen />}
      {screen === "lobby" && <LobbyScreen />}
      {screen === "room" && <RoomScreen />}
      {/* When screen === "match", UI overlay lets canvas render through and only shows HUD */}
    </div>
  );
};
