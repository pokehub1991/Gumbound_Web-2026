package match

const (
	MobileArmor   = 0
	MobileMage    = 1
	MobileNak     = 2
	MobileTrico   = 3
	MobileBigFoot = 4
	MobileBoomer  = 5
	MobileRaon    = 6
	MobileTurtle  = 7
)

type MobileStats struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	MaxHP       int     `json:"max_hp"`
	BaseDelay   int     `json:"base_delay"`
	Shot1Delay  int     `json:"shot1_delay"`
	Shot2Delay  int     `json:"shot2_delay"`
	SSDelay     int     `json:"ss_delay"`
	Shot1Damage int     `json:"shot1_damage"`
	Shot2Damage int     `json:"shot2_damage"`
	SSDamage    int     `json:"ss_damage"`
	BlastRadius float64 `json:"blast_radius"`
	Gravity     float64 `json:"gravity"`
	WindFactor  float64 `json:"wind_factor"`
	MinAngle    float64 `json:"min_angle"`
	MaxAngle    float64 `json:"max_angle"`
}

var Mobiles = map[int]MobileStats{
	MobileArmor: {
		ID: 0, Name: "Armor", MaxHP: 1000,
		BaseDelay: 500, Shot1Delay: 150, Shot2Delay: 250, SSDelay: 350,
		Shot1Damage: 180, Shot2Damage: 270, SSDamage: 420, BlastRadius: 28,
		Gravity: 0.42, WindFactor: 1.0, MinAngle: 15, MaxAngle: 50,
	},
	MobileMage: {
		ID: 1, Name: "Mage", MaxHP: 920,
		BaseDelay: 510, Shot1Delay: 160, Shot2Delay: 260, SSDelay: 360,
		Shot1Damage: 190, Shot2Damage: 280, SSDamage: 440, BlastRadius: 30,
		Gravity: 0.40, WindFactor: 1.05, MinAngle: 20, MaxAngle: 45,
	},
	MobileNak: {
		ID: 2, Name: "Nak", MaxHP: 880,
		BaseDelay: 480, Shot1Delay: 130, Shot2Delay: 230, SSDelay: 330,
		Shot1Damage: 170, Shot2Damage: 290, SSDamage: 410, BlastRadius: 28,
		Gravity: 0.44, WindFactor: 0.85, MinAngle: 20, MaxAngle: 70,
	},
	MobileTrico: {
		ID: 3, Name: "Trico", MaxHP: 950,
		BaseDelay: 520, Shot1Delay: 170, Shot2Delay: 270, SSDelay: 370,
		Shot1Damage: 175, Shot2Damage: 300, SSDamage: 450, BlastRadius: 32,
		Gravity: 0.42, WindFactor: 1.0, MinAngle: 15, MaxAngle: 55,
	},
	MobileBigFoot: {
		ID: 4, Name: "BigFoot", MaxHP: 1100,
		BaseDelay: 560, Shot1Delay: 200, Shot2Delay: 310, SSDelay: 420,
		Shot1Damage: 190, Shot2Damage: 320, SSDamage: 470, BlastRadius: 38,
		Gravity: 0.50, WindFactor: 0.65, MinAngle: 20, MaxAngle: 40,
	},
	MobileBoomer: {
		ID: 5, Name: "Boomer", MaxHP: 850,
		BaseDelay: 490, Shot1Delay: 140, Shot2Delay: 240, SSDelay: 340,
		Shot1Damage: 160, Shot2Damage: 270, SSDamage: 460, BlastRadius: 26,
		Gravity: 0.35, WindFactor: 2.2, MinAngle: 10, MaxAngle: 75,
	},
	MobileRaon: {
		ID: 6, Name: "Raon", MaxHP: 900,
		BaseDelay: 500, Shot1Delay: 150, Shot2Delay: 250, SSDelay: 350,
		Shot1Damage: 160, Shot2Damage: 260, SSDamage: 430, BlastRadius: 28,
		Gravity: 0.42, WindFactor: 1.0, MinAngle: 25, MaxAngle: 55,
	},
	MobileTurtle: {
		ID: 7, Name: "Turtle", MaxHP: 1050,
		BaseDelay: 540, Shot1Delay: 180, Shot2Delay: 280, SSDelay: 390,
		Shot1Damage: 185, Shot2Damage: 295, SSDamage: 480, BlastRadius: 32,
		Gravity: 0.45, WindFactor: 0.95, MinAngle: 20, MaxAngle: 50,
	},
}

func GetMobileStats(id int) MobileStats {
	if s, ok := Mobiles[id]; ok {
		return s
	}
	return Mobiles[MobileArmor]
}
