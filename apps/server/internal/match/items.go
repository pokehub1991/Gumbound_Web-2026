package match

import (
	"errors"
	"fmt"
	"math"

	"gumbound-web/server/internal/physics"
)

// ItemID enumerates the 8 canonical GunBound items (plan §4.6).
// Values are mirrored 1:1 by packages/shared/src/types.ts ITEM_CATALOG.
type ItemID string

const (
	ItemDual         ItemID = "dual"
	ItemDualPlus     ItemID = "dual_plus"
	ItemTeleport     ItemID = "teleport"
	ItemWindChange   ItemID = "wind_change"
	ItemPowerUp      ItemID = "power_up"
	ItemBlood        ItemID = "blood"
	ItemBungeShot    ItemID = "bunge_shot"
	ItemTeamTeleport ItemID = "team_teleport"
)

// itemDef is the canonical cost / extra-delay table for an item.
type itemDef struct {
	cost       int
	extraDelay int
}

// itemCatalog holds server-authoritative cost and delay for every item.
var itemCatalog = map[ItemID]itemDef{
	ItemDual:         {cost: 200, extraDelay: 250},
	ItemDualPlus:     {cost: 300, extraDelay: 275},
	ItemTeleport:     {cost: 150, extraDelay: 200},
	ItemWindChange:   {cost: 100, extraDelay: 150},
	ItemPowerUp:      {cost: 150, extraDelay: 200},
	ItemBlood:        {cost: 150, extraDelay: 100},
	ItemBungeShot:    {cost: 200, extraDelay: 100},
	ItemTeamTeleport: {cost: 250, extraDelay: 250},
}

// itemDelayFactor maps items that alter the delay multiplier for the paired shot.
var itemDelayFactor = map[ItemID]float64{
	ItemDual:     12.5,
	ItemDualPlus: 11.0,
}

// ErrItemUse wraps all item-validation failures.
var ErrItemUse = errors.New("item use rejected")

// UseItem applies a player's item use authoritatively.
// Immediate-effect items (Teleport, Wind Change, Power Up, Blood, Bunge, Team Teleport)
// are applied here. Shot-coupled items (Dual, Dual+) are queued and consumed by the
// next HandleFireShot call.
func (m *Match) UseItem(playerID string, itemID ItemID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.State != StateInProgress {
		return fmt.Errorf("%w: match not live", ErrItemUse)
	}
	if m.ActiveID != playerID {
		return fmt.Errorf("%w: not your turn", ErrItemUse)
	}

	p, ok := m.Players[playerID]
	if !ok || !p.Alive {
		return fmt.Errorf("%w: player unavailable", ErrItemUse)
	}

	def, ok := itemCatalog[itemID]
	if !ok {
		return fmt.Errorf("%w: unknown item %q", ErrItemUse, itemID)
	}

	if p.ItemUsedThisTurn {
		return fmt.Errorf("%w: already used an item this turn", ErrItemUse)
	}

	// Canonical loadout: three sockets filled at match start.
	if _, owned := p.Inventory[itemID]; !owned || p.Inventory[itemID] <= 0 {
		return fmt.Errorf("%w: item %q not in inventory", ErrItemUse, itemID)
	}

	if p.Gold < def.cost {
		return fmt.Errorf("%w: not enough gold (have %d, need %d)", ErrItemUse, p.Gold, def.cost)
	}

	// Apply the effect. Any effect-specific validation happens inside the switch
	// before the shared bookkeeping below.
	switch itemID {
	case ItemDual, ItemDualPlus:
		p.PendingShotItem = itemID

	case ItemTeleport, ItemTeamTeleport:
		target, err := m.teleportTarget(p, itemID == ItemTeamTeleport)
		if err != nil {
			return err
		}
		p.Pos = target

	case ItemWindChange:
		m.RandomizeWind()

	case ItemPowerUp:
		p.NextShotPowerMultiplier = 1.20

	case ItemBlood:
		// +30% max HP healed, but the player's outgoing damage is reduced 20% this turn.
		heal := int(math.Round(float64(p.MaxHP) * 0.30))
		p.HP += heal
		if p.HP > p.MaxHP {
			p.HP = p.MaxHP
		}
		p.NextShotDamageMultiplier = 0.80

	case ItemBungeShot:
		p.NextShotBungeBonus = 20 // extra crater radius px

	default:
		return fmt.Errorf("%w: unsupported item %q", ErrItemUse, itemID)
	}

	// Consume one from inventory, deduct gold, apply delay and mark the turn flag.
	p.Inventory[itemID]--
	if p.Inventory[itemID] <= 0 {
		delete(p.Inventory, itemID)
	}
	p.Gold -= def.cost
	p.ItemUsedThisTurn = true

	// Delay economy: shot-coupled items defer the avatar reduction to the
	// paired shot (HandleFireShot applies the 12.5 / 11.0 factor there).
	// Immediate items add their flat surcharge now.
	if _, coupled := itemDelayFactor[itemID]; !coupled {
		m.TurnMgr.AddDelay(playerID, def.extraDelay)
	}

	return nil
}

