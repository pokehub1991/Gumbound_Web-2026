package physics

import (
	"math"
)

// CheckMobileCollision checks if projectile hit any mobile within their radius
func CheckMobileCollision(pos Vec2, mobiles []MobileTarget) (string, bool) {
	for _, m := range mobiles {
		dx := pos.X - m.Pos.X
		dy := pos.Y - m.Pos.Y
		distSq := dx*dx + dy*dy
		if distSq <= m.Radius*m.Radius {
			return m.ID, true
		}
	}
	return "", false
}

// SelfArmDistance is how far a projectile must travel from its muzzle before
// it can deal splash damage to its own shooter. Replaces the legacy 60/80ms
// time-based arming.
const SelfArmDistance = 20.0

// CalculateRadialDamage implements the canonical DragonBound splash model:
//   - splash (<= R) -> dm = base - dist (linear falloff, floor 10)
//   - shooter       -> immune while impact is inside the 20px arm radius
//
// shooterPos nil disables self-arming (bunge / walking mines / no shooter).
func CalculateRadialDamage(impactPos Vec2, mobiles []MobileTarget, baseDamage int, blastRadius float64, shooterPos *Vec2) map[string]int {
	damages := make(map[string]int)
	for _, m := range mobiles {
		dx := impactPos.X - m.Pos.X
		dy := impactPos.Y - m.Pos.Y
		dist := math.Sqrt(dx*dx + dy*dy)
		if dist > blastRadius {
			continue
		}
		if shooterPos != nil {
			sx := impactPos.X - shooterPos.X
			sy := impactPos.Y - shooterPos.Y
			if math.Sqrt(sx*sx+sy*sy) < SelfArmDistance {
				continue
			}
		}
		dmg := int(float64(baseDamage) - dist)
		if dmg < 10 {
			dmg = 10
		}
		damages[m.ID] = dmg
	}
	return damages
}

