import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { Opcode } from "@gumbound/shared";

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

export const ChatBox: React.FC = () => {
  const { chatMessages, connection } = useStore();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    connection.send(Opcode.CHAT_MESSAGE, { text: text.trim() });
    setText("");
  };

  return (
    <div className="pixel-box" style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderRadius: "6px",
      overflow: "hidden",
      fontFamily: "var(--font-game)",
    }}>
      <div style={{
        padding: "8px 12px",
        background: "var(--bg-panel-slate)",
        fontWeight: 700,
        fontSize: "11px",
        color: "var(--color-primary)",
        borderBottom: "var(--border-subtle)",
        textShadow: "var(--text-shadow-pixel)",
      }}>
        💬 CHATEO GLOBAL
      </div>

      <div className="pixel-scrollbar" style={{
        flex: 1,
        padding: "10px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        fontSize: "12px",
        lineHeight: "1.4",
      }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ wordBreak: "break-word" }}>
            <span style={{ color: "var(--color-primary)", fontWeight: 700, textShadow: "var(--text-shadow-pixel)" }}>[{renderPixelText(msg.sender)}]: </span>
            <span style={{ color: "var(--color-slate-200)", textShadow: "var(--text-shadow-pixel)" }}>{renderPixelText(msg.text)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", padding: "8px", borderTop: "var(--border-subtle)", gap: "8px" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje y presiona Enter..."
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "var(--bg-input-field)",
            border: "var(--border-pixel-thin)",
            borderRadius: "4px",
            color: "var(--color-white)",
            outline: "none",
            fontSize: "10px",
            fontFamily: "var(--font-game)",
          }}
        />
        <button
          type="submit"
          className="pixel-btn pixel-btn-primary"
          style={{
            padding: "6px 14px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "11px",
          }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
};

