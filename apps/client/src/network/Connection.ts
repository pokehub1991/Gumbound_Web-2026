import { Opcode } from "@gumbound/shared";
import { MessageHandler } from "./MessageHandler.js";
import { decodeMessage, encodeMessage } from "./protocol.js";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export class Connection {
  private ws?: WebSocket;
  private url: string;
  public state: ConnectionState = "disconnected";
  public handler: MessageHandler = new MessageHandler();
  private reconnectTimer?: number;

  constructor(url: string = `ws://${window.location.hostname}:8080/ws`) {
    this.url = url;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.state = "connecting";
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
          this.state = "connected";
          console.log("[WS] Connected to Gumbound Gateway at", this.url);
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          if (event.data instanceof ArrayBuffer) {
            try {
              const msg = decodeMessage(event.data);
              this.handler.dispatch(msg);
            } catch (err) {
              console.error("[WS] Decode error:", err);
            }
          }
        };

        this.ws.onclose = () => {
          this.state = "disconnected";
          console.warn("[WS] Disconnected, scheduling reconnect in 3s...");
          this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
          console.error("[WS] Connection error:", err);
          if (this.state === "connecting") {
            reject(err);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch(() => {});
    }, 3000);
  }

  public send(opcode: Opcode, payload?: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send, socket not open");
      return;
    }
    const buffer = encodeMessage(opcode, payload);
    this.ws.send(buffer);
  }
}

