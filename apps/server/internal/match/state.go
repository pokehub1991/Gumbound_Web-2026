package match

import (
	"gumbound-web/server/internal/physics"
)

type MatchState string

const (
	StateWaitingForPlayers MatchState = "waiting"
	StateInProgress        MatchState = "in_progress"
	StateFinished          MatchState = "finished"
)

// DeathCause distinguishes the canonical death tracks (§4.1 / §4.2).
// A bunge kill pays the bunge bonus track, not the plain kill track.
type DeathCause string

const (
	DeathNone    DeathCause = ""
	DeathDamage  DeathCause = "damage" // HP driven to 0 by splash / direct hit
	DeathBunge   DeathCause = "bunge"  // fall_and_fie: ground dug out from under the mobile
)

type MatchPlayer struct {
	ID       string        `json:"id"`
	Nickname string        `json:"nickname"`
	MobileID int           `json:"mobile_id"`
	Team     string        `json:"team"`
	HP       int           `json:"hp"`
	MaxHP    int           `json:"max_hp"`
	Shield   int           `json:"shield"`
	MaxShield int          `json:"max_shield"`
	Pos      physics.Vec2  `json:"pos"`
	Delay    int           `json:"delay"`
	Gold     int           `json:"gold"`
	GP       int           `json:"gp"`
	Alive    bool          `json:"alive"`
	// DeathCause records how this player died, so the reward path can pick the
	// bunge bonus track vs the plain kill track. Empty while alive.
	DeathCause DeathCause `json:"death_cause,omitempty"`
	// Avatar is the server-validated stat bundle (§7.2). Zero value = no avatar.
	Avatar AvatarStats `json:"avatar"`

	// Item economy (§4.6). Inventory maps item ID -> remaining count.
	Inventory       map[ItemID]int `json:"inventory"`
	ItemUsedThisTurn bool          `json:"-"`
	// PendingShotItem is a Dual/Dual+ queued for the next HandleFireShot.
	PendingShotItem ItemID `json:"-"`
	// NextShotPowerMultiplier / NextShotDamageMultiplier are consumed by the next shot.
	NextShotPowerMultiplier   float64 `json:"-"`
	NextShotDamageMultiplier  float64 `json:"-"`
	// NextShotBungeBonus adds extra crater radius px on the next shot.
	NextShotBungeBonus int `json:"-"`
}

