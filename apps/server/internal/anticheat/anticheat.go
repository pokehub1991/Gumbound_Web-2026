// Package anticheat implements server-side heuristic detection of aimbot,
// macro, and protocol abuse. Detectors never crash the server: they flag and
// the caller decides (drop packet, log, or escalate).
package anticheat

import (
	"log"
	"math"
	"os"
	"strconv"
	"sync"
	"time"
)

// Violation is a single anticheat finding attached to a player.
type Violation struct {
	Kind    string
	Detail  string
	At      time.Time
	Account string
}

// Verdict is the outcome of inspecting an inbound combat intent.
type Verdict struct {
	OK        bool
	Flag      bool // logged for later review / ban pipeline
	Reject    bool // packet dropped; not forwarded to match logic
	Violation Violation
}

// Detector keeps per-account sliding state. Safe for concurrent use.
type Detector struct {
	mu      sync.Mutex
	players map[string]*playerState
	logger  *log.Logger
	cfg     Config
}

// Config holds tunable thresholds. Zero values use the defaults.
type Config struct {
	// MaxAnglePrecision is the max decimal places a humanly-entered angle can have.
	MaxAnglePrecision int
	// MaxPowerPrecision is the max decimal places for power.
	MaxPowerPrecision int
	// MaxAngleRateDegPerSec bounds how fast the aim can rotate between frames.
	MaxAngleRateDegPerSec float64
	// MinShotIntervalMs bounds how quickly two shots from the same player can land.
	MinShotIntervalMs int64
	// ChargeTimingEpsilonMs: if N consecutive shot intervals fall within this
	// window, the player is flagged for macro-like uniform charge timing.
	ChargeTimingEpsilonMs int64
	ChargeTimingSamples   int
	// ChatMaxChars is the hard server-side chat cap.
	ChatMaxChars int
}

func defaultConfig() Config {
	return Config{
		MaxAnglePrecision:     2,
		MaxPowerPrecision:     2,
		MaxAngleRateDegPerSec: 720.0,
		MinShotIntervalMs:     250,
		ChargeTimingEpsilonMs: 15,
		ChargeTimingSamples:   4,
		ChatMaxChars:          200,
	}
}

type playerState struct {
	lastShotAt    time.Time
	lastAngle     float64
	haveLastAngle bool
	// recentIntervals tracks the last N inter-shot gaps for macro detection.
	recentIntervals []int64
}

// New builds a Detector with defaults overridden by any non-zero cfg fields.
func New(cfg Config) *Detector {
	def := defaultConfig()
	if cfg.MaxAnglePrecision > 0 {
		def.MaxAnglePrecision = cfg.MaxAnglePrecision
	}
	if cfg.MaxPowerPrecision > 0 {
		def.MaxPowerPrecision = cfg.MaxPowerPrecision
	}
	if cfg.MaxAngleRateDegPerSec > 0 {
		def.MaxAngleRateDegPerSec = cfg.MaxAngleRateDegPerSec
	}
	if cfg.MinShotIntervalMs > 0 {
		def.MinShotIntervalMs = cfg.MinShotIntervalMs
	}
	if cfg.ChargeTimingEpsilonMs > 0 {
		def.ChargeTimingEpsilonMs = cfg.ChargeTimingEpsilonMs
	}
	if cfg.ChargeTimingSamples > 0 {
		def.ChargeTimingSamples = cfg.ChargeTimingSamples
	}
	if cfg.ChatMaxChars > 0 {
		def.ChatMaxChars = cfg.ChatMaxChars
	}
	logger := log.New(os.Stderr, "[anticheat] ", log.LstdFlags|log.LUTC)
	return &Detector{players: make(map[string]*playerState), logger: logger, cfg: def}
}

func allow() Verdict { return Verdict{OK: true} }

func reject(account, kind, detail string, now time.Time) Verdict {
	return Verdict{
		Reject:    true,
		Flag:      true,
		Violation: Violation{Kind: kind, Detail: detail, At: now, Account: account},
	}
}

func flag(account, kind, detail string, now time.Time) Verdict {
	return Verdict{
		OK:        true,
		Flag:      true,
		Violation: Violation{Kind: kind, Detail: detail, At: now, Account: account},
	}
}

