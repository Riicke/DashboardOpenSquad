// === Office Color Palette ===
export const COLORS = {
  // Floor (wood planks)
  woodLight: 0x9a7a56,
  woodBase: 0x876a48,
  woodDark: 0x755a3a,
  woodGap: 0x4e3a28,

  // Walls
  wallFace: 0xe4d8cc,
  wallTrim: 0xa89888,
  wallShadow: 0x887868,

  // Desk / Workstation
  deskTop: 0xd4bf9c,
  deskEdge: 0xb8a480,
  deskShadow: 0x806844,
  monitorFrame: 0x2a2a32,
  monitorScreen: 0x1a2a3a,
  monitorScreenOn: 0x4a9aff,
  keyboard: 0x3a3a42,

  // Office chair
  chairSeat: 0x3a3a4a,
  chairBase: 0x4a4a5a,

  // Furniture / Decor
  bookshelfWood: 0xc4a070,
  plantGreen: 0x5aaa5a,
  plantDark: 0x3a7a3a,
  plantPot: 0xd4a878,
  whiteboardBg: 0xf5f0ea,
  whiteboardFrame: 0x8a8a92,
  clockFace: 0xf0ebe0,
  clockFrame: 0x6a6a72,
  coffeeMachine: 0x4a4a52,

  // Refined avatar palette
  skinPorcelain: 0xf1c6a7,
  skinGolden: 0xd8a778,
  skinAmber: 0xb67d54,
  skinDeep: 0x7f573d,
  skinPorcelainShadow: 0xd7a88b,
  skinGoldenShadow: 0xb9855e,
  skinAmberShadow: 0x956246,
  skinDeepShadow: 0x5f3f2c,

  hairInk: 0x251d19,
  hairEspresso: 0x533523,
  hairHoney: 0xd1a446,
  hairCopper: 0xa04d2d,
  hairInkLight: 0x463833,
  hairInkDark: 0x16100d,
  hairEspressoLight: 0x785039,
  hairEspressoDark: 0x3a2518,
  hairHoneyLight: 0xe2ba62,
  hairHoneyDark: 0xaa7f2d,
  hairCopperLight: 0xc16943,
  hairCopperDark: 0x7b351d,

  outfitSlate: 0x52637b,
  outfitSlateLight: 0x6c809a,
  outfitSlateDark: 0x39485d,
  outfitPine: 0x4f765b,
  outfitPineLight: 0x6b9277,
  outfitPineDark: 0x37533f,
  outfitClay: 0x9b5c52,
  outfitClayLight: 0xb8796d,
  outfitClayDark: 0x733d37,
  outfitSand: 0xcab99b,
  outfitSandLight: 0xe0d1b6,
  outfitSandDark: 0xa29278,
  outfitPlum: 0x735b82,
  outfitPlumLight: 0x9176a1,
  outfitPlumDark: 0x534062,
  outfitTeal: 0x417380,
  outfitTealLight: 0x5e93a1,
  outfitTealDark: 0x2c5460,

  accentCyan: 0x67c5ff,
  accentMint: 0x8cd6a1,
  accentGold: 0xf0c56d,
  accentRose: 0xef9ea1,
  accentLavender: 0xc7a9f2,
  accentAmber: 0xf2ab57,

  glassesFrame: 0x28222e,
  glassesGlint: 0xbfe3ff,
  headsetBand: 0x232631,
  headsetPad: 0x4f5567,
  notePaper: 0xf4e1a4,
  noteEdge: 0xe0c86a,

  // Accessories
  mugBody: 0xe0e0e0,
  mugRim: 0xcccccc,
  mugHandle: 0xcccccc,
  postItYellow: 0xffee55,
  postItPink: 0xff8866,
  bookRed: 0xcc4444,
  bookBlue: 0x4466aa,
  bookGreen: 0x44aa44,
  photoFrame: 0x3a3028,
  waterBottle: 0x88bbdd,
  waterCap: 0x4488aa,

  // Name card
  nameCardBg: 0x14141c,
  nameCardText: 0xffffff,

  // Character details
  beltBuckle: 0x8a8a6a,
  collarWhite: 0xf0f0f0,

  // Status effects
  statusIdle: 0xaaaacc,
  statusWorking: 0x60b0ff,
  statusDone: 0x60f080,
  statusCheckpoint: 0xffbb22,
  bubbleBg: 0xffffff,
  bubbleBorder: 0x3a3a4a,
  particleGreen: 0x60f080,

  // Envelope
  envelopeBody: 0xf5e6c8,
  envelopeFold: 0xe0d0b0,
  envelopeSeal: 0xcc3333,
} as const;

