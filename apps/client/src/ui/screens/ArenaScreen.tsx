import React, { useEffect, useState, useRef, useCallback } from "react";
import { CombatArena } from "../../core/combat/CombatArena.js";
import { MobileSelector } from "../components/MobileSelector.js";
import { MOBILES_DATA } from "../../core/constants/mobiles.js";
import { AudioManager } from "../../core/audio/AudioManager.js";

interface ArenaScreenProps {
  arena: CombatArena | null;
  onExit?: () => void;
}

const renderPixelText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\d+)/g);
  return parts.map((part, i) =>
    /^\d+$/.test(part) ? (
      <span key={i} className="num-font">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

export const ArenaScreen: React.FC<ArenaScreenProps> = ({ arena }) => {
  const [playerMobileId, setPlayerMobileId] = useState<number>(0);
  const [botMobileId, setBotMobileId] = useState<number>(1);
  const [shotType, setShotType] = useState<number>(0);

  const [angle, setAngle] = useState<number>(45);
  const [angleMode, setAngleMode] = useState<"true" | "chassis">("true");
  const [chassisAngle, setChassisAngle] = useState<number>(45);
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

  // Anti-Spam & Chat Cooldown (Max 200 chars, mute 60s if same msg sent > 3 times)
  const [chatMuteRemaining, setChatMuteRemaining] = useState<number>(0);
  const lastChatMessageRef = useRef<string>("");
  const repeatCountRef = useRef<number>(0);

  // Unread Messages Indicator (Pixel-art notification badge)
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [hasNewChatAlert, setHasNewChatAlert] = useState<boolean>(false);
  const lastMessageCountRef = useRef<number>(chatMessages.length);

  useEffect(() => {
    if (chatMessages.length > lastMessageCountRef.current) {
      const newMessages = chatMessages.slice(lastMessageCountRef.current);
      // Only notify if chat is closed and the message wasn't sent by local player
      const incoming = newMessages.filter((m) => m.sender !== "Tú");
      if (!isChatOpen && incoming.length > 0) {
        setUnreadChatCount((prev) => prev + incoming.length);
        setHasNewChatAlert(true);
      }
    }
    lastMessageCountRef.current = chatMessages.length;
  }, [chatMessages, isChatOpen]);

  // When user opens the chat box, immediately deactivate notifications and return button to normal state
  useEffect(() => {
    if (isChatOpen) {
      setUnreadChatCount(0);
      setHasNewChatAlert(false);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (chatMuteRemaining <= 0) return;
    const interval = window.setInterval(() => {
      setChatMuteRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          repeatCountRef.current = 0;
          lastChatMessageRef.current = "";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [chatMuteRemaining]);

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
    setAngle(arena.player.getTrueAimAngle());
    setChassisAngle(arena.player.angleDeg);
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
      if (arena) {
        setChassisAngle(arena.player.angleDeg);
      }
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
    if (chatMuteRemaining > 0) return;
    if (!chatInput.trim()) return;
    const text = chatInput.trim().slice(0, 200);
    const normalized = text.toLowerCase();

    if (normalized === lastChatMessageRef.current) {
      repeatCountRef.current += 1;
    } else {
      lastChatMessageRef.current = normalized;
      repeatCountRef.current = 1;
    }

    // If sent more than 3 times, immediately mute for 60 seconds
    if (repeatCountRef.current > 3) {
      setChatMuteRemaining(60);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "Sistema",
          text: "⚠️ ¡Anti-Spam activado! (60s)",
          isSystem: true,
        },
      ]);
      setChatInput("");
      resetChatInactivityTimer();
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 40);
      return;
    }

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
      fontFamily: "var(--font-game)",
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
            <span style={{ fontSize: "12px", color: "var(--color-slate-500)", margin: "0 2px" }}>🔍</span>
            {[
              { label: "1.2x", val: 1.2, title: "Zoom normal (1.2x)" },
              { label: "0.85x", val: 0.85, title: "Vista amplia (0.85x)" },
              { label: "0.55x", val: 0.55, title: "Vista panorámica (0.55x)" },
            ].map((item) => (
              <button
                key={item.label}
                className={`pixel-btn ${currentZoom === item.val ? "pixel-btn-primary" : "pixel-btn-slate"}`}
                onClick={() => {
                  if (arena) arena.engine.setPresetZoom(item.val);
                  setCurrentZoom(item.val);
                  AudioManager.play("click", 0.6);
                }}
                style={{
                  borderRadius: "3px",
                  padding: "2px 6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  height: "26px",
                  textShadow: "var(--text-shadow-pixel)",
                }}
                title={item.title}
              >
                {renderPixelText(item.label)}
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
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.5px", textShadow: "var(--text-shadow-pixel)" }}>
              METAMINE
            </span>
            <button
              className="pixel-btn pixel-btn-primary"
              onClick={() => {
                if (arena) {
                  arena.resetMap();
                  setLastPower(null);
                  setTurnCountdown(20);
                  AudioManager.play("click", 0.7);
                }
              }}
              style={{
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
            ? "var(--bg-panel-dark)"
            : "var(--bg-panel-slate)",
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
                <polygon points="18,4 24,27 18,21 12,27" fill={isWindEnabled ? "var(--color-primary)" : "var(--color-slate-400)"} stroke="#000000" strokeWidth="1" />
                <circle cx="18" cy="18" r="3" fill="#ffffff" />
              </g>
            </svg>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
            <span className="num-font" style={{ color: isWindEnabled ? "var(--color-primary)" : "var(--color-slate-400)", fontSize: "15px", fontWeight: 700, textShadow: "var(--text-shadow-pixel)" }}>
              {isWindEnabled ? windPower : 0}
            </span>
            <span className={isWindEnabled ? "num-font" : undefined} style={{ fontSize: "10px", color: isWindEnabled ? "var(--color-primary-hover)" : "var(--color-slate-500)", fontWeight: 700, textShadow: "var(--text-shadow-pixel)" }}>
              {isWindEnabled ? `${windAngle}°` : "OFF"}
            </span>
          </div>

          {/* Toggle Wind Button */}
          <button
            className={`pixel-btn ${isWindEnabled ? "pixel-btn-primary" : "pixel-btn-slate"}`}
            onClick={handleToggleWind}
            style={{
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
              className="pixel-btn pixel-btn-slate"
              onClick={handleRandomizeWind}
              style={{
                color: "var(--color-primary)",
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
                fontSize: "12px",
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
                background: "var(--bg-well-dark)",
                border: "1.5px solid var(--color-warning)",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25)",
              }}>
                🐣
              </div>
              <span style={{ color: "var(--color-primary)" }}>{currentMob.name}</span>
              <span style={{ fontSize: "10px", color: "var(--color-slate-400)" }}>▾</span>
            </button>

            {/* Subtle Vertical Divider */}
            <div style={{ width: "1px", height: "18px", background: "var(--color-slate-700)" }} />

            {/* Integrated Music Toggle Button */}
            <button
              className={`pixel-btn ${isMusicActive ? "pixel-btn-success" : "pixel-btn-danger"}`}
              onClick={handleToggleMusic}
              style={{
                borderRadius: "3px",
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

            {/* Subtle Vertical Divider */}
            <div style={{ width: "1px", height: "18px", background: "var(--color-slate-700)" }} />

            {/* Random Bot Respawn Button */}
            <button
              className="pixel-btn pixel-btn-primary"
              onClick={() => {
                if (arena) {
                  arena.resetBot(true);
                  setBotHp(arena.bot.mobile.maxHp);
                  setBotMaxHp(arena.bot.mobile.maxHp);
                  AudioManager.play("click", 0.7);
                }
              }}
              style={{
                borderRadius: "3px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
                border: "none",
              }}
              title="Reaparecer Bot en terreno aleatorio (Respawn)"
            >
              🎲
            </button>
          </div>

          {/* Bot Immortal / Mortal Toggle Button */}
          <button
            className={`pixel-btn ${isBotImmortal ? "pixel-btn-success" : "pixel-btn-danger"}`}
            onClick={() => {
              if (arena) {
                const next = arena.toggleBotImmortality();
                setIsBotImmortal(next);
                AudioManager.play("click", 0.7);
              }
            }}
            style={{
              borderRadius: "4px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              cursor: "pointer",
              boxSizing: "border-box",
              boxShadow: isBotImmortal ? "var(--shadow-glow-green)" : "var(--shadow-glow-red)",
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
              width: "72px",
              height: "36px",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              pointerEvents: "auto",
              background: turnCountdown <= 5
                ? "var(--bg-panel-critical)"
                : "var(--bg-panel-slate)",
              border: turnCountdown <= 5 ? "var(--border-pixel-danger)" : "var(--border-pixel-black)",
              boxShadow: turnCountdown <= 5
                ? "var(--shadow-glow-red)"
                : "var(--shadow-bevel-btn)",
            }}
            title="Tiempo restante de turno (20 segundos)"
          >
            <span
              className="num-font"
              style={{
                fontSize: "19px",
                fontWeight: 700,
                lineHeight: "1",
                color: turnCountdown <= 5 ? "var(--color-danger)" : turnCountdown <= 10 ? "var(--color-warning-light)" : "var(--color-success)",
                textShadow: "var(--text-shadow-pixel-bold)",
                textAlign: "right",
                display: "inline-block",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {turnCountdown}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "var(--font-game)",
                lineHeight: "1",
                color: turnCountdown <= 5 ? "var(--color-danger-light)" : turnCountdown <= 10 ? "var(--color-warning-soft)" : "var(--color-success-light)",
                textShadow: "var(--text-shadow-pixel)",
                marginTop: "2px",
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
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", textShadow: "var(--text-shadow-pixel)" }}>
              Lista de Turnos
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span className="num-font" style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-success-light)", textShadow: "var(--text-shadow-pixel)" }}>
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
                  <div className="num-font" style={{
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
                    fontSize: "11px",
                    fontWeight: 700,
                    color: item.nameColor,
                    textShadow: "var(--text-shadow-pixel)",
                    maxWidth: "100px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {item.name}
                  </span>
                </div>

                {/* Right section: Delay points difference */}
                <span className="num-font" style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: item.delayColor,
                  textShadow: "var(--text-shadow-pixel)",
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
                  ? "var(--bg-panel-blue)"
                  : "var(--bg-panel-slate)",
                border: shotType === 0 ? "2px solid var(--color-white)" : "var(--border-pixel-black)",
                borderRadius: "4px",
                padding: "3px 12px",
                color: shotType === 0 ? "var(--color-white)" : "var(--color-slate-400)",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "44px",
                height: "34px",
                boxShadow: shotType === 0
                  ? "var(--shadow-glow-cyan)"
                  : "var(--shadow-bevel-btn)",
                textShadow: "var(--text-shadow-pixel)",
              }}
              title="Shot 1 [Tecla 1]"
            >
              <span>S<span className="num-font">1</span></span>
            </button>

            <button
              className="pixel-btn"
              onClick={() => handleSelectShotType(1)}
              style={{
                background: shotType === 1
                  ? "linear-gradient(180deg, #facc15 0%, #d97706 100%)"
                  : "var(--bg-panel-slate)",
                border: shotType === 1 ? "2px solid var(--color-white)" : "var(--border-pixel-black)",
                borderRadius: "4px",
                padding: "3px 12px",
                color: shotType === 1 ? "var(--color-white)" : "var(--color-slate-400)",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "44px",
                height: "34px",
                boxShadow: shotType === 1
                  ? "var(--shadow-glow-gold)"
                  : "var(--shadow-bevel-btn)",
                textShadow: "var(--text-shadow-pixel)",
              }}
              title="Shot 2 [Tecla 2]"
            >
              <span>S<span className="num-font">2</span></span>
            </button>

            <button
              className="pixel-btn"
              onClick={() => handleSelectShotType(2)}
              style={{
                background: shotType === 2
                  ? "var(--bg-panel-red)"
                  : "var(--bg-panel-slate)",
                border: shotType === 2 ? "var(--border-pixel-warning)" : "var(--border-pixel-black)",
                borderRadius: "4px",
                padding: "3px 12px",
                color: shotType === 2 ? "var(--color-warning-soft)" : "var(--color-slate-400)",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "44px",
                height: "34px",
                boxShadow: shotType === 2
                  ? "var(--shadow-glow-red)"
                  : "var(--shadow-bevel-btn)",
                textShadow: "var(--text-shadow-pixel)",
              }}
              title="Super Shot [Tecla 3 / F]"
            >
              <span>SS</span>
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
                      ? "var(--bg-panel-green)"
                      : "var(--bg-panel-slate)",
                    border: isSelected ? "2px solid var(--color-white)" : "var(--border-pixel-black)",
                    borderRadius: "4px",
                    padding: 0,
                    width: "56px",
                    minWidth: "56px",
                    height: "34px",
                    boxSizing: "border-box",
                    color: isSelected ? "var(--color-white)" : "var(--color-slate-400)",
                    fontFamily: "var(--font-game)",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: isSelected
                      ? "var(--shadow-glow-green)"
                      : "var(--shadow-bevel-btn)",
                    textShadow: "var(--text-shadow-pixel)",
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
                  ? "var(--bg-panel-green)"
                  : "var(--bg-panel-slate)",
                border: shootMode === "drag" ? "var(--border-pixel-success)" : "var(--border-pixel-black)",
                borderRadius: "4px",
                width: "36px",
                height: "34px",
                color: "var(--color-white)",
                cursor: "pointer",
                boxShadow: shootMode === "drag"
                  ? "var(--shadow-glow-green)"
                  : "var(--shadow-bevel-btn)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "17px",
              }}
              title={shootMode === "drag" ? "Modo Mouse / Slice (Click para cambiar a Teclado Espacio)" : "Modo Teclado / Espacio (Click para cambiar a Mouse Slice)"}
            >
              <span>{shootMode === "drag" ? "🖱️" : "⌨️"}</span>
            </button>

            {/* Digital Arcade Angle Display (GunBound True Angle + Backshot + Mode Toggle) */}
            <button
              className="pixel-btn"
              onClick={() => {
                setAngleMode((prev) => (prev === "true" ? "chassis" : "true"));
                AudioManager.play("click", 0.7);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-input-field)",
                border: "var(--border-pixel-black)",
                borderRadius: "4px",
                padding: "3px 8px",
                minWidth: "58px",
                height: "34px",
                boxSizing: "border-box",
                boxShadow: "var(--shadow-well-sunken)",
                cursor: "pointer",
                gap: "3px",
              }}
              title={angleMode === "true"
                ? `Ángulo Real: ${angle > 90 ? `${180 - angle}° [BS]` : `${angle}°`} (Click para ver Ángulo Chasis: ${chassisAngle}°)`
                : `Ángulo Chasis: ${chassisAngle}° (Click para ver Ángulo Real: ${angle > 90 ? `${180 - angle}° [BS]` : `${angle}°`})`}
            >
              <span className="num-font" style={{
                color: angle > 90 ? "var(--color-danger)" : "var(--color-success)",
                fontSize: "17px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textShadow: "var(--text-shadow-pixel-bold)",
              }}>
                {angleMode === "true"
                  ? (angle > 90 ? `${180 - angle}°` : `${angle}°`)
                  : `${chassisAngle}°`}
              </span>
              {angleMode === "true" && angle > 90 && (
                <span style={{ fontSize: "9px", color: "var(--color-danger-light)", fontWeight: 700, textShadow: "var(--text-shadow-pixel)" }}>
                  BS
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Lower Row: Full-Width Authentic GunBound Power Meter Bar (WITHOUT TEXT AS REQUESTED) */}
        <div style={{
          width: "100%",
          height: "32px",
          background: "var(--bg-well-dark)",
          borderRadius: "4px",
          border: "var(--border-pixel-black)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "var(--shadow-power-well)",
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
              width: "340px",
              height: "220px",
              borderRadius: "4px",
              padding: "7px 9px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.85)",
              boxSizing: "border-box",
            }}
          >
            {/* Chat Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "var(--border-subtle)",
              paddingBottom: "4px",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-primary)", textShadow: "var(--text-shadow-pixel)" }}>
                💬 Chat de Batalla
              </span>
              <button
                onClick={() => setIsChatOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-slate-400)",
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
                gap: "5px",
                paddingRight: "4px",
              }}
            >
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ fontSize: "12px", lineHeight: "1.4", letterSpacing: "0.2px", fontFamily: "var(--font-game)" }}>
                  {msg.isSystem ? (
                    <span style={{ color: "var(--color-success)", textShadow: "var(--text-shadow-pixel)" }}>{renderPixelText(msg.text)}</span>
                  ) : (
                    <span>
                      <strong style={{ color: msg.sender === "Tú" ? "var(--color-warning)" : "var(--color-primary)", textShadow: "var(--text-shadow-pixel)" }}>
                        [{renderPixelText(msg.sender)}]:{" "}
                      </strong>
                      <span style={{ color: "var(--color-slate-200)", textShadow: "var(--text-shadow-pixel)" }}>{renderPixelText(msg.text)}</span>
                    </span>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form with 200 char limit, anti-spam mute and pixel-art chat indicator icon */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              style={{ display: "flex", gap: "4px", alignItems: "center" }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  background: chatMuteRemaining > 0 ? "var(--bg-input-muted)" : "var(--bg-input-field)",
                  border: chatMuteRemaining > 0 ? "var(--border-pixel-danger)" : "var(--border-pixel-thin)",
                  borderRadius: "3px",
                  boxShadow: "var(--shadow-well-sunken)",
                  padding: "0 6px",
                  gap: "5px",
                }}
              >
                {/* Pixel Art Chat Indicator Icon */}
                <span
                  style={{
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    filter: hasNewChatAlert ? "drop-shadow(0 0 3px #38bdf8)" : "none",
                    transition: "filter 0.2s ease",
                    userSelect: "none",
                  }}
                  title="Mensaje de chat"
                >
                  💬
                </span>

                <input
                  ref={chatInputRef}
                  type="text"
                  maxLength={200}
                  disabled={chatMuteRemaining > 0}
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
                  placeholder={
                    chatMuteRemaining > 0
                      ? `Silenciado (${chatMuteRemaining}s)...`
                      : "Escribe un mensaje... (máx 200)"
                  }
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    fontFamily: "var(--font-game)",
                    color: chatMuteRemaining > 0 ? "var(--color-danger-light)" : "var(--color-white)",
                    fontSize: "11px",
                    padding: "4px 0",
                    outline: "none",
                    boxSizing: "border-box",
                    opacity: chatMuteRemaining > 0 ? 0.8 : 1,
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={chatMuteRemaining > 0 || !chatInput.trim()}
                className={`pixel-btn ${chatMuteRemaining > 0 ? "pixel-btn-slate" : "pixel-btn-primary"}`}
                style={{
                  borderRadius: "3px",
                  padding: "0 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: chatMuteRemaining > 0 ? "not-allowed" : "pointer",
                  opacity: chatMuteRemaining > 0 ? 0.5 : 1,
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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
          onClick={() => {
            setIsChatOpen(!isChatOpen);
            setUnreadChatCount(0);
            setHasNewChatAlert(false);
          }}
          style={{
            position: "relative",
            background: (!isChatOpen && unreadChatCount > 0)
              ? "var(--bg-panel-amber)"
              : "var(--bg-panel-slate)",
            color: "var(--color-white)",
            borderRadius: "4px",
            padding: "4px 10px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            textShadow: "var(--text-shadow-pixel)",
            boxShadow: (!isChatOpen && unreadChatCount > 0)
              ? "var(--shadow-glow-gold)"
              : "var(--shadow-bevel-btn)",
          }}
          title="Abrir / Cerrar Chat de batalla"
        >
          <span style={{ fontSize: "12px" }}>💬</span>
          <span>Chat</span>

          {/* Retro Pixel Art Notification Badge when closed and new messages exist */}
          {unreadChatCount > 0 && !isChatOpen && (
            <div
              className="num-font"
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "var(--bg-panel-red)",
                border: "var(--border-pixel-thin)",
                borderRadius: "999px",
                padding: "0 5px",
                minWidth: "16px",
                height: "16px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-white)",
                fontSize: "9px",
                fontWeight: 700,
                boxShadow: "var(--shadow-glow-red)",
              }}
            >
              {unreadChatCount}
            </div>
          )}
        </button>
      </div>
    </div>
  );
};