func decimals(f float64) int {
	s := strconv.FormatFloat(f, 'f', -1, 64)
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return len(s) - i - 1
		}
	}
	return 0
}

// InspectShot validates a FireShot intent (angle, power, timing, turn).
func (d *Detector) InspectShot(account string, angle, power float64, now time.Time) Verdict {
	d.mu.Lock()
	defer d.mu.Unlock()

	p := d.players[account]
	if p == nil {
		p = &playerState{}
		d.players[account] = p
	}

	// 1. Impossible precision: a real input device cannot land on 27.31847°.
	if dec := decimals(angle); dec > d.cfg.MaxAnglePrecision {
		return reject(account, "impossible_precision",
			"angle "+strconv.FormatFloat(angle, 'f', -1, 64), now)
	}
	if dec := decimals(power); dec > d.cfg.MaxPowerPrecision {
		return reject(account, "impossible_precision",
			"power "+strconv.FormatFloat(power, 'f', -1, 64), now)
	}

	// 2. Instant angle snap between shots.
	if p.haveLastAngle && !p.lastShotAt.IsZero() {
		gap := now.Sub(p.lastShotAt)
		if gap > 0 {
			rate := math.Abs(angle-p.lastAngle) / gap.Seconds()
			if rate > d.cfg.MaxAngleRateDegPerSec {
				return reject(account, "angle_snap",
					"rate "+strconv.FormatFloat(rate, 'f', 1, 64)+" deg/s", now)
			}
		}
	}

	// 3. Macro timing: uniform charge intervals across the sample window.
	if !p.lastShotAt.IsZero() {
		gapMs := now.Sub(p.lastShotAt).Milliseconds()
		if gapMs < d.cfg.MinShotIntervalMs {
			return reject(account, "shot_rate",
				"interval "+strconv.FormatInt(gapMs, 10)+"ms", now)
		}
		p.recentIntervals = append(p.recentIntervals, gapMs)
		if len(p.recentIntervals) > d.cfg.ChargeTimingSamples {
			p.recentIntervals = p.recentIntervals[len(p.recentIntervals)-d.cfg.ChargeTimingSamples:]
		}
		if len(p.recentIntervals) == d.cfg.ChargeTimingSamples &&
			uniform(p.recentIntervals, d.cfg.ChargeTimingEpsilonMs) {
			p.recentIntervals = p.recentIntervals[:0]
			return flag(account, "macro_timing",
				"uniform intervals within "+strconv.FormatInt(d.cfg.ChargeTimingEpsilonMs, 10)+"ms", now)
		}
	}

	p.lastShotAt = now
	p.lastAngle = angle
	p.haveLastAngle = true
	return allow()
}

func uniform(intervals []int64, eps int64) bool {
	for i := 1; i < len(intervals); i++ {
		diff := intervals[i] - intervals[i-1]
		if diff < 0 {
			diff = -diff
		}
		if diff > eps {
			return false
		}
	}
	return true
}

// InspectOutOfTurn is called for any combat packet that arrives while the
// sender is not the active player. Logged and dropped.
func (d *Detector) InspectOutOfTurn(account, activeID string, now time.Time) Verdict {
	return reject(account, "out_of_turn",
		"active="+activeID, now)
}

// InspectChat enforces the server-side character cap.
func (d *Detector) InspectChat(account, text string, now time.Time) (string, Verdict) {
	if len([]rune(text)) > d.cfg.ChatMaxChars {
		return "", reject(account, "chat_too_long",
			strconv.Itoa(len([]rune(text)))+" runes", now)
	}
	return text, allow()
}

// Cleanup drops state for accounts no longer in a match. Best-effort.
func (d *Detector) Cleanup(accounts []string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	keep := make(map[string]struct{}, len(accounts))
	for _, a := range accounts {
		keep[a] = struct{}{}
	}
	for a := range d.players {
		if _, ok := keep[a]; !ok {
			delete(d.players, a)
		}
	}
}

// Config exposes the active thresholds (used by tests).
func (d *Detector) Config() Config { return d.cfg }