// teleportTarget resolves a destination for Teleport / Team Teleport.
// Teleport drops the player near the last recorded impact point.
// Team Teleport drops the player adjacent to the closest alive ally.
func (m *Match) teleportTarget(p *MatchPlayer, toAlly bool) (physics.Vec2, error) {
	if toAlly {
		var best *MatchPlayer
		bestDist := math.MaxFloat64
		for _, other := range m.Players {
			if other.ID == p.ID || !other.Alive || other.Team != p.Team {
				continue
			}
			dx := other.Pos.X - p.Pos.X
			dy := other.Pos.Y - p.Pos.Y
			d := math.Sqrt(dx*dx + dy*dy)
			if d < bestDist {
				bestDist = d
				best = other
			}
		}
		if best == nil {
			return physics.Vec2{}, fmt.Errorf("%w: no ally to teleport to", ErrItemUse)
		}
		// Land just off the ally on the side away from them.
		dir := -1.0
		if best.Pos.X < p.Pos.X {
			dir = 1.0
		}
		x := best.Pos.X + dir*40
		groundY := m.Terrain.FindGroundY(int(x), 50)
		return physics.Vec2{X: x, Y: float64(groundY - 15)}, nil
	}

	// Plain Teleport: pick a position up to 300px ahead of the player.
	// Server picks the direction based on last known facing to avoid trusting
	// the client's chosen landing spot.
	dir := 1.0
	if m.rng.Intn(2) == 0 {
		dir = -1.0
	}
	offset := 200 + float64(m.rng.Intn(101)) // 200..300
	x := p.Pos.X + dir*offset
	if x < 40 {
		x = 40
	} else if x > float64(m.Terrain.Width-40) {
		x = float64(m.Terrain.Width - 40)
	}
	groundY := m.Terrain.FindGroundY(int(x), 50)
	return physics.Vec2{X: x, Y: float64(groundY - 15)}, nil
}

// consumePendingShotItem clears the queued Dual/Dual+ item and returns the
// delay factor it should apply to the paired shot (1.0 if none).
func (p *MatchPlayer) consumePendingShotItem() float64 {
	if p.PendingShotItem == "" {
		return 1.0
	}
	factor, ok := itemDelayFactor[p.PendingShotItem]
	p.PendingShotItem = ""
	if !ok {
		return 1.0
	}
	return factor
}

// nextShotDelayFactor combines the queued dual item with any avatar reduction
// and returns the canonical multiplier for the paired shot delay.
func nextShotDelayFactor(p *MatchPlayer) float64 {
	factor := p.consumePendingShotItem()
	if factor == 1.0 {
		return 1.0
	}
	// Avatar delay reduction nudges the factor downward but never below 8.0,
	// matching the Dual+ canonical floor.
	reduced := factor - float64(p.Avatar.Delay)/100.0
	if reduced < 8.0 {
		reduced = 8.0
	}
	return reduced
}

// resetTurnItemFlags clears per-turn item state on the newly active player.
func (m *Match) resetTurnItemFlags(p *MatchPlayer) {
	p.ItemUsedThisTurn = false
	// Pending dual items and power/damage modifiers are one-shot and consumed
	// by HandleFireShot; stale values from a skipped turn are discarded here.
	p.PendingShotItem = ""
	p.NextShotPowerMultiplier = 0
	p.NextShotDamageMultiplier = 0
	p.NextShotBungeBonus = 0
}

// defaultLoadout returns the canonical starting inventory. Only Dual and
// Dual+ are surfaced in the UI per current scope; the rest of the catalog
// exists server-side and can be granted by future room configs (§7.2).
func defaultLoadout() map[ItemID]int {
	return map[ItemID]int{
		ItemDual:     2,
		ItemDualPlus: 1,
		ItemTeleport: 1,
	}
}

// seedLoadout fills every player's inventory and starting gold at match start.
func seedLoadout(players []*MatchPlayer) {
	for _, p := range players {
		p.Inventory = defaultLoadout()
		p.Gold = 1000
	}
}
