package lobby

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"gumbound-web/server/internal/anticheat"
	"gumbound-web/server/internal/gateway"
	"gumbound-web/server/internal/protocol"
)

type LobbyManager struct {
	defaultChannel *Channel
	connRooms      map[string]*Room // connID -> room
	conns          map[string]*gateway.Connection
	anticheat      *anticheat.Detector
	// mutedUntil maps account ID to the instant until which chat is silenced.
	// Only reachable through the mute opcode; no automatic unbans.
	mutedUntil map[string]time.Time
	mu         sync.RWMutex
}

func NewLobbyManager() *LobbyManager {
	return &LobbyManager{
		defaultChannel: NewChannel("ch1", "Principal 1 (All Welcome)"),
		connRooms:      make(map[string]*Room),
		conns:          make(map[string]*gateway.Connection),
		anticheat:      anticheat.New(anticheat.Config{}),
		mutedUntil:     make(map[string]time.Time),
	}
}

func (m *LobbyManager) GetRoom(roomID string) (*Room, bool) {
	return m.defaultChannel.GetRoom(roomID)
}

func (m *LobbyManager) RegisterHandlers(gw *gateway.Gateway) {
	// Channel State / List Rooms
	gw.RegisterHandler(protocol.OpcodeChannelJoin, func(c *gateway.Connection, msg protocol.Message) {
		m.mu.Lock()
		m.conns[c.ID] = c
		m.mu.Unlock()

		rooms := m.defaultChannel.ListRooms()
		payload, _ := json.Marshal(map[string]interface{}{
			"channel_id":   m.defaultChannel.ID,
			"channel_name": m.defaultChannel.Name,
			"rooms":        rooms,
		})

		c.Send(protocol.Message{
			Opcode:  protocol.OpcodeChannelState,
			Payload: payload,
		})
	})

	// Room Create
	gw.RegisterHandler(protocol.OpcodeRoomCreate, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			Name       string `json:"name"`
			MaxPlayers int    `json:"max_players"`
			MapID      string `json:"map_id"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		if req.Name == "" {
			req.Name = "Sala de " + c.Username
		}
		if req.MaxPlayers <= 0 || req.MaxPlayers > 8 {
			req.MaxPlayers = 8
		}
		if req.MapID == "" {
			req.MapID = "plains"
		}

		host := &Player{
			ID:       c.UserID,
			Nickname: c.Username,
		}

		room, err := m.defaultChannel.CreateRoom(req.Name, req.MaxPlayers, req.MapID, host)
		if err != nil {
			return
		}

		m.mu.Lock()
		m.connRooms[c.ID] = room
		m.mu.Unlock()

		roomSnapshot := room.Snapshot()
		respData, _ := json.Marshal(roomSnapshot)
		c.Send(protocol.Message{
			Opcode:  protocol.OpcodeRoomState,
			Payload: respData,
		})

		m.broadcastChannelRooms()
	})

	// Room Join
	gw.RegisterHandler(protocol.OpcodeRoomJoin, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			RoomID string `json:"room_id"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		room, exists := m.defaultChannel.GetRoom(req.RoomID)
		if !exists {
			return
		}

		player := &Player{
			ID:       c.UserID,
			Nickname: c.Username,
		}

		if err := room.Join(player); err != nil {
			log.Printf("failed to join room %s: %v\n", req.RoomID, err)
			return
		}

		m.mu.Lock()
		m.connRooms[c.ID] = room
		m.mu.Unlock()

		m.broadcastRoomState(room)
		m.broadcastChannelRooms()
	})

	// Room Leave
	gw.RegisterHandler(protocol.OpcodeRoomLeave, func(c *gateway.Connection, msg protocol.Message) {
		m.mu.RLock()
		room := m.connRooms[c.ID]
		m.mu.RUnlock()
		if room == nil {
			return
		}
		room.Leave(c.UserID)
		m.mu.Lock()
		delete(m.connRooms, c.ID)
		m.mu.Unlock()
		m.broadcastRoomState(room)
		m.broadcastChannelRooms()
	})

	// Select Mobile
	gw.RegisterHandler(protocol.OpcodeSelectMobile, func(c *gateway.Connection, msg protocol.Message) {
		m.mu.RLock()
		room := m.connRooms[c.ID]
		m.mu.RUnlock()
		if room == nil {
			return
		}

		var req struct {
			MobileID int `json:"mobile_id"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		room.SetMobile(c.UserID, req.MobileID)
		m.broadcastRoomState(room)
	})

	// Toggle Ready
	gw.RegisterHandler(protocol.OpcodeToggleReady, func(c *gateway.Connection, msg protocol.Message) {
		m.mu.RLock()
		room := m.connRooms[c.ID]
		m.mu.RUnlock()
		if room == nil {
			return
		}

		room.ToggleReady(c.UserID)
		m.broadcastRoomState(room)
	})

	// Chat Message — server-side cap (200 chars) and server-side mute.
	gw.RegisterHandler(protocol.OpcodeChatMessage, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil || req.Text == "" {
			return
		}

		m.mu.RLock()
		muted := m.mutedUntil[c.UserID]
		m.mu.RUnlock()
		if time.Now().Before(muted) {
			log.Printf("[chat] %s is muted, dropped message\n", c.UserID)
			return
		}

		clean, v := m.anticheat.InspectChat(c.UserID, req.Text, time.Now())
		if v.Reject {
			log.Printf("[anticheat] chat %s for %s: %s\n",
				v.Violation.Kind, c.UserID, v.Violation.Detail)
			return
		}

		m.mu.RLock()
		room := m.connRooms[c.ID]
		m.mu.RUnlock()

		scope := "channel"
		if room != nil {
			scope = "room"
		}

		chatMsg := NewChatMessage(c.UserID, c.Username, clean, scope)
		payload, _ := json.Marshal(chatMsg)
		broadcastPacket := protocol.Message{
			Opcode:  protocol.OpcodeChatBroadcast,
			Payload: payload,
		}

		m.mu.RLock()
		defer m.mu.RUnlock()

		if room != nil {
			for connID, r := range m.connRooms {
				if r.ID == room.ID {
					if conn, ok := m.conns[connID]; ok {
						conn.Send(broadcastPacket)
					}
				}
			}
		} else {
			for _, conn := range m.conns {
				conn.Send(broadcastPacket)
			}
		}
	})

	// AdminChatMute — server-side silence window. Only callers authenticated as
	// "admin" (or a GM nickname) are honored; everything else is logged and dropped.
	gw.RegisterHandler(protocol.OpcodeAdminChatMute, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			Target  string `json:"target"`
			Seconds int    `json:"seconds"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil || req.Target == "" {
			return
		}
		if !isGameMaster(c.Username) {
			log.Printf("[chat] mute request denied for %q (%s)\n", c.Username, c.UserID)
			return
		}
		if req.Seconds <= 0 || req.Seconds > 86400 {
			return
		}

		m.mu.Lock()
		m.mutedUntil[req.Target] = time.Now().Add(time.Duration(req.Seconds) * time.Second)
		m.mu.Unlock()
		log.Printf("[chat] muted %s for %ds by %s\n", req.Target, req.Seconds, c.UserID)
	})
}

func isGameMaster(username string) bool {
	return username == "admin" || username == "GameMaster"
}

func (m *LobbyManager) broadcastChannelRooms() {
	rooms := m.defaultChannel.ListRooms()
	payload, _ := json.Marshal(map[string]interface{}{
		"channel_id":   m.defaultChannel.ID,
		"channel_name": m.defaultChannel.Name,
		"rooms":        rooms,
	})
	packet := protocol.Message{
		Opcode:  protocol.OpcodeChannelState,
		Payload: payload,
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, conn := range m.conns {
		conn.Send(packet)
	}
}

func (m *LobbyManager) broadcastRoomState(room *Room) {
	snapshot := room.Snapshot()
	payload, _ := json.Marshal(snapshot)
	packet := protocol.Message{
		Opcode:  protocol.OpcodeRoomState,
		Payload: payload,
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	for connID, r := range m.connRooms {
		if r.ID == room.ID {
			if conn, ok := m.conns[connID]; ok {
				conn.Send(packet)
			}
		}
	}
}
