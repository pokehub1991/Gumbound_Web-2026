package match

import (
	"sync"
)

type TurnManager struct {
	players []*MatchPlayer
	mu      sync.RWMutex
}

func NewTurnManager(players []*MatchPlayer) *TurnManager {
	return &TurnManager{
		players: players,
	}
}

// NextPlayer finds the alive player with the lowest accumulated delay
func (tm *TurnManager) NextPlayer() *MatchPlayer {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var candidate *MatchPlayer
	for _, p := range tm.players {
		if !p.Alive {
			continue
		}
		if candidate == nil || p.Delay < candidate.Delay {
			candidate = p
		}
	}
	return candidate
}

// AddDelay adds delay penalty to a player
func (tm *TurnManager) AddDelay(playerID string, delay int) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for _, p := range tm.players {
		if p.ID == playerID {
			p.Delay += delay
			break
		}
	}
}

// GetDelayQueue returns alive players sorted by current delay
func (tm *TurnManager) GetDelayQueue() []*MatchPlayer {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	alive := make([]*MatchPlayer, 0, len(tm.players))
	for _, p := range tm.players {
		if p.Alive {
			alive = append(alive, p)
		}
	}

	// Simple bubble/insertion sort for small slice
	for i := 0; i < len(alive); i++ {
		for j := i + 1; j < len(alive); j++ {
			if alive[j].Delay < alive[i].Delay {
				alive[i], alive[j] = alive[j], alive[i]
			}
		}
	}
	return alive
}

