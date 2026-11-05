import React from "react";
import { useStore } from "../store.js";
import { RoomList } from "../components/RoomList.js";
import { ChatBox } from "../components/ChatBox.js";

export const LobbyScreen: React.FC = () => {
  const { user } = useStore();

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
      {/* Top Header Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        background: "rgba(15, 23, 42, 0.95)",
        borderRadius: "8px",
        border: "1px solid #334155",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px", fontWeight: "bold", color: "#38bdf8" }}>
            GUMBOUND S2
          </span>
          <span style={{
            fontSize: "12px",
            background: "#0284c7",
            padding: "2px 8px",
            borderRadius: "4px",
            color: "#fff",
            fontWeight: "bold"
          }}>
            CANAL 1 (PRINCIPAL)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px", fontSize: "13px" }}>
          <div style={{ color: "#f8fafc" }}>
            Piloto: <strong style={{ color: "#38bdf8" }}>{user?.nickname || "Invitado"}</strong>
          </div>
          <div style={{ color: "var(--color-warning-light)" }}>
            Oro: <strong className="num-font">{user?.gold?.toLocaleString() || "10,000"}</strong>
          </div>
          <div style={{ color: "#a855f7" }}>
            GP: <strong className="num-font">{user?.gp?.toLocaleString() || "0"}</strong>
          </div>
        </div>
      </div>

      {/* Main Lobby Area (Split: Rooms left 65%, Chat right 35%) */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1.7fr 1fr",
        gap: "12px",
        minHeight: 0,
      }}>
        <RoomList />
        <ChatBox />
      </div>
    </div>
  );
};

