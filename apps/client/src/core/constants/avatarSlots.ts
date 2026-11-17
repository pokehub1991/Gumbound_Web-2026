export type AvatarSlotKey =
  | "flag"
  | "hairBack"
  | "body"
  | "face"
  | "eyes"
  | "helmet"
  | "pet";

export interface AvatarEquipment {
  flag?: string | null;
  hairBack?: string | null;
  body?: string | null;
  face?: string | null;
  eyes?: string | null;
  helmet?: string | null;
  pet?: string | null;
}

export const AVATAR_CANVAS_SIZE = 64;

// Standard pivot anchors on 64x64 canvas
export const AVATAR_ANCHORS = {
  // Body, Flag, Pet, HairBack anchor at Seat / Hip: (32, 44)
  seat: {
    x: 32 / AVATAR_CANVAS_SIZE,
    y: 44 / AVATAR_CANVAS_SIZE,
  },
  // Head, Eyes, Helmet anchor at Neck base: (32, 34)
  neck: {
    x: 32 / AVATAR_CANVAS_SIZE,
    y: 34 / AVATAR_CANVAS_SIZE,
  },
  // Neck joint position relative to seat: (0, -10)
  neckOffset: {
    x: 0,
    y: -10,
  },
};

export const DEFAULT_AVATAR_EQUIPMENT: Record<"male" | "female", AvatarEquipment> = {
  male: {
    flag: "flag_default",
    hairBack: null,
    body: "body_default",
    face: "face_default",
    eyes: "eyes_open",
    helmet: null,
    pet: "pet_default",
  },
  female: {
    flag: "flag_default",
    hairBack: null,
    body: "body_default",
    face: "face_default",
    eyes: "eyes_open",
    helmet: null,
    pet: "pet_default",
  },
};

