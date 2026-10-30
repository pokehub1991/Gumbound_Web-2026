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

        {/* 30s Countdown Timer */}
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

      {/* Bottom Center: Shot Type Selection */}
      {isMyTurn && (
        <div style={{
          alignSelf: "center",
          display: "flex",
          gap: "8px",
          background: "rgba(15, 23, 42, 0.9)",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #334155",
          pointerEvents: "auto",
          marginBottom: "50px",
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
