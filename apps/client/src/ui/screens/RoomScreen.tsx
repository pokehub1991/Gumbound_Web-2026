import React from "react";
import { useStore } from "../store.js";
import { MobileSelector } from "../components/MobileSelector.js";
import { ChatBox } from "../components/ChatBox.js";
import { Opcode } from "@gumbound/shared";

export const RoomScreen: React.FC = () => {
  const { currentRoom, user, connection, setScreen } = useStore();

  if (!currentRoom) return null;

  const players = Object.values(currentRoom.players || {});
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const myPlayer = players.find((p) => p.id === user?.id) || players[0];
  const isHost = currentRoom.host_id === user?.id;

  const handleToggleReady = () => {
    connection.send(Opcode.TOGGLE_READY, {});
  };

  const handleLeave = () => {
    connection.send(Opcode.ROOM_LEAVE, {});
    setScreen("lobby");
  };

  const handleStartGame = () => {
    // Host starts match
    connection.send(Opcode.MATCH_START, { room_id: currentRoom.id });
  };

  const handleSelectMobile = (id: number) => {
    connection.send(Opcode.SELECT_MOBILE, { mobile_id: id });
  };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "16px",
      gap: "12px",
      boxSizing: "border-box",
    }}>
      {/* Room Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        background: "rgba(15, 23, 42, 0.95)",
        borderRadius: "8px",
        border: "1px solid #334155",
      }}>
        <div>
          <span style={{ fontSize: "16px", fontWeight: "bold", color: "#f8fafc" }}>
            {currentRoom.name}
          </span>
          <span style={{ marginLeft: "10px", fontSize: "12px", color: "#94a3b8" }}>
            [Mapa: {currentRoom.map_id.toUpperCase()}]
          </span>
        </div>
        <button
          onClick={handleLeave}
          style={{
            padding: "6px 14px",
            background: "#475569",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Salir al Lobby
        </button>
      </div>

      {/* Main Grid: Teams + Mobile selection + Chat */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 340px",
        gap: "12px",
        minHeight: 0,
      }}>
        {/* Team A (Blue) */}
        <div style={{
          background: "rgba(15, 23, 42, 0.9)",
          borderRadius: "8px",
          border: "2px solid #2563eb",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          <div style={{ fontWeight: "bold", color: "#60a5fa", borderBottom: "1px solid #1e3a8a", paddingBottom: "6px" }}>
            EQUIPO AZUL (<span className="num-font">{teamA.length}</span>)
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            {teamA.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "#1e293b",
                  borderRadius: "6px",
                  border: p.ready ? "1px solid #22c55e" : "1px solid #475569",
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold", color: "#fff", fontSize: "13px" }}>{p.nickname}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Móvil: #<span className="num-font">{p.mobile}</span></div>
                </div>
                <div style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  background: p.ready ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  color: p.ready ? "#4ade80" : "#f87171",
                }}>
                  {p.ready ? "LISTO" : "ESPERANDO"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team B (Red) */}
        <div style={{
          background: "rgba(15, 23, 42, 0.9)",
          borderRadius: "8px",
          border: "2px solid #dc2626",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          <div style={{ fontWeight: "bold", color: "#f87171", borderBottom: "1px solid #7f1d1d", paddingBottom: "6px" }}>
            EQUIPO ROJO (<span className="num-font">{teamB.length}</span>)
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            {teamB.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "#1e293b",
                  borderRadius: "6px",
                  border: p.ready ? "1px solid #22c55e" : "1px solid #475569",
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold", color: "#fff", fontSize: "13px" }}>{p.nickname}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Móvil: #<span className="num-font">{p.mobile}</span></div>
                </div>
                <div style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  background: p.ready ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  color: p.ready ? "#4ade80" : "#f87171",
                }}>
                  {p.ready ? "LISTO" : "ESPERANDO"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <ChatBox />
      </div>

      {/* Bottom Control Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 20px",
        background: "rgba(15, 23, 42, 0.95)",
        borderRadius: "8px",
        border: "1px solid #334155",
        gap: "20px"
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Selecciona tu Móvil:</div>
          <MobileSelector selectedMobileId={myPlayer?.mobile ?? 0} onSelectMobile={handleSelectMobile} />
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleToggleReady}
            style={{
              padding: "14px 28px",
              background: myPlayer?.ready ? "#eab308" : "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "15px",
            }}
          >
            {myPlayer?.ready ? "CANCELAR" : "LISTO"}
          </button>

          {isHost && (
            <button
              onClick={handleStartGame}
              style={{
                padding: "14px 32px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "15px",
                boxShadow: "0 0 15px rgba(37,99,235,0.5)",
              }}
            >
              EMPEZAR JUEGO
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

