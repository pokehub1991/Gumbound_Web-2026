package physics

import (
	"testing"
)

func TestTerrainClearCircle(t *testing.T) {
	terrain := NewFlatTerrain(200, 200, 100)

	// Before destruction, ground is present at (100, 110)
	if !terrain.IsGround(100, 110) {
		t.Fatal("expected ground at (100, 110)")
	}

	// Blast circle at (100, 100) with radius 25
	terrain.ClearCircle(100, 100, 25)

	// Now inside hole, no ground
	if terrain.IsGround(100, 110) {
		t.Errorf("expected no ground at (100, 110) after crater creation")
	}

	// Outside crater, ground still intact
	if !terrain.IsGround(100, 140) {
		t.Errorf("expected ground at (100, 140) outside crater")
	}
}
