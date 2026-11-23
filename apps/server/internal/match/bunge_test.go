package match

import (
	"testing"

	"gumbound-web/server/internal/physics"
)

func physicsV(x, y float64) physics.Vec2 { return physics.Vec2{X: x, Y: y} }

// TestPerShotBungeRadii locks the canonical GunBound palaBunge table (§bunge).
// shot2 radii differ from shot1/ss for most mobiles — a single-value BlastRadius
// cannot reproduce per-shot crater depth. All 22 mobiles × 3 shots are locked to
// match the client parity tables in apps/client/tests/bungeTerrain.test.mts.
func TestPerShotBungeRadii(t *testing.T) {
	cases := []struct {
		id          int
		shot1, shot2, ss float64
	}{
		{MobileArmor, 43, 45, 50},
		{MobileIce, 45, 42, 53},
		{MobileAduka, 36, 27, 40},
		{MobileLightning, 35, 38, 45},
		{MobileBigFoot, 30, 29, 28},
		{MobileJD, 39, 33, 38},
		{MobileASate, 40, 45, 50},
		{MobileRandom, 38, 38, 45},
		{MobileKnight, 42, 44, 48},
		{MobileFox, 38, 40, 45},
		{MobileDragon, 45, 50, 60},
		{MobileNak, 38, 40, 48},
		{MobileTrico, 30, 25, 45},
		{MobileMage, 39, 36, 48},
		{MobileTurtle, 64, 45, 65},
		{MobileBoomer, 30, 25, 42},
		{MobileGrub, 36, 32, 45},
		{MobileRaon, 25, 10, 45},
		{MobileFrog, 35, 38, 55},
		{MobileKalsiddon, 32, 30, 45},
		{MobileMaya, 45, 45, 60},
		{MobilePhoenix, 40, 42, 52},
	}
	for _, c := range cases {
		s := GetMobileStats(c.id)
		if got := s.BlastRadiusForShot(0); got != c.shot1 {
			t.Errorf("id %d shot1 bunge = %v, want %v", c.id, got, c.shot1)
		}
		if got := s.BlastRadiusForShot(1); got != c.shot2 {
			t.Errorf("id %d shot2 bunge = %v, want %v", c.id, got, c.shot2)
		}
		if got := s.BlastRadiusForShot(2); got != c.ss {
			t.Errorf("id %d ss bunge = %v, want %v", c.id, got, c.ss)
		}
	}
}

// TestArmorS2DoubleBlast locks the Armor S2 double detonation
// (DetonateShot2_Bullet2 in the reference decomp).
func TestArmorS2DoubleBlast(t *testing.T) {
	m := newTwoPlayerMatch(t)
	stats := GetMobileStats(MobileArmor)
	if !stats.DoubleBlast {
		t.Fatal("Armor must be flagged DoubleBlast")
	}
	shooter := m.Players["p1"]
	shooter.MobileID = MobileArmor
	enemy := m.Players["p2"]
	enemy.HP = enemy.MaxHP

	// Place enemy within blast radius of a low-power shot.
	shooter.Pos = physicsV(200, 500)
	enemy.Pos = physicsV(240, 500)

	res, err := m.HandleFireShot("p1", 20, 40, 1, 1)
	if err != nil {
		t.Fatalf("HandleFireShot = %v", err)
	}
	if res == nil {
		t.Fatal("expected result")
	}
	// Second blast in SubShots deals half per-hit damage.
	if len(res.SubShots) != 1 {
		t.Fatalf("expected 1 sub-shot (second blast), got %d", len(res.SubShots))
	}
	if res.SubShots[0].TerrainDelta == nil {
		t.Fatal("second blast must carve terrain")
	}
	if res.SubShots[0].TerrainDelta.RadiusY == 0 {
		t.Fatal("second blast must be elliptical (radius_y > 0)")
	}
}
