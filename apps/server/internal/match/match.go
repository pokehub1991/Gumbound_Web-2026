package match

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"gumbound-web/server/internal/maps"
	"gumbound-web/server/internal/physics"
)

var (
	ErrNotYourTurn   = errors.New("not your turn")
	ErrMatchNotLive  = errors.New("match is not in progress")
	ErrInvalidShot   = errors.New("invalid shot parameters")
)

type Wind struct {
	AngleDeg  float64      `json:"angle_deg"`
	Magnitude float64      `json:"magnitude"`
	Vector    physics.Vec2 `json:"vector"`
}

type Match struct {
	ID          string                  `json:"id"`
	State       MatchState              `json:"state"`
	MapID       string                  `json:"map_id"`
	Players     map[string]*MatchPlayer `json:"players"`
	TurnMgr     *TurnManager            `json:"-"`
	Terrain     *physics.TerrainMask    `json:"-"`
	ActiveID    string                  `json:"active_id"`
	Wind        Wind                    `json:"wind"`
	TurnNumber  int                     `json:"turn_number"`
	WinnerTeam  string                  `json:"winner_team,omitempty"`
	mu          sync.RWMutex
	rng         *rand.Rand
}

func NewMatch(id string, players []*MatchPlayer, mapID string) *Match {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	terrain, _ := maps.GenerateMapTerrain(mapID)

	playerMap := make(map[string]*MatchPlayer)
	for i, p := range players {
		stats := GetMobileStats(p.MobileID)
		p.MaxHP = stats.MaxHP
		if p.HP <= 0 {
			p.HP = stats.MaxHP
		}
		p.Alive = true
		p.Delay = 0

		// Spread spawn positions across map, scanning downwards from sky
		spawnX := 300 + (i * 400)
		groundY := terrain.FindGroundY(spawnX, 50)
		p.Pos = physics.Vec2{X: float64(spawnX), Y: float64(groundY - 15)}
		playerMap[p.ID] = p
	}

	turnMgr := NewTurnManager(players)
	firstPlayer := turnMgr.NextPlayer()

	m := &Match{
		ID:         id,
		State:      StateInProgress,
		MapID:      mapID,
		Players:    playerMap,
		TurnMgr:    turnMgr,
		Terrain:    terrain,
		ActiveID:   firstPlayer.ID,
		TurnNumber: 1,
		rng:        rng,
	}

	m.RandomizeWind()
	return m
}

func (m *Match) RandomizeWind() {
	m.Wind.AngleDeg = float64(m.rng.Intn(360))
	m.Wind.Magnitude = float64(m.rng.Intn(25) + 1) // 1 to 25
	rad := m.Wind.AngleDeg * (math.Pi / 180.0)
	m.Wind.Vector = physics.Vec2{
		X: m.Wind.Magnitude * math.Cos(rad),
		Y: -m.Wind.Magnitude * math.Sin(rad), // -Y is up in screen coordinates
	}
}

func (m *Match) ActivePlayer() *MatchPlayer {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.Players[m.ActiveID]
}

