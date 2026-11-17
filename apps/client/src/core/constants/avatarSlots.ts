export type AvatarSlotKey =
  | "flag"
  | "hairBack"
  | "body"
  | "face"
  | "eyes"
  | "helmet"
  | "pet";

export type PetCategory = "shoulder" | "ground" | "flying";

export interface PetConfig {
  id: string;
  name: string;
  category: PetCategory;
  offset: { x: number; y: number };
  scale?: number;
  swaySpeed?: number;
  swayAmplitude?: { x: number; y: number };
}

export interface AvatarEquipment {
  flag?: string | null;
  hairBack?: string | null;
  body?: string | null;
  face?: string | null;
  eyes?: string | null;
  helmet?: string | null;
  pet?: string | null;
}

export interface AvatarItemDef {
  id: string;
  slot: AvatarSlotKey;
  name: string;
  gender?: "male" | "female" | "unisex";
  priceGold?: number;
  priceCash?: number;
  icon?: string;
  texturePath?: string;
  petConfig?: PetConfig;
}

export const AVATAR_CANVAS_SIZE = 64;

// Standard pivot anchors on 64x64 canvas
export const AVATAR_ANCHORS = {
  // Body, Flag, HairBack anchor at Seat / Hip: (32, 34) - lowers avatar to sit authentically in cockpit
  seat: {
    x: 32 / AVATAR_CANVAS_SIZE,
    y: 34 / AVATAR_CANVAS_SIZE,
  },
  // Head, Eyes, Helmet anchor at Neck base: (32, 28)
  neck: {
    x: 32 / AVATAR_CANVAS_SIZE,
    y: 28 / AVATAR_CANVAS_SIZE,
  },
  // Neck joint position relative to seat: (7, -6) - aligns neck with body collar after flip
  neckOffset: {
    x: 7,
    y: -6,
  },
  // Shoulder pet position relative to seat: (9, -9) - perches pet on rider's shoulder
  petOffset: {
    x: 9,
    y: -9,
  },
};

// Default pet category position anchors and behavior presets
export const PET_CATEGORY_DEFAULTS: Record<PetCategory, { offset: { x: number; y: number } }> = {
  shoulder: {
    offset: { x: 9, y: -9 }, // Sits on rider's shoulder, sways with torso breathing
  },
  ground: {
    offset: { x: -22, y: 14 }, // Stands or trots in front of vehicle on ground
  },
  flying: {
    offset: { x: 6, y: -26 }, // Floats/orbits above rider's head
  },
};

// Solid registry of Pets for the upcoming Avatar Shop
export const PET_REGISTRY: Record<string, PetConfig> = {
  pet_default: {
    id: "pet_default",
    name: "Pollito Guardián",
    category: "shoulder",
    offset: { x: 9, y: -9 },
    swaySpeed: 4.2,
    swayAmplitude: { x: 0.4, y: 0.4 },
  },
  pet_ground_walker: {
    id: "pet_ground_walker",
    name: "Cachorro Terrestre",
    category: "ground",
    offset: { x: -22, y: 14 },
    swaySpeed: 5.5,
    swayAmplitude: { x: 0.5, y: 0.8 },
  },
  pet_fairy_flyer: {
    id: "pet_fairy_flyer",
    name: "Hada Celestial",
    category: "flying",
    offset: { x: 6, y: -26 },
    swaySpeed: 3.0,
    swayAmplitude: { x: 1.8, y: 1.5 },
  },
};

// Default avatar equipment configurations
// Flag and Pet are temporarily disabled (null) per user request to keep only Head + Body active
export const DEFAULT_AVATAR_EQUIPMENT: Record<"male" | "female", AvatarEquipment> = {
  male: {
    flag: null, // Temporarily disabled
    hairBack: null,
    body: "body_default",
    face: "face_default",
    eyes: "eyes_open",
    helmet: null,
    pet: null, // Temporarily disabled
  },
  female: {
    flag: null, // Temporarily disabled
    hairBack: null,
    body: "body_female",
    face: "face_female",
    eyes: "eyes_open_female",
    helmet: null,
    pet: null, // Temporarily disabled
  },
};
