package lobby

import (
	"testing"
)

func TestRoomLifecycle(t *testing.T) {
	host := &Player{ID: "p1", Nickname: "HostPlayer"}
	p2 := &Player{ID: "p2", Nickname: "PlayerTwo"}

	room := NewRoom("r1", "Test Room", 8, "plains", host)
	if room.PlayerCount() != 1 {
		t.Fatalf("expected 1 player (host), got %d", room.PlayerCount())
	}

	err := room.Join(p2)
	if err != nil {
		t.Fatalf("unexpected error joining room: %v", err)
	}

	if room.PlayerCount() != 2 {
		t.Fatalf("expected 2 players, got %d", room.PlayerCount())
	}

	// Host selects mobile
	room.SetMobile("p1", 0) // Armor

	// P2 selects mobile and readies
	room.SetMobile("p2", 1) // Mage
	room.ToggleReady("p2")

	if !room.IsPlayerReady("p1") || !room.IsPlayerReady("p2") {
		t.Error("expected both players to be ready")
	}

	// Can start match
	if err := room.CanStartMatch(); err != nil {
		t.Errorf("expected room to be startable, got error: %v", err)
	}

	// Player 2 leaves
	room.Leave("p2")
	if room.PlayerCount() != 1 {
		t.Errorf("expected 1 player after leave, got %d", room.PlayerCount())
	}
}

func TestRoomFull(t *testing.T) {
	host := &Player{ID: "p1", Nickname: "Host"}
	room := NewRoom("r1", "Small Room", 1, "plains", host)

	p2 := &Player{ID: "p2", Nickname: "PlayerTwo"}
	err := room.Join(p2)
	if err != ErrRoomFull {
		t.Errorf("expected ErrRoomFull, got %v", err)
	}
}
