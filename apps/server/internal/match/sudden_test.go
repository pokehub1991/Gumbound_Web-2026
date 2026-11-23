package match

import "testing"

func TestSuddenDeathActivation(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.SetSuddenDeath(SuddenDeathGeneric, 3)
	m.TurnNumber = 2
	if msg := m.CheckSuddenDeathActivation(); msg != "" {
		t.Fatalf("premature announcement: %q", msg)
	}
	m.TurnNumber = 3
	msg := m.CheckSuddenDeathActivation()
	if msg == "" {
		t.Fatal("expected activation announcement at start turn")
	}
	if !m.SuddenDeath.Active {
		t.Fatal("Sudden Death should be active")
	}
	// No duplicate activation announcement.
	if msg2 := m.CheckSuddenDeathActivation(); msg2 != "" {
		t.Fatalf("duplicate activation: %q", msg2)
	}
}

func TestSuddenDeathCountdownAnnouncements(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.SetSuddenDeath(SuddenDeathGeneric, 40)
	m.SuddenDeath.Active = true
	cases := []struct {
		turn int
		want string
	}{
		{20, "SUDDEN DEATH EN 20 TURNOS"},
		{30, "SUDDEN DEATH EN 10 TURNOS"},
		{35, "SUDDEN DEATH EN 5 TURNOS"},
	}
	for _, c := range cases {
		m.TurnNumber = c.turn
		if got := m.CheckSuddenDeathActivation(); got != c.want {
			t.Fatalf("turn %d announcement = %q, want %q", c.turn, got, c.want)
		}
	}
}

func TestSuddenDeathDamageMultipliers(t *testing.T) {
	m := newTwoPlayerMatch(t)
	base := 100
	if got := m.ApplySuddenDeathDamage(base); got != base {
		t.Fatalf("inactive multiplier = %d, want %d", got, base)
	}
	cases := []struct {
		kind SuddenDeathKind
		want int
	}{
		{SuddenDeathGeneric, 200},
		{SuddenDeathDouble, 200},
		{SuddenDeathSS, 100},
		{SuddenDeathBigbomb, 500},
	}
	for _, c := range cases {
		m.SetSuddenDeath(c.kind, 1)
		m.SuddenDeath.Active = true
		if got := m.ApplySuddenDeathDamage(base); got != c.want {
			t.Fatalf("%s damage = %d, want %d", c.kind, got, c.want)
		}
	}
}

func TestSuddenDeathShotRestrictions(t *testing.T) {
	m := newTwoPlayerMatch(t)
	m.SetSuddenDeath(SuddenDeathSS, 1)
	m.SuddenDeath.Active = true
	if err := m.ValidateSuddenDeathShot(0); err == nil {
		t.Fatal("SS-only variant must reject shot 1")
	}
	if err := m.ValidateSuddenDeathShot(2); err != nil {
		t.Fatalf("SS-only variant must accept SS: %v", err)
	}
	m.SetSuddenDeath(SuddenDeathDouble, 1)
	m.SuddenDeath.Active = true
	if err := m.ValidateSuddenDeathShot(2); err == nil {
		t.Fatal("Double variant must reject SS")
	}
	if err := m.ValidateSuddenDeathShot(1); err != nil {
		t.Fatalf("Double variant must accept shot 2: %v", err)
	}
}

func TestSuddenDeathDisabled(t *testing.T) {
	m := newTwoPlayerMatch(t)
	if got := m.suddenDeathTurnsRemaining(); got != -1 {
		t.Fatalf("disabled remaining = %d, want -1", got)
	}
	if msg := m.CheckSuddenDeathActivation(); msg != "" {
		t.Fatalf("disabled variant must not announce: %q", msg)
	}
}

func TestItoa(t *testing.T) {
	if got := itoa(20); got != "20" {
		t.Fatalf("itoa(20) = %q", got)
	}
	if got := itoa(0); got != "0" {
		t.Fatalf("itoa(0) = %q", got)
	}
}
