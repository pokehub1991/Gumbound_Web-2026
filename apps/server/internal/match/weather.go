package match

import (
	"math"
	"math/rand"

	"gumbound-web/server/internal/physics"
)

// WeatherType mirrors packages/shared/src/types.ts WeatherType.
type WeatherType string

const (
	WeatherThor      WeatherType = "thor"
	WeatherWind      WeatherType = "wind"
	WeatherNoItems   WeatherType = "no_items"
	WeatherSun       WeatherType = "sun"
	WeatherLightning WeatherType = "lightning"
	WeatherBlack     WeatherType = "black"
	WeatherRandom    WeatherType = "random"
	WeatherMirror    WeatherType = "mirror"
	WeatherTornado   WeatherType = "tornado"
)

// ActiveWeather is an authoritative positional weather anchor.
// x is world-space center, width is the affected band, power is strength.
type ActiveWeather struct {
	Type   WeatherType `json:"type"`
	X      float64     `json:"x"`
	Width  float64     `json:"width"`
	Power  float64     `json:"power"`
}

// WeatherState is the server-authoritative weather state for a match.
type WeatherState struct {
	Active       []ActiveWeather `json:"active"`
	NextPositions []WeatherAnchor `json:"next_positions"`
	TurnInRound  int             `json:"turn_in_round"`
	TurnsPerRound int            `json:"turns_per_round"`
}

// WeatherAnchor describes a future anchor position and its weather type.
type WeatherAnchor struct {
	X    float64     `json:"x"`
	Type WeatherType `json:"type"`
}

// weatherWidth returns the affected world-space width for a weather type.
func weatherWidth(t WeatherType) float64 {
	switch t {
	case WeatherTornado:
		return 68
	case WeatherSun:
		return 44
	case WeatherMirror:
		return 32
	case WeatherBlack, WeatherLightning, WeatherRandom:
		return 52
	default:
		return 0 // global weather has no positional anchor
	}
}

// weatherEffectStrength returns the canonical 0..100 strength for a type.
func weatherEffectStrength(t WeatherType) float64 {
	switch t {
	case WeatherSun, WeatherTornado:
		return 100
	case WeatherMirror:
		return 80
	case WeatherBlack, WeatherLightning:
		return 60
	default:
		return 0
	}
}

// weatherRollBag matches the weighted distribution in WeatherManager.ts.
var weatherRollBag = []WeatherType{
	WeatherThor, WeatherThor,
	WeatherWind, WeatherWind, WeatherWind,
	WeatherNoItems,
	WeatherSun, WeatherSun,
	WeatherLightning, WeatherLightning, WeatherLightning,
	WeatherBlack,
	WeatherMirror, WeatherMirror,
	WeatherTornado, WeatherTornado,
	WeatherRandom,
}

// rollWeather picks a deterministic type from the weighted bag.
func rollWeather(rng *rand.Rand) WeatherType {
	return weatherRollBag[rng.Intn(len(weatherRollBag))]
}

// newWeatherState creates initial weather anchors for a match.
func newWeatherState(rng *rand.Rand, mapWidth int) *WeatherState {
	ws := &WeatherState{TurnsPerRound: 5, TurnInRound: 1}
	ws.roll(rng, mapWidth)
	return ws
}

// roll advances the weather for a new turn. Positional anchors are re-placed
// within the map; global weather (Thor/Wind/NoItems) has no anchor.
func (ws *WeatherState) roll(rng *rand.Rand, mapWidth int) {
	t := rollWeather(rng)
	ws.Active = ws.Active[:0]
	w := weatherWidth(t)
	x := 0.0
	if w > 0 {
		// Keep anchor away from map edges.
		x = 120 + rng.Float64()*float64(mapWidth-240)
	}
	// Global weather (Thor/Wind/NoItems) is a zero-width anchor at x=0.
	ws.Active = append(ws.Active, ActiveWeather{
		Type: t, X: x, Width: w, Power: weatherEffectStrength(t),
	})

	// Precompute the next round of anchor positions (sync hint to client).
	ws.NextPositions = ws.NextPositions[:0]
	next := rollWeather(rng)
	if nextWidth := weatherWidth(next); nextWidth > 0 {
		ws.NextPositions = append(ws.NextPositions, WeatherAnchor{
			X: 120 + rng.Float64()*float64(mapWidth-240), Type: next,
		})
	}
}

// advance moves to the next turn in the weather round.
func (ws *WeatherState) advance(rng *rand.Rand, mapWidth int) {
	ws.TurnInRound++
	if ws.TurnInRound > ws.TurnsPerRound {
		ws.TurnInRound = 1
	}
	ws.roll(rng, mapWidth)
}

// weatherTypeAt returns the positional weather covering world coordinate x.
// Zero-width anchors are global and never match a position.
func (ws *WeatherState) weatherTypeAt(x float64) WeatherType {
	for _, a := range ws.Active {
		if a.Width > 0 && math.Abs(x-a.X) <= a.Width/2 {
			return a.Type
		}
	}
	return ""
}

// WeatherAccelModifiers returns per-axis multipliers for projectile
// accelerations at world coordinate x (plan §4.7).
//   - Tornado: strong vertical lift inside column
//   - Sun: reduced gravity ("energy"), stronger horizontal push
//   - Mirror: horizontal acceleration reversal near barrier
func (ws *WeatherState) WeatherAccelModifiers(x float64) (axMult, ayMult, axAdd, ayAdd float64) {
	axMult, ayMult = 1.0, 1.0
	t := ws.weatherTypeAt(x)
	switch t {
	case WeatherTornado:
		ayMult = 0.55 // lift inside vortex
		axAdd = 90
		ayAdd = -120
	case WeatherSun:
		ayMult = 0.75
		axMult = 1.20
	case WeatherMirror:
		axMult = -0.85 // reflect horizontal force
	case WeatherLightning:
		ayMult = 1.15
	case WeatherBlack:
		ayMult = 1.10
	}
	return
}

// WeatherGuardMultiplier returns the outgoing damage multiplier for a shooter
// inside a Guard/Weakness column (Aduka-style). 1.0 = no effect.
func (ws *WeatherState) WeatherGuardMultiplier(x float64) float64 {
	switch ws.weatherTypeAt(x) {
	case WeatherSun:
		return 1.20 // weakness: more damage dealt
	case WeatherBlack:
		return 0.80 // guard: less damage dealt
	default:
		return 1.0
	}
}

// applyWeatherToConfig attaches the positional weather callback to a projectile.
func (m *Match) applyWeatherToConfig(cfg *physics.ProjectileConfig) {
	if m.Weather == nil || len(m.Weather.Active) == 0 {
		return
	}
	// Only positional columns require step-by-step integration.
	hasColumn := false
	for _, a := range m.Weather.Active {
		if a.Width > 0 {
			hasColumn = true
			break
		}
	}
	if !hasColumn {
		return
	}
	weather := m.Weather
	cfg.WeatherAt = func(x float64) physics.AccelModifier {
		am, ay, axAdd, ayAdd := weather.WeatherAccelModifiers(x)
		return physics.AccelModifier{AxMult: am, AyMult: ay, AxAdd: axAdd, AyAdd: ayAdd}
	}
}

// IsThorActive reports whether Thor orbital strikes are active.
func (ws *WeatherState) IsThorActive() bool {
	for _, a := range ws.Active {
		if a.Type == WeatherThor {
			return true
		}
	}
	return false
}
