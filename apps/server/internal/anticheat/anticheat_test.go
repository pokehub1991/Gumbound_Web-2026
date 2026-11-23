package anticheat

import (
	"testing"
	"time"
)

func TestImpossibleAnglePrecision(t *testing.T) {
	d := New(Config{})
	now := time.Now()

	v := d.InspectShot("bot", 27.31847, 55, now)
	if !v.Reject || v.Violation.Kind != "impossible_precision" {
		t.Fatalf("expected reject for over-precise angle, got %+v", v)
	}

	v = d.InspectShot("human", 27.31, 55, now)
	if v.Reject {
		t.Fatalf("expected accept for 2-decimal angle, got %+v", v)
	}

	v = d.InspectShot("human", 27.3, 55.123456, now)
	if !v.Reject {
		t.Fatalf("expected reject for over-precise power, got %+v", v)
	}
}

func TestOutOfTurnFlaggedAndRejected(t *testing.T) {
	d := New(Config{})
	now := time.Now()

	v := d.InspectOutOfTurn("eager", "actual_player", now)
	if !v.Reject || !v.Flag {
		t.Fatalf("expected out-of-turn to reject and flag, got %+v", v)
	}
	if v.Violation.Detail != "active=actual_player" {
		t.Fatalf("unexpected detail: %q", v.Violation.Detail)
	}
}

func TestAngleSnap(t *testing.T) {
	d := New(Config{MaxAngleRateDegPerSec: 90, MinShotIntervalMs: 1})
	base := time.Now()

	// First shot is the baseline.
	if v := d.InspectShot("snapper", 10, 50, base); v.Reject {
		t.Fatalf("first shot should pass, got %+v", v)
	}
	// 180° in 100ms = 1800 deg/s >> 90.
	v := d.InspectShot("snapper", 190, 50, base.Add(100*time.Millisecond))
	if !v.Reject || v.Violation.Kind != "angle_snap" {
		t.Fatalf("expected angle_snap rejection, got %+v", v)
	}
	// Same turn, small rotation is fine.
	d2 := New(Config{MaxAngleRateDegPerSec: 90, MinShotIntervalMs: 1})
	d2.InspectShot("slow", 10, 50, base)
	if v := d2.InspectShot("slow", 15, 50, base.Add(200*time.Millisecond)); v.Reject {
		t.Fatalf("small rotation should pass, got %+v", v)
	}
}

func TestMacroTiming(t *testing.T) {
	// 4 uniform 600ms intervals → flag on the 5th shot (4 gaps).
	d := New(Config{ChargeTimingSamples: 4, ChargeTimingEpsilonMs: 15})
	base := time.Now()
	d.InspectShot("macro", 20, 50, base)
	for i := 1; i <= 4; i++ {
		v := d.InspectShot("macro", 20, 50, base.Add(time.Duration(600*i)*time.Millisecond))
		if i < 4 && v.Flag {
			t.Fatalf("premature macro flag on sample %d: %+v", i, v)
		}
		if i == 4 && !v.Flag {
			t.Fatalf("expected macro flag on 5th uniform shot, got %+v", v)
		}
	}

	// Human-like jitter doesn't trip.
	d2 := New(Config{ChargeTimingSamples: 4, ChargeTimingEpsilonMs: 15})
	d2.InspectShot("human", 20, 50, base)
	cum := int64(0)
	gaps := []int64{580, 640, 605, 720, 610}
	for i, g := range gaps {
		cum += g
		if v := d2.InspectShot("human", 20, 50, base.Add(time.Duration(cum)*time.Millisecond)); v.Flag {
			t.Fatalf("human jitter should not flag (iter %d), got %+v", i, v)
		}
	}
}

func TestShotRateLimit(t *testing.T) {
	d := New(Config{MinShotIntervalMs: 500})
	base := time.Now()
	d.InspectShot("spam", 30, 50, base)
	v := d.InspectShot("spam", 31, 50, base.Add(50*time.Millisecond))
	if !v.Reject || v.Violation.Kind != "shot_rate" {
		t.Fatalf("expected shot_rate reject, got %+v", v)
	}
}

func TestChatCap(t *testing.T) {
	d := New(Config{ChatMaxChars: 200})
	ok, v := d.InspectChat("x", "hola", time.Now())
	if v.Reject || ok != "hola" {
		t.Fatalf("short chat should pass, got %+v", v)
	}
	long := ""
	for i := 0; i < 201; i++ {
		long += "a"
	}
	trimmed, v := d.InspectChat("x", long, time.Now())
	if !v.Reject || trimmed != "" {
		t.Fatalf("expected over-cap chat to reject, got %+v", v)
	}
}

func TestCleanupRemovesStaleState(t *testing.T) {
	d := New(Config{})
	d.InspectShot("gone", 20, 50, time.Now())
	d.Cleanup([]string{"stay"})
	if _, exists := d.players["gone"]; exists {
		t.Fatal("expected state for removed account to be dropped")
	}
}
