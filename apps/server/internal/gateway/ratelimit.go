package gateway

import (
	"sync"
	"time"
)

// limiter is a fixed-window token bucket enforcing a maximum number of
// messages per opcode per connection over a time window.
type limiter struct {
	mu       sync.Mutex
	window   time.Duration
	records  map[uint16]*bucket
}

type bucket struct {
	count   int
	resetAt time.Time
}

func newLimiter(window time.Duration) *limiter {
	return &limiter{window: window, records: make(map[uint16]*bucket)}
}

// allow returns true if this opcode is still within its per-window quota.
func (l *limiter) allow(opcode uint16, max int) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	b, ok := l.records[opcode]
	if !ok || now.After(b.resetAt) {
		l.records[opcode] = &bucket{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	if b.count >= max {
		return false
	}
	b.count++
	return true
}

// opcodeRateLimits is the default per-opcode token bucket. Any opcode not
// listed here is capped at the catch-all below.
var opcodeRateLimits = map[uint16]int{
	0x3002: 2,  // FIRE_SHOT — one per turn, small buffer
	0x3006: 20, // PLAYER_MOVE
	0x3007: 2,  // USE_ITEM — one per turn, small buffer
	0x2006: 5,  // CHAT_MSG
}

const defaultRateLimit = 60
