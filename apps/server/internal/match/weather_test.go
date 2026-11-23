package match

import (
	"math/rand"
	"testing"

	"gumbound-web/server/internal/physics"
)

func TestWeatherRollProvidesAnchor(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	ws := newWeatherState(rng, 2400)
	if ws == nil || len(ws.Active) != 1 {
		t.Fatalf("expected one active anchor, got %+v", ws)
	}
	if ws.TurnsPerRound != 5 {
		t.Fatalf("turns per round = %d, want 5", ws.TurnsPerRound)
	}
}

func TestWeatherAdvanceShiftsTurn(t *testing.T) {
	rng := rand.New(rand.NewSource(2))
	ws := newWeatherState(rng, 2400)
	if ws.TurnInRound != 1 {
		t.Fatalf("turn_in_round = %d, want 1", ws.TurnInRound)
	}
	ws.advance(rng, 2400)
	if ws.TurnInRound != 2 {
		t.Fatalf("after advance turn_in_round = %d, want 2", ws.TurnInRound)
	}
	// 1 -> 2 -> 3 -> 4 -> 5 -> 1 (four more advances).
	for i := 0; i < 4; i++ {
		ws.advance(rng, 2400)
	}
	if ws.TurnInRound != 1 {
		t.Fatalf("should wrap to 1, got %d", ws.TurnInRound)
	}
}

func TestWeatherTypeAt(t *testing.T) {
	ws := &WeatherState{
		Active: []ActiveWeather{{Type: WeatherTornado, X: 500, Width: 68, Power: 100}},
	}
	if got := ws.weatherTypeAt(500); got != WeatherTornado {
		t.Fatalf("center hit = %q, want tornado", got)
	}
	if got := ws.weatherTypeAt(533); got != WeatherTornado {
		t.Fatalf("edge hit = %q, want tornado", got)
	}
	if got := ws.weatherTypeAt(560); got != "" {
		t.Fatalf("outside = %q, want empty", got)
	}
	// Zero-width anchor (global Thor) matches nothing.
	global := &WeatherState{Active: []ActiveWeather{{Type: WeatherThor, X: 0, Width: 0}}}
	if got := global.weatherTypeAt(0); got != "" {
		t.Fatalf("global anchor should not match position, got %q", got)
	}
	if !global.IsThorActive() {
		t.Fatal("IsThorActive must be true for thor anchor")
	}
}

func TestWeatherAccelModifiers(t *testing.T) {
	ws := &WeatherState{
		Active: []ActiveWeather{{Type: WeatherTornado, X: 600, Width: 68, Power: 100}},
	}
	_, ay, axAdd, ayAdd := ws.WeatherAccelModifiers(600)
	if ay == 1 {
		t.Fatalf("tornado must modify ay multiplier, got %v", ay)
	}
	if axAdd == 0 && ayAdd == 0 {
		t.Fatal("tornado must add lift")
	}
	// Outside column: no modifier.
	am2, ay2, axAdd2, ayAdd2 := ws.WeatherAccelModifiers(900)
	if am2 != 1 || ay2 != 1 || axAdd2 != 0 || ayAdd2 != 0 {
		t.Fatalf("outside column must be no-op, got (%v,%v,%v,%v)", am2, ay2, axAdd2, ayAdd2)
	}
}

func TestWeatherGuardMultiplier(t *testing.T) {
	ws := &WeatherState{
		Active: []ActiveWeather{{Type: WeatherSun, X: 300, Width: 44, Power: 100}},
	}
	if got := ws.WeatherGuardMultiplier(300); got <= 1.0 {
		t.Fatalf("sun must increase outgoing damage, got %v", got)
	}
	ws.Active = []ActiveWeather{{Type: WeatherBlack, X: 300, Width: 52, Power: 100}}
	if got := ws.WeatherGuardMultiplier(300); got >= 1.0 {
		t.Fatalf("black must decrease outgoing damage, got %v", got)
	}
}

func TestApplyWeatherToConfig(t *testing.T) {
	m := newTwoPlayerMatch(t)
	// Force a positional column.
	m.Weather.Active = []ActiveWeather{{Type: WeatherSun, X: 800, Width: 44, Power: 100}}
	cfg := physics.ProjectileConfig{}
	m.applyWeatherToConfig(&cfg)
	if cfg.WeatherAt == nil {
		t.Fatal("expected WeatherAt callback for positional column")
	}
	if m := cfg.WeatherAt(800); m.AyMult == 1 && m.AxMult == 1 && m.AxAdd == 0 && m.AyAdd == 0 {
		t.Fatal("WeatherAt(800) should report sun effects")
	}
	// Global weather (thor) -> no callback.
	m.Weather.Active = []ActiveWeather{{Type: WeatherThor, X: 0, Width: 0}}
	cfg2 := physics.ProjectileConfig{}
	m.applyWeatherToConfig(&cfg2)
	if cfg2.WeatherAt != nil {
		t.Fatal("global weather must not enable per-step integration")
	}
}

func TestMatchInitializesWeather(t *testing.T) {
	m := newTwoPlayerMatch(t)
	if m.Weather == nil {
		t.Fatal("Match.Weather must be initialized")
	}
	if len(m.Weather.Active) == 0 {
		t.Fatal("weather state must carry at least one active anchor")
	}
}
