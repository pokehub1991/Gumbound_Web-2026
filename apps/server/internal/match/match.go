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
	Weather     *WeatherState           `json:"weather"`
	SuddenDeath SuddenDeathConfig       `json:"sudden_death"`
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

	// Authoritative starting loadout and gold (§4.6).
	seedLoadout(players)

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

	m.Weather = newWeatherState(rng, terrain.Width)
	m.SuddenDeath = newSuddenDeath()
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

// Reward tracks from AUDIT_REPORT.md §4 / IMPLEMENTATION_PLAN_2026.md §4.3.
// Kept as named constants so the decomp values are never hand-typed twice.
const (
	rewardKill       = 2300 // gold, +2 GP (plain damage kill)
	rewardGoodShot   = 50   // gold, shield broken this hit
	rewardExcellent  = 100  // gold, full direct hit with no penalty
	rewardLose       = 250  // gold, -3 GP on defeat
	penaltyFriendly  = 250  // gold, -1 GP on same-team damage
	penaltyBungeSelf = 250  // gold, -2 GP on self-bunge
	gpKill           = 2
	gpLose           = -3
	gpFriendly       = -1
	gpBungeSelf      = -2
)

// applyDamage implements the canonical DragonBound shield-first damage path.
// Same-team hits still deal damage but carry a gold/GP penalty.
func (m *Match) applyDamage(victim, shooter *MatchPlayer, dmg int) {
	if victim == nil || !victim.Alive || dmg <= 0 {
		return
	}

	remaining := dmg
	hadShield := victim.Shield > 0
	if victim.Shield > 0 {
		if remaining < victim.Shield {
			victim.Shield -= remaining
			remaining = 0
		} else {
			remaining -= victim.Shield
			victim.Shield = 0
		}
	}
	victim.HP -= remaining

	friendly := shooter != nil && shooter.Team == victim.Team
	if friendly {
		shooter.Gold -= penaltyFriendly
		shooter.GP -= 1
	} else if shooter != nil && hadShield && victim.Shield == 0 {
		// Good shot: this blast broke the victim's shield (§4.3).
		// Excellent shot (100) needs the direct-hit flag carried on the result,
		// which applyDamage does not receive — deferred, do not guess the band.
		shooter.Gold += rewardGoodShot
	}

	if victim.HP <= 0 {
		if len(m.Players) <= 1 {
			// Solo practice: keep player alive infinitely.
			victim.HP = victim.MaxHP
			victim.Alive = true
		} else {
			victim.HP = 0
			victim.Alive = false
			victim.DeathCause = DeathDamage
			if shooter != nil && shooter.Team != victim.Team {
				shooter.Gold += rewardKill
				shooter.GP += gpKill
			}
			victim.Gold -= rewardLose
			victim.GP += gpLose
		}
	}
}

func (m *Match) ActivePlayer() *MatchPlayer {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.Players[m.ActiveID]
}

