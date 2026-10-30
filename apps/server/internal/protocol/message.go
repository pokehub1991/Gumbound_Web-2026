package protocol

import (
	"encoding/binary"
	"errors"
	"fmt"
)

var (
	ErrMessageTooShort = errors.New("message payload too short for header")
	ErrLengthMismatch  = errors.New("message length header does not match payload size")
)

// Message is the binary protocol unit: [2B len][2B opcode][payload]
// len represents the total bytes of (2B opcode + payload)
type Message struct {
	Opcode  uint16
	Payload []byte
}

// Encode serializes the Message into wire format: [2B Length (big-endian)][2B Opcode (big-endian)][Payload]
func (m Message) Encode() []byte {
	totalLen := uint16(2 + len(m.Payload))
	buf := make([]byte, 2+totalLen)
	binary.BigEndian.PutUint16(buf[0:2], totalLen)
	binary.BigEndian.PutUint16(buf[2:4], m.Opcode)
	copy(buf[4:], m.Payload)
	return buf
}

// DecodeMessage decodes a single binary message buffer
func DecodeMessage(data []byte) (Message, error) {
	if len(data) < 4 {
		return Message{}, ErrMessageTooShort
	}

	length := binary.BigEndian.Uint16(data[0:2])
	if int(length)+2 > len(data) {
		return Message{}, fmt.Errorf("%w: header says %d bytes, buffer has %d", ErrLengthMismatch, length+2, len(data))
	}

	opcode := binary.BigEndian.Uint16(data[2:4])
	payload := make([]byte, length-2)
	copy(payload, data[4:2+length])

	return Message{
		Opcode:  opcode,
		Payload: payload,
	}, nil
}

