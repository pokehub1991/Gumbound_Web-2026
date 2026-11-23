package match

import "testing"

func TestAvatarAttackCap(t *testing.T) {
	// Cap at +50.
	capped := AvatarStats{Attack: 500}
	if got := capped.TotalAttack(); got != AvatarAttackCap {
		t.Fatalf("TotalAttack(500) = %d, want %d", got, AvatarAttackCap)
	}
	// round(125/2.5) = 50.
	mid := AvatarStats{Attack: 125}
	if got := mid.TotalAttack(); got != 50 {
		t.Fatalf("TotalAttack(125) = %d, want 50", got)
	}
	// No avatar.
	none := AvatarStats{}
	if got := none.TotalAttack(); got != 0 {
		t.Fatalf("TotalAttack(none) = %d, want 0", got)
	}
}

func TestBaseDamageWithAvatar(t *testing.T) {
	stats := GetMobileStats(MobileArmor) // Shot1 = 150
	none := AvatarStats{}
	if got := BaseDamage(stats, none, 0); got != 150 {
		t.Fatalf("base = %d, want 150", got)
	}
	bonus := AvatarStats{Attack: 125}
	if got := BaseDamage(stats, bonus, 0); got != 200 {
		t.Fatalf("with avatar = %d, want 200", got)
	}
}

func TestAddedDelayFloorAndReduction(t *testing.T) {
	stats := GetMobileStats(MobileArmor) // base 500 + shot1 760
	none := AvatarStats{}
	if got := AddedDelay(stats, none, 0, 1.0); got != 1260 {
		t.Fatalf("added = %d, want 1260", got)
	}
	// Large delay reduction clamps to floor 100.
	big := AvatarStats{Delay: 1000}
	if got := AddedDelay(stats, big, 0, 12.5); got != 100 {
		t.Fatalf("clamped added = %d, want 100", got)
	}
	// Dual factor 12.5: 500+760 - round(20*12.5)=250 -> 1010.
	dual := AvatarStats{Delay: 20}
	if got := AddedDelay(stats, dual, 0, 12.5); got != 1010 {
		t.Fatalf("dual added = %d, want 1010", got)
	}
}

func TestBungeJC(t *testing.T) {
	scratch := AvatarStats{Scratch: 100}
	if got := BungeJC(scratch, 0); got != 20 {
		t.Fatalf("BungeJC = %d, want 20", got)
	}
	pala := AvatarStats{}
	if got := BungeJC(pala, 3); got != 3 {
		t.Fatalf("BungeJC(pala) = %d, want 3", got)
	}
}
