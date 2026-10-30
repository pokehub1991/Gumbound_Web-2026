package match

import (
	"testing"
)

func TestTurnOrderByDelay(t *testing.T) {
	p1 := &MatchPlayer{ID: "p1", Nickname: "PlayerNak", MobileID: MobileNak, Delay: 0, Alive: true}
	p2 := &MatchPlayer{ID: "p2", Nickname: "PlayerBigFoot", MobileID: MobileBigFoot, Delay: 0, Alive: true}

	tm := NewTurnManager([]*MatchPlayer{p1, p2})

	// First turn goes to p1 (tie breaker is initial order)
	first := tm.NextPlayer()
	if first == nil || first.ID != "p1" {
		t.Fatalf("expected first player to be p1, got %v", first)
	}

	// Nak does Shot 1: low delay (+120)
	tm.AddDelay("p1", 120)
	// BigFoot does Shot 2: high delay (+250)
	tm.AddDelay("p2", 250)

	// Since Nak has delay=120 and BigFoot has delay=250, next turn goes to Nak!
	second := tm.NextPlayer()
	if second == nil || second.ID != "p1" {
		t.Errorf("expected Nak (p1) to get another turn due to lower delay, got %v", second)
	}

	// Nak fires again (+150 delay -> total 270)
	tm.AddDelay("p1", 150)

	// Now BigFoot has 250 < 270, so BigFoot takes the turn!
	third := tm.NextPlayer()
	if third == nil || third.ID != "p2" {
		t.Errorf("expected BigFoot (p2) to take next turn, got %v", third)
	}
}