func (m *Match) HandleFireShot(playerID string, angle, power float64, shotType int, facing ...int) (*physics.ProjectileResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.State != StateInProgress {
		return nil, ErrMatchNotLive
	}

	if m.ActiveID != playerID {
		return nil, fmt.Errorf("%w: active is %s, attempted by %s", ErrNotYourTurn, m.ActiveID, playerID)
	}

	if power < 0 || power > 100 {
		return nil, fmt.Errorf("%w: power out of range", ErrInvalidShot)
	}

	activePlayer := m.Players[playerID]
	stats := GetMobileStats(activePlayer.MobileID)

	// Collect mobile targets for collision
	targets := make([]physics.MobileTarget, 0, len(m.Players))
	for _, p := range m.Players {
		if p.Alive {
			targets = append(targets, physics.MobileTarget{
				ID:     p.ID,
				Pos:    p.Pos,
				Radius: 20.0,
			})
		}
	}

	f := 1
	if len(facing) > 0 && facing[0] < 0 {
		f = -1
	}

	baseDamage := stats.Shot1Damage
	if shotType == 1 {
		baseDamage = stats.Shot2Damage
	} else if shotType == 2 {
		baseDamage = stats.SSDamage
	}

	var result physics.ProjectileResult

	numProjectiles := 1
	if activePlayer.MobileID == MobileBigFoot && shotType == 0 {
		numProjectiles = 4
	} else if activePlayer.MobileID == MobileBoomer && shotType == 1 {
		numProjectiles = 10
	}

	if numProjectiles > 1 {
		subShots := make([]physics.ProjectileResult, 0, numProjectiles)
		accumulatedDamages := make(map[string]int)

		for i := 0; i < numProjectiles; i++ {
			var angleOffset, powerMult float64
			var blastRadiusMult float64 = 0.70

			if activePlayer.MobileID == MobileBigFoot {
				// Bigfoot Shot 1: Salvo of 4 rockets with slight angle & power spread
				angleOffset = (float64(i) - 1.5) * 0.40
				powerMult = 1.0 - float64(i)*0.012
			} else {
				// Boomer Shot 2: Barrage of 10 boomerangs curving with authentic aerodynamics
				angleOffset = (float64(i) - 4.5) * 0.50
				powerMult = 1.0 + (float64(i)-4.5)*0.008
				blastRadiusMult = 0.65
			}

			subCfg := physics.ProjectileConfig{
				Origin:      activePlayer.Pos,
				AngleDeg:    angle + angleOffset,
				Power:       power * powerMult,
				Wind:        m.Wind.Vector,
				Gravity:     stats.Gravity,
				WindFactor:  stats.WindFactor,
				BaseDamage:  baseDamage / numProjectiles,
				BlastRadius: stats.BlastRadius * blastRadiusMult,
				Facing:      f,
			}

			subRes := physics.SimulateProjectileAdv(subCfg, m.Terrain, targets)
			subRes.ShooterID = playerID
			subRes.MobileType = activePlayer.MobileID
			subRes.ShotType = shotType
			subShots = append(subShots, subRes)

			for vid, dmg := range subRes.Damages {
				accumulatedDamages[vid] += dmg
			}
		}

		result = subShots[0]
		result.Damages = accumulatedDamages
		result.SubShots = subShots
	} else {
		// Run authoritative physics simulation with authentic GunBound mobile ballistics
		cfg := physics.ProjectileConfig{
			Origin:      activePlayer.Pos,
			AngleDeg:    angle,
			Power:       power,
			Wind:        m.Wind.Vector,
			Gravity:     stats.Gravity,
			WindFactor:  stats.WindFactor,
			BaseDamage:  baseDamage,
			BlastRadius: stats.BlastRadius,
			Facing:      f,
		}
		result = physics.SimulateProjectileAdv(cfg, m.Terrain, targets)
	}
	result.ShooterID = playerID
	result.MobileType = activePlayer.MobileID
	result.ShotType = shotType

	// Apply damages
	for victimID, dmg := range result.Damages {
		if victim, exists := m.Players[victimID]; exists && victim.Alive {
			victim.HP -= dmg
			if victim.HP <= 0 {
				if len(m.Players) <= 1 {
					// In solo practice testing mode, keep player alive infinitely!
					victim.HP = stats.MaxHP
					victim.Alive = true
				} else {
					victim.HP = 0
					victim.Alive = false
				}
			}
		}
	}

	// Calculate and add delay
	shotDelay := stats.Shot1Delay
	if shotType == 1 {
		shotDelay = stats.Shot2Delay
	} else if shotType == 2 {
		shotDelay = stats.SSDelay
	}
	m.TurnMgr.AddDelay(playerID, stats.BaseDelay+shotDelay)

	// Check win condition
	if m.checkWinCondition() {
		m.State = StateFinished
		return &result, nil
	}

	// Advance turn to next alive player with lowest delay
	next := m.TurnMgr.NextPlayer()
	if next != nil {
		m.ActiveID = next.ID
		m.TurnNumber++
		m.RandomizeWind()
	} else if len(m.Players) <= 1 {
		for _, p := range m.Players {
			p.Alive = true
			m.ActiveID = p.ID
			m.TurnNumber++
			m.RandomizeWind()
			break
		}
	} else {
		m.State = StateFinished
	}

	return &result, nil
}

func (m *Match) checkWinCondition() bool {
	teamAAlive := false
	teamBAlive := false
	hasTeamB := false

	for _, p := range m.Players {
		if p.Team == "B" {
			hasTeamB = true
		}
		if p.Alive {
			if p.Team == "A" {
				teamAAlive = true
			} else {
				teamBAlive = true
			}
		}
	}

	// Solo / Practice mode: only 1 team or 1 player present
	if len(m.Players) <= 1 || !hasTeamB {
		if len(m.Players) <= 1 {
			return false // Never finish in solo test mode, allow infinite shots
		}
		if !teamAAlive {
			m.WinnerTeam = "FINISH"
			return true
		}
		return false
	}

	if !teamAAlive && teamBAlive {
		m.WinnerTeam = "B"
		return true
	}
	if !teamBAlive && teamAAlive {
		m.WinnerTeam = "A"
		return true
	}
	if !teamAAlive && !teamBAlive {
		m.WinnerTeam = "DRAW"
		return true
	}

	return false
}

func (m *Match) HandleMove(playerID string, x, y float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.State != StateInProgress {
		return ErrMatchNotLive
	}
	if m.ActiveID != playerID {
		return ErrNotYourTurn
	}

	p, ok := m.Players[playerID]
	if !ok || !p.Alive {
		return errors.New("player not active or dead")
	}

	if x < 40 {
		x = 40
	} else if x > 2360 {
		x = 2360
	}

	p.Pos.X = x
	p.Pos.Y = y
	return nil
}


