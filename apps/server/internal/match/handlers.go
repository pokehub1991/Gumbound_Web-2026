package match

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"gumbound-web/server/internal/gateway"
	"gumbound-web/server/internal/lobby"
	"gumbound-web/server/internal/protocol"
)

type MatchManager struct {
	lobbyManager *lobby.LobbyManager
	matches      map[string]*Match        // roomID -> Match
	connMatches  map[string]*Match        // connID -> Match
	roomConns    map[string][]*gateway.Connection // roomID -> conns
	conns        map[string]*gateway.Connection
	mu           sync.RWMutex
}

func NewMatchManager(lm *lobby.LobbyManager) *MatchManager {
	return &MatchManager{
		lobbyManager: lm,
		matches:      make(map[string]*Match),
		connMatches:  make(map[string]*Match),
		roomConns:    make(map[string][]*gateway.Connection),
		conns:        make(map[string]*gateway.Connection),
	}
}

func (mm *MatchManager) RegisterHandlers(gw *gateway.Gateway) {
	// Register connection tracking
	gw.RegisterHandler(protocol.OpcodeMatchStart, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			RoomID string `json:"room_id"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		mm.mu.Lock()
		mm.conns[c.ID] = c
		mm.mu.Unlock()

		// Get room from lobby
		room, exists := mm.lobbyManager.GetRoom(req.RoomID)
		if !exists {
			log.Printf("Cannot start match: room %s not found\n", req.RoomID)
			return
		}

		// Convert lobby players to match players
		matchPlayers := make([]*MatchPlayer, 0, len(room.Players))
		for _, lp := range room.Players {
			matchPlayers = append(matchPlayers, &MatchPlayer{
				ID:       lp.ID,
				Nickname: lp.Nickname,
				MobileID: lp.Mobile,
				Team:     string(lp.Team),
				Alive:    true,
			})
		}

		// Create match
		m := NewMatch(room.ID, matchPlayers, room.MapID)
		mm.mu.Lock()
		mm.matches[room.ID] = m
		mm.connMatches[c.ID] = m
		mm.mu.Unlock()

		// Broadcast MatchStart
		playerList := make([]*MatchPlayer, 0, len(m.Players))
		for _, p := range m.Players {
			playerList = append(playerList, p)
		}

		startData, _ := json.Marshal(map[string]interface{}{
			"match_id":  m.ID,
			"map_id":    m.MapID,
			"players":   playerList,
			"wind":      m.Wind,
			"active_id": m.ActiveID,
		})

		startMsg := protocol.Message{
			Opcode:  protocol.OpcodeMatchStart,
			Payload: startData,
		}

		// Broadcast to all room players
		mm.broadcastToMatch(m, startMsg)

		// Broadcast first turn
		mm.broadcastTurnStart(m)
	})

	// Handle FireShot
	gw.RegisterHandler(protocol.OpcodeFireShot, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			Angle    float64 `json:"angle"`
			Power    float64 `json:"power"`
			ShotType int     `json:"shot_type"`
			Facing   int     `json:"facing"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		mm.mu.RLock()
		m := mm.connMatches[c.ID]
		mm.mu.RUnlock()

		if m == nil {
			log.Printf("No active match for connection %s\n", c.ID)
			return
		}

		f := req.Facing
		if f == 0 {
			f = 1
		}
		result, err := m.HandleFireShot(c.UserID, req.Angle, req.Power, req.ShotType, f)
		if err != nil {
			log.Printf("FireShot rejected: %v\n", err)
			return
		}

		// Broadcast ProjectileResult
		resultData, _ := json.Marshal(result)
		mm.broadcastToMatch(m, protocol.Message{
			Opcode:  protocol.OpcodeProjectileResult,
			Payload: resultData,
		})

		// Check if match ended or next turn
		if m.State == StateFinished {
			endData, _ := json.Marshal(map[string]interface{}{
				"winner_team": m.WinnerTeam,
			})
			mm.broadcastToMatch(m, protocol.Message{
				Opcode:  protocol.OpcodeMatchEnd,
				Payload: endData,
			})
		} else {
			// Delay before announcing next turn to allow projectile flight, ground walking, and explosion animation
			turnDelay := 2600 * time.Millisecond
			if len(result.Trajectory) > 50 {
				turnDelay = time.Duration(len(result.Trajectory)*28+900) * time.Millisecond
			}
			if len(result.SubShots) > 1 {
				stagger := 60
				if len(result.SubShots) > 5 {
					stagger = 35
				}
				turnDelay += time.Duration(len(result.SubShots)*stagger) * time.Millisecond
			}
			time.AfterFunc(turnDelay, func() {
				mm.broadcastTurnStart(m)
			})
		}
	})

	// In-match mobile quick hot-swap handler
	gw.RegisterHandler(protocol.OpcodeSelectMobile, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			MobileID int `json:"mobile_id"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		mm.mu.RLock()
		m := mm.connMatches[c.ID]
		mm.mu.RUnlock()

		if m != nil {
			m.mu.Lock()
			if p, ok := m.Players[c.UserID]; ok {
				p.MobileID = req.MobileID
				log.Printf("[Match] Player %s (%s) hot-swapped to mobile %d\n", c.UserID, p.Nickname, req.MobileID)
			}
			m.mu.Unlock()
		}
	})

	// Handle PlayerMove
	gw.RegisterHandler(protocol.OpcodePlayerMove, func(c *gateway.Connection, msg protocol.Message) {
		var req struct {
			X      float64 `json:"x"`
			Y      float64 `json:"y"`
			Facing int     `json:"facing"`
		}
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		mm.mu.RLock()
		m := mm.connMatches[c.ID]
		mm.mu.RUnlock()

		if m == nil {
			return
		}

		if err := m.HandleMove(c.UserID, req.X, req.Y); err != nil {
			return
		}

		// Broadcast movement to all match players
		payload, _ := json.Marshal(map[string]interface{}{
			"player_id": c.UserID,
			"x":         req.X,
			"y":         req.Y,
			"facing":    req.Facing,
		})

		mm.broadcastToMatch(m, protocol.Message{
			Opcode:  protocol.OpcodePlayerMove,
			Payload: payload,
		})
	})
}

func (mm *MatchManager) broadcastTurnStart(m *Match) {
	turnData, _ := json.Marshal(map[string]interface{}{
		"active_id":   m.ActiveID,
		"turn_number": m.TurnNumber,
		"wind":        m.Wind,
		"delay_queue": m.TurnMgr.GetDelayQueue(),
	})

	mm.broadcastToMatch(m, protocol.Message{
		Opcode:  protocol.OpcodeTurnStart,
		Payload: turnData,
	})
}

func (mm *MatchManager) broadcastToMatch(m *Match, msg protocol.Message) {
	mm.mu.RLock()
	defer mm.mu.RUnlock()

	// Broadcast to all matching connections
	for _, conn := range mm.conns {
		if _, exists := m.Players[conn.UserID]; exists {
			conn.Send(msg)
		}
	}
}
