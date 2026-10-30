package main

import (
	"fmt"
	"log"
	"net/http"

	"gumbound-web/server/internal/gateway"
	"gumbound-web/server/internal/protocol"
)

func main() {
	gw := gateway.NewGateway()

	// Register sample handshake / ping
	gw.RegisterHandler(protocol.OpcodeAuthRequest, func(c *gateway.Connection, msg protocol.Message) {
		log.Printf("AuthRequest received from %s\n", c.ID)
		c.Send(protocol.Message{
			Opcode:  protocol.OpcodeAuthResponse,
			Payload: []byte(`{"status":"guest_connected"}`),
		})
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","version":"2026.1","active_conns":%d}`, gw.ActiveConnectionCount())
	})

	http.HandleFunc("/ws", gw.HandleWebSocket)

	port := ":8080"
	log.Printf("Gumbound Web 2026 Server running on http://localhost%s (WS: /ws)\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
