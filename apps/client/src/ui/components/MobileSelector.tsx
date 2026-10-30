import React from "react";
import { useStore } from "../store.js";
import { Opcode } from "@gumbound/shared";

interface MobileInfo {
  id: number;
  name: string;
  type: string;
  color: string;
}

const MOBILES_LIST: MobileInfo[] = [
  { id: 0, name: "Armor", type: "Equilibrado", color: "#38bdf8" },
  { id: 1, name: "Mage", type: "Energía / Escudo", color: "#818cf8" },
  { id: 2, name: "Nak", type: "Subterráneo", color: "#f472b6" },
  { id: 3, name: "Trico", type: "Triple Disparo", color: "#4ade80" },
  { id: 4, name: "BigFoot", type: "Cañón Pesado", color: "#fb923c" },
  { id: 5, name: "Boomer", type: "Curva de Viento", color: "#facc15" },
  { id: 6, name: "Raon", type: "Minas Caminantes", color: "#a78bfa" },
  { id: 7, name: "Turtle", type: "Sniper / Láser", color: "#2dd4bf" },
];

interface Props {
  selectedMobileId: number;
}

export const MobileSelector: React.FC<Props> = ({ selectedMobileId }) => {
  const { connection } = useStore();

  const handleSelect = (id: number) => {
    connection.send(Opcode.SELECT_MOBILE, { mobile_id: id });
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "8px",
      padding: "10px",
      background: "#0f172a",
      borderRadius: "6px",
      border: "1px solid #334155",
    }}>
      {MOBILES_LIST.map((m) => {
        const isSelected = m.id === selectedMobileId;
        return (
          <button
            key={m.id}
            onClick={() => handleSelect(m.id)}
            style={{
              padding: "10px",
              background: isSelected ? "rgba(56, 189, 248, 0.15)" : "#1e293b",
              border: isSelected ? "2px solid #38bdf8" : "1px solid #334155",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              outline: "none",
            }}
          >
            <div style={{
              width: "32px",
              height: "22px",
              background: m.color,
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "10px",
              color: "#000",
            }}>
              {m.name.slice(0, 3).toUpperCase()}
            </div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "12px" }}>{m.name}</div>
            <div style={{ color: "#94a3b8", fontSize: "10px" }}>{m.type}</div>
          </button>
        );
      })}
    </div>
  );
};

