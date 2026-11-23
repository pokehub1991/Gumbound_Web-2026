package match

import "testing"

func newTwoPlayerMatch(t *testing.T) *Match {
	t.Helper()
	players := []*MatchPlayer{
		{ID: "p1", Nickname: "P1", MobileID: MobileArmor, Team: "A"},
		{ID: "p2", Nickname: "P2", MobileID: MobileIce, Team: "B"},
	}
	m := NewMatch("m-items", players, "plains")
	if m.ActiveID != "p1" {
		t.Fatalf("expected p1 active, got %s", m.ActiveID)
	}
	return m
}

func TestUseItemUnknownAndOutOfTurn(t *testing.T) {
	m := newTwoPlayerMatch(t)
	if err := m.UseItem("p1", ItemID("nope")); err == nil {
		t.Fatal("unknown item must be rejected")
	}
	if err := m.UseItem("p2", ItemDual); err == nil {
		t.Fatal("out-of-turn item use must be rejected")
	}
}

func TestUseItemDualQueuesPendingAndConsumesGold(t *testing.T) {
	m := newTwoPlayerMatch(t)
	p := m.Players["p1"]
	startingGold := p.Gold
	if err := m.UseItem("p1", ItemDual); err != nil {
		t.Fatalf("UseItem(dual) = %v", err)
	}
	if p.PendingShotItem != ItemDual {
		t.Fatalf("PendingShotItem = %q, want dual", p.PendingShotItem)
	}
	if p.ItemUsedThisTurn != true {
		t.Fatal("ItemUsedThisTurn should be true")
	}
	if p.Gold != startingGold-itemCatalog[ItemDual].cost {
		t.Fatalf("gold = %d, want %d", p.Gold, startingGold-itemCatalog[ItemDual].cost)
	}
	if p.Inventory[ItemDual] != 1 {
		t.Fatalf("dual remaining = %d, want 1", p.Inventory[ItemDual])
	}
	// Second item this turn must be rejected.
	if err := m.UseItem("p1", ItemTeleport); err == nil {
		t.Fatal("second item in same turn must be rejected")
	}
	// Consume via fire.
	if got := nextShotDelayFactor(p); got == 1.0 {
		t.Fatal("next shot should carry dual factor")
	}
	if p.PendingShotItem != "" {
		t.Fatalf("pending dual should be cleared, got %q", p.PendingShotItem)
	}
}

func TestUseItemDualPlusFactorLower(t *testing.T) {
	m := newTwoPlayerMatch(t)
	p := m.Players["p1"]
	if err := m.UseItem("p1", ItemDualPlus); err != nil {
		t.Fatalf("UseItem(dual_plus) = %v", err)
	}
	factor := nextShotDelayFactor(p)
	if factor >= 12.5 {
		t.Fatalf("dual+ factor %v should be < 12.5", factor)
	}
}

func TestUseItemWindChangeRerolls(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.Players["p1"].Inventory[ItemWindChange] = 1
	// Force a known wind then confirm it changes.
	m.Wind.AngleDeg = 0
	m.Wind.Magnitude = 1
	if err := m.UseItem("p1", ItemWindChange); err != nil {
		t.Fatalf("UseItem(wind_change) = %v", err)
	}
	if m.Wind.Magnitude == 1 && m.Wind.AngleDeg == 0 {
		t.Fatal("wind_change should re-roll wind")
	}
}

func TestUseItemBloodHeals(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.Players["p1"].Inventory[ItemBlood] = 1
	p := m.Players["p1"]
	p.HP = 100
	if err := m.UseItem("p1", ItemBlood); err != nil {
		t.Fatalf("UseItem(blood) = %v", err)
	}
	if p.HP <= 100 {
		t.Fatalf("blood should heal, hp = %d", p.HP)
	}
	if p.NextShotDamageMultiplier != 0.80 {
		t.Fatalf("damage multiplier = %v, want 0.80", p.NextShotDamageMultiplier)
	}
}

func TestUseItemTeleportMovesAndClamps(t *testing.T) {
	m := newTwoPlayerMatch(t)
	p := m.Players["p1"]
	before := p.Pos
	if err := m.UseItem("p1", ItemTeleport); err != nil {
		t.Fatalf("UseItem(teleport) = %v", err)
	}
	if p.Pos.X == before.X && p.Pos.Y == before.Y {
		t.Fatal("teleport should move the player")
	}
	if p.Pos.X < 40 || p.Pos.X > float64(m.Terrain.Width-40) {
		t.Fatalf("teleport x out of bounds: %v", p.Pos.X)
	}
}

func TestUseItemPowerUpSetsMultiplier(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.Players["p1"].Inventory[ItemPowerUp] = 1
	p := m.Players["p1"]
	if err := m.UseItem("p1", ItemPowerUp); err != nil {
		t.Fatalf("UseItem(power_up) = %v", err)
	}
	if p.NextShotPowerMultiplier != 1.20 {
		t.Fatalf("power multiplier = %v, want 1.20", p.NextShotPowerMultiplier)
	}
}

func TestUseItemBungeShotAddsCrater(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.Players["p1"].Inventory[ItemBungeShot] = 1
	p := m.Players["p1"]
	if err := m.UseItem("p1", ItemBungeShot); err != nil {
		t.Fatalf("UseItem(bunge) = %v", err)
	}
	if p.NextShotBungeBonus != 20 {
		t.Fatalf("bunge bonus = %d, want 20", p.NextShotBungeBonus)
	}
}

func TestUseItemTeamTeleportNoAllyRejected(t *testing.T) {
	m := newTwoPlayerMatch(t)
	// Solo A-side player: no ally available.
	if err := m.UseItem("p1", ItemTeamTeleport); err == nil {
		t.Fatal("team teleport without ally must be rejected")
	}
}

func TestUseItemInsufficientGold(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.Players["p1"].Gold = 0
	if err := m.UseItem("p1", ItemDual); err == nil {
		t.Fatal("insufficient gold must be rejected")
	}
}

func TestResetTurnItemFlagsClearsPending(t *testing.T) {
	m := newTwoPlayerMatch(t)
	p := m.Players["p1"]
	if err := m.UseItem("p1", ItemDual); err != nil {
		t.Fatalf("UseItem = %v", err)
	}
	m.resetTurnItemFlags(p)
	if p.ItemUsedThisTurn || p.PendingShotItem != "" {
		t.Fatal("reset should clear per-turn flags")
	}
}
