package physics

import (
	"math"
)

type ProjectileConfig struct {
	Origin       Vec2
	AngleDeg     float64
	Power        float64
	Wind         Vec2
	WindPower    float64
	WindAngleDeg float64
	By           float64
	Bx           float64
	Ax           float64
	Ay           float64
	Gravity      float64
	WindFactor   float64
	BaseDamage   int
	BlastRadius  float64
	Facing       int
	// WeatherAt reports per-step acceleration modifiers at world coordinate x.
	// Nil disables positional weather effects.
	WeatherAt func(x float64) AccelModifier
}

// AccelModifier describes per-step acceleration changes from a positional
// weather column (plan §4.7). Multipliers scale the base wind/gravity vector;
// additive terms are applied directly.
type AccelModifier struct {
	AxMult float64
	AyMult float64
	AxAdd  float64
	AyAdd  float64
}

// DefaultAccelModifier is the no-op modifier.
func DefaultAccelModifier() AccelModifier { return AccelModifier{AxMult: 1, AyMult: 1} }

// SimulateProjectile runs an authoritative, deterministic projectile simulation
func SimulateProjectile(
	origin Vec2,
	angleDeg float64,
	power float64,
	wind Vec2,
	gravity float64,
	terrain *TerrainMask,
	mobiles []MobileTarget,
	facing ...int,
) ProjectileResult {
	f := 1
	if len(facing) > 0 && facing[0] < 0 {
		f = -1
	}
	cfg := ProjectileConfig{
		Origin:      origin,
		AngleDeg:    angleDeg,
		Power:       power,
		Wind:        wind,
		Gravity:     gravity,
		WindFactor:  1.0,
		BaseDamage:  250,
		BlastRadius: 28.0,
		Facing:      f,
	}
	return SimulateProjectileAdv(cfg, terrain, mobiles)
}

func ComputeAccelerations(by, bx, windPower, windAngleDeg float64) (float64, float64) {
	if windPower == 0 {
		return 0, math.Round(by)
	}
	rad := windAngleDeg * (math.Pi / 180.0)
	b0 := math.Round(math.Floor(math.Cos(rad)*windPower*by)) / 100.0
	b1 := math.Round(math.Floor(math.Sin(rad)*windPower*by-bx)) / 100.0
	return math.Round(0.0 - b0), math.Round(by - b1)
}

