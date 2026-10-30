package lobby

import (
	"errors"
	"fmt"
	"sync"
)

var (
	ErrRoomFull       = errors.New("room is full")
	ErrPlayerNotFound = errors.New("player not in room")
	ErrNotAllReady    = errors.New("not all players are ready")
	ErrNeedMorePlayer = errors.New("need at least 2 players to start")
)

type Team string

const (
	TeamA Team = "A"
	TeamB Team = "B"
)

type Player struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Mobile   int    `json:"mobile"`
	Team     Team   `json:"team"`
	Ready    bool   `json:"ready"`
}

type Room struct {
	ID         string             `json:"id"`
	Name       string             `json:"name"`
	MaxPlayers int                `json:"max_players"`
	MapID      string             `json:"map_id"`
	HostID     string             `json:"host_id"`
	Players    map[string]*Player `json:"players"`
	mu         sync.RWMutex
}

func NewRoom(id, name string, maxPlayers int, mapID string, host *Player) *Room {
	host.Ready = true
	host.Team = TeamA
	players := make(map[string]*Player)
	players[host.ID] = host

	return &Room{
		ID:         id,
		Name:       name,
		MaxPlayers: maxPlayers,
		MapID:      mapID,
		HostID:     host.ID,
		Players:    players,
	}
}

func (r *Room) PlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players)
}

func (r *Room) Join(p *Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.Players) >= r.MaxPlayers {
		return ErrRoomFull
	}

	// Balance team assignment
	teamACount := 0
	teamBCount := 0
	for _, player := range r.Players {
		if player.Team == TeamA {
			teamACount++
		} else {
			teamBCount++
		}
	}

	if teamACount <= teamBCount {
		p.Team = TeamA
	} else {
		p.Team = TeamB
	}
	p.Ready = false

	r.Players[p.ID] = p
	return nil
}

func (r *Room) Leave(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Players, playerID)
	// Migrate host if host leaves
	if r.HostID == playerID && len(r.Players) > 0 {
		for id := range r.Players {
			r.HostID = id
			r.Players[id].Ready = true
			break
		}
	}
}

func (r *Room) SetMobile(playerID string, mobileID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, exists := r.Players[playerID]
	if !exists {
		return ErrPlayerNotFound
	}
	p.Mobile = mobileID
	return nil
}

func (r *Room) ToggleReady(playerID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, exists := r.Players[playerID]
	if !exists {
		return false
	}
	p.Ready = !p.Ready
	return p.Ready
}

func (r *Room) IsPlayerReady(playerID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, exists := r.Players[playerID]
	if !exists {
		return false
	}
	return p.Ready
}

func (r *Room) CanStartMatch() error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.Players) < 1 {
		return ErrNeedMorePlayer
	}

	for _, p := range r.Players {
		if !p.Ready {
			return fmt.Errorf("%w: player %s is not ready", ErrNotAllReady, p.Nickname)
		}
	}

	return nil
}

func (r *Room) Snapshot() *Room {
	r.mu.RLock()
	defer r.mu.RUnlock()

	playersCopy := make(map[string]*Player, len(r.Players))
	for k, v := range r.Players {
		pCopy := *v
		playersCopy[k] = &pCopy
	}

	return &Room{
		ID:         r.ID,
		Name:       r.Name,
		MaxPlayers: r.MaxPlayers,
		MapID:      r.MapID,
		HostID:     r.HostID,
		Players:    playersCopy,
	}
}

