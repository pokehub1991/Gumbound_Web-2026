import { Opcode } from "@gumbound/shared";

export interface DecodedMessage {
  opcode: Opcode;
  payload: Uint8Array;
  json<T>(): T;
}

export function encodeMessage(opcode: Opcode, payloadObj?: unknown): Uint8Array {
  let payloadBytes = new Uint8Array(0);
  if (payloadObj !== undefined) {
    if (typeof payloadObj === "string") {
      payloadBytes = new TextEncoder().encode(payloadObj);
    } else {
      payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
    }
  }

  const totalLen = 2 + payloadBytes.length; // 2B opcode + payload
  const buffer = new Uint8Array(2 + totalLen);
  const view = new DataView(buffer.buffer);

  // Big-endian 16-bit length & opcode
  view.setUint16(0, totalLen, false);
  view.setUint16(2, opcode, false);
  buffer.set(payloadBytes, 4);

  return buffer;
}

export function decodeMessage(data: ArrayBuffer): DecodedMessage {
  const view = new DataView(data);
  if (data.byteLength < 4) {
    throw new Error("Message buffer too short for header");
  }

  const length = view.getUint16(0, false);
  const opcode = view.getUint16(2, false) as Opcode;
  const payload = new Uint8Array(data, 4, length - 2);

  return {
    opcode,
    payload,
    json<T>(): T {
      const text = new TextDecoder().decode(payload);
      return JSON.parse(text) as T;
    },
  };
}
