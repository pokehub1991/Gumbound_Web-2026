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

// CalculateRadialDamage computes distance falloff damage for splash damage
func CalculateRadialDamage(impactPos Vec2, mobiles []MobileTarget, baseDamage int, blastRadius float64) map[string]int {
	damages := make(map[string]int)
	for _, m := range mobiles {
		dx := impactPos.X - m.Pos.X
		dy := impactPos.Y - m.Pos.Y
		dist := math.Sqrt(dx*dx + dy*dy)
		if dist <= blastRadius {
			factor := 1.0 - (dist / blastRadius)
			dmg := int(float64(baseDamage) * factor)
			if dmg < 10 {
				dmg = 10
			}
			damages[m.ID] = dmg
		}
	}
	return damages
}
