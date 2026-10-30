package lobby

import (
	"time"
)

type ChatMessage struct {
	SenderID   string    `json:"sender_id"`
	SenderNick string    `json:"sender_nick"`
	Text       string    `json:"text"`
	Scope      string    `json:"scope"` // "channel" or "room"
	Timestamp  time.Time `json:"timestamp"`
}

func NewChatMessage(senderID, senderNick, text, scope string) ChatMessage {
	return ChatMessage{
		SenderID:   senderID,
		SenderNick: senderNick,
		Text:       text,
		Scope:      scope,
		Timestamp:  time.Now(),
	}
}
