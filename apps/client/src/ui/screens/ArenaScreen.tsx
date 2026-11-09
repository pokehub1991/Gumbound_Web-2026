import React, { useEffect, useState, useRef, useCallback } from "react";
import { CombatArena } from "../../core/combat/CombatArena.js";
import { MOBILES_DATA } from "../../core/constants/mobiles.js";
import { AudioManager } from "../../core/audio/AudioManager.js";
import { WeatherWidget } from "../components/WeatherWidget.js";
import { WeatherDefinition, WeatherSlotItem, WeatherRoundInfo, WEATHER_DEFINITIONS } from "../../core/weather/WeatherManager.js";

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
  const [playerGender, setPlayerGender] = useState<"male" | "female">("male");
  const [, setBotMobileId] = useState<number>(1);
  const [shotType, setShotType] = useState<number>(0);

  const [angle, setAngle] = useState<number>(45);
  const [angleMode, setAngleMode] = useState<"true" | "chassis">("true");
  const [chassisAngle, setChassisAngle] = useState<number>(45);
  const [windPower, setWindPower] = useState<number>(0);
  const [windAngle, setWindAngle] = useState<number>(0);
  const [isWindEnabled, setIsWindEnabled] = useState<boolean>(true);

  // Authentic Weather System state (Thor, Wind, Force, Lightning, Mirror, Tornado, etc.)
  const [currentWeather, setCurrentWeather] = useState<WeatherDefinition>(
    arena?.weatherManager?.activeWeather || WEATHER_DEFINITIONS[0]
  );
  const [weatherTapeSlice, setWeatherTapeSlice] = useState<WeatherSlotItem[]>(
    arena?.weatherManager?.getTapeSlice() || []
  );
  const [weatherRoundInfo, setWeatherRoundInfo] = useState<WeatherRoundInfo>(
    arena?.weatherManager?.getRoundInfo() || { turnInRound: 1, turnsPerRound: 2, turnsRemaining: 1 }
  );

  const [, setBotHp] = useState<number>(1000);
  const [, setBotMaxHp] = useState<number>(1000);

  const [shootMode, setShootMode] = useState<"space" | "drag">("space");
  const [lastPower, setLastPower] = useState<number | null>(null);

  // Audio and Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [musicVol, setMusicVol] = useState<number>(Math.round(AudioManager.musicVolume * 100));
  const [sfxVol, setSfxVol] = useState<number>(Math.round(AudioManager.sfxVolume * 100));
  const [isTimerFrozen, setIsTimerFrozen] = useState<boolean>(false);

  // Epic Battle Intro Phase ("ready" -> "¿ESTÁS LISTO?", "fight" -> "¡QUE EMPIECE EL COMBATE!")
  const [battleIntroPhase, setBattleIntroPhase] = useState<"ready" | "fight" | null>(null);
  const centerHudRef = useRef<HTMLDivElement>(null);

  // Turn System (Lista de Turnos)
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [maxTurns, setMaxTurns] = useState<number>(40);
  const [activeTurn, setActiveTurn] = useState<"player" | "bot">("player");
  const [playerDelay, setPlayerDelay] = useState<number>(0);
  const [, setBotDelay] = useState<number>(10);
  const [botCount, setBotCount] = useState<number>(1);
  const [botsInfo, setBotsInfo] = useState<
    Array<{
      id: string;
      nickname: string;
      mobileType: number;
      delay: number;
      hp: number;
      maxHp: number;
      isDead: boolean;
      isImmortal: boolean;
    }>
  >([]);

  // Compact Chat System
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; isSystem?: boolean }>>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatInactivityTimeoutRef = useRef<number | null>(null);
  const handleSendChatMessageRef = useRef<() => void>(() => {});

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

  // Battle Item Inventory & Slots (Dual, Dual, TP) - Permanently consumed on use leaving a hollow socket
  const [playerItems, setPlayerItems] = useState<("dual" | "teleport" | null)[]>(
    arena?.playerItems || ["dual", "dual", "teleport"]
  );
  const [activeItemSlot, setActiveItemSlot] = useState<number | null>(null);
  const [hasUsedItemThisTurn, setHasUsedItemThisTurn] = useState<boolean>(false);
  const [isPlayerTurnActive, setIsPlayerTurnActive] = useState<boolean>(() => {
    return Boolean(
      arena &&
      arena.activeTurn === "player" &&
      !arena.isSimulating &&
      !arena.isBattleIntroActive &&
      !arena.isTurnAdvancing
    );
  });

  const handleToggleItemSlot = (slotIndex: number, itemType: "dual" | "teleport") => {
    if (playerItems[slotIndex] === null) return; // Empty socket ("hueco") cannot be activated
    if (hasUsedItemThisTurn || !isPlayerTurnActive || currentWeather.type === "no_items") return;
    if (activeItemSlot === slotIndex) {
      setActiveItemSlot(null);
      if (arena) arena.activateItem(null);
      AudioManager.play("click", 0.7);
    } else {
      setActiveItemSlot(slotIndex);
      if (arena) arena.activateItem(itemType, slotIndex);
    }
  };

  // Turn Countdown Timer Interval: ticks every single second when not frozen or simulating, and only AFTER intro completes
  useEffect(() => {
    const timer = setInterval(() => {
      setTurnCountdown((prev) => {
        if (activeTurn !== "player" || battleIntroPhase || arena?.isBattleIntroActive || !arena || arena.isSimulating || arena.isTurnTimerFrozen || isTimerFrozen) return prev;
        if (prev <= 1) {
          if (prev === 1) {
            arena.handleTurnTimeout();
          }
          return 0;
        }
        const next = prev - 1;
        // Sonido del temporizador suena en cada segundo desde el principio (respetando silenciar música/audio)
        if (next > 0 && !AudioManager.isMusicMuted && !AudioManager.isMuted) {
          AudioManager.play("turntick1s", next <= 5 ? 0.9 : 0.75);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [arena, isTimerFrozen, battleIntroPhase, activeTurn]);

  // Keyboard listeners: ESC opens/closes settings modal & chat; Enter handles chat; Shift cycles shot types
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Priority Escape handling: ALWAYS closes settings modal if open, closes chat if open, or opens settings modal
      if (e.key === "Escape" || e.code === "Escape") {
        e.preventDefault();
        if (target) {
          try {
            target.blur();
          } catch {}
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          AudioManager.play("click", 0.7);
        } else if (isChatOpen) {
          setIsChatOpen(false);
        } else {
          setIsSettingsOpen(true);
          AudioManager.play("click", 0.7);
        }
        return;
      }

      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }

      // Authentic GunBound Pass Turn hotkey: F9 exclusively
      if (e.key === "F9" || e.code === "F9") {
        e.preventDefault();
        if (arena && isPlayerTurnActive) {
          arena.passTurn();
        }
        return;
      }

      if (e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        if (!isPlayerTurnActive) return;
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
        if (!isChatOpen) {
          setIsChatOpen(true);
          setTimeout(() => {
            chatInputRef.current?.focus();
          }, 50);
        } else {
          if (!chatInput.trim()) {
            setIsChatOpen(false);
          } else {
            handleSendChatMessageRef.current();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [arena, isChatOpen, chatInput, isSettingsOpen, isPlayerTurnActive]);

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
    setTurnNumber(arena.turnNumber);
    setMaxTurns(arena.maxTurns);
    setActiveTurn(arena.activeTurn);
    setPlayerDelay(arena.playerDelay);
    setBotDelay(arena.botDelay);
    setBotCount(arena.bots.length);
    arena.setShootMode(shootMode);
    setIsPlayerTurnActive(
      arena.activeTurn === "player" &&
      !arena.isSimulating &&
      !arena.isBattleIntroActive &&
      !arena.isTurnAdvancing
    );

    arena.onBotCountChange = (count) => {
      setBotCount(count);
    };

    arena.onBotChat = (nickname, text) => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: nickname,
          text,
          isSystem: false,
        },
      ]);
    };

    arena.onTurnPlayableChange = (playable) => {
      setIsPlayerTurnActive(playable);
      if (playable) {
        setHasUsedItemThisTurn(false);
        setActiveItemSlot(null);
      }
    };

    arena.onTurnUpdate = (info) => {
      setTurnNumber(info.turnNumber);
      setMaxTurns(info.maxTurns);
      setActiveTurn(info.activeTurn);
      if (info.activeTurn !== "player") {
        setActiveItemSlot(null);
        setIsPlayerTurnActive(false);
      } else if (!arena.isSimulating && !arena.isBattleIntroActive && !arena.isTurnAdvancing) {
        setIsPlayerTurnActive(true);
      }
      setPlayerDelay(info.playerDelay);
      setBotDelay(info.botDelay);
      if (info.bots) {
        setBotsInfo(info.bots);
      }
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

    arena.onItemUsedThisTurnChange = (used) => {
      setHasUsedItemThisTurn(used);
      if (used) {
        setActiveItemSlot(null);
      }
    };

    setPlayerItems([...arena.playerItems]);
    arena.onPlayerItemsChange = (items) => {
      setPlayerItems([...items]);
    };

    if (arena.weatherManager) {
      setCurrentWeather(arena.weatherManager.activeWeather);
      setWeatherTapeSlice(arena.weatherManager.getTapeSlice());
      setWeatherRoundInfo(arena.weatherManager.getRoundInfo());
    }

    arena.onWeatherUpdate = (weather, tape, _col, roundInfo) => {
      setCurrentWeather(weather);
      setWeatherTapeSlice(tape);
      if (roundInfo) {
        setWeatherRoundInfo(roundInfo);
      }
      if (weather.type === "no_items") {
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
      setIsTimerFrozen(false);
      setHasUsedItemThisTurn(false);
      setActiveItemSlot(null);
      setIsPlayerTurnActive(true);
    };

    arena.onTurnTimerFreeze = () => {
      setIsTimerFrozen(true);
    };

    arena.onTurnTimerReset = (secs = 20) => {
      setTurnCountdown(secs);
      setIsTimerFrozen(false);
    };

    arena.onMatchReset = () => {
      setChatMessages([]);
      setUnreadChatCount(0);
      setHasNewChatAlert(false);
    };

    // Battle Intro Sequence listener & initial sync
    if (arena.battleIntroPhase) {
      setBattleIntroPhase(arena.battleIntroPhase);
      if (arena.battleIntroPhase !== null) {
        setIsPlayerTurnActive(false);
      }
    }
    arena.onBattleIntro = (phase) => {
      setBattleIntroPhase(phase);
      if (phase !== null) {
        setIsPlayerTurnActive(false);
      }
    };

    // If intro hasn't started yet on fresh arena mount, trigger it now
    if (arena.turnNumber === 1 && !arena.hasStartedIntro) {
      arena.startBattleIntroSequence();
    }

    // Dynamic HUD bounds measuring to keep WeatherSkyMarker accurately pinned
    const updateHudBounds = () => {
      if (centerHudRef.current && arena) {
        const rect = centerHudRef.current.getBoundingClientRect();
        arena.setCenterHudBounds(rect.left - 8, rect.right + 8, rect.bottom);
      }
    };
    updateHudBounds();
    window.addEventListener("resize", updateHudBounds);
    const hudTimer = setTimeout(updateHudBounds, 250);

    return () => {
      window.removeEventListener("resize", updateHudBounds);
      clearTimeout(hudTimer);
    };
  }, [arena]);

  const handleSelectShotType = (type: number) => {
    if (!isPlayerTurnActive) return;
    setShotType(type);
    if (arena) {
      arena.setShotType(type);
      AudioManager.play("click", 0.7);
    }
  };

  const handleSelectPlayerMobile = (id: number) => {
    setPlayerMobileId(id);
    if (arena) {
      arena.setPlayerMobile(id);
      AudioManager.play("click", 0.7);
    }
  };

  const handleSelectPlayerGender = (gender: "male" | "female") => {
    setPlayerGender(gender);
    if (arena) {
      arena.setPlayerGender(gender);
      AudioManager.play("click", 0.7);
    }
  };

  const handleSetBotCount = (targetCount: number) => {
    if (!arena) return;
    arena.setBotCount(targetCount);
    setBotCount(arena.bots.length);
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
  handleSendChatMessageRef.current = handleSendChatMessage;

  // Turn List dynamically formats the combatants list, prioritizing active turn entity at index 0 (top row)
  const rankIcons = ["🔨", "⚔️", "👑", "⭐"];
  const botParticipants = botsInfo.length > 0
    ? botsInfo
    : (arena?.bots || []).map((b) => ({
        id: b.mobile.id,
        nickname: b.mobile.nickname,
        mobileType: b.mobile.mobileType,
        delay: b.delay,
        hp: b.mobile.hp,
        maxHp: b.mobile.maxHp,
        isDead: b.isDead,
        isImmortal: b.isImmortal,
      }));

  const allCombatants = [
    {
      id: "player",
      name: "Player [Tú]",
      rankIcon: "🐣",
      delay: playerDelay,
      isActive: activeTurn === "player",
      nameColor: "#f59e0b",
    },
    ...botParticipants.map((b, idx) => ({
      id: b.id,
      name: b.nickname,
      rankIcon: rankIcons[idx % rankIcons.length],
      delay: b.delay,
      isActive: activeTurn === "bot" && (arena?.actingBot?.mobile.id === b.id || (!arena?.actingBot && idx === 0)),
      nameColor: "#38bdf8",
    })),
  ];

  const activeCombatant = allCombatants.find((c) => c.isActive) || allCombatants[0];
  const sortedCombatants = [...allCombatants].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.delay - b.delay;
  });

  const turnList = sortedCombatants.map((c, idx) => {
    const delta = c.delay - activeCombatant.delay;
    return {
      id: c.id,
      turnIndex: idx,
      rankIcon: c.rankIcon,
      name: c.name,
      isActive: c.isActive,
      orderBoxBg: c.isActive ? "#f59e0b" : "#38bdf8",
      orderBoxBorder: c.isActive ? "#b45309" : "#0284c7",
      nameColor: c.nameColor,
      delayStr: c.isActive ? "0" : delta >= 0 ? `+${delta}` : `${delta}`,
      delayColor: c.isActive ? "#ffffff" : "#94a3b8",
    };
  });

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
        {/* Left: Map Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
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

        {/* Center: Unified Weather + Wind Widget (Replica fiel de GunBound) */}
        <div ref={centerHudRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto" }}>
          <WeatherWidget
            currentWeather={currentWeather}
            tapeSlice={weatherTapeSlice}
            roundInfo={weatherRoundInfo}
            windPower={windPower}
            windAngle={windAngle}
            isWindEnabled={isWindEnabled}
          />
        </div>

        {/* Right: Giant Turn Countdown Timer (Replica fiel GunBound Image 1) */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end", minWidth: "120px", pointerEvents: "none" }}>
          {activeTurn === "player" && !battleIntroPhase && !arena?.isBattleIntroActive && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "auto",
                padding: "0 8px",
              }}
              title="Tiempo restante de turno (20 segundos)"
            >
              <span
                className={`gunbound-giant-timer ${turnCountdown <= 5 ? "gunbound-giant-timer-critical" : ""}`}
                style={{
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {turnCountdown}
              </span>
            </div>
          )}
        </div>
      </div>


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
          height: "76px",
          borderRadius: "4px",
          padding: "4px 8px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
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
      {/* CENTER-BOTTOM: COCKPIT HUD (2x3 GRID + POWER BAR RIGHT) */}
      {/* ============================================================ */}
      <div
        className="pixel-box"
        style={{
          position: "absolute",
          bottom: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          borderRadius: "6px",
          padding: "4px 8px",
          height: "76px",
          boxSizing: "border-box",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          gap: "8px",
          width: "min(660px, calc(100vw - 320px))",
          zIndex: 10,
        }}
      >
        {/* Left Side: 2x3 Grid of Mobil Shots (S1, S2, SS) & Items (Replica Image 3) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 48px)",
          gridTemplateRows: "repeat(2, 28px)",
          gap: "4px",
          alignItems: "center",
          flexShrink: 0,
        }}>
          {/* Row 1, Col 1: S1 */}
          <button
            className="pixel-btn"
            disabled={!isPlayerTurnActive}
            onClick={() => handleSelectShotType(0)}
            style={{
              background: shotType === 0
                ? "var(--bg-panel-blue)"
                : "var(--bg-panel-slate)",
              border: shotType === 0 ? "2px solid var(--color-white)" : "var(--border-pixel-black)",
              borderRadius: "3px",
              padding: 0,
              color: shotType === 0 ? "var(--color-white)" : "var(--color-slate-400)",
              fontWeight: 700,
              fontSize: "12px",
              cursor: isPlayerTurnActive ? "pointer" : "not-allowed",
              opacity: isPlayerTurnActive ? 1 : 0.45,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "28px",
              boxSizing: "border-box",
              boxShadow: shotType === 0
                ? "var(--shadow-glow-cyan)"
                : "var(--shadow-bevel-btn)",
              textShadow: "var(--text-shadow-pixel)",
            }}
            title={isPlayerTurnActive ? "Shot 1 [Tecla 1]" : "Esperando tu turno..."}
          >
            <span>S<span className="num-font">1</span></span>
          </button>

          {/* Row 1, Col 2: S2 */}
          <button
            className="pixel-btn"
            disabled={!isPlayerTurnActive}
            onClick={() => handleSelectShotType(1)}
            style={{
              background: shotType === 1
                ? "linear-gradient(180deg, #facc15 0%, #d97706 100%)"
                : "var(--bg-panel-slate)",
              border: shotType === 1 ? "2px solid var(--color-white)" : "var(--border-pixel-black)",
              borderRadius: "3px",
              padding: 0,
              color: shotType === 1 ? "var(--color-white)" : "var(--color-slate-400)",
              fontWeight: 700,
              fontSize: "12px",
              cursor: isPlayerTurnActive ? "pointer" : "not-allowed",
              opacity: isPlayerTurnActive ? 1 : 0.45,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "28px",
              boxSizing: "border-box",
              boxShadow: shotType === 1
                ? "var(--shadow-glow-gold)"
                : "var(--shadow-bevel-btn)",
              textShadow: "var(--text-shadow-pixel)",
            }}
            title={isPlayerTurnActive ? "Shot 2 [Tecla 2]" : "Esperando tu turno..."}
          >
            <span>S<span className="num-font">2</span></span>
          </button>

          {/* Row 1, Col 3: SS */}
          <button
            className="pixel-btn"
            disabled={!isPlayerTurnActive}
            onClick={() => handleSelectShotType(2)}
            style={{
              background: shotType === 2
                ? "var(--bg-panel-red)"
                : "var(--bg-panel-slate)",
              border: shotType === 2 ? "var(--border-pixel-warning)" : "var(--border-pixel-black)",
              borderRadius: "3px",
              padding: 0,
              color: shotType === 2 ? "var(--color-warning-soft)" : "var(--color-slate-400)",
              fontWeight: 700,
              fontSize: "12px",
              cursor: isPlayerTurnActive ? "pointer" : "not-allowed",
              opacity: isPlayerTurnActive ? 1 : 0.45,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "28px",
              boxSizing: "border-box",
              boxShadow: shotType === 2
                ? "var(--shadow-glow-red)"
                : "var(--shadow-bevel-btn)",
              textShadow: "var(--text-shadow-pixel)",
            }}
            title={isPlayerTurnActive ? "Super Shot [Tecla 3 / F]" : "Esperando tu turno..."}
          >
            <span>SS</span>
          </button>

          {/* Row 2: 3 Items Slots (Col 1, Col 2, Col 3) */}
          {playerItems.map((itemType, slotIndex) => {
            if (itemType === null) {
              return (
                <div
                  key={slotIndex}
                  style={{
                    width: "48px",
                    height: "28px",
                    boxSizing: "border-box",
                    background: "rgba(10, 15, 26, 0.75)",
                    borderRadius: "3px",
                    border: "2px solid #000000",
                    boxShadow: "inset 2px 2px 3px rgba(0, 0, 0, 0.85), inset -1px -1px 0px rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Espacio de ítem usado (vacío por el resto del combate)"
                >
                  <div
                    style={{
                      width: "10px",
                      height: "2px",
                      background: "rgba(255, 255, 255, 0.08)",
                      borderRadius: "1px",
                    }}
                  />
                </div>
              );
            }

            const label = itemType === "dual" ? "DUAL" : "TP";
            const defaultTitle = itemType === "dual"
              ? `Item ${slotIndex + 1}: Disparo Dual (x2 proyectiles)`
              : `Item ${slotIndex + 1}: Teleportación instantánea`;
            const isLocked = currentWeather.type === "no_items" || hasUsedItemThisTurn || !isPlayerTurnActive;
            const isSelected = activeItemSlot === slotIndex && !isLocked;
            const lockTitle = currentWeather.type === "no_items"
              ? "Ítems bloqueados por el clima (No Items)"
              : hasUsedItemThisTurn
              ? "Solo puedes usar 1 ítem por turno"
              : !isPlayerTurnActive
              ? "Esperando tu turno..."
              : defaultTitle;

            return (
              <button
                key={slotIndex}
                disabled={isLocked}
                className="pixel-btn"
                onClick={() => !isLocked && handleToggleItemSlot(slotIndex, itemType)}
                style={{
                  background: isLocked
                    ? "rgba(30, 41, 59, 0.6)"
                    : isSelected
                    ? "var(--bg-panel-green)"
                    : "var(--bg-panel-slate)",
                  border: isSelected ? "2px solid var(--color-white)" : "var(--border-pixel-black)",
                  borderRadius: "3px",
                  padding: 0,
                  width: "48px",
                  height: "28px",
                  boxSizing: "border-box",
                  color: isLocked ? "#64748b" : isSelected ? "var(--color-white)" : "var(--color-slate-400)",
                  fontFamily: "var(--font-game)",
                  fontWeight: 700,
                  fontSize: "11px",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.45 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isSelected
                    ? "var(--shadow-glow-green)"
                    : "var(--shadow-bevel-btn)",
                  textShadow: "var(--text-shadow-pixel)",
                }}
                title={lockTitle}
              >
                {isLocked && currentWeather.type === "no_items" ? "🔒" : label}
              </button>
            );
          })}
        </div>

        {/* Right Side: Mode Toggle + Digital Angle Badge (Top) and Power Bar (Bottom) */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          gap: "4px",
          minWidth: 0,
        }}>
          {/* Top Sub-Row: Shoot Mode Toggle (⌨️ / 🖱️) + Digital Angle Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "5px",
            height: "26px",
          }}>
            {/* Mode toggle button */}
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
                borderRadius: "3px",
                width: "30px",
                height: "26px",
                color: "var(--color-white)",
                cursor: "pointer",
                boxShadow: shootMode === "drag"
                  ? "var(--shadow-glow-green)"
                  : "var(--shadow-bevel-btn)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
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
                borderRadius: "3px",
                padding: "2px 6px",
                minWidth: "52px",
                height: "26px",
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
                fontSize: "15px",
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

          {/* Bottom Sub-Row: Full-Width Authentic GunBound Power Meter Bar */}
          <div style={{
            width: "100%",
            height: "28px",
            background: "var(--bg-well-dark)",
            borderRadius: "3px",
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
                  top: "6px",
                  bottom: "6px",
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
              {chatMessages.map((msg, idx) => {
                const cleanSender = msg.sender.replace(/^\[?\(?BOT\)?\]?\s*/i, "").trim();
                return (
                  <div key={idx} style={{ fontSize: "12px", lineHeight: "1.4", letterSpacing: "0.2px", fontFamily: "var(--font-game)" }}>
                    {msg.isSystem ? (
                      <span style={{ color: "var(--color-success)", textShadow: "var(--text-shadow-pixel)" }}>{renderPixelText(msg.text)}</span>
                    ) : (
                      <span>
                        <strong style={{ color: cleanSender === "Tú" ? "var(--color-warning)" : "var(--color-primary)", textShadow: "var(--text-shadow-pixel)" }}>
                          [{renderPixelText(cleanSender)}]:{" "}
                        </strong>
                        <span style={{ color: "var(--color-slate-200)", textShadow: "var(--text-shadow-pixel)" }}>{renderPixelText(msg.text)}</span>
                      </span>
                    )}
                  </div>
                );
              })}
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
                    if (e.key === "Enter") {
                      if (!chatInput.trim()) {
                        e.preventDefault();
                        setIsChatOpen(false);
                        chatInputRef.current?.blur();
                      }
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setIsChatOpen(false);
                      chatInputRef.current?.blur();
                    }
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

      {/* ============================================================ */}
      {/* EPIC RETRO BATTLE INTRO BANNER ("¿ESTÁS LISTO?" -> "¡QUE EMPIECE EL COMBATE!") */}
      {/* ============================================================ */}
      {battleIntroPhase && (
        <div style={{
          position: "fixed",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 95,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "pixelIntroPop 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        }}>
          <div
            className="pixel-box"
            style={{
              padding: "18px 48px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              background: battleIntroPhase === "ready"
                ? "radial-gradient(ellipse at center, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.98) 100%)"
                : "radial-gradient(ellipse at center, rgba(69, 10, 10, 0.96) 0%, rgba(26, 4, 4, 0.98) 100%)",
              border: battleIntroPhase === "ready"
                ? "3.5px solid #38bdf8"
                : "3.5px solid #ef4444",
              boxShadow: battleIntroPhase === "ready"
                ? "0 0 45px rgba(56, 189, 248, 0.8), inset 0 0 24px rgba(56, 189, 248, 0.4), 0 10px 40px rgba(0,0,0,0.9)"
                : "0 0 55px rgba(239, 68, 68, 0.9), inset 0 0 30px rgba(249, 115, 22, 0.5), 0 10px 40px rgba(0,0,0,0.9)",
              borderRadius: "6px",
            }}
          >
            <div style={{
              fontFamily: "var(--font-game)",
              fontSize: battleIntroPhase === "ready" ? "42px" : "44px",
              fontWeight: 900,
              letterSpacing: "3px",
              color: battleIntroPhase === "ready" ? "#38bdf8" : "#ef4444",
              textShadow: battleIntroPhase === "ready"
                ? "0 0 16px rgba(56, 189, 248, 0.95), 3px 3px 0px #000, -2px -2px 0px #000"
                : "0 0 20px rgba(239, 68, 68, 0.98), 3px 3px 0px #000, -2px -2px 0px #000",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              {battleIntroPhase === "ready" ? "¿ESTÁS LISTO?" : "¡QUE EMPIECE EL COMBATE!"}
            </div>
            <div style={{
              fontFamily: "var(--font-num)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "3px",
              color: battleIntroPhase === "ready" ? "#facc15" : "#f97316",
              textShadow: "1px 1px 0px #000",
              textTransform: "uppercase",
            }}>
              {battleIntroPhase === "ready" ? "PREPÁRATE PARA EL COMBATE" : "¡FUEGO A DISCRECIÓN!"}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* RETRO PIXEL-ART SETTINGS & OPTIONS MODAL (ESC) */}
      {/* ============================================================ */}
      {isSettingsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSettingsOpen(false);
              AudioManager.play("click", 0.6);
            }
          }}
        >
          <div
            className="pixel-box"
            style={{
              width: "360px",
              maxWidth: "92vw",
              padding: "14px 16px 18px 16px",
              background: "var(--color-bg-panel, #090e17)",
              border: "2px solid var(--color-slate-700)",
              borderRadius: "6px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.9), 0 0 20px rgba(56, 189, 248, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxSizing: "border-box",
            }}
          >
            {/* Header: Title + Close Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--color-slate-800)",
                paddingBottom: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--color-primary, #facc15)",
                  fontFamily: "var(--font-game)",
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textShadow: "var(--text-shadow-pixel)",
                }}
              >
                <span>⚙️</span>
                <span>{renderPixelText("OPCIONES")}</span>
              </div>
              <button
                className="pixel-btn pixel-btn-danger"
                onClick={() => {
                  setIsSettingsOpen(false);
                  AudioManager.play("click", 0.7);
                }}
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                  border: "none",
                }}
                title="Cerrar (Esc)"
              >
                ✖
              </button>
            </div>

            {/* Categoría 1: Audio */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#38bdf8",
                  fontFamily: "var(--font-game)",
                  letterSpacing: "1px",
                  borderBottom: "1px dashed rgba(56, 189, 248, 0.25)",
                  paddingBottom: "3px",
                }}
              >
                🎵 {renderPixelText("AUDIO")}
              </div>

              {/* Music Volume Row */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    fontFamily: "var(--font-game)",
                    color: "var(--color-slate-300)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>{musicVol === 0 ? "🔇" : "🎵"}</span>
                    <span>{renderPixelText("MÚSICA")}</span>
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-num)",
                      fontSize: "11px",
                      color: "var(--color-primary, #facc15)",
                    }}
                  >
                    {musicVol}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={musicVol}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setMusicVol(val);
                    AudioManager.setMusicVolume(val / 100);
                  }}
                  style={{
                    width: "100%",
                    cursor: "pointer",
                    accentColor: "var(--color-primary, #facc15)",
                    height: "6px",
                  }}
                />
              </div>

              {/* SFX Volume Row */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    fontFamily: "var(--font-game)",
                    color: "var(--color-slate-300)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>{sfxVol === 0 ? "🔇" : "🔊"}</span>
                    <span>{renderPixelText("EFECTOS (SFX)")}</span>
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-num)",
                      fontSize: "11px",
                      color: "var(--color-primary, #facc15)",
                    }}
                  >
                    {sfxVol}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sfxVol}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSfxVol(val);
                    AudioManager.setSfxVolume(val / 100);
                  }}
                  onMouseUp={() => {
                    AudioManager.play("click", 0.7);
                  }}
                  style={{
                    width: "100%",
                    cursor: "pointer",
                    accentColor: "var(--color-primary, #facc15)",
                    height: "6px",
                  }}
                />
              </div>
            </div>

            {/* Categoría 2: Móvil / Vehículo */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#facc15",
                  fontFamily: "var(--font-game)",
                  letterSpacing: "1px",
                  borderBottom: "1px dashed rgba(250, 204, 21, 0.25)",
                  paddingBottom: "3px",
                }}
              >
                🚜 {renderPixelText("MÓVIL DEL JUGADOR")}
              </div>

              <select
                value={playerMobileId}
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  handleSelectPlayerMobile(id);
                }}
                className="pixel-box"
                style={{
                  width: "100%",
                  height: "32px",
                  background: "var(--bg-well-dark, #0b101b)",
                  color: "var(--color-primary, #facc15)",
                  fontFamily: "var(--font-game)",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 8px",
                  border: "var(--border-pixel-black)",
                  borderRadius: "3px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {Object.values(MOBILES_DATA).map((mob) => (
                  <option
                    key={mob.id}
                    value={mob.id}
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      fontFamily: "var(--font-game)",
                    }}
                  >
                    #{mob.id.toString().padStart(2, "0")} - {mob.name} ({mob.minAngle}° ~ {mob.maxAngle}°)
                  </option>
                ))}
              </select>

              <div
                style={{
                  fontSize: "10px",
                  color: "var(--color-slate-400)",
                  fontFamily: "var(--font-game)",
                  lineHeight: "1.4",
                  padding: "4px 6px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "3px",
                }}
              >
                {currentMob.description}
              </div>

              {/* Selector de Piloto / Avatar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0 2px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-game)",
                    color: "var(--color-slate-300)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  👤 {renderPixelText("PILOTO")}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className={`pixel-btn ${playerGender === "male" ? "pixel-btn-primary" : "pixel-btn-secondary"}`}
                    onClick={() => handleSelectPlayerGender("male")}
                    style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    👨 Chico
                  </button>
                  <button
                    className={`pixel-btn ${playerGender === "female" ? "pixel-btn-primary" : "pixel-btn-secondary"}`}
                    onClick={() => handleSelectPlayerGender("female")}
                    style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    👩 Chica
                  </button>
                </div>
              </div>
            </div>

            {/* Categoría 3: Combate y Bots */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#4ade80",
                  fontFamily: "var(--font-game)",
                  letterSpacing: "1px",
                  borderBottom: "1px dashed rgba(74, 222, 128, 0.25)",
                  paddingBottom: "3px",
                }}
              >
                🤖 {renderPixelText("COMBATE & BOTS")}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-game)",
                    color: "var(--color-slate-300)",
                  }}
                >
                  {renderPixelText("CANTIDAD DE BOTS:")}
                </span>

                <div style={{ display: "flex", gap: "6px" }}>
                  {[1, 2, 3].map((count) => (
                    <button
                      key={count}
                      className={`pixel-btn ${botCount === count ? "pixel-btn-primary" : "pixel-btn-slate"}`}
                      onClick={() => handleSetBotCount(count)}
                      style={{
                        padding: "3px 8px",
                        fontSize: "10px",
                        fontWeight: 700,
                        cursor: "pointer",
                        borderRadius: "3px",
                        border: botCount === count ? "1px solid #38bdf8" : undefined,
                      }}
                    >
                      {count} {count === 1 ? "BOT" : "BOTS"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="pixel-btn pixel-btn-warning"
                onClick={() => {
                  if (arena) {
                    arena.resetMap();
                    AudioManager.play("click", 0.7);
                    setIsSettingsOpen(false);
                  }
                }}
                style={{
                  width: "100%",
                  height: "30px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  borderRadius: "3px",
                  marginTop: "4px",
                }}
              >
                <span>🔄</span>
                <span>{renderPixelText("REINICIAR PARTIDA")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
