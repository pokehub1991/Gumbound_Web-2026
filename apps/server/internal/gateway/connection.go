package gateway

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"gumbound-web/server/internal/protocol"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 65536
	sendQueueSize  = 256
)

// Connection represents an authenticated or unauthenticated WebSocket client
type Connection struct {
	ID       string
	UserID   string
	Username string
	Conn     *websocket.Conn
	Gateway  *Gateway
	SendChan chan []byte
	closed   bool
	mu       sync.Mutex
}

// NewConnection creates a connection wrapper
func NewConnection(id string, ws *websocket.Conn, gw *Gateway) *Connection {
	return &Connection{
		ID:       id,
		Conn:     ws,
		Gateway:  gw,
		SendChan: make(chan []byte, sendQueueSize),
	}
}

// Send encodes and queues a message to the client
func (c *Connection) Send(msg protocol.Message) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}

	select {
	case c.SendChan <- msg.Encode():
	default:
		log.Printf("Connection %s send queue full, closing connection\n", c.ID)
		c.closeUnsafe()
	}
}

// Close gracefully closes the connection
func (c *Connection) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.closeUnsafe()
}

func (c *Connection) closeUnsafe() {
	if c.closed {
		return
	}
	c.closed = true
	close(c.SendChan)
	c.Conn.Close()
	c.Gateway.unregisterConn(c)
}

// ReadPump handles incoming WebSocket frames
func (c *Connection) ReadPump() {
	defer c.Close()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		messageType, data, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("read error on connection %s: %v\n", c.ID, err)
			}
			break
		}

		if messageType != websocket.BinaryMessage {
			continue // GunBound protocol only uses binary frames
		}

		msg, err := protocol.DecodeMessage(data)
		if err != nil {
			log.Printf("malformed message from %s: %v\n", c.ID, err)
			continue
		}

		c.Gateway.dispatch(c, msg)
	}
}

// WritePump handles sending frames to the WebSocket
func (c *Connection) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Close()
	}()

	for {
		select {
		case data, ok := <-c.SendChan:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.BinaryMessage)
			if err != nil {
				return
			}
			w.Write(data)
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

