package match

import (
	"math"

	"gumbound-web/server/internal/physics"
)

// §4.9 Mobile behavior helpers. These are server-authoritative counterparts
// to the client's visual implementations. They modify trajectory/collision
// inputs before damage is applied so online play cannot diverge from offline.

// JD movex: JD's dash after landing grants a short horizontal reposition.
// Applied as a post-impact move when the mobile is JD and the shot lands on terrain.
func (m *Match) applyJDMovex(shooter *MatchPlayer, result *physics.ProjectileResult) {
	if shooter.MobileID != MobileJD || result.HitType != physics.HitTerrain {
		return
	}
	// Dash 80px toward the impact point, clamped to terrain.
	const dash = 80.0
	dir := 1.0
	if result.ImpactPos.X < shooter.Pos.X {
		dir = -1.0
	}
	x := shooter.Pos.X + dir*dash
	if x < 40 {
		x = 40
	} else if x > float64(m.Terrain.Width-40) {
		x = float64(m.Terrain.Width - 40)
	}
	groundY := m.Terrain.FindGroundY(int(x), 50)
	shooter.Pos = physics.Vec2{X: x, Y: float64(groundY - 15)}
}

// projectileCountFor returns the canonical DragonBound projectile count for a
// mobile+shot pair. Shared by HandleFireShot and the parity test.
func projectileCountFor(mobileID, shotType int) int {
	switch {
	case mobileID == MobileBigFoot:
		switch shotType {
		case 0:
			return 4
		case 1:
			return 3
		case 2:
			return 8 // DragonBound canonical: 8 missiles, not 20
		}
	case mobileID == MobileBoomer && shotType == 1:
		return 4 // DragonBound canonical: 4 boomerangs, not 10
	case mobileID == MobileKalsiddon:
		return kalsiddonCount(shotType)
	case mobileID == MobileGrub && shotType == 1:
		return 2 // Grub S2: two bouncing rolling balls
	case mobileID == MobileAduka && shotType == 1:
		return 3 // Aduka S2: three tracker shots
	case mobileID == MobileTrico && shotType == 1:
		return 3
	case mobileID == MobileRaon && shotType == 1:
		return 2
	}
	return 1
}

// Kalsiddon MIRV is handled by the per-shot projectile count in HandleFireShot
// (2/4/6 bomblets with a 2° spread), matching the client's BallisticsEngine.
func kalsiddonCount(shotType int) int {
	if shotType == 2 {
		return 6
	}
	if shotType == 1 {
		return 4
	}
	return 2
}

// Nak burrow: subterranean shot emerges 120px beyond first impact along the
// facing direction, ignoring terrain between the two points.
func (m *Match) applyNakBurrow(cfg physics.ProjectileConfig, result *physics.ProjectileResult, targets []physics.MobileTarget, facing int) {
	if result.HitType != physics.HitTerrain {
		return
	}
	dir := 1.0
	if facing < 0 {
		dir = -1.0
	}
	x := result.ImpactPos.X + dir*120
	if x < 15 {
		x = 15
	} else if x > float64(m.Terrain.Width-15) {
		x = float64(m.Terrain.Width - 15)
	}
	y := float64(m.Terrain.FindGroundY(int(x), 0))
	res := physics.ProjectileResult{
		Trajectory: append(result.Trajectory, physics.Vec2{X: x, Y: y}),
		HitType:    physics.HitTerrain,
		ImpactPos:  physics.Vec2{X: x, Y: y},
		TerrainDelta: &physics.TerrainDelta{
			X: int(x), Y: int(y), Radius: int(cfg.BlastRadius),
			RadiusY: int(math.Round(cfg.BlastRadius * 0.85)),
		},
	}
	m.Terrain.ClearEllipse(int(x), int(y), int(cfg.BlastRadius), int(math.Round(cfg.BlastRadius*0.85)))
	// Nak burrow emergence blast: ×1.4 over the mobile's S1 palaBunge — the
	// subterranean detonation is a distinct decomp primitive, wider than the
	// surface impact. Intentional deviation; do not collapse to cfg.BlastRadius.
	res.Damages = physics.CalculateRadialDamage(res.ImpactPos, targets, cfg.BaseDamage, cfg.BlastRadius*1.4, nil)
	*result = res
}

// Grub bounce: shots bounce off terrain once before detonating. We add a
// reflected velocity step when the first impact is terrain.
func (m *Match) applyGrubBounce(cfg physics.ProjectileConfig, result *physics.ProjectileResult, targets []physics.MobileTarget) {
	if result.HitType != physics.HitTerrain || len(result.Trajectory) < 2 {
		return
	}
	n := len(result.Trajectory)
	prev := result.Trajectory[n-2]
	impact := result.Trajectory[n-1]
	vx := impact.X - prev.X
	vy := impact.Y - prev.Y

	// Reflect vertical component, damp to 65%, simulate one bounce forward.
	bounceCfg := cfg
	bounceCfg.Origin = impact
	bounceCfg.AngleDeg = math.Atan2(-(-vy*0.65), math.Abs(vx)*0.85) * 180 / math.Pi
	bounceCfg.Power = cfg.Power * 0.75
	bounceCfg.BaseDamage = int(float64(cfg.BaseDamage) * 0.60)
	bounceCfg.BlastRadius *= 0.80
	bounced := physics.SimulateProjectileAdv(bounceCfg, m.Terrain, targets)
	result.Trajectory = append(result.Trajectory, bounced.Trajectory...)
	result.ImpactPos = bounced.ImpactPos
	result.HitType = bounced.HitType
	result.Damages = bounced.Damages
	result.TerrainDelta = bounced.TerrainDelta
}

// Aduka Thor homing: when Thor weather is active, Aduka shots call down an
// extra orbital strike at the impact position.
func (m *Match) applyAdukaThor(result *physics.ProjectileResult, targets []physics.MobileTarget, baseDamage int) {
	if !m.Weather.IsThorActive() || result.HitType == physics.HitOOB {
		return
	}
	// 55px is the canonical Thor orbital-strike radius — a separate decomp
	// primitive from the mobile's own palaBunge, so it intentionally does NOT
	// read stats.BlastRadiusForShot. Do not "fix" to the mobile table.
	radius := 55.0
	crater := &physics.TerrainDelta{
		X: int(result.ImpactPos.X), Y: int(result.ImpactPos.Y), Radius: int(radius),
		RadiusY: int(math.Round(radius * 0.85)),
	}
	m.Terrain.ClearEllipse(crater.X, crater.Y, crater.Radius, crater.RadiusY)
	result.TerrainDelta = crater
	for id, dmg := range physics.CalculateRadialDamage(result.ImpactPos, targets, baseDamage, radius, nil) {
		result.Damages[id] += dmg
	}
}
