package physics

import "testing"

func TestCalculateRadialDamageLinearFalloff(t *testing.T) {
	impact := Vec2{X: 100, Y: 100}
	mobiles := []MobileTarget{
		{ID: "direct", Pos: Vec2{X: 100, Y: 100}, Radius: 20},
		{ID: "near", Pos: Vec2{X: 110, Y: 100}, Radius: 20},
		{ID: "far", Pos: Vec2{X: 130, Y: 100}, Radius: 20},
		{ID: "outside", Pos: Vec2{X: 200, Y: 100}, Radius: 20},
	}
	dmg := CalculateRadialDamage(impact, mobiles, 200, 60, nil)
	if dmg["direct"] != 200 {
		t.Fatalf("direct hit = %d, want 200", dmg["direct"])
	}
	if dmg["near"] != 190 { // 200 - 10
		t.Fatalf("near = %d, want 190", dmg["near"])
	}
	if dmg["far"] != 170 { // 200 - 30
		t.Fatalf("far = %d, want 170", dmg["far"])
	}
	if _, ok := dmg["outside"]; ok {
		t.Fatal("mobile outside blast radius must take no damage")
	}
}

func TestSelfArmGate(t *testing.T) {
	if SelfArmDistance != 20.0 {
		t.Fatalf("SelfArmDistance = %v, want 20", SelfArmDistance)
	}
	muzzle := Vec2{X: 0, Y: 0}
	impact := Vec2{X: 10, Y: 0}
	mobiles := []MobileTarget{
		{ID: "shooter", Pos: muzzle, Radius: 20},
	}
	dmg := CalculateRadialDamage(impact, mobiles, 200, 60, &muzzle)
	if _, ok := dmg["shooter"]; ok {
		t.Fatal("shooter must be immune inside 20px self-arm radius")
	}
	// Outside arm radius -> damage applies.
	farImpact := Vec2{X: 30, Y: 0}
	dmg = CalculateRadialDamage(farImpact, mobiles, 200, 60, &muzzle)
	if dmg["shooter"] != 170 { // 200 - 30
		t.Fatalf("shooter outside arm radius = %d, want 170", dmg["shooter"])
	}
	// Nil shooter pos -> no self-arm gating (bunge/mines).
	dmg = CalculateRadialDamage(impact, mobiles, 200, 60, nil)
	if dmg["shooter"] != 190 {
		t.Fatalf("no shooter pos = %d, want 190", dmg["shooter"])
	}
}
