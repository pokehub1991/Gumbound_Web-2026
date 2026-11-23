package gateway

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gumbound-web/server/internal/protocol"
)

type HandlerFunc func(*Connection, protocol.Message)

// Gateway manages client WebSocket connections and routes messages by opcode
type Gateway struct {
	upgrader websocket.Upgrader
	handlers map[uint16]HandlerFunc
	conns    map[string]*Connection
	mu       sync.RWMutex
	limiter  *limiter
}

// NewGateway creates a new Gateway instance
func NewGateway() *Gateway {
	return &Gateway{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for dev; production must set ALLOWED_ORIGIN
			},
		},
		handlers: make(map[uint16]HandlerFunc),
		conns:    make(map[string]*Connection),
		limiter:  newLimiter(time.Second),
	}
}

// RegisterHandler binds an opcode to a handler function
func (g *Gateway) RegisterHandler(opcode uint16, handler HandlerFunc) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.handlers[opcode] = handler
}

// HandleWebSocket upgrades HTTP requests to WebSocket and registers connection
func (g *Gateway) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	ws, err := g.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket: %v\n", err)
		return
	}

	connID := uuid.New().String()
	conn := NewConnection(connID, ws, g)

	g.mu.Lock()
	g.conns[connID] = conn
	g.mu.Unlock()

	go conn.WritePump()
	go conn.ReadPump()
}

func (g *Gateway) unregisterConn(c *Connection) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.conns, c.ID)
}

// opcodesAllowedUnauthenticated lists opcodes that can be processed before
// a client has sent a valid AUTH frame. Everything else requires c.UserID.
var opcodesAllowedUnauthenticated = map[uint16]bool{
	protocol.OpcodeAuthRequest: true,
}

func (g *Gateway) dispatch(c *Connection, msg protocol.Message) {
	g.mu.RLock()
	handler, exists := g.handlers[msg.Opcode]
	g.mu.RUnlock()

	if !exists {
		log.Printf("Unregistered opcode: 0x%04x from connection %s\n", msg.Opcode, c.ID)
		return
	}

	// Reject unauthenticated traffic on protected opcodes.
	if c.UserID == "" && !opcodesAllowedUnauthenticated[msg.Opcode] {
		log.Printf("unauthenticated opcode 0x%04x rejected for connection %s\n", msg.Opcode, c.ID)
		return
	}

	// Per-opcode rate limit.
	max, ok := opcodeRateLimits[msg.Opcode]
	if !ok {
		max = defaultRateLimit
	}
	if !g.limiter.allow(msg.Opcode, max) {
		log.Printf("rate limit exceeded: opcode 0x%04x from connection %s\n", msg.Opcode, c.ID)
		return
	}

	handler(c, msg)
}

// ActiveConnectionCount returns number of connected clients
func (g *Gateway) ActiveConnectionCount() int {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return len(g.conns)
}

