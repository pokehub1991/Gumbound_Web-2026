package match

import (
	"testing"
)

func TestMatchLifecycle(t *testing.T) {
	p1 := &MatchPlayer{ID: "p1", Nickname: "Alpha", MobileID: MobileArmor, Team: "A", HP: 1000, MaxHP: 1000, Alive: true}
	p2 := &MatchPlayer{ID: "p2", Nickname: "Beta", MobileID: MobileMage, Team: "B", HP: 950, MaxHP: 950, Alive: true}

	m := NewMatch("m1", []*MatchPlayer{p1, p2}, "plains")
	if m.State != StateInProgress {
		t.Fatalf("expected state InProgress, got %v", m.State)
	}

	active := m.ActivePlayer()
	if active == nil {
		t.Fatal("expected active player to be non-nil")
	}

	// Active player fires shot
	res, err := m.HandleFireShot(active.ID, 45.0, 50.0, 0)
	if err != nil {
		t.Fatalf("unexpected error firing shot: %v", err)
	}

	if len(res.Trajectory) == 0 {
		t.Error("expected non-empty trajectory")
	}

	// Turn has advanced
	nextActive := m.ActivePlayer()
	if nextActive == nil {
		t.Fatal("expected next active player to be non-nil")
	}
}

