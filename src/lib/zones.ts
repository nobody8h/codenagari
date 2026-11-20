// ─── Shared zone & item constants ────────────────────────────
// Single source of truth — imported by Building3D, loadout API, ShopPreview

export const ZONE_ITEMS: Record<string, string[]> = {
  crown: [
    "flag",
    "helipad",
    "spire",
    "satellite_dish",
    "crown_item",
    "github_star",
    "companion_duck",
    "duck_combatant",
    "duck_gold_animated",
    "chakra_neon_crown",
    "recruiter_hologram_beacon",
    "hostel_squad_4pack",
  ],
  roof: [
    "antenna_array",
    "rooftop_garden",
    "rooftop_fire",
    "pool_party",
    "pixel_cat_companion",
  ],
  aura: [
    "neon_trim",
    "spotlight",
    "hologram_ring",
    "lightning_aura",
    "neon_outline",
    "particle_aura",
    "chakra_neon_crown",
    "recruiter_hologram_beacon",
    "hostel_squad_4pack",
  ],
};

export const ZONE_LABELS: Record<string, string> = {
  crown: "Crown",
  roof: "Roof",
  aura: "Aura",
};

export const ITEM_NAMES: Record<string, string> = {
  flag: "Flag",
  helipad: "Helipad",
  spire: "Water Tower",
  satellite_dish: "Satellite Dish",
  crown_item: "Crown",
  antenna_array: "Solar Panels",
  rooftop_garden: "Rooftop Garden",
  rooftop_fire: "Rooftop Fire",
  pool_party: "Pool Party",
  neon_trim: "Neon Trim",
  spotlight: "Spotlight",
  hologram_ring: "Hologram Ring",
  lightning_aura: "Lightning Aura",
  custom_color: "Custom Color",
  billboard: "Billboard",
  led_banner: "LED Banner",
  neon_outline: "Neon Outline",
  particle_aura: "Particle Aura",
  streak_freeze: "Streak Freeze",
  // Raid vehicles
  raid_helicopter: "Mech Keyboard",
  raid_drone: "PC Tower",
  raid_rocket: "Hacker Rig",
  // Raid tags
  tag_neon: "Neon Tag",
  tag_fire: "Fire Tag",
  tag_gold: "Gold Tag",
  // Raid boosters
  raid_boost_small: "War Paint",
  raid_boost_medium: "Battle Armor",
  raid_boost_large: "EMP Device",
  white_rabbit: "White Rabbit",
  github_star: "GitHub Star",
  companion_duck: "Companion Duck",
  duck_combatant: "Combatant Duck",
  duck_gold_animated: "Golden Slayer Duck",
  // CodeNagari Indian impulse & career items
  pixel_cat_companion: "Pixel Cat & Chai Tapri",
  chakra_neon_crown: "Chakra Neon Crown",
  recruiter_hologram_beacon: "Recruiter Hologram Beacon",
  hostel_squad_4pack: "Hostel Squad 4-Pack",
};

// Correct mapping: item_id → achievement that unlocks it (from migration 007 seed)
export const ACHIEVEMENT_ITEMS: Record<string, { achievement: string; label: string }> = {
  flag: { achievement: "first_push", label: "First Push (1+ contributions)" },
  custom_color: { achievement: "committed", label: "Committed (1,000+ contributions)" },
  neon_trim: { achievement: "grinder", label: "Grinder (2,500+ contributions)" },
  antenna_array: { achievement: "builder", label: "Builder (25+ repos)" },
  rooftop_garden: { achievement: "architect", label: "Architect (75+ repos)" },
  spotlight: { achievement: "rising_star", label: "Rising Star (100+ stars)" },
  helipad: { achievement: "recruiter", label: "Recruiter (10+ referrals)" },
  white_rabbit: { achievement: "white_rabbit", label: "Found the White Rabbit" },
};

