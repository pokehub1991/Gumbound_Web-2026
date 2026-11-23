package physics

import (
	"math"
	"testing"
)

func TestComputeAccelerationsParity(t *testing.T) {
	cases := []struct {
		by, bx, wind, angle float64
		wantAx, wantAy      float64
	}{
		{398, 0, 0, 0, 0, 398},
		{398, 0, 12, 0, -48, 398},
		{380, 0, 20, 90, 0, 304},
		{244, 0, 15, 180, 37, 244},
		{398, 50, 10, 90, 0, 359},
	}
	for _, c := range cases {
		ax, ay := ComputeAccelerations(c.by, c.bx, c.wind, c.angle)
		if ax != c.wantAx || ay != c.wantAy {
			t.Errorf("ComputeAccelerations(%v,%v,%v,%v) = (%v,%v), want (%v,%v)",
				c.by, c.bx, c.wind, c.angle, ax, ay, c.wantAx, c.wantAy)
		}
	}
}

func TestAnalyticPositionParity(t *testing.T) {
	a := 485.0 / 485.0
	x := math.Ceil(100 + 400*a + (-10*a*a)/2)
	y := math.Ceil(300 - 200*a + (398*a*a)/2)
	if x != 495 || y != 299 {
		t.Errorf("analytic position = (%v,%v), want (495,299)", x, y)
	}
}