// SimulateProjectileAdv executes calibrated ballistics based on authentic GunBound / DragonBound mechanics
func SimulateProjectileAdv(
	cfg ProjectileConfig,
	terrain *TerrainMask,
	mobiles []MobileTarget,
) ProjectileResult {
	facingMult := 1.0
	if cfg.Facing < 0 {
		facingMult = -1.0
	}
	rad := cfg.AngleDeg * (math.Pi / 180.0)

	// Elevated muzzle origin in direction of aim
	muzzleOffset := 24.0
	muzzleX := cfg.Origin.X + muzzleOffset*math.Cos(rad)*facingMult
	muzzleY := cfg.Origin.Y - 14.0 - muzzleOffset*math.Sin(rad)

	// Ensure muzzle origin is strictly in the open air, elevating if slope rises immediately
	for iter := 0; iter < 40 && terrain.IsGround(int(muzzleX), int(muzzleY)); iter++ {
		muzzleY -= 2.0
	}
	currentPos := Vec2{X: muzzleX, Y: muzzleY}

	// Authentic mobile aerodynamics (by, bx)
	by := cfg.By
	if by <= 1.0 {
		if cfg.Gravity > 0.01 {
			// Convert legacy gravity (0.25..0.50) to standard GunBound by scale (~398)
			by = cfg.Gravity * 1000.0
		} else {
			by = 398.0
		}
	}
	bx := cfg.Bx

	// Calculate wind power and angle
	windPower := cfg.WindPower
	windAngle := cfg.WindAngleDeg
	if windPower == 0 && (cfg.Wind.X != 0 || cfg.Wind.Y != 0) {
		windPower = math.Hypot(cfg.Wind.X, cfg.Wind.Y) * 10.0
		// In DragonBound convention: ax = 0 - b0, so tailwind (X > 0) corresponds to 180 deg
		windAngle = math.Atan2(-cfg.Wind.Y, -cfg.Wind.X) * (180.0 / math.Pi)
		if windAngle < 0 {
			windAngle += 360.0
		}
	}

	var ax, ay float64
	ax, ay = ComputeAccelerations(by, bx, windPower, windAngle)

	// GunBound analytical speed: 0-100 power -> 0-400 power units -> v0 up to 936 px/sec
	scaledPower := (cfg.Power / 100.0) * 400.0
	v0 := math.Floor((scaledPower * 234.0) / 100.0)
	if v0 <= 0 {
		v0 = 234.0
	}
	vx := math.Cos(rad) * v0 * facingMult
	vy := -math.Sin(rad) * v0 // Screen coordinates: -Y is up

	trajectory := []Vec2{currentPos}
	stepMs := 16 // ~60 steps per second
	maxMs := 8000
	dt := float64(stepMs) / 1000.0

	// When positional weather is active, integrate acceleration step-by-step
	// instead of the closed-form path so the projectile can enter/leave columns.
	weathered := cfg.WeatherAt != nil
	vel := Vec2{X: vx, Y: vy}
	integratedPos := currentPos

	var hitType HitType = HitOOB
	var impactPos Vec2 = currentPos
	var hitMobileID string

	for tMs := stepMs; tMs <= maxMs; tMs += stepMs {
		p := float64(tMs) / 1000.0
		prevPos := currentPos
		if weathered {
			mod := cfg.WeatherAt(integratedPos.X)
			if mod.AxMult == 0 && mod.AyMult == 0 {
				mod = DefaultAccelModifier()
			}
			effAx := ax*mod.AxMult + mod.AxAdd
			effAy := ay*mod.AyMult + mod.AyAdd
			vel.X += effAx * dt
			vel.Y += effAy * dt
			integratedPos = Vec2{
				X: integratedPos.X + vel.X*dt,
				Y: integratedPos.Y + vel.Y*dt,
			}
			currentPos = integratedPos
		} else {
			currentPos = Vec2{
				X: muzzleX + vx*p + (ax*p*p)/2.0,
				Y: muzzleY + vy*p + (ay*p*p)/2.0,
			}
		}

		// Continuous collision detection between prevPos and currentPos
		dx := currentPos.X - prevPos.X
		dy := currentPos.Y - prevPos.Y
		dist := math.Hypot(dx, dy)
		steps := int(math.Ceil(dist / 1.5))
		if steps < 1 {
			steps = 1
		}

		collided := false
		for s := 1; s <= steps; s++ {
			t := float64(s) / float64(steps)
			checkPos := Vec2{
				X: prevPos.X + dx*t,
				Y: prevPos.Y + dy*t,
			}

			// 1. Check Mobile collision (skip initial ms to clear immediate muzzle release)
			if tMs >= 60 {
				if mobID, hit := CheckMobileCollision(checkPos, mobiles); hit {
					hitType = HitMobile
					impactPos = checkPos
					hitMobileID = mobID
					collided = true
					break
				}
			}

			// 2. Check Terrain collision (skip initial ms to clear muzzle elevation)
			px, py := int(checkPos.X), int(checkPos.Y)
			if tMs >= 40 && terrain.IsGround(px, py) {
				lowT := float64(s-1) / float64(steps)
				highT := t
				for iter := 0; iter < 8; iter++ {
					midT := (lowT + highT) * 0.5
					midX := int(prevPos.X + dx*midT)
					midY := int(prevPos.Y + dy*midT)
					if terrain.IsGround(midX, midY) {
						highT = midT
					} else {
						lowT = midT
					}
				}

				hitX := prevPos.X + dx*highT
				hitY := prevPos.Y + dy*highT

				ix, iy := int(hitX), int(hitY)
				for iy > 0 && terrain.IsGround(ix, iy-1) {
					iy--
				}
				hitY = float64(iy)

				hitType = HitTerrain
				impactPos = Vec2{X: hitX, Y: hitY}
				collided = true
				break
			}

			// 3. Out of bounds check: wide margins allow full high arcs and off-screen exits
			if checkPos.X < -1000 || checkPos.X > float64(terrain.Width)+1000 || checkPos.Y > float64(terrain.Height)+400 {
				hitType = HitOOB
				impactPos = checkPos
				collided = true
				break
			}
		}

		trajectory = append(trajectory, currentPos)
		if collided {
			break
		}
	}

	damages := make(map[string]int)
	var terrainDelta *TerrainDelta

	if hitType == HitMobile && hitMobileID != "" {
		damages[hitMobileID] = cfg.BaseDamage
		if cfg.BlastRadius > 0 {
			// Canonical GunBound crater: wider than tall (aspect 1.0 : 0.85).
			craterRx := int(math.Round(cfg.BlastRadius))
			craterRy := int(math.Round(cfg.BlastRadius * 0.85))
			terrain.ClearEllipse(int(impactPos.X), int(impactPos.Y), craterRx, craterRy)
			terrainDelta = &TerrainDelta{
				X:       int(impactPos.X),
				Y:       int(impactPos.Y),
				Radius:  craterRx,
				RadiusY: craterRy,
			}
		}
	} else if hitType == HitTerrain {
		// Self-arm gate: shooter cannot be splashed by own shell inside 20px of muzzle.
		origin := cfg.Origin
		damages = CalculateRadialDamage(impactPos, mobiles, cfg.BaseDamage, cfg.BlastRadius*1.5, &origin)

		if cfg.BlastRadius > 0 {
			// Canonical GunBound crater: wider than tall (aspect 1.0 : 0.85).
			craterRx := int(math.Round(cfg.BlastRadius))
			craterRy := int(math.Round(cfg.BlastRadius * 0.85))
			terrain.ClearEllipse(int(impactPos.X), int(impactPos.Y), craterRx, craterRy)
			terrainDelta = &TerrainDelta{
				X:       int(impactPos.X),
				Y:       int(impactPos.Y),
				Radius:  craterRx,
				RadiusY: craterRy,
			}
		}
	}

	return ProjectileResult{
		Trajectory:   trajectory,
		HitType:      hitType,
		ImpactPos:    impactPos,
		Damages:      damages,
		TerrainDelta: terrainDelta,
	}
}
