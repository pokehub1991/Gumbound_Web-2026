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

