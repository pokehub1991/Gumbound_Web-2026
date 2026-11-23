package physics

import "testing"

func TestClearEllipseWiderThanTall(t *testing.T) {
	// 100x100 mask, crater at center with rx=30, ry=25.
	tm := NewTerrainMask(100, 100)
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			tm.SetGround(x, y, true)
		}
	}
	tm.ClearEllipse(50, 50, 30, 25)

	// Horizontal extent at crater center row: near ±30.
	if !tm.IsGround(50-31, 50) || !tm.IsGround(50+31, 50) {
		t.Fatal("outside ±30 horizontally should still be solid")
	}
	if tm.IsGround(50+25, 50) {
		t.Fatal("x=+25 at y=50 should be carved (inside ellipse)")
	}

	// Vertical extent at crater center column: ±25 — SHORTER than ±30.
	if tm.IsGround(50, 50+24) {
		t.Fatal("y=+24 at x=50 should be carved (inside ry=25)")
	}
	if !tm.IsGround(50, 50+26) {
		t.Fatal("y=+26 at x=50 should still be solid (outside ry=25)")
	}
}

func TestClearCircleEquivalent(t *testing.T) {
	// ClearCircle delegates to ClearEllipse with rx=ry.
	tmA := NewTerrainMask(100, 100)
	tmB := NewTerrainMask(100, 100)
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			tmA.SetGround(x, y, true)
			tmB.SetGround(x, y, true)
		}
	}
	tmA.ClearCircle(50, 50, 20)
	tmB.ClearEllipse(50, 50, 20, 20)

	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			if tmA.IsGround(x, y) != tmB.IsGround(x, y) {
				t.Fatalf("ClearCircle and ClearEllipse(1:1) diverge at (%d,%d)", x, y)
			}
		}
	}
}

func TestClearEllipseBounds(t *testing.T) {
	tm := NewTerrainMask(50, 50)
	for y := 0; y < 50; y++ {
		for x := 0; x < 50; x++ {
			tm.SetGround(x, y, true)
		}
	}
	// Far-corner off-screen impact: crater at (500,500) radius 30 — nothing carved.
	tm.ClearEllipse(500, 500, 30, 25)
	if !tm.IsGround(49, 49) {
		t.Fatal("far corner must still be solid after off-screen impact")
	}
	// Fully off-screen negative: nothing carved.
	tm.ClearEllipse(-100, -100, 30, 25)
	if !tm.IsGround(49, 49) {
		t.Fatal("far corner must still be solid after negative off-screen impact")
	}
	// Partially off-screen impact at origin carves only in-bounds pixels.
	tm.ClearEllipse(0, 0, 10, 10)
	if tm.IsGround(0, 0) || tm.IsGround(5, 5) {
		t.Fatal("pixels inside partial crater at origin should be carved")
	}
	if !tm.IsGround(49, 49) {
		t.Fatal("far corner must remain solid after partial carve at origin")
	}
}
