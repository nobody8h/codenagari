// =============================================================================
// File: src/lib/codenagari-config.ts
// Project: CodeNagari (codenagari.in) - 3D Identity Metropolis for Indian Devs
// Description: Authoritative server & client catalog for INR Impulse Shop SKUs,
//              Indian Engineering Campuses & Tech Corridor Districts, and
//              Weekly 1v1 Campus Skyline War composite scoring utilities.
// =============================================================================

export type ShopItemId =
  | 'pixel_cat_companion'
  | 'chakra_neon_crown'
  | 'recruiter_hologram_beacon'
  | 'hostel_squad_4pack'
  | 'sky_blimp_3d_3days'
  | 'sky_blimp_3d_7days';

export type DistrictCategory = 'campus' | 'tech_hub';

export interface CodeNagariShopItem {
  id: ShopItemId;
   dbCanonicalId: string;
  name: string;
  tagline: string;
  description: string;
  priceInr: number;
  badgeText: string;
  accentHex: string;
  category: 'cosmetic' | 'career' | 'squad_viral' | 'sponsor_blimp';
  maxGiftRecipients: number;
  requiresCareerPayload: boolean;
  requiresBlimpPayload: boolean;
  blimpDurationDays?: number;
  perks: string[];
}

export interface IndianDistrictConfig {
  slug: string;
  name: string;
  shortLabel: string;
  category: DistrictCategory;
  stateOrRegion: string;
  rivalSlug: string;
  isFeaturedMatchup: boolean;
  primaryColorHex: string;
  secondaryColorHex: string;
  defaultTotalCommits: number;
  defaultBuilderCount: number;
  coordinates: {
    gridOffsetX: number;
    gridOffsetZ: number;
  };
}

export interface DistrictLiveMetrics {
  slug: string;
  name: string;
  category: DistrictCategory;
  total_commits: number;
  builder_count: number;
  rival_slug: string | null;
  is_featured_matchup: boolean;
}

export interface CampusWarScoreBreakdown {
  slug: string;
  name: string;
  category: DistrictCategory;
  totalCommits: number;
  builderCount: number;
  avgCommitsPerBuilder: number;
  volumeComponent: number;
  densityComponent: number;
  compositeScore: number;
}

export interface CampusWarMatchupResult {
  matchupId: string;
  isFeatured: boolean;
  category: DistrictCategory;
  districtA: CampusWarScoreBreakdown;
  districtB: CampusWarScoreBreakdown;
  leaderSlug: string;
  winMarginScore: number;
  districtAWinSharePercent: number;
  districtBWinSharePercent: number;
}

export interface BlimpOrderPayload {
  sponsor_name?: string;
  badge_text?: string;
  target_url?: string;
  district_slug?: string;
  role_target?: string;
  resume_or_portfolio_url?: string;
}