export const ITEM_EMOJIS: Record<string, string> = {
  flag: "🏁",
  helipad: "🚁",
  spire: "🪣",
  satellite_dish: "📡",
  crown_item: "👑",
  antenna_array: "☀️",
  rooftop_garden: "🌿",
  rooftop_fire: "🔥",
  pool_party: "🏊",
  neon_trim: "💡",
  spotlight: "🔦",
  hologram_ring: "💫",
  lightning_aura: "⚡",
  custom_color: "🎨",
  billboard: "📺",
  led_banner: "🪧",
  neon_outline: "🔮",
  particle_aura: "✨",
  streak_freeze: "🧊",
  // Raid
  raid_helicopter: "⌨️",
  raid_drone: "🗄️",
  raid_rocket: "🖥️",
  tag_neon: "🌈",
  tag_fire: "🔥",
  tag_gold: "🥇",
  raid_boost_small: "🎨",
  raid_boost_medium: "🛡️",
  raid_boost_large: "💣",
  white_rabbit: "🐇",
  github_star: "⭐",
  // CodeNagari Indian impulse & career items
  pixel_cat_companion: "🐈",
  chakra_neon_crown: "🔱",
  recruiter_hologram_beacon: "📡",
  hostel_squad_4pack: "🏛️",
};

export const FACES_ITEMS = ["custom_color", "billboard", "led_banner"];

// Legacy hand-coded vehicles only. New vehicles are data-driven: a GLB at
// /models/vehicles/<id>.glb + a catalog row (render_kind 'asset', shop_section
// 'battle', metadata.type 'raid_vehicle'). They are detected from the catalog,
// not added to this array.
export const RAID_VEHICLE_ITEMS = ["raid_helicopter", "raid_drone", "raid_rocket"];
export const RAID_TAG_ITEMS = ["tag_neon", "tag_fire", "tag_gold"];
export const RAID_BOOST_ITEMS = ["raid_boost_small", "raid_boost_medium", "raid_boost_large"];

// ─── CodeNagari Low-Poly Voxel Spec (BoxGeometry & CylinderGeometry only) ────
// Kept strictly primitive-only so mobile GPUs maintain 60fps across dense city blocks.
export type CodeNagariVoxelPrimitiveKind = "box" | "cylinder";

export interface CodeNagariVoxelPrimitive {
  kind: CodeNagariVoxelPrimitiveKind;
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number]; // box: [w, h, d]; cylinder: [radiusTop, radiusBottom, height]
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  radialSegments?: number;
}

export interface CodeNagariItemVisualSpec {
  id:
    | "pixel_cat_companion"
    | "chakra_neon_crown"
    | "recruiter_hologram_beacon"
    | "hostel_squad_4pack";
  priceInr: number;
  zone: "roof" | "crown" | "aura";
  animates: "bob_spin" | "pulse_beacon" | "tapri_steam" | "squad_orbit";
  primitives: CodeNagariVoxelPrimitive[];
}

export const CODENAGARI_VOXEL_SPECS: Record<
  CodeNagariItemVisualSpec["id"],
  CodeNagariItemVisualSpec
