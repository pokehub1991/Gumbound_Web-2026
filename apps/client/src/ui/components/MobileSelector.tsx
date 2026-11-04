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
    <div className="pixel-box" style={{
      borderRadius: "6px",
      padding: "14px 16px",
      color: "#f8fafc",
      fontFamily: "'Pixelify Sans', cursive, sans-serif",
      maxWidth: "540px",
      width: "92vw",
      display: "flex",
      flexDirection: "column",
      imageRendering: "pixelated",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
        borderBottom: "2px solid #000000",
        paddingBottom: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>🚀</span>
          <h2 style={{ margin: 0, fontSize: "16px", letterSpacing: "0.5px", color: "#38bdf8", fontWeight: 700, textShadow: "1px 1px 0 #000" }}>
            {title}
          </h2>
          <span style={{
            fontSize: "12px",
            background: "rgba(56, 189, 248, 0.2)",
            color: "#38bdf8",
            border: "1px solid #000",
            padding: "2px 6px",
            borderRadius: "3px",
            fontWeight: 700,
            textShadow: "1px 1px 0 #000",
          }}>
            {mobiles.length} Disponibles
          </span>
        </div>

        {onClose && (
          <button
            className="pixel-btn"
            onClick={onClose}
            style={{
              background: "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
              borderRadius: "3px",
              color: "#fff",
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: "13px",
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
              className="pixel-btn"
              onClick={() => handleSelect(m.id)}
              style={{
                background: isSelected
                  ? "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)"
                  : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                border: isSelected ? "2px solid #38bdf8" : "2px solid #000000",
                borderRadius: "4px",
                padding: "6px 4px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                outline: "none",
                textAlign: "center",
                boxShadow: isSelected
                  ? "0 0 10px #38bdf8, inset 1px 1px 0 #fff"
                  : "inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 #000, 0 2px 0 #000",
              }}
            >
              {/* Mini Color Tag with 3-letter abbreviation */}
              <div style={{
                background: `${badgeColor}35`,
                border: "1px solid #000",
                color: badgeColor,
                borderRadius: "3px",
                fontSize: "10px",
                fontWeight: 700,
                padding: "1px 5px",
                letterSpacing: "0.5px",
                lineHeight: 1.1,
                textShadow: "1px 1px 0 #000",
              }}>
                {m.name.slice(0, 3).toUpperCase()}
              </div>

              {/* Mobile Name */}
              <div style={{
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                lineHeight: 1.2,
                marginTop: "1px",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textShadow: "1px 1px 0 #000",
              }}>
                {m.name}
              </div>

              {/* Compact Angle Range */}
              <div style={{
                color: isSelected ? "#e0f2fe" : "#94a3b8",
                fontSize: "11px",
                fontWeight: 600,
                lineHeight: 1,
                textShadow: "1px 1px 0 #000",
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
