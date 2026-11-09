import React, { useState } from "react";
import { WeatherDefinition, WeatherSlotItem, WeatherRoundInfo } from "../../core/weather/WeatherManager.js";

interface WeatherWidgetProps {
  currentWeather: WeatherDefinition;
  tapeSlice: WeatherSlotItem[];
  roundInfo?: WeatherRoundInfo;
}

/**
 * WeatherWidget
 * 
 * Styled to perfectly match the game's retro-arcade pixel-box HUD.
 * Features:
 * - Same color palette (dark navy/slate background, pixel-art borders, neon cyan/yellow accents).
 * - Recessed 5-slot cassette tape track.
 * - Slot 0: Previous turn (grayscale, dimmed).
 * - Slot 1: Active turn (framed with glowing cyan/purple border & inward pointer arrows) with round turn-pips.
 * - Slots 2..4: Upcoming turn previews with subtle separators.
 * - Detailed pixel-art hover tooltip with weather information and round duration counter.
 */
export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ currentWeather, tapeSlice, roundInfo }) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Fallback if tapeSlice is not yet populated
  const slots: WeatherSlotItem[] = tapeSlice && tapeSlice.length === 5
    ? tapeSlice
    : [
        { id: 0, type: "thor", name: "Thor", iconActive: "/sprites/weather/weather_0_active.png", iconInactive: "/sprites/weather/weather_0_inactive.png", isActive: false, isPast: true, slotIndex: 0 },
        { id: currentWeather.id, type: currentWeather.type, name: currentWeather.nameEs, iconActive: currentWeather.iconActive, iconInactive: currentWeather.iconInactive, isActive: true, isPast: false, slotIndex: 1 },
        { id: 1, type: "wind", name: "Viento", iconActive: "/sprites/weather/weather_1_active.png", iconInactive: "/sprites/weather/weather_1_inactive.png", isActive: false, isPast: false, slotIndex: 2 },
        { id: 3, type: "sun", name: "Sol", iconActive: "/sprites/weather/weather_3_active.png", iconInactive: "/sprites/weather/weather_3_inactive.png", isActive: false, isPast: false, slotIndex: 3 },
        { id: 4, type: "lightning", name: "Rayo", iconActive: "/sprites/weather/weather_4_active.png", iconInactive: "/sprites/weather/weather_4_inactive.png", isActive: false, isPast: false, slotIndex: 4 },
      ];

  const activeSlot = slots[1] || slots.find((s) => s.isActive) || slots[0];

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        pointerEvents: "auto",
        userSelect: "none",
        cursor: "help",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${currentWeather.nameEs}: ${currentWeather.description}`}
    >
      {/* Outer Pixel Box matching the Top HUD (Wind Capsule, Timer, Turn List) */}
      <div
        className="pixel-box"
        style={{
          background: "var(--bg-panel-dark)",
          borderRadius: "4px",
          padding: "3px 6px",
          height: "36px",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: "inset 1px 1px 0px rgba(56, 189, 248, 0.4), inset -1px -1px 0px #000, 0 3px 0px rgba(0,0,0,0.6)",
          border: "2px solid #000000",
        }}
      >
        {/* Recessed Tape Cassette Track */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            background: "#050914",
            border: "1.5px solid #1e3a5f",
            borderRadius: "4px",
            height: "26px",
            padding: "0 3px",
            boxSizing: "border-box",
            boxShadow: "inset 0 1.5px 3px rgba(0,0,0,0.85)",
            gap: "3px",
          }}
        >
          {slots.map((slot, idx) => {
            if (slot.isActive) {
              // ACTIVE CURRENT TURN (Slot 1) - Iconic Arcade Selector Box with 4 Yellow Arrows
              return (
                <div
                  key={`slot-${slot.id}-${idx}`}
                  style={{
                    position: "relative",
                    width: "28px",
                    height: "30px",
                    background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
                    border: "1.8px solid var(--color-primary)",
                    borderRadius: "3px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 8px rgba(56, 189, 248, 0.7), inset 0 0 4px rgba(56, 189, 248, 0.3)",
                    zIndex: 10,
                    margin: "0 -1px",
                  }}
                >
                  {/* Top Arrow: points DOWN */}
                  <svg
                    style={{ position: "absolute", top: "-5px", left: "50%", transform: "translateX(-50%)" }}
                    width="7"
                    height="5"
                    viewBox="0 0 8 6"
                  >
                    <polygon points="0,0 8,0 4,6" fill="#facc15" stroke="#000000" strokeWidth="1" />
                  </svg>

                  {/* Bottom Arrow: points UP */}
                  <svg
                    style={{ position: "absolute", bottom: "-5px", left: "50%", transform: "translateX(-50%)" }}
                    width="7"
                    height="5"
                    viewBox="0 0 8 6"
                  >
                    <polygon points="4,0 8,6 0,6" fill="#facc15" stroke="#000000" strokeWidth="1" />
                  </svg>

                  {/* Left Arrow: points RIGHT */}
                  <svg
                    style={{ position: "absolute", left: "-5px", top: "50%", transform: "translateY(-50%)" }}
                    width="5"
                    height="7"
                    viewBox="0 0 6 8"
                  >
                    <polygon points="0,0 6,4 0,8" fill="#facc15" stroke="#000000" strokeWidth="1" />
                  </svg>

                  {/* Right Arrow: points LEFT */}
                  <svg
                    style={{ position: "absolute", right: "-5px", top: "50%", transform: "translateY(-50%)" }}
                    width="5"
                    height="7"
                    viewBox="0 0 6 8"
                  >
                    <polygon points="6,0 0,4 6,8" fill="#facc15" stroke="#000000" strokeWidth="1" />
                  </svg>

                  {/* Weather Icon Image */}
                  <img
                    src={slot.iconActive}
                    alt={slot.name}
                    style={{
                      width: "18px",
                      height: "18px",
                      imageRendering: "pixelated",
                      display: "block",
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
                      marginTop: "-3px",
                    }}
                  />

                  {/* Modern Turn Duration Pips (Round progress) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "2px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "3px",
                    }}
                    title={`Turno ${roundInfo?.turnInRound || 1} de ${roundInfo?.turnsPerRound || 2}`}
                  >
                    {Array.from({ length: roundInfo?.turnsPerRound || 2 }).map((_, pipIdx) => {
                      const isCurrent = pipIdx === (roundInfo ? roundInfo.turnInRound - 1 : 0);
                      const isElapsed = pipIdx < (roundInfo ? roundInfo.turnInRound - 1 : 0);
                      return (
                        <div
                          key={`pip-${pipIdx}`}
                          style={{
                            width: "3.5px",
                            height: "3.5px",
                            borderRadius: "50%",
                            background: isCurrent ? "#facc15" : isElapsed ? "#38bdf8" : "rgba(255,255,255,0.22)",
                            boxShadow: isCurrent ? "0 0 5px #facc15" : "none",
                            transition: "all 0.2s ease-out",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Past or Upcoming Slots
            const isPast = slot.isPast;
            return (
              <div
                key={`slot-${slot.id}-${idx}`}
                style={{
                  width: "22px",
                  height: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isPast ? 0.38 : 0.85,
                  filter: isPast ? "grayscale(100%) brightness(0.7)" : "none",
                  transition: "all 0.2s ease-out",
                  borderRight: idx < slots.length - 1 && !isPast && idx !== 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <img
                  src={isPast ? slot.iconInactive : slot.iconActive}
                  alt={slot.name}
                  style={{
                    width: "18px",
                    height: "18px",
                    imageRendering: "pixelated",
                    display: "block",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Detailed Pixel Tooltip on Hover */}
      {isHovered && (
        <div
          className="pixel-box"
          style={{
            position: "absolute",
            top: "42px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(11, 19, 41, 0.98)",
            border: "2px solid var(--color-primary)",
            borderRadius: "4px",
            padding: "8px 12px",
            minWidth: "210px",
            maxWidth: "280px",
            zIndex: 100,
            boxShadow: "0 6px 16px rgba(0,0,0,0.85), 0 0 12px rgba(56, 189, 248, 0.35)",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <img
              src={activeSlot.iconActive}
              alt=""
              style={{ width: "19px", height: "19px", imageRendering: "pixelated" }}
            />
            <span
              style={{
                color: currentWeather.color || "var(--color-primary)",
                fontSize: "12px",
                fontWeight: "bold",
                letterSpacing: "0.5px",
                fontFamily: "var(--font-family)",
                textShadow: "var(--text-shadow-pixel)",
              }}
            >
              {currentWeather.nameEs.toUpperCase()}
            </span>
          </div>
          <div
            style={{
              color: "#cbd5e1",
              fontSize: "10.5px",
              lineHeight: "1.4",
              fontFamily: "var(--font-family)",
            }}
          >
            {currentWeather.description}
          </div>
          <div
            style={{
              marginTop: "4px",
              borderTop: "1px dashed rgba(255,255,255,0.15)",
              paddingTop: "4px",
              fontSize: "9.5px",
              color: "#94a3b8",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              fontFamily: "var(--font-family)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Turno activo:</span>
              <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{activeSlot.name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Ronda de clima:</span>
              <span style={{ color: "#facc15", fontWeight: "bold" }}>
                Turno {roundInfo?.turnInRound || 1} de {roundInfo?.turnsPerRound || 2}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Próximo cambio:</span>
              <span
                style={{
                  color: (roundInfo?.turnsRemaining ?? 0) === 0 ? "#ef4444" : "#38bdf8",
                  fontWeight: "bold",
                }}
              >
                {(roundInfo?.turnsRemaining ?? 0) === 0
                  ? "¡Cambia en el próximo turno!"
                  : `En ${roundInfo?.turnsRemaining} turno`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