// =============================================================================
// 1. AUTHORITATIVE INR IMPULSE SHOP CATALOG (All under ₹2,000 NPCI QR Limit)
// =============================================================================
export const CODENAGARI_SHOP_ITEMS: Record<ShopItemId, CodeNagariShopItem> = {
  pixel_cat_companion: {
    id: 'pixel_cat_companion',
    dbCanonicalId: 'pixel_cat_companion',
    name: 'Rooftop Pixel Coding Cat + Chai Tapri',
    tagline: 'Purring 8-bit companion & steaming cutting-chai stall on your tower roof',
    description:
      'Adds an animated pixel cat typing away next to a glowing midnight Chai Tapri kettle on top of your 3D GitHub skyscraper. Also permanently claims your tower and removes Unclaimed Rust.',
    priceInr: 29,
    badgeText: 'CHAI TIER • ₹29',
    accentHex: '#F59E0B',
    category: 'cosmetic',
    maxGiftRecipients: 0,
    requiresCareerPayload: false,
    requiresBlimpPayload: false,
    perks: [
      'Animated 3D pixel cat + steaming cutting-chai tapri on your rooftop',
      'Permanently removes Unclaimed Rust decay from your skyscraper',
      'Verified Builder tick next to your GitHub username in CodeNagari'
    ]
  },

  chakra_neon_crown: {
    id: 'chakra_neon_crown',
    dbCanonicalId: 'chakra_neon_crown',
    name: 'Chakra Neon Sovereign Crown',
    tagline: 'Rotating golden pixel crown + high-voltage neon window aura',
    description:
      'Crowning glory for prolific Indian builders. Mounts a levitating golden 3D pixel crown above your tower spire and upgrades your skyscraper windows with a pulsing cyber-saffron & electric cyan shader.',
    priceInr: 49,
    badgeText: 'MOST POPULAR • ₹49',
    accentHex: '#E2FF32',
    category: 'cosmetic',
    maxGiftRecipients: 0,
    requiresCareerPayload: false,
    requiresBlimpPayload: false,
    perks: [
      'Levitating 3D Golden Pixel Crown rotating above your rooftop',
      'Glowing Cyber-Neon Window Aura visible across the entire district skyline',
      'Permanently removes Unclaimed Rust decay & unlocks Sovereign profile badge'
    ]
  },

  recruiter_hologram_beacon: {
    id: 'recruiter_hologram_beacon',
    dbCanonicalId: 'recruiter_hologram_beacon',
    name: 'Recruiter Hologram Beacon (SDE / Intern)',
    tagline: 'Sky-high "OPEN TO SDE / INTERNSHIP" laser beacon + Recruiter Filter pin',
    description:
      'Built for Indian developers hunting SDE-1, Full-Stack, AI, or Internship roles. Projects an unmistakable emerald hologram beam from your rooftop, attaches your 1-click Resume/Portfolio URL, and pins your tower inside the Recruiter Skyline Filter.',
    priceInr: 99,
    badgeText: 'CAREER BOOST • ₹99',
    accentHex: '#10B981',
    category: 'career',
    maxGiftRecipients: 0,
    requiresCareerPayload: true,
    requiresBlimpPayload: false,
    perks: [
      'Anti-Rust Shield: Scrubs away Unclaimed Rust and polishes tower facade',
      '3D Rooftop "OPEN TO SDE / INTERNSHIP" Hologram Beacon visible from orbit',
      'Direct 1-Click Resume / Portfolio / LinkedIn button on your building card',
      'Priority indexing in the CodeNagari Recruiter Skyline Filter by Campus & Tech Hub'
    ]
  },

  hostel_squad_4pack: {
    id: 'hostel_squad_4pack',
    dbCanonicalId: 'hostel_squad_4pack',
    name: 'Hostel Wing Squad 4-Pack (You + 3 Batchmates)',
    tagline: 'Unlock your tower + gift 3 Chakra Neon Crowns to your hostel wing',
    description:
      'Dominate your campus skyline together. Equips your skyscraper with the Hostel Squad Banner + Chakra Neon Crown, and pre-gifts Chakra Neon Crowns to up to 3 batchmates by their GitHub usernames—even before they log in!',
    priceInr: 149,
    badgeText: '4 TOWERS FOR ₹149 (₹37/DEV)',
    accentHex: '#EC4899',
    category: 'squad_viral',
    maxGiftRecipients: 3,
    requiresCareerPayload: false,
    requiresBlimpPayload: false,
    perks: [
      'Unlocks Chakra Neon Crown + Squad Leader emblem on your own skyscraper',
      'Instantly gifts Chakra Neon Crowns to up to 3 batchmate GitHub handles',
      'Works even if your friends have not signed into CodeNagari yet (waiting on claim)',
      'Generates a custom 1-Tap WhatsApp Hostel Wing Gift Card to drop in your group chat'
    ]
  },

  sky_blimp_3d_3days: {
    id: 'sky_blimp_3d_3days',
    dbCanonicalId: 'sky_blimp_sponsor_3d_3d',
    name: '3D Sky Blimp Sponsor (3-Day District Patrol)',
    tagline: 'Fly your startup, hackathon, or hiring blimp across any district for 3 days',
    description:
      'Put your startup, dev tool, hackathon, or hiring link in the sky. Your custom 3D neon dirigible patrols the skyline with a clickable call-to-action banner. Held in PENDING_APPROVAL until verified by moderation.',
    priceInr: 999,
    badgeText: '3 DAYS • ₹999',
    accentHex: '#38BDF8',
    category: 'sponsor_blimp',
    maxGiftRecipients: 0,
    requiresCareerPayload: false,
    requiresBlimpPayload: true,
    blimpDurationDays: 3,
    perks: [
      'Custom 3D Dirigible Blimp patrolling your chosen Campus or Tech Hub for 72 hours',
      'Interactive 3D billboard displaying your Sponsor Name + 42-char Badge Text',
      'Direct clickable redirect to your startup, hackathon, or hiring page',
      'Includes permanent Sponsor Verified badge on your personal GitHub tower'
    ]
  },

  sky_blimp_3d_7days: {
    id: 'sky_blimp_3d_7days',
    dbCanonicalId: 'sky_blimp_sponsor_3d_7d',
    name: '3D Sky Blimp Sponsor (7-Day Metropolis Domination)',
    tagline: 'Full-week 3D aerial billboard over peak Weekly Campus War traffic',
    description:
      'Maximum visibility across an entire Weekly 1v1 Campus Skyline War cycle. Your custom 3D neon blimp cruises above the highest-traffic districts for 7 full days with priority flight altitude. Held in PENDING_APPROVAL until verified by moderation.',
    priceInr: 1999,
    badgeText: '7 DAYS • ₹1,999 (BEST ROI)',
    accentHex: '#A855F7',
    category: 'sponsor_blimp',
    maxGiftRecipients: 0,
    requiresCareerPayload: false,
    requiresBlimpPayload: true,
    blimpDurationDays: 7,
    perks: [
      '7 full days (168 hours) of continuous 3D aerial patrol across your target district',
      'High-visibility neon hull shader + clickable HUD banner during Friday War Finals',
      'Under ₹2,000 NPCI limit: Instant 1-tap UPI QR / Intent checkout with zero paperwork',
      'Includes permanent Sponsor Verified badge on your personal GitHub tower'
    ]
  }
};

