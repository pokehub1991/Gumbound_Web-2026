package physics

import (
	"math"
)

type ProjectileConfig struct {
	Origin      Vec2
	AngleDeg    float64
	Power       float64
	Wind        Vec2
	Gravity     float64
	WindFactor  float64
	BaseDamage  int
	BlastRadius float64
	Facing      int
}

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

// SimulateProjectileAdv executes calibrated ballistics based on GunBound mechanics
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

	// Elevated muzzle origin in direction of aim (avoids starting underground)
	muzzleOffset := 24.0
	muzzleX := cfg.Origin.X + muzzleOffset*math.Cos(rad)*facingMult
	muzzleY := cfg.Origin.Y - 14.0 - muzzleOffset*math.Sin(rad)
	currentPos := Vec2{X: muzzleX, Y: muzzleY}

	// GunBound calibrated speed: 100 power (4 full bars) = 24.0 px/tick initial velocity
	speed := cfg.Power * 0.24
	vx := speed * math.Cos(rad) * facingMult
	vy := -speed * math.Sin(rad) // Screen coordinates: -Y is up

	gravity := cfg.Gravity
	if gravity <= 0.05 {
		gravity = 0.42 // Standard GunBound gravity fallback
	}

	windFactor := cfg.WindFactor
	if windFactor <= 0.01 {
		windFactor = 1.0
	}
	windAccelCoeff := 0.0035 * windFactor

	trajectory := []Vec2{currentPos}
	maxTicks := 600 // Up to 10 seconds simulation max
	stepDt := 1.0

	var hitType HitType = HitOOB
	var impactPos Vec2 = currentPos
	var hitMobileID string

	for tick := 0; tick < maxTicks; tick++ {
		// Apply forces (gravity + wind acceleration vector)
		vx += cfg.Wind.X * windAccelCoeff * stepDt
		vy += (gravity + cfg.Wind.Y*windAccelCoeff) * stepDt

		prevPos := currentPos
		currentPos.X += vx * stepDt
		currentPos.Y += vy * stepDt

		// Continuous collision detection: check along trajectory step every 2.0 pixels
		dx := currentPos.X - prevPos.X
		dy := currentPos.Y - prevPos.Y
		dist := math.Hypot(dx, dy)
		steps := int(math.Ceil(dist / 2.0))
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

			// 1. Check Mobile collision (ignore shooter during first 4 ticks to prevent self-collision at muzzle)
			if tick >= 4 {
				if mobID, hit := CheckMobileCollision(checkPos, mobiles); hit {
					hitType = HitMobile
					impactPos = checkPos
					hitMobileID = mobID
					collided = true
					break
				}
			}

			// 2. Check Terrain collision with binary search for exact surface contact
			px, py := int(checkPos.X), int(checkPos.Y)
			if terrain.IsGround(px, py) {
				lowT := float64(s-1) / float64(steps)
				highT := t
				for iter := 0; iter < 6; iter++ {
					midT := (lowT + highT) * 0.5
					midX := int(prevPos.X + dx*midT)
					midY := int(prevPos.Y + dy*midT)
					if terrain.IsGround(midX, midY) {
						highT = midT
					} else {
						lowT = midT
					}
				}
				hitType = HitTerrain
				impactPos = Vec2{
					X: prevPos.X + dx*highT,
					Y: prevPos.Y + dy*highT,
				}
				collided = true
				break
			}

			// 3. Check Water / Bottom boundary
			if py >= terrain.Height {
				hitType = HitWater
				impactPos = checkPos
				collided = true
				break
			}
		}

		if collided {
			break
		}

		// 4. Out of bounds check
		px, py := int(currentPos.X), int(currentPos.Y)
		if px < -300 || px > terrain.Width+300 || py < -1200 {
			hitType = HitOOB
			impactPos = currentPos
			break
		}

		// Record sample points every tick for completely smooth trajectory
		trajectory = append(trajectory, currentPos)
	}

	// Always ensure impact position is recorded in trajectory
	trajectory = append(trajectory, impactPos)

	// Calculate blast & damage
	blastRadius := cfg.BlastRadius
	if blastRadius <= 0 {
		blastRadius = 28.0
	}
	baseDamage := cfg.BaseDamage
	if baseDamage <= 0 {
		baseDamage = 250
	}

	var terrainDelta *TerrainDelta
	if hitType == HitTerrain || hitType == HitMobile {
		terrainDelta = &TerrainDelta{
			X:      int(impactPos.X),
			Y:      int(impactPos.Y),
			Radius: int(blastRadius),
		}
		terrain.ClearCircle(terrainDelta.X, terrainDelta.Y, terrainDelta.Radius)
	}

	damages := CalculateRadialDamage(impactPos, mobiles, baseDamage, blastRadius*1.5)
	if hitMobileID != "" && damages[hitMobileID] == 0 {
		damages[hitMobileID] = baseDamage
	}

	return ProjectileResult{
		Trajectory:   trajectory,
		HitType:      hitType,
		ImpactPos:    impactPos,
		Damages:      damages,
		TerrainDelta: terrainDelta,
	}
}
