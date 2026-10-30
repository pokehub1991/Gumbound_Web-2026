package protocol

import (
	"bytes"
	"testing"
)

func TestMessageRoundTrip(t *testing.T) {
	msg := Message{
		Opcode:  0x3000,
		Payload: []byte{0x01, 0x02, 0x03, 0x04},
	}

	encoded := msg.Encode()
	if len(encoded) != 8 { // 2 bytes len + 2 bytes opcode + 4 bytes payload
		t.Fatalf("expected encoded length 8, got %d", len(encoded))
	}

	decoded, err := DecodeMessage(encoded)
	if err != nil {
		t.Fatalf("unexpected error decoding message: %v", err)
	}

	if decoded.Opcode != msg.Opcode {
		t.Errorf("expected opcode 0x%04x, got 0x%04x", msg.Opcode, decoded.Opcode)
	}

	if !bytes.Equal(decoded.Payload, msg.Payload) {
		t.Errorf("payload mismatch: expected %v, got %v", msg.Payload, decoded.Payload)
	}
}

func TestDecodeShortMessage(t *testing.T) {
	_, err := DecodeMessage([]byte{0x00, 0x02})
	if err == nil {
		t.Error("expected error for truncated message header, got nil")
	}
}