export const CODENAGARI_SHOP_ITEM_LIST: CodeNagariShopItem[] = Object.values(
  CODENAGARI_SHOP_ITEMS
);

// =============================================================================
// 2. INDIAN CAMPUSES & TECH CORRIDORS (Synchronized with SQL Seed)
// =============================================================================
export const INDIAN_DISTRICTS: IndianDistrictConfig[] = [
  // --- 16 Engineering Campuses (8 Head-to-Head Rivalry Pairs) ---
  {
    slug: 'iit-bombay',
    name: 'IIT Bombay',
    shortLabel: 'IITB Powai',
    category: 'campus',
    stateOrRegion: 'Maharashtra',
    rivalSlug: 'iit-delhi',
    isFeaturedMatchup: true,
    primaryColorHex: '#38BDF8',
    secondaryColorHex: '#0284C7',
    defaultTotalCommits: 48200,
    defaultBuilderCount: 142,
    coordinates: { gridOffsetX: -120, gridOffsetZ: -120 }
  },
  {
    slug: 'iit-delhi',
    name: 'IIT Delhi',
    shortLabel: 'IITD Hauz Khas',
    category: 'campus',
    stateOrRegion: 'Delhi NCR',
    rivalSlug: 'iit-bombay',
    isFeaturedMatchup: true,
    primaryColorHex: '#EF4444',
    secondaryColorHex: '#B91C1C',
    defaultTotalCommits: 46950,
    defaultBuilderCount: 138,
    coordinates: { gridOffsetX: -60, gridOffsetZ: -120 }
  },
  {
    slug: 'bits-pilani',
    name: 'BITS Pilani',
    shortLabel: 'BITS Pilani / Goa / Hyd',
    category: 'campus',
    stateOrRegion: 'Rajasthan / Pan-India',
    rivalSlug: 'iit-kanpur',
    isFeaturedMatchup: true,
    primaryColorHex: '#F59E0B',
    secondaryColorHex: '#D97706',
    defaultTotalCommits: 51400,
    defaultBuilderCount: 156,
    coordinates: { gridOffsetX: 0, gridOffsetZ: -120 }
  },
  {
    slug: 'iit-kanpur',
    name: 'IIT Kanpur',
    shortLabel: 'IITK Kalyanpur',
    category: 'campus',
    stateOrRegion: 'Uttar Pradesh',
    rivalSlug: 'bits-pilani',
    isFeaturedMatchup: true,
    primaryColorHex: '#FB923C',
    secondaryColorHex: '#EA580C',
    defaultTotalCommits: 44800,
    defaultBuilderCount: 129,
    coordinates: { gridOffsetX: 60, gridOffsetZ: -120 }
  },
  {
    slug: 'iit-madras',
    name: 'IIT Madras',
    shortLabel: 'IITM Guindy',
    category: 'campus',
    stateOrRegion: 'Tamil Nadu',
    rivalSlug: 'iit-kharagpur',
    isFeaturedMatchup: false,
    primaryColorHex: '#10B981',
    secondaryColorHex: '#059669',
    defaultTotalCommits: 43100,
    defaultBuilderCount: 124,
    coordinates: { gridOffsetX: 120, gridOffsetZ: -120 }
  },
  {
    slug: 'iit-kharagpur',
    name: 'IIT Kharagpur',
    shortLabel: 'IIT KGP',
    category: 'campus',
    stateOrRegion: 'West Bengal',
    rivalSlug: 'iit-madras',
    isFeaturedMatchup: false,
    primaryColorHex: '#FACC15',
    secondaryColorHex: '#CA8A04',
    defaultTotalCommits: 42650,
    defaultBuilderCount: 131,
    coordinates: { gridOffsetX: -120, gridOffsetZ: -60 }
  },
  {
    slug: 'iit-roorkee',
    name: 'IIT Roorkee',
    shortLabel: 'IITR Thomso',
    category: 'campus',
    stateOrRegion: 'Uttarakhand',
    rivalSlug: 'iit-guwahati',
    isFeaturedMatchup: false,
    primaryColorHex: '#60A5FA',
    secondaryColorHex: '#2563EB',
    defaultTotalCommits: 39400,
    defaultBuilderCount: 118,
    coordinates: { gridOffsetX: -60, gridOffsetZ: -60 }
  },
  {
    slug: 'iit-guwahati',
    name: 'IIT Guwahati',
    shortLabel: 'IITG Brahmaputra',
    category: 'campus',
    stateOrRegion: 'Assam',
    rivalSlug: 'iit-roorkee',
    isFeaturedMatchup: false,
    primaryColorHex: '#2DD4BF',
    secondaryColorHex: '#0D9488',
    defaultTotalCommits: 36200,
    defaultBuilderCount: 109,
    coordinates: { gridOffsetX: 0, gridOffsetZ: -60 }
  },
  {
    slug: 'iiit-hyderabad',
    name: 'IIIT Hyderabad',
    shortLabel: 'IIITH Gachibowli',
    category: 'campus',
    stateOrRegion: 'Telangana',
    rivalSlug: 'nit-trichy',
    isFeaturedMatchup: true,
    primaryColorHex: '#E2FF32',
    secondaryColorHex: '#84CC16',
    defaultTotalCommits: 54900,
    defaultBuilderCount: 115,
    coordinates: { gridOffsetX: 60, gridOffsetZ: -60 }
  },
  {
    slug: 'nit-trichy',
    name: 'NIT Trichy',
    shortLabel: 'NITT Tanjore Rd',
    category: 'campus',
    stateOrRegion: 'Tamil Nadu',
    rivalSlug: 'iiit-hyderabad',
    isFeaturedMatchup: true,
    primaryColorHex: '#F43F5E',
    secondaryColorHex: '#E11D48',
    defaultTotalCommits: 38700,
    defaultBuilderCount: 122,
    coordinates: { gridOffsetX: 120, gridOffsetZ: -60 }
  },
  {
    slug: 'nit-surathkal',
    name: 'NIT Surathkal (NITK)',
    shortLabel: 'NITK Beach Campus',
    category: 'campus',
    stateOrRegion: 'Karnataka',
    rivalSlug: 'nit-warangal',
    isFeaturedMatchup: false,
    primaryColorHex: '#34D399',
    secondaryColorHex: '#10B981',
    defaultTotalCommits: 35800,
    defaultBuilderCount: 114,
    coordinates: { gridOffsetX: -120, gridOffsetZ: 0 }
  },
  {
    slug: 'nit-warangal',
    name: 'NIT Warangal',
    shortLabel: 'NITW Kazipet',
    category: 'campus',
    stateOrRegion: 'Telangana',
    rivalSlug: 'nit-surathkal',
    isFeaturedMatchup: false,
    primaryColorHex: '#818CF8',
    secondaryColorHex: '#4F46E5',
    defaultTotalCommits: 34100,
    defaultBuilderCount: 108,
    coordinates: { gridOffsetX: -60, gridOffsetZ: 0 }
  },
  {
    slug: 'dtu-delhi',
    name: 'DTU Delhi',
    shortLabel: 'DTU Bawana Rd',
    category: 'campus',
    stateOrRegion: 'Delhi NCR',
    rivalSlug: 'nsut-delhi',
    isFeaturedMatchup: true,
    primaryColorHex: '#C084FC',
    secondaryColorHex: '#9333EA',
    defaultTotalCommits: 41200,
    defaultBuilderCount: 149,
    coordinates: { gridOffsetX: 0, gridOffsetZ: 0 }
  },
  {
    slug: 'nsut-delhi',
    name: 'NSUT Delhi',
    shortLabel: 'NSUT Dwarka',
    category: 'campus',
    stateOrRegion: 'Delhi NCR',
    rivalSlug: 'dtu-delhi',
    isFeaturedMatchup: true,
    primaryColorHex: '#F472B6',
    secondaryColorHex: '#DB2777',
    defaultTotalCommits: 37600,
    defaultBuilderCount: 134,
    coordinates: { gridOffsetX: 60, gridOffsetZ: 0 }
  },
  {
    slug: 'vit-vellore',
    name: 'VIT Vellore',
    shortLabel: 'VIT Katpadi',
    category: 'campus',
    stateOrRegion: 'Tamil Nadu',
    rivalSlug: 'srm-chennai',
    isFeaturedMatchup: true,
    primaryColorHex: '#6366F1',
    secondaryColorHex: '#4338CA',
    defaultTotalCommits: 45300,
    defaultBuilderCount: 195,
    coordinates: { gridOffsetX: 120, gridOffsetZ: 0 }
  },
  {
    slug: 'srm-chennai',
    name: 'SRM KTR Chennai',
    shortLabel: 'SRM Kattankulathur',
    category: 'campus',
    stateOrRegion: 'Tamil Nadu',
    rivalSlug: 'vit-vellore',
    isFeaturedMatchup: true,
    primaryColorHex: '#F97316',
    secondaryColorHex: '#C2410C',
    defaultTotalCommits: 39800,
    defaultBuilderCount: 182,
    coordinates: { gridOffsetX: -120, gridOffsetZ: 60 }
  },

  // --- 6 Indian Tech Hubs / Corridors (3 Head-to-Head Rivalry Pairs) ---
  {
    slug: 'blr-indiranagar-hsr',
    name: 'Bengaluru (HSR / Indiranagar)',
    shortLabel: 'BLR • HSR & Indiranagar',
    category: 'tech_hub',
    stateOrRegion: 'Karnataka',
    rivalSlug: 'hyd-hitec-gachibowli',
    isFeaturedMatchup: true,
    primaryColorHex: '#E2FF32',
    secondaryColorHex: '#65A30D',
    defaultTotalCommits: 142500,
    defaultBuilderCount: 410,
    coordinates: { gridOffsetX: -60, gridOffsetZ: 60 }
  },
  {
    slug: 'hyd-hitec-gachibowli',
    name: 'Hyderabad (HITEC City / Gachibowli)',
    shortLabel: 'HYD • HITEC & Gachibowli',
    category: 'tech_hub',
    stateOrRegion: 'Telangana',
    rivalSlug: 'blr-indiranagar-hsr',
    isFeaturedMatchup: true,
    primaryColorHex: '#38BDF8',
    secondaryColorHex: '#0369A1',
    defaultTotalCommits: 98400,
    defaultBuilderCount: 295,
    coordinates: { gridOffsetX: 0, gridOffsetZ: 60 }
  },
  {
    slug: 'pune-hinjewadi-baner',
    name: 'Pune (Hinjewadi / Baner)',
    shortLabel: 'PNQ • Hinjewadi & Baner',
    category: 'tech_hub',
    stateOrRegion: 'Maharashtra',
    rivalSlug: 'ncr-gurugram-cyberhub',
    isFeaturedMatchup: false,
    primaryColorHex: '#FB923C',
    secondaryColorHex: '#C2410C',
    defaultTotalCommits: 76200,
    defaultBuilderCount: 240,
    coordinates: { gridOffsetX: 60, gridOffsetZ: 60 }
  },
  {
    slug: 'ncr-gurugram-cyberhub',
    name: 'Gurugram (CyberHub / Golf Course Rd)',
    shortLabel: 'GGN • CyberHub NCR',
    category: 'tech_hub',
    stateOrRegion: 'Delhi NCR',
    rivalSlug: 'pune-hinjewadi-baner',
    isFeaturedMatchup: false,
    primaryColorHex: '#A855F7',
    secondaryColorHex: '#7E22CE',
    defaultTotalCommits: 88900,
    defaultBuilderCount: 265,
    coordinates: { gridOffsetX: 120, gridOffsetZ: 60 }
  },
  {
    slug: 'chennai-omr-taramani',
    name: 'Chennai (OMR / Taramani)',
    shortLabel: 'MAA • OMR SaaS Corridor',
    category: 'tech_hub',
    stateOrRegion: 'Tamil Nadu',
    rivalSlug: 'mumbai-powai-bkc',
    isFeaturedMatchup: false,
    primaryColorHex: '#14B8A6',
    secondaryColorHex: '#0F766E',
    defaultTotalCommits: 64300,
    defaultBuilderCount: 205,
    coordinates: { gridOffsetX: -60, gridOffsetZ: 120 }
  },
  {
    slug: 'mumbai-powai-bkc',
    name: 'Mumbai (Powai / BKC)',
    shortLabel: 'BOM • Powai & BKC',
    category: 'tech_hub',
    stateOrRegion: 'Maharashtra',
    rivalSlug: 'chennai-omr-taramani',
    isFeaturedMatchup: false,
    primaryColorHex: '#EC4899',
    secondaryColorHex: '#BE185D',
    defaultTotalCommits: 67800,
    defaultBuilderCount: 215,
    coordinates: { gridOffsetX: 0, gridOffsetZ: 120 }
  }
];

