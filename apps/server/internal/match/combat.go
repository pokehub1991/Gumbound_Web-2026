package match

import "math"

// AvatarAttackCap is the maximum bonus attack that avatar equipment can add.
const AvatarAttackCap = 50

// AvatarStats bundles the three canonical avatar stat lines (§4.4 / §7.2).
// Zero values mean "no avatar equipped" — every derived value falls back to base.
type AvatarStats struct {
	Attack  int // raw ava_attack stat
	Delay   int // raw ava_delay stat (higher = larger delay reduction)
	Scratch int // raw ava_scratch stat (higher = larger bunge radius)
}

// TotalAttack returns round(ava_attack / 2.5), capped at +50.
func (a AvatarStats) TotalAttack() int {
	if a.Attack <= 0 {
		return 0
	}
	v := int(math.Round(float64(a.Attack) / 2.5))
	if v > AvatarAttackCap {
		v = AvatarAttackCap
	}
	return v
}

// BaseDamage returns the canonical damageshot for a mobile+shot pair,
// with avatar attack bonus applied.
func BaseDamage(stats MobileStats, avatar AvatarStats, shotType int) int {
	base := stats.Shot1Damage
	switch shotType {
	case 1:
		base = stats.Shot2Damage
	case 2:
		base = stats.SSDamage
	}
	return base + avatar.TotalAttack()
}

// ShotDelay returns the per-shot delay from the mobile table.
func ShotDelay(stats MobileStats, shotType int) int {
	switch shotType {
	case 1:
		return stats.Shot2Delay
	case 2:
		return stats.SSDelay
	}
	return stats.Shot1Delay
}

// AddedDelay computes the canonical added_delay:
//
//	added = base_delay + shot_delay - round(ava_delay * factor)
//
// factor is 1.0 for single shots, 12.5 for Dual, 11 for Dual+.
func AddedDelay(stats MobileStats, avatar AvatarStats, shotType int, factor float64) int {
	reduction := 0
	if avatar.Delay > 0 && factor > 0 {
		reduction = int(math.Round(float64(avatar.Delay) * factor))
	}
	added := stats.BaseDelay + ShotDelay(stats, shotType) - reduction
	if added < 100 {
		added = 100 // floor so duals cannot make a player act infinitely
	}
	return added
}

// BungeJC returns the bunge bonus points from avatar scratch + pala_bunge.
func BungeJC(avatar AvatarStats, palaBunge int) int {
	return int(math.Round(float64(avatar.Scratch)/5.0)) + palaBunge
}
