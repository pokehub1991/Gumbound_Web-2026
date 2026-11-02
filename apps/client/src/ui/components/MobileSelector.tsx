import React, { useState } from "react";
import { MOBILES_DATA } from "../../core/constants/mobiles.js";
import { AudioManager } from "../../core/audio/AudioManager.js";

interface MobileSelectorProps {
  selectedMobileId: number;
  onSelectMobile: (id: number) => void;
  title?: string;
  onClose?: () => void;
}

export const MobileSelector: React.FC<MobileSelectorProps> = ({
  selectedMobileId,
  onSelectMobile,
  title = "SELECCIONAR MÓVIL",
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");

  const mobiles = Object.values(MOBILES_DATA).filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleSelect = (id: number) => {
    AudioManager.play("click", 0.7);
    onSelectMobile(id);
    if (onClose) onClose();
  };

  const getMobileBadgeColor = (id: number) => {
    switch (id) {
      case 0: return "#38bdf8"; // Armor
      case 1: return "#67e8f9"; // Ice
      case 2: return "#818cf8"; // Aduka
      case 3: return "#c084fc"; // Lightning
      case 4: return "#fb923c"; // Bigfoot
      case 5: return "#a3e635"; // JD
      case 6: return "#60a5fa"; // ASate
      case 8: return "#facc15"; // Knight
      case 9: return "#f87171"; // Fox
      case 10: return "#f97316"; // Dragon
      case 11: return "#f472b6"; // Nak
      case 12: return "#4ade80"; // Trico
      case 13: return "#06b6d4"; // Mage
      case 14: return "#2dd4bf"; // Turtle
      case 15: return "#eab308"; // Boomer
      case 16: return "#a855f7"; // Electrico
      case 17: return "#84cc16"; // Grub
      case 19: return "#fb7185"; // Raon
      case 21: return "#10b981"; // Frog
      case 22: return "#3b82f6"; // Kalsiddon
      case 23: return "#d946ef"; // Maya
      case 24: return "#ef4444"; // Phoenix
      default: return "#94a3b8";
    }
  };

  return (
    <div style={{
      background: "rgba(11, 17, 33, 0.96)",
      border: "1px solid rgba(56, 189, 248, 0.35)",
      borderRadius: "12px",
      padding: "16px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.8), 0 0 25px rgba(56, 189, 248, 0.15)",
      color: "#f8fafc",
      fontFamily: "Inter, sans-serif",
      maxWidth: "760px",
      width: "100%",
      maxHeight: "85vh",
      display: "flex",
      flexDirection: "column",
      backdropFilter: "blur(12px)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        paddingBottom: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>🚀</span>
          <h2 style={{ margin: 0, fontSize: "16px", letterSpacing: "1px", color: "#38bdf8", fontWeight: 800 }}>
            {title}
          </h2>
          <span style={{
            fontSize: "11px",
            background: "rgba(56, 189, 248, 0.15)",
            color: "#38bdf8",
            padding: "2px 8px",
            borderRadius: "12px",
            fontWeight: 700,
          }}>
            {mobiles.length} Disponibles
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="Buscar móvil..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "6px",
              padding: "4px 10px",
              color: "#fff",
              fontSize: "12px",
              outline: "none",
            }}
          />
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "#334155",
                border: "none",
                borderRadius: "6px",
                color: "#fff",
                cursor: "pointer",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Grid of 25 Mobiles */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: "10px",
        overflowY: "auto",
        paddingRight: "4px",
      }}>
        {mobiles.map((m) => {
          const isSelected = m.id === selectedMobileId;
          const badgeColor = getMobileBadgeColor(m.id);

          return (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              style={{
                background: isSelected
                  ? "linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(15, 23, 42, 0.9))"
                  : "rgba(30, 41, 59, 0.6)",
                border: isSelected ? "2px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.8)",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
                position: "relative",
                outline: "none",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "#60a5fa";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.8)";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {/* Badge ID */}
              <div style={{
                position: "absolute",
                top: "4px",
                left: "4px",
                fontSize: "9px",
                fontWeight: 800,
                color: "#94a3b8",
              }}>
                #{m.id}
              </div>

              {/* Mobile Avatar Icon */}
              <div style={{
                width: "44px",
                height: "32px",
                background: badgeColor,
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#030712",
                fontWeight: 900,
                fontSize: "13px",
                letterSpacing: "0.5px",
                boxShadow: `0 4px 10px ${badgeColor}40`,
                marginTop: "4px",
              }}>
                {m.name.slice(0, 3).toUpperCase()}
              </div>

              {/* Mobile Name & Angles */}
              <div>
                <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "13px" }}>
                  {m.name}
                </div>
                <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: "2px" }}>
                  {m.minAngle}° - {m.maxAngle}°
                </div>
              </div>

              {/* Special mechanics hint */}
              <div style={{
                fontSize: "9px",
                color: isSelected ? "#38bdf8" : "#64748b",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
              }}>
                {m.id === 13 && "Helix Láser"}
                {m.id === 14 && "TimeBomb"}
                {m.id === 2 && "Satélite Thor"}
                {m.id === 11 && "Taladro Subterráneo"}
                {m.id === 19 && "Minas Caminantes"}
                {m.id === 4 && "Salvas Múltiples"}
                {m.id === 15 && "Curva Viento"}
                {m.id === 3 && "Rayo Ionosférico"}
                {m.id === 6 && "Haz Orbital"}
                {m.id === 8 && "Sables de Energía"}
                {m.id === 0 && "Cañón Balístico"}
                {m.id === 1 && "Congelación"}
                {![13, 14, 2, 11, 19, 4, 15, 3, 6, 8, 0, 1].includes(m.id) && "Proyectil Balístico"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