export const INDIAN_DISTRICTS_BY_SLUG: Record<string, IndianDistrictConfig> =
  INDIAN_DISTRICTS.reduce((acc, district) => {
    acc[district.slug] = district;
    return acc;
  }, {} as Record<string, IndianDistrictConfig>);

// =============================================================================
// 3. HELPER FUNCTIONS: LOOKUPS, VALIDATION & FAIR 1v1 CAMPUS WAR SCORING
// =============================================================================

/**
 * Looks up a shop item strictly by its SKU ID. Returns null if invalid.
 */
export function getShopItemById(itemId: string): CodeNagariShopItem | null {
  if (!itemId) return null;
  const normalized = itemId.trim() as ShopItemId;
  return CODENAGARI_SHOP_ITEMS[normalized] ?? null;
}

/**
 * Looks up a district config by slug. Returns null if not found.
 */
export function getDistrictConfigBySlug(slug: string | null | undefined): IndianDistrictConfig | null {
  if (!slug) return null;
  return INDIAN_DISTRICTS_BY_SLUG[slug.trim().toLowerCase()] ?? null;
}

/**
 * Validates and sanitizes a GitHub username (strips leading @, lowercases, checks regex).
 */
export function normalizeGitHubLogin(rawLogin: string | null | undefined): string | null {
  if (!rawLogin || typeof rawLogin !== 'string') return null;
  const cleaned = rawLogin.trim().replace(/^@+/, '').toLowerCase();
  if (!cleaned) return null;
  const githubRegex = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;
  return githubRegex.test(cleaned) ? cleaned : null;
}