> = {
  pixel_cat_companion: {
    id: "pixel_cat_companion",
    priceInr: 29,
    zone: "roof",
    animates: "tapri_steam",
    primitives: [
      // Chai tapri counter base
      { kind: "box", position: [-0.45, 0.16, 0.2], size: [0.65, 0.32, 0.42], color: "#78350F" },
      // Steaming brass kettle
      {
        kind: "cylinder",
        position: [-0.45, 0.42, 0.2],
        size: [0.11, 0.14, 0.2],
        color: "#F59E0B",
        emissive: "#D97706",
        emissiveIntensity: 0.35,
        radialSegments: 8,
      },
      // Pixel cat body
      { kind: "box", position: [0.35, 0.18, -0.15], size: [0.36, 0.32, 0.28], color: "#F97316" },
      // Pixel cat head
      { kind: "box", position: [0.35, 0.44, -0.1], size: [0.3, 0.26, 0.26], color: "#FB923C" },
      // Left & right pointy ears
      { kind: "box", position: [0.24, 0.62, -0.1], size: [0.09, 0.12, 0.1], color: "#EA580C" },
      { kind: "box", position: [0.46, 0.62, -0.1], size: [0.09, 0.12, 0.1], color: "#EA580C" },
      // Glowing cyan pixel eyes
      {
        kind: "box",
        position: [0.29, 0.45, 0.04],
        size: [0.05, 0.05, 0.03],
        color: "#22D3EE",
        emissive: "#22D3EE",
        emissiveIntensity: 0.9,
      },
      {
        kind: "box",
        position: [0.41, 0.45, 0.04],
        size: [0.05, 0.05, 0.03],
        color: "#22D3EE",
        emissive: "#22D3EE",
        emissiveIntensity: 0.9,
      },
    ],
  },
  chakra_neon_crown: {
    id: "chakra_neon_crown",
    priceInr: 49,
    zone: "crown",
    animates: "bob_spin",
    primitives: [
      // Crown ring base
      {
        kind: "cylinder",
        position: [0, 0.25, 0],
        size: [0.52, 0.46, 0.22],
        color: "#FACC15",
        emissive: "#EAB308",
        emissiveIntensity: 0.55,
        radialSegments: 8,
      },
      // 4 cardinal chakra prongs
      {
        kind: "box",
        position: [0.44, 0.46, 0],
        size: [0.12, 0.24, 0.12],
        color: "#E2FF32",
        emissive: "#E2FF32",
        emissiveIntensity: 0.85,
      },
      {
        kind: "box",
        position: [-0.44, 0.46, 0],
        size: [0.12, 0.24, 0.12],
        color: "#E2FF32",
        emissive: "#E2FF32",
        emissiveIntensity: 0.85,
      },
      {
        kind: "box",
        position: [0, 0.46, 0.44],
        size: [0.12, 0.24, 0.12],
        color: "#38BDF8",
        emissive: "#38BDF8",
        emissiveIntensity: 0.85,
      },
      {
        kind: "box",
        position: [0, 0.46, -0.44],
        size: [0.12, 0.24, 0.12],
        color: "#38BDF8",
        emissive: "#38BDF8",
        emissiveIntensity: 0.85,
      },
    ],
  },
  recruiter_hologram_beacon: {
    id: "recruiter_hologram_beacon",
    priceInr: 99,
    zone: "crown",
    animates: "pulse_beacon",
    primitives: [
      // Emitter pedestal
      {
        kind: "cylinder",
        position: [0, 0.15, 0],
        size: [0.36, 0.42, 0.3],
        color: "#0F172A",
        emissive: "#10B981",
        emissiveIntensity: 0.3,
        radialSegments: 8,
      },
      // Vertical emerald laser hologram shaft
      {
        kind: "cylinder",
        position: [0, 1.35, 0],
        size: [0.09, 0.16, 2.1],
        color: "#10B981",
        emissive: "#34D399",
        emissiveIntensity: 1.1,
        radialSegments: 8,
      },
      // Top floating beacon cap
      {
        kind: "box",
        position: [0, 2.5, 0],
        size: [0.34, 0.14, 0.34],
        color: "#E2FF32",
        emissive: "#E2FF32",
        emissiveIntensity: 1.0,
      },
    ],
  },
  hostel_squad_4pack: {
    id: "hostel_squad_4pack",
    priceInr: 149,
    zone: "aura",
    animates: "squad_orbit",
    primitives: [
      // Central squad pylon
      {
        kind: "cylinder",
        position: [0, 0.35, 0],
        size: [0.14, 0.22, 0.7],
        color: "#EC4899",
        emissive: "#F472B6",
        emissiveIntensity: 0.75,
        radialSegments: 8,
      },
      // 3 batchmate satellite nodes
      {
        kind: "box",
        position: [0.55, 0.55, 0],
        size: [0.16, 0.16, 0.16],
        color: "#FACC15",
        emissive: "#FACC15",
        emissiveIntensity: 0.85,
      },
      {
        kind: "box",
        position: [-0.28, 0.55, 0.48],
        size: [0.16, 0.16, 0.16],
        color: "#38BDF8",
        emissive: "#38BDF8",
        emissiveIntensity: 0.85,
      },
      {
        kind: "box",
        position: [-0.28, 0.55, -0.48],
        size: [0.16, 0.16, 0.16],
        color: "#E2FF32",
        emissive: "#E2FF32",
        emissiveIntensity: 0.85,
      },
    ],
  },
};

export const CODENAGARI_ITEM_IDS = Object.keys(
  CODENAGARI_VOXEL_SPECS
) as CodeNagariItemVisualSpec["id"][];
