package maps

import (
	"testing"
)

func TestGenerateMapTerrain(t *testing.T) {
	terrain, cfg := GenerateMapTerrain("plains")
	if terrain.Width != 2400 || terrain.Height != 800 {
		t.Fatalf("unexpected dimensions: %dx%d", terrain.Width, terrain.Height)
	}

	if cfg.ID != "plains" {
		t.Errorf("expected map ID 'plains', got '%s'", cfg.ID)
	}

	// Below ground level should be solid ground
	if !terrain.IsGround(500, 700) {
		t.Errorf("expected solid ground at (500, 700)")
	}

	// High in the sky should be air (not ground)
	if terrain.IsGround(500, 100) {
		t.Errorf("expected air at (500, 100)")
	}
}