/**
 * Sanitizes an array of batchmate GitHub handles for the Hostel Squad 4-Pack.
 */
export function sanitizeGiftRecipients(
  rawRecipients: unknown,
  buyerLogin: string,
  maxAllowed = 3
): string[] {
  if (!Array.isArray(rawRecipients) || maxAllowed <= 0) return [];
  const normalizedBuyer = normalizeGitHubLogin(buyerLogin) ?? '';
  const uniqueSet = new Set<string>();

  for (const item of rawRecipients) {
    if (typeof item !== 'string') continue;
    const normalized = normalizeGitHubLogin(item);
    if (normalized && normalized !== normalizedBuyer) {
      uniqueSet.add(normalized);
      if (uniqueSet.size >= maxAllowed) break;
    }
  }

  return Array.from(uniqueSet);
}

/**
 * Fair Weekly 1v1 Campus Skyline War Composite Formula:
 * Composite Score = (0.50 * Total Commits) + (0.50 * (Average Commits per Builder * 100))
 *
 * Why this works:
 * - Prevents massive campuses (e.g., VIT/SRM with 10,000+ students) from automatically
 *   steamrolling smaller high-density elite coding campuses (e.g., IIIT Hyderabad or BITS).
 * - Rewards both raw community mobilization (50%) and per-builder commit intensity (50%).
 */
