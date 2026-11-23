package physics

import (
	"math"
	"sync"
)

// TerrainMask represents a 1-bit collision mask for the map
type TerrainMask struct {
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Mask   []byte `json:"mask"` // 1 bit per pixel
	mu     sync.RWMutex
}

// NewTerrainMask allocates empty terrain
func NewTerrainMask(width, height int) *TerrainMask {
	bytesNeeded := (width*height + 7) / 8
	return &TerrainMask{
		Width:  width,
		Height: height,
		Mask:   make([]byte, bytesNeeded),
	}
}

// NewFlatTerrain generates terrain with ground at and below groundY
func NewFlatTerrain(width, height, groundY int) *TerrainMask {
	t := NewTerrainMask(width, height)
	for y := groundY; y < height; y++ {
		for x := 0; x < width; x++ {
			t.SetGround(x, y, true)
		}
	}
	return t
}

func (t *TerrainMask) SetGround(x, y int, ground bool) {
	if x < 0 || x >= t.Width || y < 0 || y >= t.Height {
		return
	}
	idx := y*t.Width + x
	byteIdx := idx / 8
	bitIdx := uint(idx % 8)

	if ground {
		t.Mask[byteIdx] |= (1 << bitIdx)
	} else {
		t.Mask[byteIdx] &= ^(1 << bitIdx)
	}
}

func (t *TerrainMask) IsGround(x, y int) bool {
	if x < 0 || x >= t.Width || y < 0 || y >= t.Height {
		return false
	}
	t.mu.RLock()
	defer t.mu.RUnlock()

	idx := y*t.Width + x
	byteIdx := idx / 8
	bitIdx := uint(idx % 8)
	return (t.Mask[byteIdx] & (1 << bitIdx)) != 0
}

// ClearCircle carves an explosion crater into the terrain.
// Delegates to ClearEllipse with a 1:1 aspect (kept for callers that want a
// perfect circle). Canonical GunBound craters use ClearEllipse directly.
func (t *TerrainMask) ClearCircle(cx, cy, radius int) {
	t.ClearEllipse(cx, cy, radius, radius)
}

// ClearEllipse carves an elliptical crater using the same Bresenham-style
// midpoint sweep as the reference GunBound `CarveTerrainCrater`:
//   rx = horizontal radius (wide)
//   ry = vertical radius (squashed by an aspect ratio)
//
// GunBound craters are wider than they are tall; the ratio ry/rx is what
// produces that characteristic non-circular scoop. Bit-mask writes are
// bounds-checked per pixel so off-screen impacts are a no-op.
func (t *TerrainMask) ClearEllipse(cx, cy, rx, ry int) {
	if rx <= 0 || ry <= 0 {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()

	minY := max(0, cy-ry)
	maxY := min(t.Height-1, cy+ry)

	rxSq := float64(rx * rx)
	rySq := float64(ry * ry)

	for y := minY; y <= maxY; y++ {
		dy := float64(y - cy)
		// Horizontal half-span at this row of the ellipse.
		dxSpan := int(math.Floor(math.Sqrt(rxSq * max(0, 1.0-dy*dy/rySq))))
		minX := max(0, cx-dxSpan)
		maxX := min(t.Width-1, cx+dxSpan)
		rowBase := y * t.Width
		for x := minX; x <= maxX; x++ {
			idx := rowBase + x
			byteIdx := idx / 8
			bitIdx := uint(idx % 8)
			t.Mask[byteIdx] &= ^(1 << bitIdx)
		}
	}
}

// FindGroundY finds the first ground pixel y coordinate for a given x column starting from startY downwards
func (t *TerrainMask) FindGroundY(x, startY int) int {
	for y := startY; y < t.Height; y++ {
		if t.IsGround(x, y) {
			return y
		}
	}
	return t.Height
}

