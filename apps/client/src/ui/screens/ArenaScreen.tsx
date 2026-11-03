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
  const [windPower, setWindPower] = useState<number>(0);
  const [windAngle, setWindAngle] = useState<number>(0);
  const [isWindEnabled, setIsWindEnabled] = useState<boolean>(false);

  const [botHp, setBotHp] = useState<number>(1000);
  const [botMaxHp, setBotMaxHp] = useState<number>(1000);

  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [selectorTarget, setSelectorTarget] = useState<"player" | "bot">("player");
  const [shootMode, setShootMode] = useState<"space" | "drag">("space");
  const [lastPower, setLastPower] = useState<number | null>(null);

  // Audio and Camera
  const [isMusicActive, setIsMusicActive] = useState<boolean>(!AudioManager.isMusicMuted);
  const [currentZoom, setCurrentZoom] = useState<number>(1.2);
  const [isBotImmortal, setIsBotImmortal] = useState<boolean>(true);

  // Direct DOM reference for 60fps smooth power bar with zero React re-render overhead
  const powerBarFillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!arena) return;

    setPlayerMobileId(arena.player.mobileType);
    setBotMobileId(arena.bot.mobile.mobileType);
    setAngle(arena.player.angleDeg);
    setWindPower(arena.windPower);
    setWindAngle(arena.windAngle);
    setIsWindEnabled(arena.isWindEnabled);
    setIsBotImmortal(arena.bot.isImmortal);
    arena.setShootMode(shootMode);

    arena.onWindUpdate = (pw, ang) => {
      setWindPower(pw);
      setWindAngle(ang);
      setIsWindEnabled(arena.isWindEnabled);
    };

    arena.onPlayerAngleUpdate = (ang) => {
      setAngle(ang);
    };

    arena.onPlayerPowerUpdate = (pw) => {
      if (powerBarFillRef.current) {
        powerBarFillRef.current.style.width = `${pw}%`;
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

  const handleToggleWind = () => {
    if (arena) {
      const enabled = arena.toggleWind();
      setIsWindEnabled(enabled);
      setWindPower(arena.windPower);
      setWindAngle(arena.windAngle);
      AudioManager.play("click", 0.7);
    }
  };

  const handleResetBot = () => {
    if (arena) {
      arena.resetBot();
      AudioManager.play("click", 0.7);
    }
  };

  const handleToggleMusic = () => {
    const active = AudioManager.toggleMusic();
    setIsMusicActive(active);
    AudioManager.play("click", 0.7);
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
      {/* TOP HEADER HUD (COMPACT & MODERN CLEAN ICONS) */}
      {/* ============================================================ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "none",
        gap: "10px",
        width: "100%",
      }}>
        {/* Left: Map & Reset & Segmented Zoom Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Map Pill */}
          <div style={{
            background: "rgba(15, 23, 42, 0.88)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "8px",
            padding: "4px 8px",
            height: "32px",
            boxSizing: "border-box",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            pointerEvents: "auto",
          }}>
            <span style={{ fontSize: "11px", fontWeight: 900, color: "#38bdf8", letterSpacing: "0.5px" }}>
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
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                width: "22px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                cursor: "pointer",
              }}
              title="Reiniciar mapa y posiciones"
            >
              🔄
            </button>
          </div>

          {/* Compact Segmented Zoom Pill */}
          <div style={{
            background: "rgba(15, 23, 42, 0.88)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "8px",
            padding: "2px 4px",
            height: "32px",
            boxSizing: "border-box",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            gap: "2px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            pointerEvents: "auto",
          }}>
            <span style={{ fontSize: "11px", color: "#64748b", margin: "0 4px" }}>🔍</span>
            {[
              { label: "1.2x", val: 1.2, title: "Zoom normal (1.2x)" },
              { label: "0.85x", val: 0.85, title: "Vista amplia (0.85x)" },
              { label: "0.55x", val: 0.55, title: "Vista panorámica (0.55x)" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  if (arena) arena.engine.setPresetZoom(item.val);
                  setCurrentZoom(item.val);
                  AudioManager.play("click", 0.6);
                }}
                style={{
                  background: currentZoom === item.val ? "rgba(56, 189, 248, 0.25)" : "transparent",
                  border: currentZoom === item.val ? "1px solid #38bdf8" : "1px solid transparent",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  color: currentZoom === item.val ? "#38bdf8" : "#94a3b8",
                  fontSize: "11px",
                  fontWeight: 800,
                  cursor: "pointer",
                  height: "24px",
                }}
                title={item.title}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Wind & Compass Capsule */}
        <div style={{
          background: isWindEnabled ? "rgba(15, 23, 42, 0.88)" : "rgba(30, 41, 59, 0.70)",
          border: isWindEnabled ? "1px solid rgba(56, 189, 248, 0.45)" : "1px solid rgba(148, 163, 184, 0.25)",
          borderRadius: "8px",
          padding: "3px 8px",
          height: "32px",
          boxSizing: "border-box",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: isWindEnabled ? "0 4px 12px rgba(56, 189, 248, 0.2)" : "none",
          pointerEvents: "auto",
        }}>
          {/* Rotating Compass Icon */}
          <div style={{ position: "relative", width: "22px", height: "22px", opacity: isWindEnabled ? 1 : 0.45 }}>
            <svg width="22" height="22" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              <g transform={`rotate(${windAngle}, 18, 18)`}>
                <polygon points="18,5 23,26 18,21 13,26" fill={isWindEnabled ? "#38bdf8" : "#94a3b8"} />
                <circle cx="18" cy="18" r="3" fill="#ffffff" />
              </g>
            </svg>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            <span style={{ color: isWindEnabled ? "#38bdf8" : "#94a3b8", fontSize: "14px", fontWeight: 900 }}>
              {isWindEnabled ? windPower : 0}
            </span>
            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }}>
              {isWindEnabled ? `${windAngle}°` : "OFF"}
            </span>
          </div>

          {/* Toggle Wind Button */}
          <button
            onClick={handleToggleWind}
            style={{
              background: isWindEnabled ? "#0284c7" : "#334155",
              border: "none",
              color: "#ffffff",
              borderRadius: "4px",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              cursor: "pointer",
            }}
            title={isWindEnabled ? "Desactivar viento (0 por defecto)" : "Activar viento"}
          >
            🌬️
          </button>

          {isWindEnabled && (
            <button
              onClick={handleRandomizeWind}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#38bdf8",
                borderRadius: "4px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title="Aleatorizar dirección y fuerza de viento"
            >
              🎲
            </button>
          )}
        </div>

        {/* Right: Player Mobile Selector + Bot Dummy Status & Audio */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Player Mobile Selector Capsule */}
          <button
            onClick={() => {
              setSelectorTarget("player");
              setIsSelectorOpen(true);
              AudioManager.play("click", 0.7);
            }}
            style={{
              background: "rgba(15, 23, 42, 0.88)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "8px",
              padding: "4px 10px",
              height: "32px",
              boxSizing: "border-box",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              pointerEvents: "auto",
              transition: "all 0.15s ease",
            }}
            title="Elegir móvil del jugador (25 móviles disponibles)"
          >
            <span style={{ fontSize: "12px" }}>👤</span>
            <span style={{ color: "#38bdf8", fontWeight: 900 }}>{currentMob.name}</span>
            <span style={{ fontSize: "9px", color: "#64748b" }}>▾</span>
          </button>

          {/* Bot Dummy Status Capsule */}
          <div style={{
            background: "rgba(15, 23, 42, 0.88)",
            border: isBotImmortal ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "8px",
            padding: "3px 8px",
            height: "32px",
            boxSizing: "border-box",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            pointerEvents: "auto",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ color: "#f87171", fontSize: "10px", fontWeight: 800 }}>
                  [{botMob.name}]
                </span>
                <span style={{ color: isBotImmortal ? "#22c55e" : botHp > 500 ? "#22c55e" : botHp > 250 ? "#eab308" : "#ef4444", fontSize: "10px", fontWeight: 800 }}>
                  {isBotImmortal ? "∞ HP" : `${botHp}/${botMaxHp}`}
                </span>
              </div>
              <div style={{
                width: "65px",
                height: "4px",
                background: "#0f172a",
                borderRadius: "2px",
                overflow: "hidden",
                marginTop: "2px",
              }}>
                <div style={{
                  width: isBotImmortal ? "100%" : `${Math.max(0, Math.min(100, (botHp / (botMaxHp || 1)) * 100))}%`,
                  height: "100%",
                  background: isBotImmortal ? "#22c55e" : botHp > 500 ? "#22c55e" : botHp > 250 ? "#eab308" : "#ef4444",
                  transition: "width 0.2s ease",
                }} />
              </div>
            </div>

            {/* Immortal / Mortal Toggle Icon */}
            <button
              onClick={() => {
                if (arena) {
                  const next = arena.toggleBotImmortality();
                  setIsBotImmortal(next);
                  AudioManager.play("click", 0.7);
                }
              }}
              style={{
                background: isBotImmortal ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                border: isBotImmortal ? "1px solid #10b981" : "1px solid #ef4444",
                color: isBotImmortal ? "#34d399" : "#f87171",
                borderRadius: "4px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title={isBotImmortal ? "Bot Inmortal (click para hacerlo mortal)" : "Bot Mortal (click para hacerlo inmortal)"}
            >
              {isBotImmortal ? "🛡️" : "⚔️"}
            </button>

            {/* Change Bot Mobile Button */}
            <button
              onClick={() => {
                setSelectorTarget("bot");
                setIsSelectorOpen(true);
                AudioManager.play("click", 0.7);
              }}
              style={{
                background: "#b91c1c",
                border: "1px solid #f87171",
                color: "#ffffff",
                borderRadius: "4px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title="Cambiar móvil del bot"
            >
              🚗
            </button>

            {/* Reset Bot Position Button */}
            <button
              onClick={handleResetBot}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#94a3b8",
                borderRadius: "4px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title="Reubicar bot en posición segura"
            >
              🔄
            </button>
          </div>

          {/* Quick Settings: Music Toggle */}
          <div style={{
            background: "rgba(15, 23, 42, 0.88)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "8px",
            padding: "3px 6px",
            height: "32px",
            boxSizing: "border-box",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            pointerEvents: "auto",
          }}>
            {/* Music Toggle */}
            <button
              onClick={handleToggleMusic}
              style={{
                background: isMusicActive ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                border: isMusicActive ? "1px solid #10b981" : "1px solid #ef4444",
                borderRadius: "4px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title={isMusicActive ? "Silenciar música" : "Activar música"}
            >
              {isMusicActive ? "🔊" : "🔇"}
            </button>
          </div>
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
      {/* BOTTOM HUD (AUTHENTIC POWER METER + FLOATING SLICE/SPACE BUTTON TO THE RIGHT) */}
      {/* ============================================================ */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: "12px",
        width: "100%",
        pointerEvents: "none",
      }}>
        {/* Main HUD Container: Shot Selectors, Angle & Authentic Power Bar */}
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
          maxWidth: "680px",
        }}>
          {/* Upper Row: Shot Selector (S1, S2, SS) & Angle Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}>
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

            {/* Clean Angle Badge */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#1e293b",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "6px",
              padding: "5px 14px",
              minWidth: "48px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}>
              <span style={{ color: "#ffffff", fontSize: "19px", fontWeight: 900, letterSpacing: "0.5px" }}>
                {angle}°
              </span>
            </div>
          </div>

          {/* Lower Row: Full-Width Authentic GunBound Power Meter Bar */}
          <div style={{
            width: "100%",
            height: "28px",
            background: "#080d1a",
            borderRadius: "6px",
            border: "1.5px solid #334155",
            position: "relative",
            overflow: "hidden",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8)",
          }}>
            {/* Authentic ruler tick marks at 25%, 50%, 75% */}
            <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "1.5px", background: "rgba(255,255,255,0.35)", zIndex: 2 }} />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "2px", background: "rgba(255,255,255,0.6)", zIndex: 2 }} />
            <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: "1.5px", background: "rgba(255,255,255,0.35)", zIndex: 2 }} />

            {/* Subtle sub-ticks at 10% intervals */}
            {[10, 20, 30, 40, 60, 70, 80, 90].map((tick) => (
              <div
                key={tick}
                style={{
                  position: "absolute",
                  left: `${tick}%`,
                  top: "6px",
                  bottom: "6px",
                  width: "1px",
                  background: "rgba(255,255,255,0.18)",
                  zIndex: 2,
                }}
              />
            ))}

            {/* Last Shot Power Indicator Marker */}
            {lastPower !== null && (
              <div
                style={{
                  position: "absolute",
                  left: `${lastPower}%`,
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  background: "#ffffff",
                  boxShadow: "0 0 10px #fbbf24, 0 0 4px #ffffff",
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "-5px",
                    width: 0,
                    height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "7px solid #fbbf24",
                  }}
                />
              </div>
            )}

            {/* Filled Power Progress with authentic fiery GunBound gradient */}
            <div
              ref={powerBarFillRef}
              style={{
                width: "0%",
                height: "100%",
                background: "linear-gradient(90deg, #facc15 0%, #f97316 40%, #ef4444 80%, #b91c1c 100%)",
                boxShadow: "0 0 14px rgba(249, 115, 22, 0.65)",
                transition: "none",
              }}
            />
          </div>
        </div>

        {/* Independent Floating Shoot Mode Button (to the right of the Power Bar) */}
        <button
          onClick={() => {
            const newMode = shootMode === "space" ? "drag" : "space";
            setShootMode(newMode);
            if (arena) arena.setShootMode(newMode);
            AudioManager.play("click", 0.7);
          }}
          style={{
            pointerEvents: "auto",
            background: shootMode === "drag"
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "rgba(15, 23, 42, 0.94)",
            border: `1.5px solid ${shootMode === "drag" ? "#34d399" : "rgba(56, 189, 248, 0.45)"}`,
            borderRadius: "10px",
            padding: "0 14px",
            height: "44px",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: shootMode === "drag"
              ? "0 0 16px rgba(16, 185, 129, 0.45)"
              : "0 4px 14px rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            whiteSpace: "nowrap",
            backdropFilter: "blur(12px)",
            transition: "all 0.15s ease",
            marginBottom: "2px",
          }}
          title={shootMode === "drag" ? "Modo arrastrar con ratón (Click y suelta)" : "Modo barra espaciadora (Mantén Espacio)"}
        >
          <span style={{ fontSize: "14px" }}>{shootMode === "drag" ? "🖱️" : "⌨️"}</span>
          <span style={{ letterSpacing: "0.4px" }}>{shootMode === "drag" ? "SLICE" : "ESPACIO"}</span>
        </button>
      </div>
    </div>
  );
};
