import React, { useState, useEffect } from "react";

interface Props {
  activeNickname: string;
  isMyTurn: boolean;
  turnNumber: number;
  selectedShotType: number;
  onSelectShotType: (type: number) => void;
  winnerTeam?: string;
  myTeam?: string;
  onReturnToRoom: () => void;
  onExitToLobby: () => void;
}

export const MatchHUD: React.FC<Props> = ({
  activeNickname,
  isMyTurn,
  turnNumber,
  selectedShotType,
  onSelectShotType,
  winnerTeam,
  myTeam,
  onReturnToRoom,
  onExitToLobby,
}) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    setTimeLeft(30);
    const interval = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [turnNumber, activeNickname]);

  return (
    <div style={{
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "16px 24px",
      boxSizing: "border-box",
    }}>
      {/* Top Bar: Turn & Timer */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        pointerEvents: "auto",
      }}>
        {/* Turn Indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "rgba(15, 23, 42, 0.85)",
          padding: "8px 16px",
          borderRadius: "8px",
          border: isMyTurn ? "2px solid #22c55e" : "1px solid #334155",
          boxShadow: isMyTurn ? "0 0 15px rgba(34, 197, 94, 0.4)" : "none",
        }}>
          <div style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: isMyTurn ? "#22c55e" : "#eab308",
            animation: isMyTurn ? "pulse 1.5s infinite" : "none",
          }} />
          <div style={{ color: "#fff", fontSize: "14px", fontWeight: "bold" }}>
            {isMyTurn ? "¡TU TURNO!" : `TURNO DE: ${activeNickname}`}
          </div>
          <div style={{ color: "#94a3b8", fontSize: "12px" }}>
            (Ronda #{turnNumber})
          </div>
        </div>

        {/* Right Controls: Exit to Lobby & 30s Countdown Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={onExitToLobby}
            title="Salir de la partida y regresar al Lobby para cambiar de móvil"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(220, 38, 38, 0.85)",
              color: "#ffffff",
              border: "1px solid #ef4444",
              borderRadius: "8px",
              padding: "8px 14px",
              fontWeight: "bold",
              fontSize: "12px",
              cursor: "pointer",
              transition: "background 0.2s, transform 0.1s",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#b91c1c")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(220, 38, 38, 0.85)")}
          >
            <span>🚪</span> Salir al Lobby
          </button>

          <div style={{
            background: timeLeft <= 5 ? "rgba(239, 68, 68, 0.9)" : "rgba(15, 23, 42, 0.85)",
            color: "#fff",
            fontSize: "20px",
            fontWeight: "bold",
            padding: "8px 18px",
            borderRadius: "8px",
            border: "1px solid #334155",
            fontFamily: "monospace",
          }}>
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Bottom Center: Shot Type Selection & Controls Hint */}
      {isMyTurn && (
        <div style={{
          alignSelf: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          marginBottom: "50px",
          pointerEvents: "auto",
        }}>
          <div style={{
            background: "rgba(15, 23, 42, 0.8)",
            padding: "4px 12px",
            borderRadius: "20px",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#94a3b8",
            fontSize: "11px",
            fontWeight: "500",
            letterSpacing: "0.5px",
          }}>
            <span style={{ color: "#38bdf8" }}>◄ ►</span> Moverse &nbsp;|&nbsp; <span style={{ color: "#38bdf8" }}>▲ ▼</span> Ángulo &nbsp;|&nbsp; <span style={{ color: "#fbbf24" }}>Espacio</span> Mantener disparo
          </div>

          <div style={{
            display: "flex",
            gap: "8px",
            background: "rgba(15, 23, 42, 0.9)",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #334155",
          }}>
            <button
              onClick={() => onSelectShotType(0)}
              style={{
                padding: "8px 14px",
                background: selectedShotType === 0 ? "#0284c7" : "#1e293b",
                border: selectedShotType === 0 ? "2px solid #38bdf8" : "1px solid #334155",
                color: "#fff",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              [1] DISPARO 1
            </button>

            <button
              onClick={() => onSelectShotType(1)}
              style={{
                padding: "8px 14px",
                background: selectedShotType === 1 ? "#0284c7" : "#1e293b",
                border: selectedShotType === 1 ? "2px solid #38bdf8" : "1px solid #334155",
                color: "#fff",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              [2] DISPARO 2
            </button>

            <button
              onClick={() => onSelectShotType(2)}
              style={{
                padding: "8px 14px",
                background: selectedShotType === 2 ? "#7c3aed" : "#1e293b",
                border: selectedShotType === 2 ? "2px solid #c084fc" : "1px solid #334155",
                color: "#fff",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              [3] SUPER SHOT (SS)
            </button>
          </div>
        </div>
      )}

      {/* Victory / Defeat Modal */}
      {winnerTeam && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "auto",
          zIndex: 100,
        }}>
          <div style={{
            background: "#1e293b",
            border: "2px solid #38bdf8",
            borderRadius: "12px",
            padding: "36px",
            textAlign: "center",
            width: "360px",
            boxShadow: "0 0 30px rgba(56, 189, 248, 0.3)",
          }}>
            <h1 style={{
              margin: "0 0 12px 0",
              color: winnerTeam === myTeam ? "#22c55e" : "#ef4444",
              fontSize: "32px",
            }}>
              {winnerTeam === "DRAW" ? "¡EMPATE!" : winnerTeam === myTeam ? "¡VICTORIA!" : "DERROTA"}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: "0 0 24px 0" }}>
              Ganador: Equipo {winnerTeam === "A" ? "Azul" : "Rojo"}
            </p>
            <button
              onClick={onReturnToRoom}
              style={{
                padding: "12px 24px",
                background: "#0284c7",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Volver a la Sala
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
