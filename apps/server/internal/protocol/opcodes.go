package protocol

// Opcodes defining network protocol commands
const (
	OpcodeAuthRequest      uint16 = 0x0001
	OpcodeAuthResponse     uint16 = 0x0002
	OpcodeChannelJoin      uint16 = 0x1000
	OpcodeChannelState     uint16 = 0x1001
	OpcodeRoomCreate       uint16 = 0x2000
	OpcodeRoomJoin         uint16 = 0x2001
	OpcodeRoomLeave        uint16 = 0x2002
	OpcodeRoomState        uint16 = 0x2003
	OpcodeSelectMobile     uint16 = 0x2004
	OpcodeToggleReady      uint16 = 0x2005
	OpcodeChatMessage      uint16 = 0x2006
	OpcodeChatBroadcast    uint16 = 0x2007
	OpcodeMatchStart       uint16 = 0x3000
	OpcodeTurnStart        uint16 = 0x3001
	OpcodeFireShot         uint16 = 0x3002
	OpcodeProjectileResult uint16 = 0x3003
	OpcodeTurnEnd          uint16 = 0x3004
	OpcodeMatchEnd         uint16 = 0x3005
)

