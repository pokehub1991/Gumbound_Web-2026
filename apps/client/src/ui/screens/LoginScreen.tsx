import React, { useState } from "react";
import { useStore } from "../store.js";
import { Opcode } from "@gumbound/shared";

export const LoginScreen: React.FC = () => {
  const { setAuth, setScreen, connection } = useStore();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("player1");
  const [nickname, setNickname] = useState("GumboundPro");
  const [email, setEmail] = useState("player1@gunbound.local");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/register" : "/api/login";
      const body = isRegister
        ? { username, nickname, email, password }
        : { username, password };

      const res = await fetch(`http://${window.location.hostname}:8080${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setAuth(data.token, data.user);

      // Connect WebSocket with token
      await connection.connect();
      connection.send(Opcode.AUTH_REQUEST, { token: data.token });

      // Request initial channel state
      connection.send(Opcode.CHANNEL_JOIN, {});
      setScreen("lobby");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      height: "100%",
      background: "radial-gradient(circle, rgba(17,25,33,0.92) 0%, rgba(5,8,12,0.98) 100%)",
    }}>
      <div style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "32px",
        width: "360px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1 style={{ color: "#38bdf8", margin: 0, fontSize: "24px", letterSpacing: "1px" }}>
            GUMBOUND S2
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: "4px 0 0" }}>
            Edición Web Moderna (2026)
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.2)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "8px 12px",
            borderRadius: "6px",
            marginBottom: "16px",
            fontSize: "12px",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "4px" }}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#fff",
              }}
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "4px" }}>
                  Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    color: "#fff",
                  }}
                />
              </div>
              <div>
                <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "4px" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    color: "#fff",
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "4px" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#fff",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              padding: "10px",
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {loading ? "Conectando..." : isRegister ? "Crear Cuenta" : "Iniciar Sesión"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#38bdf8",
              cursor: "pointer",
              fontSize: "12px",
              textDecoration: "underline",
            }}
          >
            {isRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate aquí"}
          </button>
        </div>
      </div>
    </div>
  );
};