// === Layout Constants ===
export const TILE = 32;
export const CELL_W = 4 * TILE;
export const CELL_H = 4 * TILE;
export const SCENE_SCALE = 3;

export type HairStyle = "parted" | "crop" | "bob" | "bun" | "wave" | "fade";
export type AccessoryStyle = "none" | "glasses" | "headset";
export type OutfitStyle = "blazer" | "hoodie" | "shirt" | "sweater";

export type CharacterVariant = {
  id: string;
  hairStyle: HairStyle;
  accessory: AccessoryStyle;
  outfit: OutfitStyle;
  hair: number;
  hairLight: number;
  hairDark: number;
  skin: number;
  skinShadow: number;
  shirt: number;
  shirtLight: number;
  shirtDark: number;
  accent: number;
};

export const CHARACTER_VARIANTS: CharacterVariant[] = [
  {
    id: "analyst",
    hairStyle: "parted",
    accessory: "glasses",
    outfit: "blazer",
    hair: COLORS.hairInk,
    hairLight: COLORS.hairInkLight,
    hairDark: COLORS.hairInkDark,
    skin: COLORS.skinPorcelain,
    skinShadow: COLORS.skinPorcelainShadow,
    shirt: COLORS.outfitSlate,
    shirtLight: COLORS.outfitSlateLight,
    shirtDark: COLORS.outfitSlateDark,
    accent: COLORS.accentCyan,
  },
  {
    id: "operator",
    hairStyle: "crop",
    accessory: "headset",
    outfit: "hoodie",
    hair: COLORS.hairEspresso,
    hairLight: COLORS.hairEspressoLight,
    hairDark: COLORS.hairEspressoDark,
    skin: COLORS.skinGolden,
    skinShadow: COLORS.skinGoldenShadow,
    shirt: COLORS.outfitPine,
    shirtLight: COLORS.outfitPineLight,
    shirtDark: COLORS.outfitPineDark,
    accent: COLORS.accentMint,
  },
  {
    id: "producer",
    hairStyle: "bob",
    accessory: "none",
    outfit: "sweater",
    hair: COLORS.hairHoney,
    hairLight: COLORS.hairHoneyLight,
    hairDark: COLORS.hairHoneyDark,
    skin: COLORS.skinPorcelain,
    skinShadow: COLORS.skinPorcelainShadow,
    shirt: COLORS.outfitClay,
    shirtLight: COLORS.outfitClayLight,
    shirtDark: COLORS.outfitClayDark,
    accent: COLORS.accentGold,
  },
  {
    id: "reviewer",
    hairStyle: "bun",
    accessory: "none",
    outfit: "blazer",
    hair: COLORS.hairCopper,
    hairLight: COLORS.hairCopperLight,
    hairDark: COLORS.hairCopperDark,
    skin: COLORS.skinAmber,
    skinShadow: COLORS.skinAmberShadow,
    shirt: COLORS.outfitSand,
    shirtLight: COLORS.outfitSandLight,
    shirtDark: COLORS.outfitSandDark,
    accent: COLORS.accentRose,
  },
  {
    id: "designer",
    hairStyle: "wave",
    accessory: "glasses",
    outfit: "sweater",
    hair: COLORS.hairInk,
    hairLight: COLORS.hairInkLight,
    hairDark: COLORS.hairInkDark,
    skin: COLORS.skinGolden,
    skinShadow: COLORS.skinGoldenShadow,
    shirt: COLORS.outfitPlum,
    shirtLight: COLORS.outfitPlumLight,
    shirtDark: COLORS.outfitPlumDark,
    accent: COLORS.accentLavender,
  },
  {
    id: "lead",
    hairStyle: "fade",
    accessory: "headset",
    outfit: "shirt",
    hair: COLORS.hairEspresso,
    hairLight: COLORS.hairEspressoLight,
    hairDark: COLORS.hairEspressoDark,
    skin: COLORS.skinDeep,
    skinShadow: COLORS.skinDeepShadow,
    shirt: COLORS.outfitTeal,
    shirtLight: COLORS.outfitTealLight,
    shirtDark: COLORS.outfitTealDark,
    accent: COLORS.accentAmber,
  },
];
