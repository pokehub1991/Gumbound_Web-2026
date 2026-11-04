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
      fontFamily: "'Pixelify Sans', cursive, sans-serif",
      userSelect: "none",
      padding: "12px",
      boxSizing: "border-box",
      imageRendering: "pixelated",
    }}>
      {/* ============================================================ */}
      {/* TOP HEADER HUD (PIXEL-ART RETRO GUNBOUND STYLE) */}
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
          <div className="pixel-box" style={{
            borderRadius: "4px",
            padding: "3px 10px",
            height: "36px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            pointerEvents: "auto",
          }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#38bdf8", letterSpacing: "0.5px", textShadow: "1px 1px 0 #000" }}>
              METAMINE
            </span>
            <button
              className="pixel-btn"
              onClick={() => {
                if (arena) {
                  arena.resetMap();
                  AudioManager.play("click", 0.7);
                }
              }}
              style={{
                background: "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                borderRadius: "3px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title="Reiniciar mapa y posiciones"
            >
              🔄
            </button>
          </div>

          {/* Compact Segmented Zoom Pill */}
          <div className="pixel-box" style={{
            borderRadius: "4px",
            padding: "3px 6px",
            height: "36px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            pointerEvents: "auto",
          }}>
            <span style={{ fontSize: "13px", color: "#64748b", margin: "0 3px" }}>🔍</span>
            {[
              { label: "1.2x", val: 1.2, title: "Zoom normal (1.2x)" },
              { label: "0.85x", val: 0.85, title: "Vista amplia (0.85x)" },
              { label: "0.55x", val: 0.55, title: "Vista panorámica (0.55x)" },
            ].map((item) => (
              <button
                key={item.label}
                className="pixel-btn"
                onClick={() => {
                  if (arena) arena.engine.setPresetZoom(item.val);
                  setCurrentZoom(item.val);
                  AudioManager.play("click", 0.6);
                }}
                style={{
                  background: currentZoom === item.val
                    ? "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)"
                    : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                  border: currentZoom === item.val ? "1.5px solid #38bdf8" : "1.5px solid #000000",
                  borderRadius: "3px",
                  padding: "2px 8px",
                  color: currentZoom === item.val ? "#ffffff" : "#94a3b8",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  height: "26px",
                  textShadow: "1px 1px 0 #000",
                }}
                title={item.title}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Wind & Compass Capsule */}
        <div className="pixel-box" style={{
          background: isWindEnabled
            ? "linear-gradient(180deg, #131f3d 0%, #0a1122 100%)"
            : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          borderRadius: "4px",
          padding: "3px 10px",
          height: "36px",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: isWindEnabled
            ? "inset 1px 1px 0px rgba(56, 189, 248, 0.5), inset -1px -1px 0px #000, 0 3px 0px rgba(0,0,0,0.6)"
            : "inset 1px 1px 0px rgba(255,255,255,0.15), inset -1px -1px 0px #000, 0 3px 0px rgba(0,0,0,0.6)",
          pointerEvents: "auto",
        }}>
          {/* Rotating Compass Icon */}
          <div style={{ position: "relative", width: "24px", height: "24px", opacity: isWindEnabled ? 1 : 0.45 }}>
            <svg width="24" height="24" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="#0f172a" stroke="#000000" strokeWidth="2.5" />
              <g transform={`rotate(${windAngle}, 18, 18)`}>
                <polygon points="18,4 24,27 18,21 12,27" fill={isWindEnabled ? "#38bdf8" : "#94a3b8"} stroke="#000000" strokeWidth="1" />
                <circle cx="18" cy="18" r="3" fill="#ffffff" />
              </g>
            </svg>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
            <span style={{ color: isWindEnabled ? "#38bdf8" : "#94a3b8", fontSize: "17px", fontWeight: 700, textShadow: "1px 1px 0 #000" }}>
              {isWindEnabled ? windPower : 0}
            </span>
            <span style={{ fontSize: "12px", color: isWindEnabled ? "#7dd3fc" : "#64748b", fontWeight: 700, textShadow: "1px 1px 0 #000" }}>
              {isWindEnabled ? `${windAngle}°` : "OFF"}
            </span>
          </div>

          {/* Toggle Wind Button */}
          <button
            className="pixel-btn"
            onClick={handleToggleWind}
            style={{
              background: isWindEnabled
                ? "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)"
                : "linear-gradient(180deg, #334155 0%, #1e293b 100%)",
              color: "#ffffff",
              borderRadius: "3px",
              width: "26px",
              height: "26px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              cursor: "pointer",
            }}
            title={isWindEnabled ? "Desactivar viento (0 por defecto)" : "Activar viento"}
          >
            🌬️
          </button>

          {isWindEnabled && (
            <button
              className="pixel-btn"
              onClick={handleRandomizeWind}
              style={{
                background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                color: "#38bdf8",
                borderRadius: "3px",
                width: "26px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
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
            className="pixel-box pixel-btn"
            onClick={() => {
              setSelectorTarget("player");
              setIsSelectorOpen(true);
              AudioManager.play("click", 0.7);
            }}
            style={{
              borderRadius: "4px",
              padding: "3px 10px",
              height: "36px",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              pointerEvents: "auto",
              textShadow: "1px 1px 0 #000",
            }}
            title="Elegir móvil del jugador (25 móviles disponibles)"
          >
            <span style={{ fontSize: "14px" }}>👤</span>
            <span style={{ color: "#38bdf8" }}>{currentMob.name}</span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>▾</span>
          </button>

          {/* Bot Dummy Status Capsule */}
          <div className="pixel-box" style={{
            borderRadius: "4px",
            padding: "3px 10px",
            height: "36px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            pointerEvents: "auto",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#f87171", fontSize: "12px", fontWeight: 700, textShadow: "1px 1px 0 #000" }}>
                  [{botMob.name}]
                </span>
                <span style={{
                  color: isBotImmortal ? "#4ade80" : botHp > 500 ? "#4ade80" : botHp > 250 ? "#facc15" : "#ef4444",
                  fontSize: "12px",
                  fontWeight: 700,
                  textShadow: "1px 1px 0 #000",
                }}>
                  {isBotImmortal ? "∞ HP" : `${botHp}/${botMaxHp}`}
                </span>
              </div>
              <div style={{
                width: "72px",
                height: "6px",
                background: "#030712",
                border: "1.5px solid #000",
                borderRadius: "2px",
                overflow: "hidden",
                marginTop: "2px",
              }}>
                <div style={{
                  width: isBotImmortal ? "100%" : `${Math.max(0, Math.min(100, (botHp / (botMaxHp || 1)) * 100))}%`,
                  height: "100%",
                  background: isBotImmortal ? "#22c55e" : botHp > 500 ? "#22c55e" : botHp > 250 ? "#eab308" : "#ef4444",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                  transition: "width 0.2s steps(8)",
                }} />
              </div>
            </div>

            {/* Immortal / Mortal Toggle Icon */}
            <button
              className="pixel-btn"
              onClick={() => {
                if (arena) {
                  const next = arena.toggleBotImmortality();
                  setIsBotImmortal(next);
                  AudioManager.play("click", 0.7);
                }
              }}
              style={{
                background: isBotImmortal
                  ? "linear-gradient(180deg, #059669 0%, #047857 100%)"
                  : "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
                color: "#ffffff",
                borderRadius: "3px",
                width: "26px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                cursor: "pointer",
              }}
              title={isBotImmortal ? "Bot Inmortal (click para hacerlo mortal)" : "Bot Mortal (click para hacerlo inmortal)"}
            >
              {isBotImmortal ? "🛡️" : "⚔️"}
            </button>

            {/* Change Bot Mobile Button */}
            <button
              className="pixel-btn"
              onClick={() => {
                setSelectorTarget("bot");
                setIsSelectorOpen(true);
                AudioManager.play("click", 0.7);
              }}
              style={{
                background: "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
                color: "#ffffff",
                borderRadius: "3px",
                width: "26px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                cursor: "pointer",
              }}
              title="Cambiar móvil del bot"
            >
              🚗
            </button>

            {/* Reset Bot Position Button */}
            <button
              className="pixel-btn"
              onClick={handleResetBot}
              style={{
                background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                color: "#94a3b8",
                borderRadius: "3px",
                width: "26px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                cursor: "pointer",
              }}
              title="Reubicar bot en posición segura"
            >
              🔄
            </button>
          </div>

          {/* Quick Settings: Music Toggle */}
          <div className="pixel-box" style={{
            borderRadius: "4px",
            padding: "3px 6px",
            height: "36px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            pointerEvents: "auto",
          }}>
            <button
              className="pixel-btn"
              onClick={handleToggleMusic}
              style={{
                background: isMusicActive
                  ? "linear-gradient(180deg, #059669 0%, #047857 100%)"
                  : "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
                borderRadius: "3px",
                width: "26px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
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
          background: "rgba(0,0,0,0.7)",
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
      {/* BOTTOM HUD (AUTHENTIC PIXEL-ART GUNBOUND BAR + SLICE/SPACE BUTTON) */}
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
        <div className="pixel-box" style={{
          borderRadius: "6px",
          padding: "10px 16px",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          maxWidth: "700px",
        }}>
          {/* Upper Row: Shot Selector (S1, S2, SS) & Angle Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}>
            {/* Shot Selector (S1, S2, SS Pixel Arcade Buttons) */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="pixel-btn"
                onClick={() => handleSelectShotType(0)}
                style={{
                  background: shotType === 0
                    ? "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)"
                    : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                  border: shotType === 0 ? "2px solid #ffffff" : "2px solid #000000",
                  borderRadius: "4px",
                  padding: "4px 14px",
                  color: shotType === 0 ? "#ffffff" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "50px",
                  height: "34px",
                  boxShadow: shotType === 0
                    ? "0 0 10px #38bdf8, inset 1px 1px 0 #fff"
                    : "inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 #000, 0 2px 0 #000",
                  textShadow: "1px 1px 0 #000",
                }}
                title="Shot 1 [Tecla 1]"
              >
                S1
              </button>

              <button
                className="pixel-btn"
                onClick={() => handleSelectShotType(1)}
                style={{
                  background: shotType === 1
                    ? "linear-gradient(180deg, #facc15 0%, #d97706 100%)"
                    : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                  border: shotType === 1 ? "2px solid #ffffff" : "2px solid #000000",
                  borderRadius: "4px",
                  padding: "4px 14px",
                  color: shotType === 1 ? "#ffffff" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "50px",
                  height: "34px",
                  boxShadow: shotType === 1
                    ? "0 0 10px #facc15, inset 1px 1px 0 #fff"
                    : "inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 #000, 0 2px 0 #000",
                  textShadow: "1px 1px 0 #000",
                }}
                title="Shot 2 [Tecla 2]"
              >
                S2
              </button>

              <button
                className="pixel-btn"
                onClick={() => handleSelectShotType(2)}
                style={{
                  background: shotType === 2
                    ? "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)"
                    : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                  border: shotType === 2 ? "2px solid #fde047" : "2px solid #000000",
                  borderRadius: "4px",
                  padding: "4px 14px",
                  color: shotType === 2 ? "#fde047" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "50px",
                  height: "34px",
                  boxShadow: shotType === 2
                    ? "0 0 12px #ef4444, inset 1px 1px 0 #fff"
                    : "inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 #000, 0 2px 0 #000",
                  textShadow: "1px 1px 0 #000",
                }}
                title="Super Shot [Tecla 3 / F]"
              >
                SS
              </button>
            </div>

            {/* Digital Arcade Angle Display */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#030712",
              border: "2px solid #000000",
              borderRadius: "4px",
              padding: "3px 14px",
              minWidth: "62px",
              height: "34px",
              boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.95), 0 2px 0 rgba(255,255,255,0.1)",
            }}>
              <span style={{
                color: "#4ade80",
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "1px",
                textShadow: "0 0 8px rgba(74, 222, 128, 0.8), 1px 1px 0 #000",
              }}>
                {angle}°
              </span>
            </div>
          </div>

          {/* Lower Row: Full-Width Authentic GunBound Power Meter Bar */}
          <div style={{
            width: "100%",
            height: "32px",
            background: "#050914",
            borderRadius: "4px",
            border: "2px solid #000000",
            position: "relative",
            overflow: "hidden",
            boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.95), 0 2px 0 rgba(255,255,255,0.1)",
          }}>
            {/* Authentic ruler tick marks at 25%, 50%, 75% */}
            <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "2px", background: "rgba(255,255,255,0.45)", zIndex: 3 }} />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "2.5px", background: "#ffffff", zIndex: 3 }} />
            <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: "2px", background: "rgba(255,255,255,0.45)", zIndex: 3 }} />

            {/* Subtle sub-ticks at 10% intervals */}
            {[10, 20, 30, 40, 60, 70, 80, 90].map((tick) => (
              <div
                key={tick}
                style={{
                  position: "absolute",
                  left: `${tick}%`,
                  top: "8px",
                  bottom: "8px",
                  width: "1px",
                  background: "rgba(255,255,255,0.22)",
                  zIndex: 3,
                }}
              />
            ))}

            {/* Centered POTENCIA Text Overlay in Pixelify Sans */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
              pointerEvents: "none",
            }}>
              <span style={{
                color: "rgba(255, 255, 255, 0.85)",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
              }}>
                POTENCIA
              </span>
            </div>

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
                  boxShadow: "0 0 8px #fbbf24, 0 0 2px #ffffff",
                  zIndex: 5,
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
                    borderTop: "8px solid #fbbf24",
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
                boxShadow: "0 0 14px rgba(249, 115, 22, 0.75)",
                transition: "none",
              }}
            />
          </div>
        </div>

        {/* Independent Floating Shoot Mode Button (to the right of the Power Bar) */}
        <button
          className="pixel-btn"
          onClick={() => {
            const newMode = shootMode === "space" ? "drag" : "space";
            setShootMode(newMode);
            if (arena) arena.setShootMode(newMode);
            AudioManager.play("click", 0.7);
          }}
          style={{
            pointerEvents: "auto",
            background: shootMode === "drag"
              ? "linear-gradient(180deg, #10b981 0%, #059669 100%)"
              : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
            border: shootMode === "drag" ? "2px solid #34d399" : "2px solid #000000",
            borderRadius: "6px",
            padding: "0 16px",
            height: "46px",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: shootMode === "drag"
              ? "0 0 14px rgba(16, 185, 129, 0.6), inset 1px 1px 0 #fff"
              : "inset 1px 1px 0 rgba(255,255,255,0.25), inset -1px -1px 0 #000, 0 3px 0 #000",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            textShadow: "1px 1px 0 #000",
            marginBottom: "2px",
          }}
          title={shootMode === "drag" ? "Modo arrastrar con ratón (Click y suelta)" : "Modo barra espaciadora (Mantén Espacio)"}
        >
          <span style={{ fontSize: "16px" }}>{shootMode === "drag" ? "🖱️" : "⌨️"}</span>
          <span style={{ letterSpacing: "0.8px" }}>{shootMode === "drag" ? "SLICE" : "ESPACIO"}</span>
        </button>
      </div>
    </div>
  );
};
