package physics

import (
	"math"
	"testing"
)

func TestTerrainMaskIntegrity(t *testing.T) {
	width := 2400
	height := 800
	groundBaseY := 560
	roughness := 0.008
	amplitude := 65.0

	terrain := NewTerrainMask(width, height)
	for x := 0; x < width; x++ {
		fx := float64(x)
		elevation := math.Sin(fx*roughness)*amplitude + math.Sin(fx*roughness*2.5)*(amplitude*0.3)
		groundY := int(float64(groundBaseY) + elevation)
		for y := max(0, groundY); y < height; y++ {
			terrain.SetGround(x, y, true)
		}
	}

	// Verify all points
	for x := 0; x < width; x += 17 {
		fx := float64(x)
		elevation := math.Sin(fx*roughness)*amplitude + math.Sin(fx*roughness*2.5)*(amplitude*0.3)
		groundY := int(float64(groundBaseY) + elevation)

		// Above surface must be false
		for y := max(0, groundY-50); y < groundY; y++ {
			if terrain.IsGround(x, y) {
				t.Fatalf("Pixel (%d, %d) should be false (ground is at %d)", x, y, groundY)
			}
		}

		// Surface and below must be true
		for y := groundY; y < min(height, groundY+50); y++ {
			if !terrain.IsGround(x, y) {
				t.Fatalf("Pixel (%d, %d) should be true (ground is at %d)", x, y, groundY)
			}
		}
	}
}
