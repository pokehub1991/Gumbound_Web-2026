import { Opcode } from "@gumbound/shared";
import { DecodedMessage } from "./protocol.js";

type Callback = (msg: DecodedMessage) => void;

export class MessageHandler {
  private handlers: Map<Opcode, Set<Callback>> = new Map();

  public on(opcode: Opcode, cb: Callback) {
    if (!this.handlers.has(opcode)) {
      this.handlers.set(opcode, new Set());
    }
    this.handlers.get(opcode)!.add(cb);
  }

  public off(opcode: Opcode, cb: Callback) {
    this.handlers.get(opcode)?.delete(cb);
  }

  public dispatch(msg: DecodedMessage) {
    const cbs = this.handlers.get(msg.opcode);
    if (cbs) {
      cbs.forEach((cb) => {
        try {
          cb(msg);
        } catch (err) {
          console.error(`Error in handler for opcode 0x${msg.opcode.toString(16)}:`, err);
        }
      });
    }
  }
}

