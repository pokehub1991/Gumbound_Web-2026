package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"gumbound-web/server/internal/protocol"
)

func TestGatewayWebSocketDispatch(t *testing.T) {
	gw := NewGateway()

	var receivedMsg protocol.Message
	var wg sync.WaitGroup
	wg.Add(1)

	testOpcode := uint16(0x1000)
	gw.RegisterHandler(testOpcode, func(c *Connection, msg protocol.Message) {
		receivedMsg = msg
		// Echo back
		c.Send(protocol.Message{
			Opcode:  0x1001,
			Payload: []byte("ACK"),
		})
		wg.Done()
	})

	server := httptest.NewServer(http.HandlerFunc(gw.HandleWebSocket))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to dial test server: %v", err)
	}
	defer clientConn.Close()

	// Send message
	msgToSend := protocol.Message{
		Opcode:  testOpcode,
		Payload: []byte("HELLO_GUMBOUND"),
	}
	err = clientConn.WriteMessage(websocket.BinaryMessage, msgToSend.Encode())
	if err != nil {
		t.Fatalf("Failed to write message: %v", err)
	}

	// Wait for handler to receive
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// success
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for gateway to dispatch message")
	}

	if string(receivedMsg.Payload) != "HELLO_GUMBOUND" {
		t.Errorf("expected payload 'HELLO_GUMBOUND', got '%s'", string(receivedMsg.Payload))
	}

	// Read echo from server
	_, respData, err := clientConn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read response: %v", err)
	}

	respMsg, err := protocol.DecodeMessage(respData)
	if err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if respMsg.Opcode != 0x1001 {
		t.Errorf("expected opcode 0x1001, got 0x%04x", respMsg.Opcode)
	}

	if string(respMsg.Payload) != "ACK" {
		t.Errorf("expected response payload 'ACK', got '%s'", string(respMsg.Payload))
	}
}

