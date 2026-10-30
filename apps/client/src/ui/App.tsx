import React, { useEffect, useState, useRef } from "react";
import { useStore } from "./store.js";
import { LoginScreen } from "./screens/LoginScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { MatchHUD } from "./screens/MatchHUD.js";
import { MatchController } from "../game/MatchController.js";
import { Game } from "../game/Game.js";
import { Opcode, ChannelState, RoomState } from "@gumbound/shared";

export const App: React.FC = () => {
  const { screen, connection, user, setRooms, setCurrentRoom, addChatMessage, setScreen } = useStore();

  const [activeNickname, setActiveNickname] = useState("");
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [turnNumber, setTurnNumber] = useState(1);
  const [selectedShotType, setSelectedShotType] = useState(0);
  const [winnerTeam, setWinnerTeam] = useState<string | undefined>(undefined);

  const matchCtrlRef = useRef<MatchController | null>(null);

  useEffect(() => {
    // Acquire game instance from window
    const game = (window as unknown as { __game?: Game }).__game;
    if (game && !matchCtrlRef.current) {
      const ctrl = new MatchController(game, connection);
      ctrl.localUserId = user?.id || "";

      ctrl.onTurnChange = (activeNick, myTurn, turnNum) => {
        setActiveNickname(activeNick);
        setIsMyTurn(myTurn);
        setTurnNumber(turnNum);
      };

      ctrl.onMatchEnd = (winner) => {
        setWinnerTeam(winner);
      };

      matchCtrlRef.current = ctrl;
    }

    if (matchCtrlRef.current && user) {
      matchCtrlRef.current.localUserId = user.id;
    }
  }, [user, connection]);

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
    if (matchCtrlRef.current) {
      matchCtrlRef.current.setShotType(type);
    }
  };

  const handleReturnToRoom = () => {
    setWinnerTeam(undefined);
    setScreen("room");
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
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
          myTeam={matchCtrlRef.current?.myTeam}
          onReturnToRoom={handleReturnToRoom}
        />
      )}
    </div>
  );
};
