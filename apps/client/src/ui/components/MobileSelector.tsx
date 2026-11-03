import React from "react";
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
  const mobiles = Object.values(MOBILES_DATA);

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
      background: "rgba(11, 17, 33, 0.97)",
      border: "1px solid rgba(56, 189, 248, 0.35)",
      borderRadius: "10px",
      padding: "12px 14px",
      boxShadow: "0 16px 36px rgba(0,0,0,0.85), 0 0 20px rgba(56, 189, 248, 0.15)",
      color: "#f8fafc",
      fontFamily: "Inter, sans-serif",
      maxWidth: "520px",
      width: "92vw",
      display: "flex",
      flexDirection: "column",
      backdropFilter: "blur(12px)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "10px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        paddingBottom: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>🚀</span>
          <h2 style={{ margin: 0, fontSize: "14px", letterSpacing: "0.5px", color: "#38bdf8", fontWeight: 800 }}>
            {title}
          </h2>
          <span style={{
            fontSize: "10px",
            background: "rgba(56, 189, 248, 0.15)",
            color: "#38bdf8",
            padding: "2px 6px",
            borderRadius: "10px",
            fontWeight: 700,
          }}>
            {mobiles.length} Disponibles
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "rgba(51, 65, 85, 0.7)",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: "12px",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Compact Grid of 25 Mobiles (5 columns x 5 rows) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "6px",
        maxHeight: "68vh",
        overflowY: "auto",
        paddingRight: "2px",
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
                  ? "linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(15, 23, 42, 0.95))"
                  : "rgba(22, 30, 49, 0.75)",
                border: isSelected ? "1.5px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.7)",
                borderRadius: "6px",
                padding: "6px 4px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                transition: "all 0.12s ease",
                outline: "none",
                textAlign: "center",
                boxShadow: isSelected ? `0 0 10px ${badgeColor}50` : "none",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "#60a5fa";
                  e.currentTarget.style.background = "rgba(30, 41, 59, 0.9)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.7)";
                  e.currentTarget.style.background = "rgba(22, 30, 49, 0.75)";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {/* Mini Color Tag with 3-letter abbreviation */}
              <div style={{
                background: `${badgeColor}25`,
                border: `1px solid ${badgeColor}60`,
                color: badgeColor,
                borderRadius: "3px",
                fontSize: "8.5px",
                fontWeight: 900,
                padding: "1px 4px",
                letterSpacing: "0.5px",
                lineHeight: 1.1,
              }}>
                {m.name.slice(0, 3).toUpperCase()}
              </div>

              {/* Mobile Name */}
              <div style={{
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "11px",
                lineHeight: 1.2,
                marginTop: "1px",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {m.name}
              </div>

              {/* Compact Angle Range */}
              <div style={{
                color: "#94a3b8",
                fontSize: "9px",
                fontWeight: 600,
                lineHeight: 1,
              }}>
                {m.minAngle}°-{m.maxAngle}°
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
