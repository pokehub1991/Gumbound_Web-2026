import React, { useEffect, useState } from "react";
import { useStore } from "./store.js";
import { ArenaScreen } from "./screens/ArenaScreen.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { MatchHUD } from "./screens/MatchHUD.js";
import { CombatArena } from "../core/combat/CombatArena.js";
import { Opcode, ChannelState, RoomState } from "@gumbound/shared";

export const App: React.FC = () => {
  const { screen, connection, setRooms, setCurrentRoom, addChatMessage, setScreen } = useStore();

  const [activeNickname] = useState("");
  const [isMyTurn] = useState(false);
  const [turnNumber] = useState(1);
  const [selectedShotType, setSelectedShotType] = useState(0);
  const [currentMobileId, setCurrentMobileId] = useState(0);
  const [winnerTeam, setWinnerTeam] = useState<string | undefined>(undefined);

  const [arenaInstance, setArenaInstance] = useState<CombatArena | null>(null);

  useEffect(() => {
    // Acquire CombatArena from window
    const checkArena = () => {
      const arena = (window as unknown as { __arena?: CombatArena }).__arena;
      if (arena) {
        setArenaInstance(arena);
      }
    };

    checkArena();
    const interval = setInterval(checkArena, 200);
    return () => clearInterval(interval);
  }, []);

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
      setWinnerTeam(undefined);
      setScreen("match");
    });
  }, [connection, setRooms, setCurrentRoom, addChatMessage, setScreen]);

  const handleSelectShotType = (type: number) => {
    setSelectedShotType(type);
    if (arenaInstance) {
      arenaInstance.setShotType(type);
    }
  };

  const handleChangeMobile = (mobileId: number) => {
    setCurrentMobileId(mobileId);
    connection.send(Opcode.SELECT_MOBILE, { mobile_id: mobileId });
    if (arenaInstance) {
      arenaInstance.setPlayerMobile(mobileId);
    }
  };

  const handleReturnToRoom = () => {
    setWinnerTeam(undefined);
    setScreen("room");
  };

  const handleExitToLobby = () => {
    setWinnerTeam(undefined);
    connection.send(Opcode.ROOM_LEAVE, {});
    setCurrentRoom(undefined);
    setScreen("lobby");
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Top Navigator when not on the Arena screen to avoid obscuring combat HUD */}
      {screen !== "arena" && (
        <div style={{
          position: "absolute",
          top: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          display: "flex",
          gap: "6px",
          background: "rgba(15, 23, 42, 0.8)",
          padding: "4px 8px",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(8px)",
        }}>
          <button
            onClick={() => setScreen("arena")}
            style={{
              background: "transparent",
              color: "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ⚔️ Modo Combate (Metamine)
          </button>

          <button
            onClick={() => setScreen("login")}
            style={{
              background: screen === "login" ? "#0284c7" : "transparent",
              color: "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🔑 Login / Multi-jugador
          </button>

          <button
            onClick={() => setScreen("lobby")}
            style={{
              background: screen === "lobby" ? "#0284c7" : "transparent",
              color: "#ffffff",
              border: "none",
              borderRadius: "14px",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🏛️ Lobby / Salas
          </button>
        </div>
      )}

      {/* Screen views */}
      {screen === "arena" && <ArenaScreen arena={arenaInstance} />}
      {screen === "login" && <LoginScreen />}
      {screen === "lobby" && <LobbyScreen />}
      {screen === "room" && <RoomScreen />}
      {screen === "match" && (
        <MatchHUD
          activeNickname={activeNickname}
          isMyTurn={isMyTurn}
          turnNumber={turnNumber}
          selectedShotType={selectedShotType}
          onSelectShotType={handleSelectShotType}
          winnerTeam={winnerTeam}
          myTeam="A"
          onReturnToRoom={handleReturnToRoom}
          onExitToLobby={handleExitToLobby}
          currentMobileId={currentMobileId}
          onChangeMobile={handleChangeMobile}
        />
      )}
    </div>
  );
};
