package match

const (
	MobileArmor      = 0
	MobileIce        = 1
	MobileAduka      = 2
	MobileLightning  = 3
	MobileBigFoot    = 4
	MobileJD         = 5
	MobileASate      = 6
	MobileRandom     = 7
	MobileKnight     = 8
	MobileFox        = 9
	MobileDragon     = 10
	MobileNak        = 11
	MobileTrico      = 12
	MobileMage       = 13
	MobileTurtle     = 14
	MobileBoomer     = 15
	MobileGrub       = 17
	MobileRaon       = 19
	MobileFrog       = 21
	MobileKalsiddon  = 22
	MobileMaya       = 23
	MobilePhoenix    = 24
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
	By          float64 `json:"by"`
	Bx          float64 `json:"bx"`
	Ax          float64 `json:"ax"`
	Ay          float64 `json:"ay"`
	MinAngle    float64 `json:"min_angle"`
	MaxAngle    float64 `json:"max_angle"`
}

// Mobiles contains the canonical 25 GunBound / DragonBound mobile definitions
var Mobiles = map[int]MobileStats{
	MobileArmor: {
		ID: 0, Name: "Armor", MaxHP: 1000,
		BaseDelay: 500, Shot1Delay: 760, Shot2Delay: 940, SSDelay: 1310,
		Shot1Damage: 150, Shot2Damage: 153, SSDamage: 400, BlastRadius: 43,
		By: 398, Bx: 0, Ax: 73.5, Ay: 0.74, MinAngle: 10, MaxAngle: 55,
	},
	MobileIce: {
		ID: 1, Name: "Ice", MaxHP: 1000,
		BaseDelay: 500, Shot1Delay: 740, Shot2Delay: 890, SSDelay: 1290,
		Shot1Damage: 250, Shot2Damage: 250, SSDamage: 400, BlastRadius: 45,
		By: 384, Bx: 0, Ax: 62.5, Ay: 0.625, MinAngle: 20, MaxAngle: 70,
	},
	MobileAduka: {
		ID: 2, Name: "Aduka", MaxHP: 980,
		BaseDelay: 500, Shot1Delay: 760, Shot2Delay: 910, SSDelay: 1310,
		Shot1Damage: 190, Shot2Damage: 100, SSDamage: 400, BlastRadius: 36,
		By: 392, Bx: 0, Ax: 65.5, Ay: 0.695, MinAngle: 110, MaxAngle: 170,
	},
	MobileLightning: {
		ID: 3, Name: "Lightning", MaxHP: 960,
		BaseDelay: 500, Shot1Delay: 750, Shot2Delay: 900, SSDelay: 1300,
		Shot1Damage: 200, Shot2Damage: 250, SSDamage: 400, BlastRadius: 38,
		By: 393, Bx: 0, Ax: 65.0, Ay: 0.72, MinAngle: 18, MaxAngle: 40,
	},
	MobileBigFoot: {
		ID: 4, Name: "BigFoot", MaxHP: 1100,
		BaseDelay: 520, Shot1Delay: 820, Shot2Delay: 980, SSDelay: 1420,
		Shot1Damage: 50, Shot2Damage: 70, SSDamage: 120, BlastRadius: 30,
		By: 396, Bx: 0, Ax: 88.0, Ay: 0.74, MinAngle: 20, MaxAngle: 45,
	},
	MobileJD: {
		ID: 5, Name: "J.D", MaxHP: 980,
		BaseDelay: 500, Shot1Delay: 740, Shot2Delay: 890, SSDelay: 1290,
		Shot1Damage: 200, Shot2Damage: 200, SSDamage: 400, BlastRadius: 39,
		By: 387, Bx: 0, Ax: 62.5, Ay: 0.625, MinAngle: 15, MaxAngle: 65,
	},
	MobileASate: {
		ID: 6, Name: "A.Sate", MaxHP: 940,
		BaseDelay: 500, Shot1Delay: 770, Shot2Delay: 930, SSDelay: 1330,
		Shot1Damage: 330, Shot2Damage: 250, SSDamage: 400, BlastRadius: 38,
		By: 412, Bx: 0, Ax: 76.0, Ay: 0.765, MinAngle: 20, MaxAngle: 60,
	},
	MobileRandom: {
		ID: 7, Name: "Random", MaxHP: 1000,
		BaseDelay: 500, Shot1Delay: 760, Shot2Delay: 920, SSDelay: 1320,
		Shot1Damage: 200, Shot2Damage: 250, SSDamage: 400, BlastRadius: 40,
		By: 390, Bx: 0, Ax: 70.0, Ay: 0.70, MinAngle: 20, MaxAngle: 60,
	},
	MobileKnight: {
		ID: 8, Name: "Knight", MaxHP: 950,
		BaseDelay: 500, Shot1Delay: 780, Shot2Delay: 940, SSDelay: 1350,
		Shot1Damage: 330, Shot2Damage: 250, SSDamage: 400, BlastRadius: 38,
		By: 360, Bx: 0, Ax: 65.5, Ay: 0.695, MinAngle: 20, MaxAngle: 60,
	},
	MobileFox: {
		ID: 9, Name: "Fox", MaxHP: 960,
		BaseDelay: 500, Shot1Delay: 750, Shot2Delay: 900, SSDelay: 1300,
		Shot1Damage: 330, Shot2Damage: 250, SSDamage: 400, BlastRadius: 36,
		By: 390, Bx: 0, Ax: 68.0, Ay: 0.70, MinAngle: 20, MaxAngle: 60,
	},
	MobileDragon: {
		ID: 10, Name: "Dragon", MaxHP: 1200,
		BaseDelay: 540, Shot1Delay: 850, Shot2Delay: 1050, SSDelay: 1500,
		Shot1Damage: 400, Shot2Damage: 250, SSDamage: 600, BlastRadius: 45,
		By: 380, Bx: 0, Ax: 70.0, Ay: 0.72, MinAngle: 15, MaxAngle: 65,
	},
	MobileNak: {
		ID: 11, Name: "Nak", MaxHP: 920,
		BaseDelay: 500, Shot1Delay: 740, Shot2Delay: 920, SSDelay: 1320,
		Shot1Damage: 330, Shot2Damage: 280, SSDamage: 420, BlastRadius: 38,
		By: 395, Bx: 0, Ax: 68.0, Ay: 0.71, MinAngle: 20, MaxAngle: 70,
	},
	MobileTrico: {
		ID: 12, Name: "Trico", MaxHP: 960,
		BaseDelay: 500, Shot1Delay: 760, Shot2Delay: 930, SSDelay: 1330,
		Shot1Damage: 100, Shot2Damage: 100, SSDamage: 400, BlastRadius: 36,
		By: 395, Bx: 0, Ax: 84.0, Ay: 0.87, MinAngle: 10, MaxAngle: 60,
	},
	MobileMage: {
		ID: 13, Name: "Mage", MaxHP: 940,
		BaseDelay: 500, Shot1Delay: 750, Shot2Delay: 900, SSDelay: 1310,
		Shot1Damage: 100, Shot2Damage: 100, SSDamage: 400, BlastRadius: 39,
		By: 360, Bx: 0, Ax: 71.5, Ay: 0.78, MinAngle: 15, MaxAngle: 50,
	},
	MobileTurtle: {
		ID: 14, Name: "Turtle", MaxHP: 1050,
		BaseDelay: 520, Shot1Delay: 780, Shot2Delay: 950, SSDelay: 1380,
		Shot1Damage: 230, Shot2Damage: 150, SSDamage: 400, BlastRadius: 64,
		By: 389, Bx: 0, Ax: 73.5, Ay: 0.74, MinAngle: 25, MaxAngle: 50,
	},
	MobileBoomer: {
		ID: 15, Name: "Boomer", MaxHP: 880,
		BaseDelay: 480, Shot1Delay: 730, Shot2Delay: 880, SSDelay: 1280,
		Shot1Damage: 150, Shot2Damage: 120, SSDamage: 400, BlastRadius: 30,
		By: 244, Bx: 0, Ax: 62.5, Ay: 1.395, MinAngle: 10, MaxAngle: 90,
	},

	MobileGrub: {
		ID: 17, Name: "Grub", MaxHP: 960,
		BaseDelay: 500, Shot1Delay: 760, Shot2Delay: 910, SSDelay: 1310,
		Shot1Damage: 220, Shot2Damage: 110, SSDamage: 400, BlastRadius: 38,
		By: 398, Bx: 0, Ax: 61.0, Ay: 0.65, MinAngle: 30, MaxAngle: 60,
	},

	MobileRaon: {
		ID: 19, Name: "Raon", MaxHP: 940,
		BaseDelay: 500, Shot1Delay: 750, Shot2Delay: 910, SSDelay: 1310,
		Shot1Damage: 70, Shot2Damage: 100, SSDamage: 400, BlastRadius: 25,
		By: 398, Bx: 0, Ax: 73.5, Ay: 0.74, MinAngle: 30, MaxAngle: 60,
	},

	MobileFrog: {
		ID: 21, Name: "Frog", MaxHP: 960,
		BaseDelay: 500, Shot1Delay: 750, Shot2Delay: 900, SSDelay: 1300,
		Shot1Damage: 330, Shot2Damage: 250, SSDamage: 400, BlastRadius: 36,
		By: 380, Bx: 0, Ax: 65.0, Ay: 0.70, MinAngle: 20, MaxAngle: 65,
	},
	MobileKalsiddon: {
		ID: 22, Name: "Kalsiddon", MaxHP: 1000,
		BaseDelay: 510, Shot1Delay: 780, Shot2Delay: 950, SSDelay: 1380,
		Shot1Damage: 120, Shot2Damage: 140, SSDamage: 420, BlastRadius: 38,
		By: 390, Bx: 0, Ax: 72.0, Ay: 0.73, MinAngle: 20, MaxAngle: 60,
	},
	MobileMaya: {
		ID: 23, Name: "Maya", MaxHP: 1150,
		BaseDelay: 530, Shot1Delay: 840, Shot2Delay: 1020, SSDelay: 1460,
		Shot1Damage: 450, Shot2Damage: 260, SSDamage: 550, BlastRadius: 45,
		By: 395, Bx: 0, Ax: 75.0, Ay: 0.75, MinAngle: 15, MaxAngle: 60,
	},
	MobilePhoenix: {
		ID: 24, Name: "Phoenix", MaxHP: 1000,
		BaseDelay: 500, Shot1Delay: 760, Shot2Delay: 920, SSDelay: 1340,
		Shot1Damage: 120, Shot2Damage: 220, SSDamage: 440, BlastRadius: 38,
		By: 375, Bx: 0, Ax: 66.0, Ay: 0.70, MinAngle: 20, MaxAngle: 65,
	},
}

func GetMobileStats(id int) MobileStats {
	if s, ok := Mobiles[id]; ok {
		return s
	}
	return Mobiles[MobileArmor]
}
