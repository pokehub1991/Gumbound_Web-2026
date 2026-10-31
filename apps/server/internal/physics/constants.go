package physics

type HitType string

const (
	HitTerrain HitType = "terrain"
	HitMobile  HitType = "mobile"
	HitWater   HitType = "water"
	HitOOB     HitType = "out_of_bounds"
)

type Vec2 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type MobileTarget struct {
	ID     string  `json:"id"`
	Pos    Vec2    `json:"pos"`
	Radius float64 `json:"radius"`
}

type TerrainDelta struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Radius int `json:"radius"`
}

type ProjectileResult struct {
	ShooterID    string           `json:"shooter_id,omitempty"`
	MobileType   int              `json:"mobile_type"`
	ShotType     int              `json:"shot_type"`
	Trajectory   []Vec2           `json:"trajectory"`
	HitType      HitType          `json:"hit_type"`
	ImpactPos    Vec2             `json:"impact_pos"`
	Damages      map[string]int   `json:"damages"`
	TerrainDelta *TerrainDelta    `json:"terrain_delta,omitempty"`
}

