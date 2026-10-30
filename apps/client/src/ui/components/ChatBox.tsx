import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { Opcode } from "@gumbound/shared";

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
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "rgba(18, 25, 33, 0.9)",
      borderRadius: "8px",
      border: "1px solid #2a3b4c",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 12px",
        background: "#1e293b",
        fontWeight: "bold",
        fontSize: "12px",
        color: "#94a3b8",
        borderBottom: "1px solid #334155"
      }}>
        CHATEO GLOBAL
      </div>

      <div style={{
        flex: 1,
        padding: "10px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        fontSize: "13px"
      }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ wordBreak: "break-word" }}>
            <span style={{ color: "#60a5fa", fontWeight: "bold" }}>[{msg.sender}]: </span>
            <span style={{ color: "#f8fafc" }}>{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", padding: "8px", borderTop: "1px solid #334155" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje y presiona Enter..."
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "4px",
            color: "#fff",
            outline: "none",
            fontSize: "13px",
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: "8px",
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "13px",
          }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
};
