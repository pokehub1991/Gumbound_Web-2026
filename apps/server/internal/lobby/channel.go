package lobby

import (
	"errors"
	"sync"

	"github.com/google/uuid"
)

var (
	ErrChannelFull = errors.New("channel is full")
)

type Channel struct {
	ID      string           `json:"id"`
	Name    string           `json:"name"`
	Rooms   map[string]*Room `json:"rooms"`
	Players map[string]*Player `json:"players"`
	mu      sync.RWMutex
}

func NewChannel(id, name string) *Channel {
	return &Channel{
		ID:      id,
		Name:    name,
		Rooms:   make(map[string]*Room),
		Players: make(map[string]*Player),
	}
}

func (c *Channel) CreateRoom(name string, maxPlayers int, mapID string, host *Player) (*Room, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	roomID := uuid.New().String()[:8]
	room := NewRoom(roomID, name, maxPlayers, mapID, host)
	c.Rooms[roomID] = room
	return room, nil
}

func (c *Channel) GetRoom(roomID string) (*Room, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	room, exists := c.Rooms[roomID]
	return room, exists
}

func (c *Channel) RemoveRoom(roomID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.Rooms, roomID)
}

func (c *Channel) ListRooms() []*Room {
	c.mu.RLock()
	defer c.mu.RUnlock()

	list := make([]*Room, 0, len(c.Rooms))
	for _, room := range c.Rooms {
		list = append(list, room.Snapshot())
	}
	return list
}

