package physics

import (
	"testing"
)

func TestProjectileStraightShot(t *testing.T) {
	terrain := NewFlatTerrain(2400, 600, 500)
	result := SimulateProjectile(
		Vec2{X: 100, Y: 450}, // origin
		45.0,                  // angle degrees
		50.0,                  // power (0-100)
		Vec2{X: 0, Y: 0},      // no wind
		0.25,                  // gravity
		terrain,
		nil, // no mobile targets
	)

	if result.HitType != HitTerrain {
		t.Fatalf("expected HitTerrain, got %v", result.HitType)
	}

	if result.ImpactPos.X <= 100 {
		t.Errorf("expected impact X > 100, got %f", result.ImpactPos.X)
	}

	if result.ImpactPos.Y < 498 {
		t.Errorf("expected impact Y >= 498, got %f", result.ImpactPos.Y)
	}

	if len(result.Trajectory) < 5 {
		t.Errorf("expected trajectory points >= 5, got %d", len(result.Trajectory))
	}
}

func TestProjectileWithWind(t *testing.T) {
	terrain := NewFlatTerrain(2400, 600, 500)

	// Shot with no wind
	shotNoWind := SimulateProjectile(
		Vec2{X: 100, Y: 450},
		45.0,
		35.0,
		Vec2{X: 0, Y: 0},
		0.25,
		terrain,
		nil,
	)

	// Shot with tailwind (pushing right)
	shotTailwind := SimulateProjectile(
		Vec2{X: 100, Y: 450},
		45.0,
		35.0,
		Vec2{X: 1.5, Y: 0},
		0.25,
		terrain,
		nil,
	)

	if shotTailwind.ImpactPos.X <= shotNoWind.ImpactPos.X {
		t.Errorf("expected tailwind shot to travel further: tailwind=%f, nowind=%f",
			shotTailwind.ImpactPos.X, shotNoWind.ImpactPos.X)
	}
}
