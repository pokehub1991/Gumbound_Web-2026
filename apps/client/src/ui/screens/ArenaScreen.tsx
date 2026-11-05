import React, { useEffect, useState, useRef, useCallback } from "react";
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

  const [, setBotHp] = useState<number>(1000);
  const [, setBotMaxHp] = useState<number>(1000);

  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [selectorTarget, setSelectorTarget] = useState<"player" | "bot">("player");
  const [shootMode, setShootMode] = useState<"space" | "drag">("space");
  const [lastPower, setLastPower] = useState<number | null>(null);

  // Audio and Camera
  const [isMusicActive, setIsMusicActive] = useState<boolean>(!AudioManager.isMusicMuted);
  const [currentZoom, setCurrentZoom] = useState<number>(1.2);
  const [isBotImmortal, setIsBotImmortal] = useState<boolean>(true);

  // Turn System (Lista de Turnos)
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [maxTurns, setMaxTurns] = useState<number>(40);
  const [activeTurn, setActiveTurn] = useState<"player" | "bot">("player");
  const [playerDelay, setPlayerDelay] = useState<number>(0);
  const [botDelay, setBotDelay] = useState<number>(960);

  // Compact Chat System
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; isSystem?: boolean }>>([
    { sender: "Sistema", text: "¡Bienvenido a Meta Mine!", isSystem: true },
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatInactivityTimeoutRef = useRef<number | null>(null);

  // 20-Second Turn Countdown (GunBound Authentic)
  const [turnCountdown, setTurnCountdown] = useState<number>(20);

  // Battle Item Slots (Dual, Dual, TP) - Only 1 active at a time
  const [activeItemSlot, setActiveItemSlot] = useState<number | null>(null);

  const handleToggleItemSlot = (slotIndex: number, itemType: "dual" | "teleport") => {
    if (activeItemSlot === slotIndex) {
      setActiveItemSlot(null);
      if (arena) arena.activateItem(null);
      AudioManager.play("click", 0.7);
    } else {
      setActiveItemSlot(slotIndex);
      if (arena) arena.activateItem(itemType);
      AudioManager.play("dual_snd", 0.85);
    }
  };

  // Turn Countdown Timer Interval: ticks every single second from the beginning
  useEffect(() => {
    const timer = setInterval(() => {
      setTurnCountdown((prev) => {
        if (!arena || arena.isSimulating) return prev;
        if (prev <= 1) return 0;
        const next = prev - 1;
        // Sonido del temporizador suena en cada segundo desde el principio (respetando silenciar música/audio)
        if (next > 0 && !AudioManager.isMusicMuted && !AudioManager.isMuted) {
          AudioManager.play("turntick1s", next <= 5 ? 0.9 : 0.75);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [arena]);

  // Keyboard listeners: Enter opens chat; Shift cycles shot types (S1 -> S2 -> SS -> S1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        setShotType((prev) => {
          const next = (prev + 1) % 3;
          if (arena) arena.setShotType(next);
          AudioManager.play("click", 0.7);
          return next;
        });
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        setIsChatOpen(true);
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [arena]);

  const resetChatInactivityTimer = useCallback(() => {
    if (chatInactivityTimeoutRef.current) {
      window.clearTimeout(chatInactivityTimeoutRef.current);
      chatInactivityTimeoutRef.current = null;
    }
    if (isChatOpen) {
      chatInactivityTimeoutRef.current = window.setTimeout(() => {
        setIsChatOpen(false);
      }, 10000); // Auto-close chat after 10 seconds of inactivity
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (isChatOpen) {
      resetChatInactivityTimer();
      // Instantly scroll to the bottom so the newest messages are shown when opening chat
      requestAnimationFrame(() => {
        if (chatMessagesContainerRef.current) {
          chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
        }
        chatBottomRef.current?.scrollIntoView({ behavior: "auto" });
      });
    } else if (chatInactivityTimeoutRef.current) {
      window.clearTimeout(chatInactivityTimeoutRef.current);
      chatInactivityTimeoutRef.current = null;
    }
    return () => {
      if (chatInactivityTimeoutRef.current) {
        window.clearTimeout(chatInactivityTimeoutRef.current);
      }
    };
  }, [isChatOpen, resetChatInactivityTimer]);

  useEffect(() => {
    if (isChatOpen && chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isChatOpen]);

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
    setTurnNumber(arena.turnNumber);
    setMaxTurns(arena.maxTurns);
    setActiveTurn(arena.activeTurn);
    setPlayerDelay(arena.playerDelay);
    setBotDelay(arena.botDelay);
    arena.setShootMode(shootMode);

    arena.onTurnUpdate = (info) => {
      setTurnNumber(info.turnNumber);
      setMaxTurns(info.maxTurns);
      setActiveTurn(info.activeTurn);
      setPlayerDelay(info.playerDelay);
      setBotDelay(info.botDelay);
      setTurnCountdown(20);
    };

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
      setLastPower(pw ?? null);
    };

    arena.onActiveItemChange = (item) => {
      if (item === null) {
        setActiveItemSlot(null);
      }
    };

    arena.onChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (msg.sender === "Tú" || msg.sender === "Player [Tú]") {
        arena.player.showChatBubble(msg.text);
      } else if (!msg.isSystem && arena.bot) {
        arena.bot.mobile.showChatBubble(msg.text);
      }
    };

    arena.onTurnReady = () => {
      if (powerBarFillRef.current) powerBarFillRef.current.style.width = "0%";
      setTurnCountdown(20);
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

  const handleToggleMusic = () => {
    const active = AudioManager.toggleMusic();
    setIsMusicActive(active);
    AudioManager.play("click", 0.7);
  };

  const currentMob = MOBILES_DATA[playerMobileId] || MOBILES_DATA[0];

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: "Tú", text }]);
    if (arena) {
      arena.player.showChatBubble(text);
    }
    setChatInput("");
    resetChatInactivityTimer();
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);
  };

  // Turn List always prioritizes the active turn entity at index 0 (top row)
  const turnList = activeTurn === "player"
    ? [
        {
          id: "player",
          turnIndex: 0,
          rankIcon: "🐣",
          name: "Player [Tú]",
          isActive: true,
          orderBoxBg: "#f59e0b",
          orderBoxBorder: "#b45309",
          nameColor: "#f59e0b",
          delayStr: "0",
          delayColor: "#ffffff",
        },
        {
          id: "bot",
          turnIndex: 1,
          rankIcon: "🔨",
          name: "Haris Pilton",
          isActive: false,
          orderBoxBg: "#38bdf8",
          orderBoxBorder: "#0284c7",
          nameColor: "#38bdf8",
          delayStr: `+${Math.max(0, botDelay - playerDelay || 960)}`,
          delayColor: "#94a3b8",
        },
      ]
    : [
        {
          id: "bot",
          turnIndex: 0,
          rankIcon: "🔨",
          name: "Haris Pilton",
          isActive: true,
          orderBoxBg: "#f59e0b",
          orderBoxBorder: "#b45309",
          nameColor: "#38bdf8",
          delayStr: "0",
          delayColor: "#ffffff",
        },
        {
          id: "player",
          turnIndex: 1,
          rankIcon: "🐣",
          name: "Player [Tú]",
          isActive: false,
          orderBoxBg: "#38bdf8",
          orderBoxBorder: "#0284c7",
          nameColor: "#f59e0b",
          delayStr: `+${Math.max(0, playerDelay - botDelay || 960)}`,
          delayColor: "#94a3b8",
        },
      ];

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
        alignItems: "flex-start",
        justifyContent: "space-between",
        pointerEvents: "none",
        gap: "10px",
        width: "100%",
      }}>
        {/* Left: Stacked Segmented Zoom Pill (top) & Map Info (bottom) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
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
                  setLastPower(null);
                  setTurnCountdown(20);
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

        {/* Right: Player Mobile Selector + Bot Immortal Toggle + Turn Countdown Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", pointerEvents: "auto" }}>
          {/* Mobile Selector Capsule with integrated Music Toggle */}
          <div
            className="pixel-box"
            style={{
              borderRadius: "4px",
              padding: "3px 8px",
              height: "36px",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              pointerEvents: "auto",
            }}
          >
            <button
              className="pixel-btn"
              onClick={() => {
                setSelectorTarget("player");
                setIsSelectorOpen(true);
                AudioManager.play("click", 0.7);
              }}
              style={{
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                textShadow: "1px 1px 0 #000",
              }}
              title="Elegir móvil del jugador (25 móviles disponibles)"
            >
              {/* User Rank Box */}
              <div style={{
                width: "20px",
                height: "20px",
                background: "#050914",
                border: "1.5px solid #f59e0b",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25)",
              }}>
                🐣
              </div>
              <span style={{ color: "#38bdf8" }}>{currentMob.name}</span>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>▾</span>
            </button>

            {/* Subtle Vertical Divider */}
            <div style={{ width: "1px", height: "18px", background: "#334155" }} />

            {/* Integrated Music Toggle Button */}
            <button
              className="pixel-btn"
              onClick={handleToggleMusic}
              style={{
                background: isMusicActive
                  ? "linear-gradient(180deg, #059669 0%, #047857 100%)"
                  : "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
                borderRadius: "3px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.3), 0 1px 0 #000",
              }}
              title={isMusicActive ? "Silenciar música" : "Activar música"}
            >
              {isMusicActive ? "🔊" : "🔇"}
            </button>
          </div>

          {/* Bot Immortal / Mortal Toggle Button */}
          <button
            className="pixel-btn pixel-box"
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
              borderRadius: "4px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              cursor: "pointer",
              boxSizing: "border-box",
              border: isBotImmortal ? "2px solid #34d399" : "2px solid #f87171",
              boxShadow: isBotImmortal
                ? "0 0 8px rgba(16, 185, 129, 0.5), inset 1px 1px 0 rgba(255,255,255,0.3)"
                : "0 0 8px rgba(239, 68, 68, 0.5), inset 1px 1px 0 rgba(255,255,255,0.3)",
            }}
            title={isBotImmortal ? "Bot Inmortal (click para hacerlo mortal)" : "Bot Mortal (click para hacerlo inmortal)"}
          >
            {isBotImmortal ? "🛡️" : "⚔️"}
          </button>

          {/* Turn Countdown Timer Widget (20s) in Top-Right Corner */}
          <div
            className="pixel-box"
            style={{
              borderRadius: "4px",
              width: "70px",
              height: "36px",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              pointerEvents: "auto",
              background: turnCountdown <= 5
                ? "linear-gradient(180deg, #450a0a 0%, #1f0404 100%)"
                : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
              border: turnCountdown <= 5 ? "2px solid #ef4444" : "2px solid #000000",
              boxShadow: turnCountdown <= 5
                ? "0 0 12px rgba(239, 68, 68, 0.85), inset 1px 1px 0 rgba(255,255,255,0.25)"
                : "inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 #000, 0 2px 0 rgba(0,0,0,0.6)",
            }}
            title="Tiempo restante de turno (20 segundos)"
          >
            <span
              style={{
                fontSize: "24px",
                fontWeight: 900,
                fontFamily: "'Pixelify Sans', cursive, monospace",
                lineHeight: "1",
                color: turnCountdown <= 5 ? "#ef4444" : turnCountdown <= 10 ? "#facc15" : "#4ade80",
                textShadow: turnCountdown <= 5
                  ? "0 0 8px rgba(239, 68, 68, 0.9), 2px 2px 0 #000"
                  : "2px 2px 0 #000",
                textAlign: "right",
                display: "inline-block",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {turnCountdown}
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                fontFamily: "'Pixelify Sans', cursive, monospace",
                lineHeight: "1",
                color: turnCountdown <= 5 ? "#fca5a5" : turnCountdown <= 10 ? "#fde047" : "#86efac",
                textShadow: "1px 1px 0 #000",
                marginTop: "3px",
              }}
            >
              s
            </span>
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
      {/* BOTTOM-LEFT: LISTA DE TURNOS */}
      {/* ============================================================ */}
      <div style={{
        position: "absolute",
        bottom: "12px",
        left: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        zIndex: 20,
        pointerEvents: "auto",
      }}>
        {/* Turn List Box (Replica fiel de GunBound con estilo Pixel-Art moderno) */}
        <div className="pixel-box" style={{
          width: "240px",
          borderRadius: "4px",
          padding: "4px 8px",
          boxSizing: "border-box",
        }}>
          {/* Header: Lista de Turnos, 1/40, ⏱️ */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "3px",
            borderBottom: "1px solid rgba(0,0,0,0.6)",
            marginBottom: "3px",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", textShadow: "1px 1px 0 #000" }}>
              Lista de Turnos
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#86efac", textShadow: "1px 1px 0 #000" }}>
                {turnNumber} / {maxTurns}
              </span>
              <span style={{ fontSize: "12px" }}>⏱️</span>
            </div>
          </div>

          {/* Turn Rows: Active Turn always first at top */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {turnList.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: item.isActive
                    ? "linear-gradient(90deg, rgba(161, 98, 7, 0.5) 0%, rgba(120, 53, 15, 0.3) 100%)"
                    : "rgba(0, 0, 0, 0.3)",
                  border: item.isActive ? "1px solid rgba(245, 158, 11, 0.65)" : "1px solid transparent",
                  borderRadius: "3px",
                  padding: "2px 4px",
                }}
              >
                {/* Left section: Turn order box + Rank icon box + Name */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  {/* Order Box: [0] or [1] */}
                  <div style={{
                    width: "16px",
                    height: "16px",
                    background: item.orderBoxBg,
                    border: `1.5px solid ${item.orderBoxBorder}`,
                    borderRadius: "2px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 900,
                    color: "#000000",
                    lineHeight: "1",
                  }}>
                    {item.turnIndex}
                  </div>

                  {/* Rank Icon Box */}
                  <div style={{
                    width: "18px",
                    height: "18px",
                    background: "#030712",
                    border: "1.5px solid #000",
                    borderRadius: "2px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25)",
                  }}>
                    {item.rankIcon}
                  </div>

                  {/* Player / Bot Nickname */}
                  <span style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: item.nameColor,
                    textShadow: "1px 1px 0 #000",
                    maxWidth: "100px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {item.name}
                  </span>
                </div>

                {/* Right section: Delay points difference */}
                <span style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: item.delayColor,
                  textShadow: "1px 1px 0 #000",
                }}>
                  {item.delayStr}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CENTER-BOTTOM: STRICTLY FIXED CENTER POWER BAR HUD */}
      {/* ============================================================ */}
      <div
        className="pixel-box"
        style={{
          position: "absolute",
          bottom: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          borderRadius: "6px",
          padding: "8px 14px",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "min(640px, calc(100vw - 340px))",
          boxSizing: "border-box",
          zIndex: 10,
        }}
      >
        {/* Upper Row: Left S1/S2/SS, Center DUAL/DUAL/TP, Right Mode Toggle + Angle Badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          minHeight: "36px",
        }}>
          {/* Left Group: Shot Selector (S1, S2, SS Pixel Arcade Buttons) */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              className="pixel-btn"
              onClick={() => handleSelectShotType(0)}
              style={{
                background: shotType === 0
                  ? "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)"
                  : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                border: shotType === 0 ? "2px solid #ffffff" : "2px solid #000000",
                borderRadius: "4px",
                padding: "3px 12px",
                color: shotType === 0 ? "#ffffff" : "#94a3b8",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "44px",
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
                padding: "3px 12px",
                color: shotType === 1 ? "#ffffff" : "#94a3b8",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "44px",
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
                padding: "3px 12px",
                color: shotType === 2 ? "#fde047" : "#94a3b8",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "44px",
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

          {/* Center Group: 3 Classic Lobby Item Buttons (DUAL, DUAL, TP) */}
          <div style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "6px",
            alignItems: "center",
          }}>
            {[
              { id: 0, label: "DUAL", type: "dual" as const, title: "Item 1: Disparo Dual (x2 proyectiles)" },
              { id: 1, label: "DUAL", type: "dual" as const, title: "Item 2: Disparo Dual (x2 proyectiles)" },
              { id: 2, label: "TP", type: "teleport" as const, title: "Item 3: Teleportación instantánea" },
            ].map((slot) => {
              const isSelected = activeItemSlot === slot.id;
              return (
                <button
                  key={slot.id}
                  className="pixel-btn"
                  onClick={() => handleToggleItemSlot(slot.id, slot.type)}
                  style={{
                    background: isSelected
                      ? "linear-gradient(180deg, #10b981 0%, #047857 100%)"
                      : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                    border: isSelected ? "2px solid #ffffff" : "2px solid #000000",
                    borderRadius: "4px",
                    padding: 0,
                    width: "56px",
                    minWidth: "56px",
                    height: "34px",
                    boxSizing: "border-box",
                    color: isSelected ? "#ffffff" : "#94a3b8",
                    fontFamily: "'Pixelify Sans', cursive, monospace, sans-serif",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: isSelected
                      ? "0 0 10px #34d399, inset 1px 1px 0 #fff"
                      : "inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 #000, 0 2px 0 #000",
                    textShadow: "1px 1px 0 #000",
                    filter: isSelected ? "none" : undefined,
                  }}
                  title={slot.title}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          {/* Right Group: Shoot Mode Toggle (⌨️ / 🖱️) + Digital Angle Badge */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginLeft: "auto" }}>
            {/* Mode toggle button moved directly to the left of angle box */}
            <button
              className="pixel-btn"
              onClick={() => {
                const newMode = shootMode === "space" ? "drag" : "space";
                setShootMode(newMode);
                if (arena) arena.setShootMode(newMode);
                AudioManager.play("click", 0.7);
              }}
              style={{
                background: shootMode === "drag"
                  ? "linear-gradient(180deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                border: shootMode === "drag" ? "2px solid #34d399" : "2px solid #000000",
                borderRadius: "4px",
                width: "36px",
                height: "34px",
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: shootMode === "drag"
                  ? "0 0 10px rgba(16, 185, 129, 0.6), inset 1px 1px 0 #fff"
                  : "inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 #000, 0 2px 0 #000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "17px",
              }}
              title={shootMode === "drag" ? "Modo Mouse / Slice (Click para cambiar a Teclado Espacio)" : "Modo Teclado / Espacio (Click para cambiar a Mouse Slice)"}
            >
              <span>{shootMode === "drag" ? "🖱️" : "⌨️"}</span>
            </button>

            {/* Digital Arcade Angle Display */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#030712",
              border: "2px solid #000000",
              borderRadius: "4px",
              padding: "3px 10px",
              minWidth: "56px",
              height: "34px",
              boxSizing: "border-box",
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
        </div>

        {/* Lower Row: Full-Width Authentic GunBound Power Meter Bar (WITHOUT TEXT AS REQUESTED) */}
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
          {/* Authentic ruler tick marks at 25%, 50%, 75% with exact same color intensity (1px, 0.28 opacity) */}
          <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.28)", zIndex: 3 }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.28)", zIndex: 3 }} />
          <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.28)", zIndex: 3 }} />

          {/* Sub-ticks at 10% intervals with matching subtle intensity */}
          {[10, 20, 30, 40, 60, 70, 80, 90].map((tick) => (
            <div
              key={tick}
              style={{
                position: "absolute",
                left: `${tick}%`,
                top: "8px",
                bottom: "8px",
                width: "1px",
                background: "rgba(255,255,255,0.28)",
                zIndex: 3,
              }}
            />
          ))}

          {/* Last Shot Power Indicator Marker (Golden-yellow line matching arrow marker) */}
          {lastPower !== null && (
            <div
              style={{
                position: "absolute",
                left: `${lastPower}%`,
                top: 0,
                bottom: 0,
                width: "2px",
                background: "#fbbf24",
                boxShadow: "0 0 4px #f59e0b",
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

      {/* ============================================================ */}
      {/* BOTTOM-RIGHT: CHAT DE BATALLA COMPACTO */}
      {/* ============================================================ */}
      <div style={{
        position: "absolute",
        bottom: "12px",
        right: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "6px",
        zIndex: 25,
        pointerEvents: "auto",
      }}>
        {/* Compact Chat Popup (if open) */}
        {isChatOpen && (
          <div
            className="pixel-box"
            onMouseMove={resetChatInactivityTimer}
            onMouseDown={resetChatInactivityTimer}
            onClick={resetChatInactivityTimer}
            style={{
              width: "250px",
              height: "175px",
              borderRadius: "4px",
              padding: "6px 8px",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.85)",
              boxSizing: "border-box",
            }}
          >
            {/* Chat Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.15)",
              paddingBottom: "3px",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#38bdf8", textShadow: "1px 1px 0 #000" }}>
                💬 Chat de Batalla
              </span>
              <button
                onClick={() => setIsChatOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "12px",
                  fontWeight: 900,
                  cursor: "pointer",
                  padding: "0 4px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Messages Scroll Area with Retro Pixel-Art Scrollbar */}
            <div
              ref={chatMessagesContainerRef}
              className="pixel-scrollbar"
              onScroll={resetChatInactivityTimer}
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                paddingRight: "4px",
              }}
            >
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ fontSize: "11px", lineHeight: "1.25" }}>
                  {msg.isSystem ? (
                    <span style={{ color: "#4ade80", textShadow: "1px 1px 0 #000" }}>{msg.text}</span>
                  ) : (
                    <span>
                      <strong style={{ color: msg.sender === "Tú" ? "#f59e0b" : "#38bdf8", textShadow: "1px 1px 0 #000" }}>
                        [{msg.sender}]:{" "}
                      </strong>
                      <span style={{ color: "#e2e8f0", textShadow: "1px 1px 0 #000" }}>{msg.text}</span>
                    </span>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              style={{ display: "flex", gap: "4px" }}
            >
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  resetChatInactivityTimer();
                }}
                onFocus={resetChatInactivityTimer}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  resetChatInactivityTimer();
                }}
                onKeyUp={(e) => e.stopPropagation()}
                placeholder="Escribe un mensaje..."
                style={{
                  flex: 1,
                  background: "#030712",
                  border: "1.5px solid #000",
                  borderRadius: "3px",
                  color: "#ffffff",
                  fontSize: "11px",
                  padding: "3px 6px",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                className="pixel-btn"
                style={{
                  background: "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  borderRadius: "3px",
                  padding: "0 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ➤
              </button>
            </form>
          </div>
        )}

        {/* Chat Toggle Button in bottom-right */}
        <button
          className="pixel-btn"
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{
            background: isChatOpen
              ? "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)"
              : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
            color: "#ffffff",
            borderRadius: "4px",
            padding: "4px 10px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            textShadow: "1px 1px 0 #000",
            boxShadow: "0 2px 0 #000",
          }}
          title="Abrir / Cerrar Chat de batalla"
        >
          <span style={{ fontSize: "14px" }}>💬</span>
          <span>Chat</span>
        </button>
      </div>
    </div>
  );
};
