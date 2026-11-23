package match

// SuddenDeathKind enumerates the room-selectable variants (plan §4.8).
type SuddenDeathKind string

const (
	SuddenDeathNone    SuddenDeathKind = ""
	SuddenDeathGeneric SuddenDeathKind = "generic" // base damage doubles
	SuddenDeathDouble  SuddenDeathKind = "double"  // only shot 1/2 allowed, damage x2
	SuddenDeathSS      SuddenDeathKind = "ss"      // only SS allowed
	SuddenDeathBigbomb SuddenDeathKind = "bigbomb" // 5x damage, SS only
)

// SuddenDeathConfig holds the room's Sudden Death settings.
type SuddenDeathConfig struct {
	Kind     SuddenDeathKind `json:"kind"`
	StartTurn int           `json:"start_turn"`
	Active   bool          `json:"active"`
}

// suddenDeathChatThresholds are the turns remaining at which the server
// broadcasts a countdown chat announcement (§4.8).
var suddenDeathChatThresholds = []int{20, 10, 5, 0}

// newSuddenDeath creates a disabled config; enable via SetSuddenDeath.
func newSuddenDeath() SuddenDeathConfig {
	return SuddenDeathConfig{Kind: SuddenDeathNone, StartTurn: 40}
}

// SetSuddenDeath configures the room's variant and starting turn.
// Called at match creation from RoomConfig (§6.2).
func (m *Match) SetSuddenDeath(kind SuddenDeathKind, startTurn int) {
	if kind == SuddenDeathNone {
		m.SuddenDeath = SuddenDeathConfig{Kind: SuddenDeathNone, StartTurn: 0}
		return
	}
	if startTurn < 1 {
		startTurn = 40
	}
	m.SuddenDeath = SuddenDeathConfig{
		Kind:      kind,
		StartTurn: startTurn,
		Active:    false,
	}
}

// suddenDeathTurnsRemaining returns turns left before Sudden Death engages.
// Returns 0 when already active, -1 when disabled.
func (m *Match) suddenDeathTurnsRemaining() int {
	if m.SuddenDeath.Kind == SuddenDeathNone {
		return -1
	}
	left := m.SuddenDeath.StartTurn - m.TurnNumber
	if left < 0 {
		return 0
	}
	return left
}

// CheckSuddenDeathActivation is called on turn advance. It flips the Active
// flag and returns the chat announcement to send (empty string = none).
func (m *Match) CheckSuddenDeathActivation() string {
	if m.SuddenDeath.Kind == SuddenDeathNone {
		return ""
	}
	if !m.SuddenDeath.Active && m.TurnNumber >= m.SuddenDeath.StartTurn {
		m.SuddenDeath.Active = true
		return "SUDDEN DEATH ACTIVADO"
	}
	for _, threshold := range suddenDeathChatThresholds {
		if m.suddenDeathTurnsRemaining() == threshold && threshold != 0 {
			return "SUDDEN DEATH EN " + itoa(threshold) + " TURNOS"
		}
	}
	return ""
}

// ApplySuddenDeathDamage returns the outgoing damage multiplier for a shot.
func (m *Match) ApplySuddenDeathDamage(baseDamage int) int {
	if !m.SuddenDeath.Active {
		return baseDamage
	}
	switch m.SuddenDeath.Kind {
	case SuddenDeathGeneric:
		return baseDamage * 2
	case SuddenDeathDouble:
		return baseDamage * 2
	case SuddenDeathBigbomb:
		return baseDamage * 5
	case SuddenDeathSS:
		return baseDamage
	default:
		return baseDamage
	}
}

// ValidateSuddenDeathShot returns an error when a shot type is forbidden by
// the active Sudden Death variant.
func (m *Match) ValidateSuddenDeathShot(shotType int) error {
	if !m.SuddenDeath.Active {
		return nil
	}
	switch m.SuddenDeath.Kind {
	case SuddenDeathSS, SuddenDeathBigbomb:
		if shotType != 2 {
			return ErrInvalidShot
		}
	case SuddenDeathDouble:
		if shotType != 0 && shotType != 1 {
			return ErrInvalidShot
		}
	}
	return nil
}

// itoa is a tiny helper avoiding strconv in hot paths.
func itoa(v int) string {
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	buf := [12]byte{}
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