// shooterPos returns the shooter's position for self-arm gating, or nil when
// the shooter is unknown/absent (disables self-arm for that radial blast).
func (m *Match) shooterPos(id string) *physics.Vec2 {
	if id == "" {
		return nil
	}
	if p, ok := m.Players[id]; ok {
		pos := p.Pos
		return &pos
	}
	return nil
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

	if shotType < 0 || shotType > 2 {
		return nil, fmt.Errorf("%w: shot_type out of range", ErrInvalidShot)
	}
	if err := m.ValidateSuddenDeathShot(shotType); err != nil {
		return nil, fmt.Errorf("%w: forbidden by sudden death variant %s", err, m.SuddenDeath.Kind)
	}

	activePlayer := m.Players[playerID]
	stats := GetMobileStats(activePlayer.MobileID)

	// Reject out-of-range aim. Client-side clamp is not trusted.
	if angle < stats.MinAngle || angle > stats.MaxAngle {
		return nil, fmt.Errorf("%w: angle %.2f outside mobile range [%.2f, %.2f]",
			ErrInvalidShot, angle, stats.MinAngle, stats.MaxAngle)
	}

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

	baseDamage := BaseDamage(stats, activePlayer.Avatar, shotType)
	baseDamage = m.ApplySuddenDeathDamage(baseDamage)
	// Power Up / Blood modifiers are one-shot; consume them here.
	if activePlayer.NextShotDamageMultiplier > 0 {
		baseDamage = int(float64(baseDamage) * activePlayer.NextShotDamageMultiplier)
		activePlayer.NextShotDamageMultiplier = 0
	}
	if activePlayer.NextShotPowerMultiplier > 0 {
		power = math.Min(100, power*activePlayer.NextShotPowerMultiplier)
		activePlayer.NextShotPowerMultiplier = 0
	}
	// Bunge bonus is consumed when building projectile config below.
	bungeBonus := activePlayer.NextShotBungeBonus
	activePlayer.NextShotBungeBonus = 0

	var result physics.ProjectileResult

	numProjectiles := projectileCountFor(activePlayer.MobileID, shotType)

	if numProjectiles > 1 {
		subShots := make([]physics.ProjectileResult, 0, numProjectiles)
		accumulatedDamages := make(map[string]int)

		for i := 0; i < numProjectiles; i++ {
			var angleOffset, powerMult float64
			var blastRadiusMult float64 = 0.70

			if activePlayer.MobileID == MobileBigFoot {
				if shotType == 0 {
					// Bigfoot Shot 1: Salvo of 4 rockets
					angleOffset = (float64(i) - 1.5) * 0.40
					powerMult = 1.0 - float64(i)*0.012
					blastRadiusMult = 0.70
				} else if shotType == 1 {
					// Bigfoot Shot 2: Triple missile shotgun (3 rockets)
					angleOffset = (float64(i) - 1.0) * 0.75
					powerMult = 1.0 + (float64(i)-1.0)*0.010
					blastRadiusMult = 0.80
				} else {
					// Bigfoot SS: 8-missile concentrated barrage (DragonBound).
					angleOffset = (float64(i) - 3.5) * 0.44
					powerMult = 1.0 + (float64(i)-3.5)*0.010
					blastRadiusMult = 0.65
				}
			} else if activePlayer.MobileID == MobileBoomer {
				// Boomer Shot 2: 4 curving boomerangs (DragonBound).
				angleOffset = (float64(i) - 1.5) * 1.0
				powerMult = 1.0 + (float64(i)-1.5)*0.015
				blastRadiusMult = 0.75
			} else if activePlayer.MobileID == MobileKalsiddon {
				// Kalsiddon MIRV: 2/4/6 bomblets with a 2° stagger.
				count := float64(numProjectiles)
				angleOffset = (float64(i) - (count-1)/2) * 2.0
				powerMult = 1.0 + float64(i%2)*0.008
				blastRadiusMult = 0.60
			} else if activePlayer.MobileID == MobileTrico {
				// Trico Shot 2: 3 cabbages revolving in flight
				angleOffset = (float64(i) - 1.0) * 1.25
				powerMult = 1.0 + (float64(i)-1.0)*0.015
				blastRadiusMult = 0.85
			} else if activePlayer.MobileID == MobileRaon {
				// Raon Shot 2: 2 walking mine capsules
				angleOffset = (float64(i) - 0.5) * 0.75
				powerMult = 1.0 + (float64(i)-0.5)*0.025
				blastRadiusMult = 0.85
			} else if activePlayer.MobileID == MobileGrub {
				// Grub Shot 2: two rolling balls with slight vertical stagger.
				angleOffset = (float64(i) - 0.5) * 1.20
				powerMult = 1.0 + (float64(i)-0.5)*0.030
				blastRadiusMult = 0.75
			} else if activePlayer.MobileID == MobileAduka {
				// Aduka Shot 2: three Thor-tracking projectiles.
				angleOffset = (float64(i) - 1.0) * 1.10
				powerMult = 1.0 + (float64(i)-1.0)*0.020
				blastRadiusMult = 0.70
			}

			subCfg := physics.ProjectileConfig{
				Origin:       activePlayer.Pos,
				AngleDeg:     angle + angleOffset,
				Power:        power * powerMult,
				Wind:         m.Wind.Vector,
				WindPower:    m.Wind.Magnitude,
				WindAngleDeg: m.Wind.AngleDeg,
				By:           stats.By,
				Bx:           stats.Bx,
				Ax:           stats.Ax,
				Ay:           stats.Ay,
				BaseDamage:   baseDamage / numProjectiles,
				BlastRadius:  stats.BlastRadiusForShot(shotType) * blastRadiusMult,
				Facing:       f,
			}
			m.applyWeatherToConfig(&subCfg)

			// For Raon walking mines, disable instant crater during flight so terrain is carved at final walk position
			if activePlayer.MobileID == MobileRaon && shotType >= 1 {
				subCfg.BlastRadius = 0
			}

			subRes := physics.SimulateProjectileAdv(subCfg, m.Terrain, targets)

			// Execute ground-walking AI logic for Raon mines
			if activePlayer.MobileID == MobileRaon && shotType >= 1 {
				subCfg.BlastRadius = stats.BlastRadiusForShot(shotType) * blastRadiusMult
				m.simulateRaonWalkingMine(&subRes, subCfg, targets, playerID, 260.0, 130.0)
			}
			if activePlayer.MobileID == MobileGrub && shotType == 1 {
				m.applyGrubBounce(subCfg, &subRes, targets)
			}
			if activePlayer.MobileID == MobileAduka && shotType == 1 {
				m.applyAdukaThor(&subRes, targets, stats.Shot2Damage/numProjectiles/2)
			}

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
			Origin:       activePlayer.Pos,
			AngleDeg:     angle,
			Power:        power,
			Wind:         m.Wind.Vector,
			WindPower:    m.Wind.Magnitude,
			WindAngleDeg: m.Wind.AngleDeg,
			By:           stats.By,
			Bx:           stats.Bx,
			Ax:           stats.Ax,
			Ay:           stats.Ay,
		BaseDamage:   baseDamage,
		BlastRadius:  stats.BlastRadiusForShot(shotType) + float64(bungeBonus),
		Facing:       f,
	}
	m.applyWeatherToConfig(&cfg)

		if activePlayer.MobileID == MobileRaon && shotType == 2 {
			cfg.BlastRadius = 0
		}

		result = physics.SimulateProjectileAdv(cfg, m.Terrain, targets)

		if activePlayer.MobileID == MobileRaon && shotType == 2 {
			cfg.BlastRadius = stats.BlastRadiusForShot(2)
			m.simulateRaonWalkingMine(&result, cfg, targets, playerID, 320.0, 160.0)
		}

		// §4.9 Single-shot mobile behaviors.
		switch activePlayer.MobileID {
		case MobileNak:
			if shotType == 1 {
				m.applyNakBurrow(cfg, &result, targets, f)
			}
		case MobileGrub:
			if shotType == 1 {
				m.applyGrubBounce(cfg, &result, targets)
			}
		case MobileAduka:
			// Aduka S2 uses three tracker shots (handled in the multi-shot path).
			// Other shots also call Thor when the satellite weather is active.
			if shotType != 1 {
				m.applyAdukaThor(&result, targets, stats.SSDamage/2)
			}
		}
	}
	result.ShooterID = playerID
	result.MobileType = activePlayer.MobileID
	result.ShotType = shotType

	// §4.9 JD movex dash after landing.
	m.applyJDMovex(activePlayer, &result)

	// Armor S2 double detonation (DetonateShot2_Bullet2): the shell runs two
	// detonation passes at the same impact point — an immediate primary blast
	// plus a delayed secondary blast. Damage is already settled on the primary
	// pass (applyDamage below), so the sub-shot carries a zeroed damage map and
	// only signals the client to render the second visual + carve the terrain.
	if stats.DoubleBlast && shotType == 1 {
		second := result
		second.TerrainDelta = &physics.TerrainDelta{
			X:       int(result.ImpactPos.X),
			Y:       int(result.ImpactPos.Y),
			Radius:  int(stats.Shot2BlastRadius),
			RadiusY: int(math.Round(stats.Shot2BlastRadius * 0.85)),
		}
		m.Terrain.ClearEllipse(second.TerrainDelta.X, second.TerrainDelta.Y, second.TerrainDelta.Radius, second.TerrainDelta.RadiusY)
		for victimID := range second.Damages {
			second.Damages[victimID] = stats.Shot2Damage / 2
		}
		result.SubShots = append(result.SubShots, second)
	}

	// Apply damages through shield-first authoritative path.
	for victimID, dmg := range result.Damages {
		if victim, exists := m.Players[victimID]; exists {
			m.applyDamage(victim, m.Players[playerID], dmg)
		}
	}
	// Apply the second blast's damage too.
	for _, sub := range result.SubShots {
		for victimID, dmg := range sub.Damages {
			if victim, exists := m.Players[victimID]; exists {
				m.applyDamage(victim, m.Players[playerID], dmg)
			}
		}
	}

	// §4.3 Excellent shot (100 gold): a direct hit on an enemy mobile with no
	// friendly-fire penalty. Splash-only hits never pay it.
	if result.HitType == physics.HitMobile {
		for victimID := range result.Damages {
			if victim, exists := m.Players[victimID]; exists && victim.Team != activePlayer.Team {
				activePlayer.Gold += rewardExcellent
				break
			}
		}
	}

	// §4.2 fall_and_fie: after the crater(s) are carved, any mobile whose feet
	// no longer have ground underneath falls out of the map. This is the
	// distinct bunge kill — it pays the bunge bonus track (2300/+2) instead of
	// the plain kill track, and the victim keeps its HP (they died by falling,
	// not by damage). Checked after ALL blasts so the double-blast shaft counts.
	m.applyBungeFalls(playerID)

	// Calculate and add delay using canonical economy (§4.5).
	// A queued Dual/Dual+ reduces the delay factor for this paired shot.
	delayFactor := nextShotDelayFactor(activePlayer)
	m.TurnMgr.AddDelay(playerID, AddedDelay(stats, activePlayer.Avatar, shotType, delayFactor))

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
		m.resetTurnItemFlags(next)
		m.Weather.advance(m.rng, m.Terrain.Width)
	} else if len(m.Players) <= 1 {
		for _, p := range m.Players {
			p.Alive = true
			m.ActiveID = p.ID
			m.TurnNumber++
			m.RandomizeWind()
			m.resetTurnItemFlags(p)
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

	// Reject free teleport: the client can no longer dictate Y arbitrarily.
	// The authoritative standing surface is the terrain; a mobile may only
	// sit within a small tolerance of it.
	groundY := m.Terrain.FindGroundY(int(x), 50)
	if math.Abs(y-float64(groundY-15)) > 60 {
		return fmt.Errorf("%w: y %.2f is more than 60px from terrain surface %.2f", ErrInvalidShot, y, float64(groundY-15))
	}

	// Cap horizontal travel per movement packet. Prevents speed/macro cheats.
	const maxMoveDelta = 180.0
	if math.Abs(x-p.Pos.X) > maxMoveDelta {
		return fmt.Errorf("%w: move delta %.2f exceeds %.2f", ErrInvalidShot, math.Abs(x-p.Pos.X), maxMoveDelta)
	}

	if x < 40 {
		x = 40
	} else if x > 2360 {
		x = 2360
	}

	// Snap Y to terrain surface. Client Y is advisory only.
	p.Pos.X = x
	p.Pos.Y = float64(groundY - 15)
	return nil
}

// applyBungeFalls implements fall_and_fie (§4.2): after a crater is carved,
// a mobile whose footprint has no solid ground beneath it falls out of the
// map. HP is left intact — the death cause is the fall, not damage. The
// shooter collects the bunge bonus track (2300 gold / +2 GP), mirroring the
// plain kill payout but tagged separately for HUD/statistics.
func (m *Match) applyBungeFalls(shooterID string) {
	shooter := m.Players[shooterID]
	for _, victim := range m.Players {
		if victim == nil || !victim.Alive {
			continue
		}
		footX := int(victim.Pos.X)
		if footX < 0 || footX >= m.Terrain.Width {
			continue // already off-map: handled by the movement validator
		}
		if m.Terrain.FindGroundY(footX, 0) < m.Terrain.Height {
			continue // ground still under the mobile
		}
		victim.Alive = false
		victim.HP = 0
		victim.DeathCause = DeathBunge
		if shooter != nil && shooter.Team != victim.Team {
			shooter.Gold += 2300
			shooter.GP += 2
		}
	}
}

// simulateRaonWalkingMine implements authentic GunBound walking mine AI
func (m *Match) simulateRaonWalkingMine(	res *physics.ProjectileResult,
	cfg physics.ProjectileConfig,
	targets []physics.MobileTarget,
	shooterID string,
	detectionRange float64,
	maxWalk float64,
) {
	if res.HitType != physics.HitTerrain {
		return
	}

	// Seek closest enemy target within detection radius
	var targetEnemy *physics.MobileTarget
	minDist := 999999.0
	for _, tgt := range targets {
		if len(targets) > 1 && tgt.ID == shooterID {
			continue // Don't target friendly/self when opponents exist
		}
		dx := tgt.Pos.X - res.ImpactPos.X
		dy := tgt.Pos.Y - res.ImpactPos.Y
		d := math.Hypot(dx, dy)
		if d <= detectionRange && d < minDist {
			minDist = d
			t := tgt
			targetEnemy = &t
		}
	}

	if targetEnemy == nil {
		// Enemy too far -> detonate on terrain at landing spot with small crater
		res.TerrainDelta = &physics.TerrainDelta{
			X:      int(res.ImpactPos.X),
			Y:      int(res.ImpactPos.Y),
			Radius: int(cfg.BlastRadius * 0.7),
		}
		m.Terrain.ClearCircle(res.TerrainDelta.X, res.TerrainDelta.Y, res.TerrainDelta.Radius)
		res.Damages = physics.CalculateRadialDamage(res.ImpactPos, targets, cfg.BaseDamage/2, cfg.BlastRadius, m.shooterPos(shooterID))
		return
	}

	// Determine crawl direction along terrain slope towards enemy
	walkDir := 1.0
	if targetEnemy.Pos.X < res.ImpactPos.X {
		walkDir = -1.0
	}

	currX := res.ImpactPos.X
	stepSize := 3.0
	steps := int(maxWalk / stepSize)

	for s := 0; s < steps; s++ {
		currX += walkDir * stepSize
		if currX < 15 || currX > float64(m.Terrain.Width-15) {
			break
		}
		groundY := float64(m.Terrain.FindGroundY(int(currX), 0))
		if groundY >= float64(m.Terrain.Height) {
			break
		}
		res.Trajectory = append(res.Trajectory, physics.Vec2{X: currX, Y: groundY})

		// Detonate when colliding with target mobile
		if math.Abs(currX-targetEnemy.Pos.X) < 18.0 {
			break
		}
	}

	// Final destination where mine detonates
	finalPos := res.Trajectory[len(res.Trajectory)-1]
	res.ImpactPos = finalPos
	res.TerrainDelta = &physics.TerrainDelta{
		X:      int(finalPos.X),
		Y:      int(finalPos.Y),
		Radius: int(cfg.BlastRadius),
	}
	m.Terrain.ClearCircle(res.TerrainDelta.X, res.TerrainDelta.Y, res.TerrainDelta.Radius)
	res.Damages = physics.CalculateRadialDamage(res.ImpactPos, targets, cfg.BaseDamage, cfg.BlastRadius*1.5, nil)
}



