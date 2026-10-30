package lobby

import (
	"testing"
)

func TestChannelRoomManagement(t *testing.T) {
	ch := NewChannel("ch1", "Beginner Area 1")

	p1 := &Player{ID: "p1", Nickname: "Master"}
	room, err := ch.CreateRoom("Pro Battle", 4, "canyon", p1)
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}

	rooms := ch.ListRooms()
	if len(rooms) != 1 {
		t.Fatalf("expected 1 room, got %d", len(rooms))
	}

	if rooms[0].Name != "Pro Battle" {
		t.Errorf("expected room name 'Pro Battle', got '%s'", rooms[0].Name)
	}

	found, exists := ch.GetRoom(room.ID)
	if !exists || found == nil {
		t.Fatal("expected room to exist in channel")
	}

	ch.RemoveRoom(room.ID)
	if len(ch.ListRooms()) != 0 {
		t.Errorf("expected 0 rooms after removal, got %d", len(ch.ListRooms()))
	}
}
