package maps

import (
	"math"

	"gumbound-web/server/internal/physics"
)

type MapConfig struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Width       int     `json:"width"`
	Height      int     `json:"height"`
	GroundBaseY int     `json:"groundBaseY"`
	Roughness   float64 `json:"roughness"`
	Amplitude   float64 `json:"amplitude"`
	Gravity     float64 `json:"gravity"`
}

var MapDefinitions = map[string]MapConfig{
	"plains": {
		ID: "plains", Name: "Miramo Plains",
		Width: 2400, Height: 800, GroundBaseY: 560,
		Roughness: 0.008, Amplitude: 65, Gravity: 0.25,
	},
	"canyon": {
		ID: "canyon", Name: "Nirvana Canyon",
		Width: 2400, Height: 800, GroundBaseY: 510,
		Roughness: 0.015, Amplitude: 120, Gravity: 0.28,
	},
	"island": {
		ID: "island", Name: "Sky Island",
		Width: 2400, Height: 800, GroundBaseY: 480,
		Roughness: 0.02, Amplitude: 90, Gravity: 0.22,
	},
}

// GenerateMapTerrain builds a deterministic 1-bit collision mask based on map config
func GenerateMapTerrain(mapID string) (*physics.TerrainMask, MapConfig) {
	cfg, ok := MapDefinitions[mapID]
	if !ok {
		cfg = MapDefinitions["plains"]
	}

	terrain := physics.NewTerrainMask(cfg.Width, cfg.Height)

	for x := 0; x < cfg.Width; x++ {
		fx := float64(x)
		elevation := math.Sin(fx*cfg.Roughness)*cfg.Amplitude + math.Sin(fx*cfg.Roughness*2.5)*(cfg.Amplitude*0.3)
		groundY := int(float64(cfg.GroundBaseY) + elevation)

		for y := max(0, groundY); y < cfg.Height; y++ {
			terrain.SetGround(x, y, true)
		}
	}

	return terrain, cfg
}

