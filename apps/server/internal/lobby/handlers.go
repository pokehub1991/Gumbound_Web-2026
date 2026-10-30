package lobby

import (
	"encoding/json"
	"log"
	"sync"

	"gumbound-web/server/internal/gateway"
	"gumbound-web/server/internal/protocol"
)

type LobbyManager struct {
	defaultChannel *Channel
	connRooms      map[string]*Room // connID -> room
	conns          map[string]*gateway.Connection
	mu             sync.RWMutex
}

func NewLobbyManager() *LobbyManager {
	return &LobbyManager{
		defaultChannel: NewChannel("ch1", "Principal 1 (All Welcome)"),
		connRooms:      make(map[string]*Room),
		conns:          make(map[string]*gateway.Connection),
	}
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

	// Chat Message
	gw.RegisterHandler(protocol.OpcodeChatMessage, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil || req.Text == "" {
			return
		}

		m.mu.RLock()
		room := m.connRooms[c.ID]
		m.mu.RUnlock()

		scope := "channel"
		if room != nil {
			scope = "room"
		}

		chatMsg := NewChatMessage(c.UserID, c.Username, req.Text, scope)
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