export function computeDistrictWarScore(
  district: Pick<DistrictLiveMetrics, 'slug' | 'name' | 'category' | 'total_commits' | 'builder_count'>
): CampusWarScoreBreakdown {
  const totalCommits = Math.max(0, Number(district.total_commits) || 0);
  const safeBuilderCount = Math.max(1, Number(district.builder_count) || 1);
  const avgCommitsPerBuilder = totalCommits / safeBuilderCount;

  const volumeComponent = totalCommits * 0.5;
  const densityComponent = avgCommitsPerBuilder * 100 * 0.5;
  const compositeScore = Math.round(volumeComponent + densityComponent);

  return {
    slug: district.slug,
    name: district.name,
    category: district.category,
    totalCommits,
    builderCount: Math.max(0, Number(district.builder_count) || 0),
    avgCommitsPerBuilder: Number(avgCommitsPerBuilder.toFixed(1)),
    volumeComponent: Math.round(volumeComponent),
    densityComponent: Math.round(densityComponent),
    compositeScore
  };
}

/**
 * Builds head-to-head 1v1 Campus & Tech Hub Rivalry Matchups from either live
 * Supabase rows or fallback seed configurations.
 */
export function buildWeeklyCampusWarMatchups(
  liveRows?: DistrictLiveMetrics[]
): CampusWarMatchupResult[] {
  const sourceList: DistrictLiveMetrics[] =
    liveRows && liveRows.length > 0
      ? liveRows
      : INDIAN_DISTRICTS.map((d) => ({
          slug: d.slug,
          name: d.name,
          category: d.category,
          total_commits: d.defaultTotalCommits,
          builder_count: d.defaultBuilderCount,
          rival_slug: d.rivalSlug,
          is_featured_matchup: d.isFeaturedMatchup
        }));

  const rowMap = new Map<string, DistrictLiveMetrics>();
  for (const row of sourceList) {
    rowMap.set(row.slug, row);
  }

  const processedSlugs = new Set<string>();
  const matchups: CampusWarMatchupResult[] = [];

  for (const rowA of sourceList) {
    if (processedSlugs.has(rowA.slug)) continue;
    const rivalSlug = rowA.rival_slug;
    if (!rivalSlug) continue;

    const rowB = rowMap.get(rivalSlug);
    if (!rowB || processedSlugs.has(rowB.slug)) continue;

    processedSlugs.add(rowA.slug);
    processedSlugs.add(rowB.slug);

    const scoreA = computeDistrictWarScore(rowA);
    const scoreB = computeDistrictWarScore(rowB);

    const combinedScore = Math.max(1, scoreA.compositeScore + scoreB.compositeScore);
    const shareA = Math.round((scoreA.compositeScore / combinedScore) * 100);
    const shareB = 100 - shareA;

    const leaderSlug =
      scoreA.compositeScore >= scoreB.compositeScore ? scoreA.slug : scoreB.slug;

    matchups.push({
      matchupId: `${scoreA.slug}__vs__${scoreB.slug}`,
      isFeatured: Boolean(rowA.is_featured_matchup || rowB.is_featured_matchup),
      category: rowA.category,
      districtA: scoreA,
      districtB: scoreB,
      leaderSlug,
      winMarginScore: Math.abs(scoreA.compositeScore - scoreB.compositeScore),
      districtAWinSharePercent: shareA,
      districtBWinSharePercent: shareB
    });
  }

  return matchups.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    const maxA = Math.max(a.districtA.compositeScore, a.districtB.compositeScore);
    const maxB = Math.max(b.districtA.compositeScore, b.districtB.compositeScore);
    return maxB - maxA;
  });
}

/**
 * Formats an INR currency amount cleanly (e.g., 49 -> "₹49", 49.01 -> "₹49.01").
 */
export function formatInrAmount(amount: number): string {
  const num = Number(amount) || 0;
  const hasPaisa = Math.round(num * 100) % 100 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2
  }).format(num);
}
