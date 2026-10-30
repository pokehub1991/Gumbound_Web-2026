package physics

import (
	"math"
)

// SimulateProjectile runs an authoritative, deterministic projectile simulation
func SimulateProjectile(
	origin Vec2,
	angleDeg float64,
	power float64,
	wind Vec2,
	gravity float64,
	terrain *TerrainMask,
	mobiles []MobileTarget,
) ProjectileResult {
	rad := angleDeg * (math.Pi / 180.0)
	// Power scaling
	speed := power * 0.45
	vx := speed * math.Cos(rad)
	vy := -speed * math.Sin(rad) // Screen coordinates: -Y is up

	currentPos := origin
	trajectory := []Vec2{origin}

	maxTicks := 600 // Up to 10 seconds simulation max
	stepDt := 1.0

	var hitType HitType = HitOOB
	var impactPos Vec2 = currentPos
	var hitMobileID string

	for tick := 0; tick < maxTicks; tick++ {
		// Apply forces
		vx += wind.X * 0.05 * stepDt
		vy += (gravity + wind.Y*0.05) * stepDt

		currentPos.X += vx * stepDt
		currentPos.Y += vy * stepDt

		// Record sample points every 2 ticks
		if tick%2 == 0 {
			trajectory = append(trajectory, currentPos)
		}

		// 1. Check Mobile collision
		if mobID, hit := CheckMobileCollision(currentPos, mobiles); hit {
			hitType = HitMobile
			impactPos = currentPos
			hitMobileID = mobID
			break
		}

		// 2. Check Terrain collision
		px, py := int(currentPos.X), int(currentPos.Y)
		if terrain.IsGround(px, py) {
			hitType = HitTerrain
			impactPos = currentPos
			break
		}

		// 3. Check Water / Bottom boundary
		if py >= terrain.Height {
			hitType = HitWater
			impactPos = currentPos
			break
		}

		// 4. Out of bounds check (left/right bounds)
		if px < -300 || px > terrain.Width+300 || py < -1000 {
			hitType = HitOOB
			impactPos = currentPos
			break
		}
	}

	// Always ensure impact position is recorded in trajectory
	trajectory = append(trajectory, impactPos)

	// Calculate blast & damage
	blastRadius := 28.0
	var terrainDelta *TerrainDelta

	if hitType == HitTerrain || hitType == HitMobile {
		terrainDelta = &TerrainDelta{
			X:      int(impactPos.X),
			Y:      int(impactPos.Y),
			Radius: int(blastRadius),
		}
		// Clear crater in server's terrain mask
		terrain.ClearCircle(terrainDelta.X, terrainDelta.Y, terrainDelta.Radius)
	}

	damages := CalculateRadialDamage(impactPos, mobiles, 250, blastRadius*1.5)
	if hitMobileID != "" && damages[hitMobileID] == 0 {
		damages[hitMobileID] = 250 // Direct hit guarantees base damage
	}

	return ProjectileResult{
		Trajectory:   trajectory,
		HitType:      hitType,
		ImpactPos:    impactPos,
		Damages:      damages,
		TerrainDelta: terrainDelta,
	}
}
