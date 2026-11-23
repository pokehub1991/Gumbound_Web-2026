package match

import (
	"testing"

	"gumbound-web/server/internal/physics"
)

// TestMobileBehaviorCounts locks the §4.9 canonical projectile counts.
// Any drift from DragonBound values must be an intentional change to this test.
func TestMobileBehaviorCounts(t *testing.T) {
	cases := []struct {
		mobile   int
		shot     int
		wantProj int
	}{
		{MobileBigFoot, 0, 4},
		{MobileBigFoot, 1, 3},
		{MobileBigFoot, 2, 8}, // was 20, DragonBound uses 8
		{MobileBoomer, 1, 4},  // was 10, DragonBound uses 4
		{MobileKalsiddon, 0, 2},
		{MobileKalsiddon, 1, 4},
		{MobileKalsiddon, 2, 6},
		{MobileGrub, 1, 2},
		{MobileAduka, 1, 3},
		{MobileTrico, 1, 3},
		{MobileRaon, 1, 2},
	}
	for _, c := range cases {
		if got := projectileCountFor(c.mobile, c.shot); got != c.wantProj {
			t.Errorf("mobile %d shot %d = %d projectiles, want %d",
				c.mobile, c.shot, got, c.wantProj)
		}
	}
}

func TestNakBurrowAdvancesPosition(t *testing.T) {
	m := newTwoPlayerMatch(t)
	shooter := m.Players["p1"]
	shooter.MobileID = MobileNak
	targets := []physics.MobileTarget{
		{ID: "p1", Pos: shooter.Pos, Radius: 20},
		{ID: "p2", Pos: m.Players["p2"].Pos, Radius: 20},
	}
	cfg := physics.ProjectileConfig{
		Origin:      shooter.Pos,
		AngleDeg:    30,
		Power:       60,
		Wind:        physics.Vec2{},
		WindPower:   0,
		WindAngleDeg: 0,
		By:          398,
		Bx:          0,
		Ax:          0,
		Ay:          398,
		BaseDamage:  100,
		BlastRadius: 30,
		Facing:      1,
	}
	res := physics.SimulateProjectileAdv(cfg, m.Terrain, targets)
	before := res.ImpactPos
	m.applyNakBurrow(cfg, &res, targets, 1)
	// Burrow pushes the impact 120px in facing direction.
	if res.ImpactPos.X <= before.X+100 {
		t.Fatalf("Nak burrow should push impact forward, got %v -> %v", before, res.ImpactPos)
	}
}

func TestJDMovexDashesTowardsImpact(t *testing.T) {
	m := newTwoPlayerMatch(t)
	shooter := m.Players["p1"]
	shooter.MobileID = MobileJD
	x0 := shooter.Pos.X

	result := &physics.ProjectileResult{
		HitType:   physics.HitTerrain,
		ImpactPos: physics.Vec2{X: x0 + 400, Y: shooter.Pos.Y},
	}
	m.applyJDMovex(shooter, result)
	if shooter.Pos.X <= x0 {
		t.Fatalf("JD should dash toward impact, x %v -> %v", x0, shooter.Pos.X)
	}
}

func TestGrubBounceExtendsTrajectory(t *testing.T) {
	m := newTwoPlayerMatch(t)
	shooter := m.Players["p1"]
	targets := []physics.MobileTarget{
		{ID: "p1", Pos: shooter.Pos, Radius: 20},
		{ID: "p2", Pos: m.Players["p2"].Pos, Radius: 20},
	}
	cfg := physics.ProjectileConfig{
		Origin:      shooter.Pos,
		AngleDeg:    15,
		Power:       50,
		Wind:        physics.Vec2{},
		WindPower:   0,
		WindAngleDeg: 0,
		By:          380,
		Bx:          0,
		Ax:          0,
		Ay:          380,
		BaseDamage:  100,
		BlastRadius: 28,
		Facing:      1,
	}
	res := physics.SimulateProjectileAdv(cfg, m.Terrain, targets)
	before := len(res.Trajectory)
	m.applyGrubBounce(cfg, &res, targets)
	// Bounce extends the trajectory (or replaces impact with further point).
	if len(res.Trajectory) < before {
		t.Fatalf("bounce should not shrink trajectory")
	}
}
