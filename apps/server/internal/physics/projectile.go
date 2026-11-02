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
	if windPower == 0 {
		ax = 0
		ay = by
	} else {
		wRad := windAngle * (math.Pi / 180.0)
		b0 := math.Round(math.Floor(math.Cos(wRad) * windPower * by)) / 100.0
		b1 := math.Round(math.Floor(math.Sin(wRad) * windPower * by - bx)) / 100.0
		ax = math.Round(0.0 - b0)
		ay = math.Round(by - b1)
	}

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

	var hitType HitType = HitOOB
	var impactPos Vec2 = currentPos
	var hitMobileID string

	for tMs := stepMs; tMs <= maxMs; tMs += stepMs {
		p := float64(tMs) / 1000.0
		prevPos := currentPos
		currentPos = Vec2{
			X: muzzleX + vx*p + (ax*p*p)/2.0,
			Y: muzzleY + vy*p + (ay*p*p)/2.0,
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

			// 3. Out of bounds check
			if checkPos.X < -150 || checkPos.X > float64(terrain.Width)+150 || checkPos.Y > float64(terrain.Height)+50 {
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
			craterRadius := int(cfg.BlastRadius)
			terrain.ClearCircle(int(impactPos.X), int(impactPos.Y), craterRadius)
			terrainDelta = &TerrainDelta{
				X:      int(impactPos.X),
				Y:      int(impactPos.Y),
				Radius: craterRadius,
			}
		}
	} else if hitType == HitTerrain {
		damages = CalculateRadialDamage(impactPos, mobiles, cfg.BaseDamage, cfg.BlastRadius*1.5)

		if cfg.BlastRadius > 0 {
			craterRadius := int(cfg.BlastRadius)
			terrain.ClearCircle(int(impactPos.X), int(impactPos.Y), craterRadius)
			terrainDelta = &TerrainDelta{
				X:      int(impactPos.X),
				Y:      int(impactPos.Y),
				Radius: craterRadius,
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
