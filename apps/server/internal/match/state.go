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
	Pos      physics.Vec2  `json:"pos"`
	Delay    int           `json:"delay"`
	Alive    bool          `json:"alive"`
}
