import React, { useState } from "react";
import { useStore } from "../store.js";
import { Opcode, RoomState } from "@gumbound/shared";

export const RoomList: React.FC = () => {
  const { rooms, connection } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);

  const handleJoin = (roomId: string) => {
    connection.send(Opcode.ROOM_JOIN, { room_id: roomId });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    connection.send(Opcode.ROOM_CREATE, {
      name: newRoomName || "Sala de Batalla",
      max_players: maxPlayers,
      map_id: "plains",
    });
    setShowCreateModal(false);
    setNewRoomName("");
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "rgba(18, 25, 33, 0.9)",
      borderRadius: "8px",
      border: "1px solid #2a3b4c",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        background: "#1e293b",
        borderBottom: "1px solid #334155",
      }}>
        <span style={{ fontWeight: "bold", color: "#38bdf8", fontSize: "14px" }}>
          SALAS DISPONIBLES ({rooms.length})
        </span>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: "6px 14px",
            background: "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "12px",
          }}
        >
          + Crear Sala
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {rooms.length === 0 ? (
          <div style={{ color: "#64748b", textAlign: "center", marginTop: "40px" }}>
            No hay salas activas. ¡Crea la primera sala para jugar!
          </div>
        ) : (
          rooms.map((room: RoomState) => {
            const currentPlayers = Object.keys(room.players || {}).length;
            return (
              <div
                key={room.id}
                onClick={() => handleJoin(room.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#0f172a",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#0f172a")}
              >
                <div>
                  <div style={{ fontWeight: "bold", color: "#f8fafc", fontSize: "14px" }}>
                    {room.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Mapa: {room.map_id.toUpperCase()}
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px",
                  background: "#334155",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#38bdf8",
                  fontWeight: "bold"
                }}>
                  {currentPlayers} / {room.max_players}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 100,
        }}>
          <form
            onSubmit={handleCreate}
            style={{
              background: "#1e293b",
              padding: "24px",
              borderRadius: "8px",
              width: "320px",
              border: "1px solid #475569",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <h3 style={{ color: "#fff", margin: 0 }}>Crear Nueva Sala</h3>
            <div>
              <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "4px" }}>Nombre de la Sala</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Ej. Batalla 1v1 Pro"
                style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#fff" }}
              />
            </div>
            <div>
              <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "4px" }}>Jugadores Máximos</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#fff" }}
              >
                <option value={2}>2 Jugadores (1 vs 1)</option>
                <option value={4}>4 Jugadores (2 vs 2)</option>
                <option value={8}>8 Jugadores (4 vs 4)</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ padding: "8px 14px", background: "#475569", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                Crear
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

