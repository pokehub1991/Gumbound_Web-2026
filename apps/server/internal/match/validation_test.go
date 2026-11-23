package match

import (
	"testing"
)

func TestHandleFireShotValidation(t *testing.T) {
	players := []*MatchPlayer{
		{ID: "p1", Nickname: "P1", MobileID: MobileArmor, Team: "A"},
		{ID: "p2", Nickname: "P2", MobileID: MobileIce, Team: "B"},
	}
	m := NewMatch("m1", players, "plains")

	// Out-of-range angle must be rejected.
	if _, err := m.HandleFireShot("p1", 200, 50, 0, 1); err == nil {
		t.Fatal("expected angle above MaxAngle to be rejected")
	}
	// Invalid shot type must be rejected.
	if _, err := m.HandleFireShot("p1", 30, 50, 5, 1); err == nil {
		t.Fatal("expected shot_type outside 0..2 to be rejected")
	}
	// Power out of range must be rejected.
	if _, err := m.HandleFireShot("p1", 30, 150, 0, 1); err == nil {
		t.Fatal("expected power > 100 to be rejected")
	}
	initialActive := m.ActiveID
	otherID := "p2"
	if initialActive == "p2" {
		otherID = "p1"
	}

	// Out-of-turn is rejected (using a non-active player before any state change).
	if _, err := m.HandleFireShot(otherID, 30, 50, 0, 1); err == nil {
		t.Fatal("expected out-of-turn shot to be rejected")
	}

	// A valid shot by the active player still works.
	if _, err := m.HandleFireShot(initialActive, 30, 50, 0, 1); err != nil {
		t.Fatalf("valid shot rejected: %v", err)
	}
}

func TestHandleMoveValidation(t *testing.T) {
	players := []*MatchPlayer{
		{ID: "p1", Nickname: "P1", MobileID: MobileArmor, Team: "A"},
		{ID: "p2", Nickname: "P2", MobileID: MobileIce, Team: "B"},
	}
	m := NewMatch("m2", players, "plains")
	current := m.ActiveID

	if err := m.HandleMove(current, 600, 100000); err == nil {
		t.Fatal("expected arbitrary Y to be rejected")
	}
	if err := m.HandleMove(current, m.Players[current].Pos.X+5000, m.Players[current].Pos.Y); err == nil {
		t.Fatal("expected huge move delta to be rejected")
	}
}
