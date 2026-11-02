import React, { useEffect, useState, useRef } from "react";
import { CombatArena } from "../../core/combat/CombatArena.js";
import { MobileSelector } from "../components/MobileSelector.js";
import { MOBILES_DATA } from "../../core/constants/mobiles.js";
import { AudioManager } from "../../core/audio/AudioManager.js";

interface ArenaScreenProps {
  arena: CombatArena | null;
  onExit?: () => void;
}

export const ArenaScreen: React.FC<ArenaScreenProps> = ({ arena }) => {

  const [playerMobileId, setPlayerMobileId] = useState<number>(0);
  const [botMobileId, setBotMobileId] = useState<number>(1);
  const [shotType, setShotType] = useState<number>(0);

  const [angle, setAngle] = useState<number>(45);
  const [windPower, setWindPower] = useState<number>(8);
  const [windAngle, setWindAngle] = useState<number>(45);

  const [botHp, setBotHp] = useState<number>(1000);
  const [botMaxHp, setBotMaxHp] = useState<number>(1000);

  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [selectorTarget, setSelectorTarget] = useState<"player" | "bot">("player");
  const [shootMode, setShootMode] = useState<"space" | "drag">("space");
  const [lastPower, setLastPower] = useState<number | null>(null);

  // Direct DOM references for 60fps smooth power bar with zero React re-render overhead
  const powerBarFillRef = useRef<HTMLDivElement>(null);
  const powerBarTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!arena) return;

    setPlayerMobileId(arena.player.mobileType);
    setBotMobileId(arena.bot.mobile.mobileType);
    setAngle(arena.player.angleDeg);
    setWindPower(arena.windPower);
    setWindAngle(arena.windAngle);

    arena.onWindUpdate = (pw, ang) => {
      setWindPower(pw);
      setWindAngle(ang);
    };

    arena.onPlayerAngleUpdate = (ang) => {
      setAngle(ang);
    };

    arena.onPlayerPowerUpdate = (pw) => {
      if (powerBarFillRef.current) {
        powerBarFillRef.current.style.width = `${pw}%`;
      }
      if (powerBarTextRef.current) {
        powerBarTextRef.current.textContent = `POTENCIA: ${Math.round(pw)}%`;
      }
    };

    arena.onBotHpUpdate = (hp, maxHp) => {
      setBotHp(hp);
      setBotMaxHp(maxHp);
    };

    arena.onLastPowerUpdate = (pw) => {
      setLastPower(pw);
    };

    arena.onTurnReady = () => {
      if (powerBarFillRef.current) powerBarFillRef.current.style.width = "0%";
      if (powerBarTextRef.current) powerBarTextRef.current.textContent = "POTENCIA: 0%";
    };
  }, [arena]);

  const handleSelectShotType = (type: number) => {
    setShotType(type);
    if (arena) {
      arena.setShotType(type);
      AudioManager.play("click", 0.7);
    }
  };

  const handleMobileSelect = (id: number) => {
    if (!arena) return;
    if (selectorTarget === "player") {
      setPlayerMobileId(id);
      arena.setPlayerMobile(id);
    } else {
      setBotMobileId(id);
      arena.setBotMobile(id);
    }
    setIsSelectorOpen(false);
  };

  const handleRandomizeWind = () => {
    if (arena) {
      arena.randomizeWind();
      AudioManager.play("click", 0.7);
    }
  };

  const handleResetBot = () => {
    if (arena) {
      arena.resetBot();
      AudioManager.play("click", 0.7);
    }
  };



  const currentMob = MOBILES_DATA[playerMobileId] || MOBILES_DATA[0];
  const botMob = MOBILES_DATA[botMobileId] || MOBILES_DATA[1];

  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      fontFamily: "Inter, Roboto, sans-serif",
      userSelect: "none",
      padding: "12px",
      boxSizing: "border-box",
    }}>
      {/* ============================================================ */}
      {/* TOP HEADER HUD */}
      {/* ============================================================ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "none",
        gap: "12px",
      }}>
        {/* Game Title, Map & Reset Bar (Compact) */}
        <div style={{
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "8px",
          padding: "5px 10px",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
        }}>
          <span style={{
            fontSize: "13px",
            fontWeight: 900,
            letterSpacing: "0.5px",
            background: "linear-gradient(90deg, #38bdf8, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            GB
          </span>
          <span style={{
            fontSize: "10px",
            background: "rgba(56, 189, 248, 0.2)",
            color: "#38bdf8",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 800,
          }}>
            METAMINE
          </span>

          <button
            onClick={() => {
              if (arena) {
                arena.resetMap();
                AudioManager.play("click", 0.7);
              }
            }}
            style={{
              background: "linear-gradient(135deg, #0284c7, #2563eb)",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              padding: "3px 7px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.4)",
            }}
            title="Resetear mapa y móviles"
          >
            🔄
          </button>
        </div>

        {/* Preset Zoom Control Widget */}
        <div style={{
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "8px",
          padding: "4px 8px",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
        }}>
          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, marginRight: "2px" }}>🔍</span>
          {[1.0, 1.2, 1.4].map((z) => (
            <button
              key={z}
              onClick={() => {
                if (arena) arena.engine.setPresetZoom(z);
                AudioManager.play("click", 0.6);
              }}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "4px",
                padding: "2px 6px",
                color: "#38bdf8",
                fontSize: "10px",
                fontWeight: 800,
                cursor: "pointer",
              }}
              title={`Zoom ${z}x`}
            >
              {z}x
            </button>
          ))}
        </div>

        {/* Wind Compass Indicator (Compact without redundant text) */}
        <div style={{
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "8px",
          padding: "4px 10px",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
        }}>
          {/* Compass Graphic */}
          <div style={{ position: "relative", width: "30px", height: "30px" }}>
            <svg width="30" height="30" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              <g transform={`rotate(${windAngle}, 18, 18)`}>
                <polygon points="18,5 23,26 18,21 13,26" fill="#38bdf8" />
                <circle cx="18" cy="18" r="3" fill="#ffffff" />
              </g>
            </svg>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
            <span style={{ color: "#38bdf8", fontSize: "16px", fontWeight: 900 }}>{windPower}</span>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>({windAngle}°)</span>
          </div>

          <button
            onClick={handleRandomizeWind}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#38bdf8",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "12px",
              cursor: "pointer",
            }}
            title="Generar viento aleatorio"
          >
            🎲
          </button>
        </div>

        {/* Bot Dummy Status (Compact) */}
        <div style={{
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          padding: "5px 10px",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
        }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: 800 }}>
                [{botMob.name}]
              </span>
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: 800 }}>
                {botHp} HP
              </span>
            </div>
            {/* Health Bar */}
            <div style={{
              width: "100px",
              height: "5px",
              background: "#0f172a",
              borderRadius: "3px",
              overflow: "hidden",
              marginTop: "3px",
            }}>
              <div style={{
                width: `${Math.max(0, (botHp / botMaxHp) * 100)}%`,
                height: "100%",
                background: botHp > 500 ? "#22c55e" : botHp > 250 ? "#eab308" : "#ef4444",
                transition: "width 0.25s ease",
              }} />
            </div>
          </div>

          <button
            onClick={handleResetBot}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#ef4444",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CENTER MODAL (MOBILE SELECTOR) */}
      {/* ============================================================ */}
      {isSelectorOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.65)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          pointerEvents: "auto",
        }}>
          <MobileSelector
            selectedMobileId={selectorTarget === "player" ? playerMobileId : botMobileId}
            onSelectMobile={handleMobileSelect}
            title={selectorTarget === "player" ? "ELEGIR MÓVIL DEL JUGADOR" : "ELEGIR MÓVIL DEL BOT"}
            onClose={() => setIsSelectorOpen(false)}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* BOTTOM HUD */}
      {/* ============================================================ */}
      <div style={{
        background: "rgba(11, 17, 33, 0.94)",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        borderRadius: "12px",
        padding: "8px 16px",
        backdropFilter: "blur(12px)",
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.7)",
        width: "100%",
        maxWidth: "760px",
        margin: "0 auto",
      }}>
        {/* Upper Row: Selected Mobile, Shot Selector, Angle, Camera Controls */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          {/* Active Mobile Profile & Switcher (Compact Pill with Tank Icon) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => {
                setSelectorTarget("player");
                setIsSelectorOpen(true);
              }}
              style={{
                background: "linear-gradient(135deg, #1e293b, #0f172a)",
                border: "1.5px solid #38bdf8",
                borderRadius: "8px",
                padding: "5px 10px",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}
              title="Cambiar móvil (25 móviles disponibles)"
            >
              {/* Game Tank Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="12" width="20" height="7" rx="3" />
                <circle cx="6" cy="15.5" r="1.5" fill="#38bdf8" />
                <circle cx="12" cy="15.5" r="1.5" fill="#38bdf8" />
                <circle cx="18" cy="15.5" r="1.5" fill="#38bdf8" />
                <path d="M7 12V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
                <line x1="14" y1="8" x2="20" y2="4" />
              </svg>
              <span style={{ fontSize: "13px", fontWeight: 900, color: "#fff", letterSpacing: "0.3px" }}>
                {currentMob.name}
              </span>
              <span style={{ fontSize: "10px", color: "#38bdf8", opacity: 0.85 }}>▾</span>
            </button>
          </div>

          {/* Shot Selector (S1, S2, SS Compact) */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => handleSelectShotType(0)}
              style={{
                background: shotType === 0 ? "rgba(56, 189, 248, 0.28)" : "#1e293b",
                border: shotType === 0 ? "2px solid #38bdf8" : "1px solid #334155",
                borderRadius: "6px",
                padding: "5px 12px",
                color: shotType === 0 ? "#38bdf8" : "#cbd5e1",
                fontWeight: 900,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "42px",
                boxShadow: shotType === 0 ? "0 0 10px rgba(56, 189, 248, 0.35)" : "none",
                transition: "all 0.15s ease",
              }}
              title="Shot 1 [Tecla 1]"
            >
              S1
            </button>

            <button
              onClick={() => handleSelectShotType(1)}
              style={{
                background: shotType === 1 ? "rgba(234, 179, 8, 0.28)" : "#1e293b",
                border: shotType === 1 ? "2px solid #eab308" : "1px solid #334155",
                borderRadius: "6px",
                padding: "5px 12px",
                color: shotType === 1 ? "#eab308" : "#cbd5e1",
                fontWeight: 900,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "42px",
                boxShadow: shotType === 1 ? "0 0 10px rgba(234, 179, 8, 0.35)" : "none",
                transition: "all 0.15s ease",
              }}
              title="Shot 2 [Tecla 2]"
            >
              S2
            </button>

            <button
              onClick={() => handleSelectShotType(2)}
              style={{
                background: shotType === 2 ? "rgba(239, 68, 68, 0.28)" : "#1e293b",
                border: shotType === 2 ? "2px solid #ef4444" : "1px solid #334155",
                borderRadius: "6px",
                padding: "5px 12px",
                color: shotType === 2 ? "#ef4444" : "#cbd5e1",
                fontWeight: 900,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "42px",
                boxShadow: shotType === 2 ? "0 0 10px rgba(239, 68, 68, 0.35)" : "none",
                transition: "all 0.15s ease",
              }}
              title="Super Shot [Tecla 3 / F]"
            >
              SS
            </button>
          </div>

          {/* Clean Angle Badge (Number only, no text, no arrow buttons as requested) */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1e293b",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "6px",
            padding: "6px 14px",
            minWidth: "48px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>
            <span style={{ color: "#ffffff", fontSize: "19px", fontWeight: 900, letterSpacing: "0.5px" }}>
              {angle}°
            </span>
          </div>
        </div>

        {/* Lower Row: Mode Toggle + Full-Width Power Meter Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          gap: "10px",
          padding: "2px 0",
        }}>
          {/* Shoot Mode Toggle: Space vs Drag */}
          <button
            onClick={() => {
              const newMode = shootMode === "space" ? "drag" : "space";
              setShootMode(newMode);
              if (arena) arena.shootMode = newMode;
              AudioManager.play("click", 0.7);
            }}
            style={{
              background: shootMode === "drag" ? "linear-gradient(135deg, #10b981, #059669)" : "#1e293b",
              border: `1px solid ${shootMode === "drag" ? "#34d399" : "#334155"}`,
              borderRadius: "6px",
              padding: "4px 10px",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: shootMode === "drag" ? "0 0 10px rgba(16, 185, 129, 0.4)" : "none",
              transition: "all 0.15s ease",
            }}
            title={shootMode === "drag" ? "Modo arrastrar con ratón (Click y suelta)" : "Modo barra espaciadora (Mantén Espacio)"}
          >
            {shootMode === "drag" ? "🖱 SLICE" : "⌨ ESPACIO"}
          </button>

          {/* Power Bar Meter with Last Power Marker */}
          <div style={{
            flex: 1,
            width: "100%",
            height: "28px",
            background: "#0f172a",
            borderRadius: "6px",
            border: "1px solid #334155",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)",
          }}>
            {/* 25%, 50%, 75% tick markers */}
            <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.2)" }} />

            {/* Last Shot Power Indicator Marker */}
            {lastPower !== null && (
              <div
                style={{
                  position: "absolute",
                  left: `${lastPower}%`,
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  background: "#fbbf24",
                  boxShadow: "0 0 8px #f59e0b",
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "-4px",
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "6px solid #fbbf24",
                  }}
                />
              </div>
            )}

            {/* Filled Power Progress */}
            <div
              ref={powerBarFillRef}
              style={{
                width: "0%",
                height: "100%",
                background: "linear-gradient(90deg, #38bdf8, #818cf8, #f43f5e)",
                transition: "none",
              }}
            />

            {/* Text Value */}
            <div
              ref={powerBarTextRef}
              style={{
                position: "absolute",
                width: "100%",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: 900,
                color: "#ffffff",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              }}
            >
              POTENCIA: 0%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
