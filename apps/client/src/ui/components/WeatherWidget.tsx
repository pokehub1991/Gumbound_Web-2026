import React, { useState } from "react";
import { WeatherDefinition, WeatherSlotItem, WeatherRoundInfo } from "../../core/weather/WeatherManager.js";

export interface WeatherWidgetProps {
  currentWeather: WeatherDefinition;
  tapeSlice: WeatherSlotItem[];
  roundInfo?: WeatherRoundInfo;
  windPower: number;
  windAngle: number;
  isWindEnabled: boolean;
}

/**
 * WeatherWidget - Retro Pixel-Art HUD Component
 * 
 * Central HUD displaying the GunBound weather roulette cassette and wind gauge.
 * Designed with authentic GunBound pixel-art aesthetics:
 * - Pixel-box arcade dark-navy container with black borders & 3D bevel.
 * - Deep sunken arcade wells for roulette track and wind compass.
 * - Tabular pixel font for wind speed, cyan directional compass, and lift indicators.
 */
export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  currentWeather,
  tapeSlice,
  roundInfo,
  windPower,
  windAngle,
  isWindEnabled,
}) => {
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

  // Wind vertical component (upward lift vs downward push)
  const rad = (windAngle * Math.PI) / 180;
  const sinVal = Math.sin(rad);
  const isUpward = isWindEnabled && windPower > 0 && sinVal > 0.15;
  const isDownward = isWindEnabled && windPower > 0 && sinVal < -0.15;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        pointerEvents: "auto",
        userSelect: "none",
        cursor: "help",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${currentWeather.nameEs}: ${currentWeather.description} | Viento: ${isWindEnabled ? `${Math.round(windPower)} a ${Math.round(windAngle)}°` : "Desactivado"}`}
    >
      {/* Outer Pixel Box Frame (Matching other HUDs: METAMINE pill, Turn List, Cockpit) */}
      <div
        className="pixel-box"
        style={{
          display: "flex",
          alignItems: "center",
          height: "36px",
          padding: "3px 6px",
          borderRadius: "4px",
          boxSizing: "border-box",
          gap: "5px",
        }}
      >
        {/* SECTION 1: Weather Roulette Cassette Sunken Track */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            background: "var(--bg-well-dark)",
            border: "1.5px solid #000000",
            borderRadius: "3px",
            height: "26px",
            padding: "0 4px",
            boxSizing: "border-box",
            boxShadow: "var(--shadow-well-sunken)",
            gap: "3px",
          }}
        >
          {slots.map((slot, idx) => {
            if (slot.isActive) {
              // ACTIVE CURRENT TURN (Slot 1) - Cyan Highlighted Pixel Box with Corner Pips
              return (
                <div
                  key={`slot-${slot.id}-${idx}`}
                  style={{
                    position: "relative",
                    width: "24px",
                    height: "24px",
                    background: "var(--bg-panel-blue)",
                    border: "1.5px solid #ffffff",
                    borderRadius: "3px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "var(--shadow-glow-cyan), inset 1px 1px 0 rgba(255, 255, 255, 0.4)",
                    zIndex: 10,
                  }}
                >
                  {/* Top Cyan/Yellow Corner Dot Indicator */}
                  <div
                    style={{
                      position: "absolute",
                      top: "-2px",
                      left: "-2px",
                      width: "3px",
                      height: "3px",
                      borderRadius: "50%",
                      background: "var(--color-warning-light)",
                      boxShadow: "0 0 2px var(--color-warning-light)",
                    }}
                  />
                  {/* Bottom Cyan/Yellow Corner Dot Indicator */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      left: "-2px",
                      width: "3px",
                      height: "3px",
                      borderRadius: "50%",
                      background: "var(--color-warning-light)",
                      boxShadow: "0 0 2px var(--color-warning-light)",
                    }}
                  />

                  {/* Weather Icon Image */}
                  <img
                    src={slot.iconActive}
                    alt={slot.name}
                    style={{
                      width: "16px",
                      height: "16px",
                      imageRendering: "pixelated",
                      display: "block",
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.85))",
                    }}
                  />

                  {/* Turn Duration Pips (Round progress) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "1px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                    }}
                  >
                    {Array.from({ length: roundInfo?.turnsPerRound || 2 }).map((_, pipIdx) => {
                      const isCurrent = pipIdx === (roundInfo ? roundInfo.turnInRound - 1 : 0);
                      const isElapsed = pipIdx < (roundInfo ? roundInfo.turnInRound - 1 : 0);
                      return (
                        <div
                          key={`pip-${pipIdx}`}
                          style={{
                            width: "3px",
                            height: "3px",
                            borderRadius: "50%",
                            background: isCurrent ? "var(--color-warning-light)" : isElapsed ? "var(--color-primary)" : "rgba(255,255,255,0.25)",
                            boxShadow: isCurrent ? "0 0 3px var(--color-warning-light)" : "none",
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
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isPast ? 0.35 : 0.85,
                  filter: isPast ? "grayscale(100%) brightness(0.6)" : "none",
                }}
              >
                <img
                  src={isPast ? slot.iconInactive : slot.iconActive}
                  alt={slot.name}
                  style={{
                    width: "15px",
                    height: "15px",
                    imageRendering: "pixelated",
                    display: "block",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Central Pixel Divider */}
        <div
          style={{
            width: "1.5px",
            height: "20px",
            background: "#000000",
            boxShadow: "1px 0 0 rgba(255, 255, 255, 0.12)",
            margin: "0 1px",
          }}
        />

        {/* SECTION 2: Wind Gauge Module Sunken Track */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-well-dark)",
            border: "1.5px solid #000000",
            borderRadius: "3px",
            height: "26px",
            padding: "0 6px",
            boxSizing: "border-box",
            boxShadow: "var(--shadow-well-sunken)",
            gap: "5px",
          }}
        >
          {/* Wind Compass Dial */}
          <div style={{ position: "relative", width: "18px", height: "18px", opacity: isWindEnabled ? 1 : 0.4 }}>
            <svg width="18" height="18" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="#0b1329" stroke="#000000" strokeWidth="2.5" />
              <line x1="18" y1="4" x2="18" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <line x1="4" y1="18" x2="32" y2="18" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <g transform={`rotate(${-windAngle}, 18, 18)`}>
                <polygon
                  points="31,18 10,12 15,18 10,24"
                  fill={isWindEnabled ? "var(--color-primary)" : "var(--color-slate-500)"}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
                <circle cx="18" cy="18" r="3" fill="#ffffff" stroke="#000000" strokeWidth="1" />
              </g>
            </svg>
          </div>

          {/* Wind Magnitude Number in Tabular Pixel Font */}
          <span
            className="num-font"
            style={{
              color: isWindEnabled ? "var(--color-primary)" : "var(--color-slate-400)",
              fontSize: "14px",
              fontWeight: 700,
              textShadow: "var(--text-shadow-pixel-bold)",
              minWidth: "18px",
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            {isWindEnabled ? Math.round(windPower) : 0}
          </span>

          {/* Vertical Wind Lift Indicators (▲ / ─ / ▼) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1px",
              lineHeight: 1,
              marginLeft: "1px",
            }}
          >
            {/* Upward Wind Arrow */}
            <span
              style={{
                fontSize: "7px",
                lineHeight: "6px",
                color: isUpward ? "var(--color-warning-light)" : "rgba(255, 255, 255, 0.18)",
                textShadow: isUpward ? "0 0 4px var(--color-warning-light)" : "none",
                fontWeight: 900,
              }}
            >
              ▲
            </span>

            {/* Horizontal Line Indicator */}
            <div
              style={{
                width: "9px",
                height: "1.5px",
                background: isWindEnabled ? "#2dd4bf" : "rgba(255, 255, 255, 0.18)",
                boxShadow: isWindEnabled ? "0 0 3px #2dd4bf" : "none",
                borderRadius: "1px",
              }}
            />

            {/* Downward Wind Arrow */}
            <span
              style={{
                fontSize: "7px",
                lineHeight: "6px",
                color: isDownward ? "var(--color-danger)" : "rgba(255, 255, 255, 0.18)",
                textShadow: isDownward ? "0 0 4px var(--color-danger)" : "none",
                fontWeight: 900,
              }}
            >
              ▼
            </span>
          </div>
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
            border: "var(--border-pixel-primary-thin)",
            borderRadius: "4px",
            padding: "8px 12px",
            minWidth: "220px",
            maxWidth: "300px",
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
                fontFamily: "var(--font-game)",
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
              fontFamily: "var(--font-game)",
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
              fontFamily: "var(--font-game)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Turno activo:</span>
              <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>{activeSlot.name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Ronda de clima:</span>
              <span style={{ color: "var(--color-warning-light)", fontWeight: "bold" }}>
                Turno {roundInfo?.turnInRound || 1} de {roundInfo?.turnsPerRound || 2}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Viento actual:</span>
              <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>
                {isWindEnabled ? `${Math.round(windPower)} m/s (${Math.round(windAngle)}°)` : "Desactivado"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
