'use client';

// =============================================================================
// File: src/components/CodeNagariOverlay.tsx
// Project: CodeNagari (codenagari.in) - 3D Identity Metropolis for Indian Devs
// Base Repo: srizzon/git-city (AGPL-3.0)
// Description: Complete client-side overlay HUD providing:
//   1. Live "Campus Skyline Wars" 1v1 Banner + District Selector Modal +
//      Recruiter Mode Filter Toggle.
//   2. Floating "Disputed Stat" 1v1 Compare Drawer + 9:16 HTML5 2D Canvas
//      Story/Status Generator ("Heightmogged by +X", "Campus Grinder",
//      codenagari.in watermark).
//   3. Floating "Upgrade Tower / Cosmetic Shop & 3D Sky Blimp" Drawer covering
//      all 6 INR tiers, Hostel Squad 4-Pack gifts, Recruiter Beacon career
//      fields, and 3D Sky Blimp sponsor inputs.
//   4. Personal-UPI-Safe Dynamic QR Checkout Modal with Micro-Paisa Shield
//      explanation, 5:00 countdown, 1-tap QR Gallery Save button, and 2.5s
//      polling for instant UTR verification.
//   5. Required AGPL-3.0 Compliance & Support Footer Pill.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CODENAGARI_SHOP_ITEM_LIST,
  INDIAN_DISTRICTS,
  CodeNagariShopItem,
  ShopItemId,
  CampusWarMatchupResult,
  buildWeeklyCampusWarMatchups,
  computeDistrictWarScore,
  formatInrAmount,
  getDistrictConfigBySlug,
  normalizeGitHubLogin
} from '@/lib/codenagari-config';

export interface EnrichedDistrictState {
  slug: string;
  name: string;
  short_label: string;
  category: 'campus' | 'tech_hub';
  state_or_region: string;
  rival_slug: string | null;
  is_featured_matchup: boolean;
  primary_color_hex: string;
  secondary_color_hex: string;
  coordinates: { gridOffsetX: number; gridOffsetZ: number };
  total_commits: number;
  builder_count: number;
  avg_commits_per_builder: number;
  volume_component: number;
  density_component: number;
  composite_score: number;
}

export interface BuilderProfileState {
  github_login: string;
  district_slug: string | null;
  is_claimed: boolean;
  claimed_at: string | null;
  is_open_to_work: boolean;
  role_target: string | null;
  resume_or_portfolio_url: string | null;
  equipped_items: string[];
  gifted_by: string | null;
  updated_at?: string | null;
}

export interface ActiveSkyBlimpState {
  id: string;
  sponsor_name: string;
  badge_text: string;
  target_url: string;
  district_slug: string | null;
  expires_at: string | null;
}

export interface CityTelemetryPayload {
  ok: boolean;
  generated_at?: string;
  districts: EnrichedDistrictState[];
  weekly_matchups: CampusWarMatchupResult[];
  active_sky_blimps: ActiveSkyBlimpState[];
  profiles: BuilderProfileState[];
  profiles_by_login: Record<string, BuilderProfileState>;
  recruiter_spotlight: BuilderProfileState[];
}

export interface CodeNagariOverlayProps {
  currentUserLogin?: string | null;
  selectedBuildingLogin?: string | null;
  onSelectBuildingLogin?: (login: string | null) => void;
  onFocusDistrict?: (districtSlug: string | null) => void;
  recruiterFilterEnabled?: boolean;
  onToggleRecruiterFilter?: (enabled: boolean) => void;
  onCityStateUpdated?: (state: CityTelemetryPayload) => void;
}

interface GitHubCompareStats {
  login: string;
  name: string;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
  estimatedContributions: number;
  fetchedAt: number;
}

interface ActiveUpiOrderSession {
  order_id: string;
  github_login: string;
  item_id: ShopItemId;
  db_item_id: string;
  item_name: string;
  catalog_amount: number;
  payable_amount: number;
  has_micro_paisa_shield: boolean;
  qr_url: string;
  checkout_url: string;
  gift_recipients: string[];
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  expires_at: string;
  utr_number?: string | null;
  paid_at?: string | null;
}

const GITHUB_STATS_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const REPO_SOURCE_URL = 'https://github.com/srizzon/git-city';
const SUPPORT_WHATSAPP_OR_MAIL =
  'mailto:support@codenagari.in?subject=CodeNagari%20UPI%20Payment%20%26%20Refund%20Support';

function buildFallbackDistricts(): EnrichedDistrictState[] {
  return INDIAN_DISTRICTS.map((d) => {
    const score = computeDistrictWarScore({
      slug: d.slug,
      name: d.name,
      category: d.category,
      total_commits: d.defaultTotalCommits,
      builder_count: d.defaultBuilderCount
    });
    return {
      slug: d.slug,
      name: d.name,
      short_label: d.shortLabel,
      category: d.category,
      state_or_region: d.stateOrRegion,
      rival_slug: d.rivalSlug,
      is_featured_matchup: d.isFeaturedMatchup,
      primary_color_hex: d.primaryColorHex,
      secondary_color_hex: d.secondaryColorHex,
      coordinates: d.coordinates,
      total_commits: score.totalCommits,
      builder_count: score.builderCount,
      avg_commits_per_builder: score.avgCommitsPerBuilder,
      volume_component: score.volumeComponent,
      density_component: score.densityComponent,
      composite_score: score.compositeScore
    };
  }).sort((a, b) => b.composite_score - a.composite_score);
}

function getCachedGitHubStats(login: string): GitHubCompareStats | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`codenagari_gh_${login}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GitHubCompareStats;
    if (Date.now() - parsed.fetchedAt > GITHUB_STATS_CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCachedGitHubStats(login: string, stats: GitHubCompareStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`codenagari_gh_${login}`, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors on restricted mobile browsers
  }
}

async function fetchPublicGitHubStats(rawLogin: string): Promise<GitHubCompareStats> {
  const normalized = normalizeGitHubLogin(rawLogin);
  if (!normalized) {
    throw new Error(`Invalid GitHub username: "${rawLogin}"`);
  }

  const cached = getCachedGitHubStats(normalized);
  if (cached) return cached;

  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(normalized)}`, {
    headers: {
      Accept: 'application/vnd.github+json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GitHub user "${normalized}" not found.`);
    }
    if (response.status === 403) {
      throw new Error('GitHub API rate limit reached. Try again in a moment.');
    }
    throw new Error(`Failed to fetch GitHub profile for "${normalized}".`);
  }

  const data = (await response.json()) as {
    login?: string;
    name?: string | null;
    avatar_url?: string;
    public_repos?: number;
    followers?: number;
    following?: number;
  };

  const publicRepos = Number(data.public_repos ?? 0);
  const followers = Number(data.followers ?? 0);
  const following = Number(data.following ?? 0);
  // Deterministic skyline activity index derived from public repos + followers
  const estimatedContributions = Math.max(45, publicRepos * 28 + followers * 6);

  const result: GitHubCompareStats = {
    login: (data.login ?? normalized).toLowerCase(),
    name: data.name || (data.login ?? normalized),
    avatarUrl: data.avatar_url || '',
    publicRepos,
    followers,
    following,
    estimatedContributions,
    fetchedAt: Date.now()
  };

  setCachedGitHubStats(normalized, result);
  return result;
}

export function CodeNagariOverlay({
  currentUserLogin = null,
  selectedBuildingLogin = null,
  onSelectBuildingLogin,
  onFocusDistrict,
  recruiterFilterEnabled: controlledRecruiterFilter,
  onToggleRecruiterFilter,
  onCityStateUpdated
}: CodeNagariOverlayProps) {
  // ---------------------------------------------------------------------------
  // City Telemetry & Active Matchups State
  // ---------------------------------------------------------------------------
  const [districts, setDistricts] = useState<EnrichedDistrictState[]>(() =>
    buildFallbackDistricts()
  );
  const [matchups, setMatchups] = useState<CampusWarMatchupResult[]>(() =>
    buildWeeklyCampusWarMatchups()
  );
  const [profilesByLogin, setProfilesByLogin] = useState<Record<string, BuilderProfileState>>({});
  const [activeMatchupIndex, setActiveMatchupIndex] = useState<number>(0);

  // Recruiter Mode Filter (supports controlled or internal state)
  const [internalRecruiterFilter, setInternalRecruiterFilter] = useState<boolean>(false);
  const isRecruiterFilterOn =
    controlledRecruiterFilter !== undefined ? controlledRecruiterFilter : internalRecruiterFilter;

  const handleToggleRecruiter = useCallback(() => {
    const next = !isRecruiterFilterOn;
    setInternalRecruiterFilter(next);
    if (onToggleRecruiterFilter) {
      onToggleRecruiterFilter(next);
    }
  }, [isRecruiterFilterOn, onToggleRecruiterFilter]);

  // ---------------------------------------------------------------------------
  // Modals & Drawers State
  // ---------------------------------------------------------------------------
  const [isDistrictModalOpen, setIsDistrictModalOpen] = useState<boolean>(false);
  const [isCompareDrawerOpen, setIsCompareDrawerOpen] = useState<boolean>(false);
  const [isShopDrawerOpen, setIsShopDrawerOpen] = useState<boolean>(false);

  // District Pledge Form State
  const [pledgeLoginInput, setPledgeLoginInput] = useState<string>(currentUserLogin ?? '');
  const [selectedDistrictSlug, setSelectedDistrictSlug] = useState<string>('iit-bombay');
  const [districtFilterTab, setDistrictFilterTab] = useState<'all' | 'campus' | 'tech_hub'>('all');
  const [isSavingDistrict, setIsSavingDistrict] = useState<boolean>(false);
  const [districtFeedback, setDistrictFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserLogin && !pledgeLoginInput) {
      setPledgeLoginInput(currentUserLogin);
    }
  }, [currentUserLogin, pledgeLoginInput]);

  // ---------------------------------------------------------------------------
  // Disputed Stat 1v1 Compare & 9:16 HTML5 Canvas Card State
  // ---------------------------------------------------------------------------
  const [userAInput, setUserAInput] = useState<string>(currentUserLogin || 'torvalds');
  const [userBInput, setUserBInput] = useState<string>('gaearon');
  const [statsA, setStatsA] = useState<GitHubCompareStats | null>(null);
  const [statsB, setStatsB] = useState<GitHubCompareStats | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [storyDataUrl, setStoryDataUrl] = useState<string | null>(null);
  const storyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ---------------------------------------------------------------------------
  // INR Impulse Shop & Dynamic QR Checkout Modal State
  // ---------------------------------------------------------------------------
  const [buyerLoginInput, setBuyerLoginInput] = useState<string>(currentUserLogin ?? '');
  const [selectedShopItemId, setSelectedShopItemId] = useState<ShopItemId>('chakra_neon_crown');

  // Recruiter Hologram Beacon fields (₹99)
  const [roleTargetInput, setRoleTargetInput] = useState<string>('SDE-1 / Full-Stack Engineer');
  const [portfolioUrlInput, setPortfolioUrlInput] = useState<string>('');

  // Hostel Squad 4-Pack gift recipients (₹149)
  const [giftFriend1, setGiftFriend1] = useState<string>('');
  const [giftFriend2, setGiftFriend2] = useState<string>('');
  const [giftFriend3, setGiftFriend3] = useState<string>('');

  // 3D Sky Blimp Sponsor fields (₹999 / ₹1,999)
  const [blimpSponsorName, setBlimpSponsorName] = useState<string>('');
  const [blimpHeadline20, setBlimpHeadline20] = useState<string>('HIRING SDE IN BLR');
  const [blimpTargetUrl, setBlimpTargetUrl] = useState<string>('https://codenagari.in');
  const [blimpDistrictSlug, setBlimpDistrictSlug] = useState<string>('blr-indiranagar-hsr');

  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [shopError, setShopError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveUpiOrderSession | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  useEffect(() => {
    if (currentUserLogin && !buyerLoginInput) {
      setBuyerLoginInput(currentUserLogin);
    }
  }, [currentUserLogin, buyerLoginInput]);

  // ---------------------------------------------------------------------------
  // Fetch Live Metropolis State from /api/codenagari/city-state
  // ---------------------------------------------------------------------------
  const refreshCityState = useCallback(async () => {
    try {
      const res = await fetch('/api/codenagari/city-state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as CityTelemetryPayload;
      if (!data.ok) return;

      if (Array.isArray(data.districts) && data.districts.length > 0) {
        setDistricts(data.districts);
      }
      if (Array.isArray(data.weekly_matchups) && data.weekly_matchups.length > 0) {
        setMatchups(data.weekly_matchups);
      }
      if (data.profiles_by_login) {
        setProfilesByLogin(data.profiles_by_login);
      }
      if (onCityStateUpdated) {
        onCityStateUpdated(data);
      }
    } catch {
      // Keep fallback seed state if network is offline
    }
  }, [onCityStateUpdated]);

  useEffect(() => {
    void refreshCityState();
    const interval = setInterval(() => {
      void refreshCityState();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshCityState]);

  const currentMatchup = useMemo(() => {
    if (matchups.length === 0) return null;
    const safeIdx = activeMatchupIndex % matchups.length;
    return matchups[safeIdx];
  }, [matchups, activeMatchupIndex]);

  const selectedShopItem: CodeNagariShopItem = useMemo(() => {
    return (
      CODENAGARI_SHOP_ITEM_LIST.find((item) => item.id === selectedShopItemId) ??
      CODENAGARI_SHOP_ITEM_LIST[1]
    );
  }, [selectedShopItemId]);

  const filteredDistrictsForModal = useMemo(() => {
    if (districtFilterTab === 'all') return districts;
    return districts.filter((d) => d.category === districtFilterTab);
  }, [districts, districtFilterTab]);

  // Recruiter candidates list when Recruiter Mode is toggled ON
  const recruiterCandidates = useMemo(() => {
    return Object.values(profilesByLogin).filter(
      (p) => p.is_open_to_work || p.equipped_items?.includes('recruiter_hologram_beacon')
    );
  }, [profilesByLogin]);

  // ---------------------------------------------------------------------------
  // District Assignment Handler (POST /api/codenagari/city-state)
  // ---------------------------------------------------------------------------
  const handleSaveDistrictPledge = async (e: React.FormEvent) => {
    e.preventDefault();
    setDistrictFeedback(null);

    const normalizedLogin = normalizeGitHubLogin(pledgeLoginInput);
    if (!normalizedLogin) {
      setDistrictFeedback('Enter a valid GitHub username first.');
      return;
    }

    setIsSavingDistrict(true);
    try {
      const res = await fetch('/api/codenagari/city-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_login: normalizedLogin,
          district_slug: selectedDistrictSlug
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setDistrictFeedback(json.message || 'Could not update district assignment.');
      } else {
        const cfg = getDistrictConfigBySlug(selectedDistrictSlug);
        setDistrictFeedback(
          `@${normalizedLogin} is now anchored in ${cfg?.name ?? selectedDistrictSlug}!`
        );
        if (onFocusDistrict) {
          onFocusDistrict(selectedDistrictSlug);
        }
        await refreshCityState();
      }
    } catch {
      setDistrictFeedback('Network error while saving district.');
    } finally {
      setIsSavingDistrict(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 9:16 Vertical Story Card HTML5 2D Canvas Renderer
  // ---------------------------------------------------------------------------
  const renderStoryCanvasCard = useCallback(
    (a: GitHubCompareStats, b: GitHubCompareStats) => {
      const canvas = storyCanvasRef.current;
      if (!canvas) return;

      const width = 1080;
      const height = 1920;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Deep midnight cyber-pixel backdrop (#070B14)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#070B14');
      bgGrad.addColorStop(0.5, '#0D1526');
      bgGrad.addColorStop(1, '#05080F');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle pixel grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Outer neon frame
      ctx.strokeStyle = '#E2FF32';
      ctx.lineWidth = 6;
      ctx.strokeRect(36, 36, width - 72, height - 72);

      // Header Tag
      ctx.fillStyle = '#E2FF32';
      ctx.fillRect(80, 95, 420, 54);
      ctx.fillStyle = '#070B14';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('DISPUTED STAT • 1V1 DUEL', 102, 131);

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('CAMPUS SKYLINE WARS', 540, 131);

      // Title
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 68px monospace';
      ctx.fillText(`@${a.login}`, 80, 250);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 54px monospace';
      ctx.fillText('VS', 80, 325);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 68px monospace';
      ctx.fillText(`@${b.login}`, 185, 325);

      // Compute witty "Heightmogged" delta
      const repoDiff = a.publicRepos - b.publicRepos;
      const followerDiff = a.followers - b.followers;
      const winner =
        a.estimatedContributions >= b.estimatedContributions ? a : b;
      const loser = winner.login === a.login ? b : a;
      const contribDelta = Math.abs(
        a.estimatedContributions - b.estimatedContributions
      );

      let mogHeadline = `HEIGHTMOGGED BY +${contribDelta} SKYLINE PTS`;
      if (Math.abs(repoDiff) >= Math.abs(followerDiff) && repoDiff !== 0) {
        const sign = repoDiff > 0 ? `+${repoDiff}` : `${repoDiff}`;
        mogHeadline = `HEIGHTMOGGED BY ${sign} REPOS`;
      } else if (followerDiff !== 0) {
        const sign = followerDiff > 0 ? `+${followerDiff}` : `${followerDiff}`;
        mogHeadline = `HEIGHTMOGGED BY ${sign} FOLLOWERS`;
      }

      // Witty Mog Badge Box
      ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
      ctx.fillRect(80, 385, width - 160, 120);
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 4;
      ctx.strokeRect(80, 385, width - 160, 120);

      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 38px monospace';
      ctx.fillText(mogHeadline, 112, 458);

      // Dual Tower Comparison Bars (9:16 vertical visual)
      const drawTowerColumn = (
        person: GitHubCompareStats,
        colX: number,
        accentColor: string,
        badgeLabel: string
      ) => {
        const colW = 410;
        const baseY = 1480;
        const maxTowerH = 620;
        const maxRef = Math.max(
          100,
          a.estimatedContributions,
          b.estimatedContributions
        );
        const towerH = Math.max(
          140,
          Math.min(maxTowerH, Math.round((person.estimatedContributions / maxRef) * maxTowerH))
        );
        const towerY = baseY - towerH;

        // Card container
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(colX, 550, colW, 1020);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 3;
        ctx.strokeRect(colX, 550, colW, 1020);

        // Badge pill
        ctx.fillStyle = accentColor;
        ctx.fillRect(colX + 24, 580, colW - 48, 46);
        ctx.fillStyle = '#070B14';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(badgeLabel, colX + 42, 611);

        // Handle
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 34px monospace';
        ctx.fillText(`@${person.login.slice(0, 16)}`, colX + 24, 680);

        // 3D Pixel Skyscraper Bar
        ctx.fillStyle = accentColor;
        ctx.fillRect(colX + 95, towerY, 220, towerH);

        // Tower windows
        ctx.fillStyle = '#070B14';
        for (let wy = towerY + 24; wy < baseY - 24; wy += 42) {
          ctx.fillRect(colX + 125, wy, 36, 20);
          ctx.fillRect(colX + 187, wy, 36, 20);
          ctx.fillRect(colX + 249, wy, 36, 20);
        }

        // Ground line
        ctx.fillStyle = '#64748B';
        ctx.fillRect(colX + 40, baseY, colW - 80, 6);

        // Stats breakdown below tower
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(`REPOS: ${person.publicRepos}`, colX + 28, 1525);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '26px monospace';
        ctx.fillText(`FOLLOWERS: ${person.followers}`, colX + 28, 1560);
      };

      drawTowerColumn(
        a,
        80,
        a.login === winner.login ? '#E2FF32' : '#38BDF8',
        a.login === winner.login ? 'CAMPUS GRINDER • LEAD' : 'CHALLENGER'
      );
      drawTowerColumn(
        b,
        590,
        b.login === winner.login ? '#E2FF32' : '#F59E0B',
        b.login === winner.login ? 'CAMPUS GRINDER • LEAD' : `TRAILS @${loser.login}`
      );

      // Footer Watermark (codenagari.in)
      ctx.fillStyle = 'rgba(7, 11, 20, 0.95)';
      ctx.fillRect(80, 1635, width - 160, 145);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.strokeRect(80, 1635, width - 160, 145);

      ctx.fillStyle = '#E2FF32';
      ctx.font = 'bold 46px monospace';
      ctx.fillText('codenagari.in', 115, 1705);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '26px monospace';
      ctx.fillText(
        'INDIAN DEVELOPER 3D SKYLINE • CLAIM YOUR TOWER FREE',
        115,
        1752
      );

      try {
        const dataUrl = canvas.toDataURL('image/png');
        setStoryDataUrl(dataUrl);
      } catch {
        setStoryDataUrl(null);
      }
    },
    []
  );

  const handleRun1v1Compare = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompareError(null);
    setStoryDataUrl(null);

    const loginA = normalizeGitHubLogin(userAInput);
    const loginB = normalizeGitHubLogin(userBInput);

    if (!loginA || !loginB) {
      setCompareError('Please enter two valid GitHub usernames (e.g., torvalds vs gaearon).');
      return;
    }

    setIsComparing(true);
    try {
      const [resA, resB] = await Promise.all([
        fetchPublicGitHubStats(loginA),
        fetchPublicGitHubStats(loginB)
      ]);
      setStatsA(resA);
      setStatsB(resB);
      requestAnimationFrame(() => {
        renderStoryCanvasCard(resA, resB);
      });
    } catch (err) {
      setCompareError(
        err instanceof Error ? err.message : 'Unable to compare GitHub profiles right now.'
      );
    } finally {
      setIsComparing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UPI Order Creation (POST /api/upi/create-order) & 2.5s Status Polling
  // ---------------------------------------------------------------------------
  const handleStartUpiCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopError(null);

    const normalizedBuyer = normalizeGitHubLogin(buyerLoginInput);
    if (!normalizedBuyer) {
      setShopError('Enter your GitHub username so we can equip your 3D tower.');
      return;
    }

    const giftRecipients =
      selectedShopItem.maxGiftRecipients > 0
        ? [giftFriend1, giftFriend2, giftFriend3]
            .map((g) => normalizeGitHubLogin(g))
            .filter((g): g is string => Boolean(g) && g !== normalizedBuyer)
            .slice(0, selectedShopItem.maxGiftRecipients)
        : [];

    const blimpPayload: Record<string, string> = {};
    if (selectedShopItem.requiresBlimpPayload) {
      if (!blimpSponsorName.trim() || !blimpHeadline20.trim()) {
        setShopError('Enter both Sponsor Name and a 20-char Headline for your 3D Sky Blimp.');
        return;
      }
      blimpPayload.sponsor_name = blimpSponsorName.trim().slice(0, 48);
      blimpPayload.badge_text = blimpHeadline20.trim().slice(0, 20);
      blimpPayload.target_url = blimpTargetUrl.trim() || 'https://codenagari.in';
      blimpPayload.district_slug = blimpDistrictSlug;
    }

    if (selectedShopItem.requiresCareerPayload) {
      if (roleTargetInput.trim()) {
        blimpPayload.role_target = roleTargetInput.trim().slice(0, 60);
      }
      if (portfolioUrlInput.trim()) {
        blimpPayload.resume_or_portfolio_url = portfolioUrlInput.trim().slice(0, 250);
      }
    }

    setIsCreatingOrder(true);
    try {
      const res = await fetch('/api/upi/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_login: normalizedBuyer,
          item_id: selectedShopItem.id,
          gift_recipients: giftRecipients,
          blimp_payload: Object.keys(blimpPayload).length > 0 ? blimpPayload : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.order) {
        setShopError(data.message || 'Failed to generate UPI QR order.');
        return;
      }

      const orderSession = data.order as ActiveUpiOrderSession;
      setActiveOrder(orderSession);

      const remainingSec = Math.max(
        1,
        Math.floor((new Date(orderSession.expires_at).getTime() - Date.now()) / 1000)
      );
      setSecondsRemaining(Math.min(300, remainingSec));
    } catch {
      setShopError('Network error while connecting to FamGateway UPI checkout.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // 1-second countdown timer for active UPI order (300s window)
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'PENDING') return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setActiveOrder((curr) => (curr ? { ...curr, status: 'EXPIRED' } : null));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeOrder]);

  // Poll GET /api/upi/create-order?order_id=... every 2.5 seconds until PAID or EXPIRED
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'PENDING') return;

    const pollOrderStatus = async () => {
      try {
        const res = await fetch(
          `/api/upi/create-order?order_id=${encodeURIComponent(activeOrder.order_id)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!json.ok || !json.order) return;

        const polled = json.order as ActiveUpiOrderSession;
        if (polled.status === 'PAID') {
          setActiveOrder(polled);
          await refreshCityState();
        } else if (polled.status === 'EXPIRED') {
          setActiveOrder((curr) => (curr ? { ...curr, status: 'EXPIRED' } : null));
        }
      } catch {
        // Silent retry on next 2.5s tick
      }
    };

    const pollInterval = setInterval(() => {
      void pollOrderStatus();
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeOrder, refreshCityState]);

  // 1-Tap Save QR Image to Phone Gallery
  const handleSaveQrToPhone = async () => {
    if (!activeOrder?.qr_url) return;
    try {
      const response = await fetch(activeOrder.qr_url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `codenagari-upi-${activeOrder.payable_amount}-${activeOrder.order_id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    } catch {
      window.open(activeOrder.qr_url, '_blank', 'noopener,noreferrer');
    }
  };

  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [secondsRemaining]);

  const inspectedProfile = useMemo(() => {
    if (!selectedBuildingLogin) return null;
    return profilesByLogin[selectedBuildingLogin.toLowerCase()] ?? null;
  }, [selectedBuildingLogin, profilesByLogin]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-2.5 sm:p-4 font-mono text-slate-100 select-none">
      {/* =====================================================================
          1. TOP LIVE "CAMPUS SKYLINE WARS" 1V1 BANNER
      ===================================================================== */}
      <div className="pointer-events-auto mx-auto w-full max-w-6xl rounded-xl border border-cyan-400/35 bg-[#070B14]/90 backdrop-blur-md shadow-[0_0_25px_rgba(6,182,212,0.16)] px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Brand & Matchup Switcher */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded bg-[#E2FF32] px-2 py-0.5 text-[11px] font-black tracking-wider text-[#070B14]">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              CODENAGARI WARS
            </span>

            {matchups.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setActiveMatchupIndex((prev) => (prev + 1) % matchups.length)
                }
                className="rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[11px] text-cyan-300 hover:border-cyan-400 transition cursor-pointer"
                title="Cycle 1v1 Campus & Tech Hub Matchups"
              >
                NEXT 1V1 ({((activeMatchupIndex % matchups.length) + 1)}/{matchups.length})
              </button>
            )}
          </div>

          {/* Center: Live Tug-of-War Bar */}
          {currentMatchup && (
            <div className="flex-1 min-w-[230px] max-w-xl">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold mb-1">
                <span className="text-amber-300 truncate">
                  {currentMatchup.districtA.name}{' '}
                  <span className="text-slate-400">
                    ({currentMatchup.districtA.compositeScore.toLocaleString('en-IN')})
                  </span>
                </span>
                <span className="px-1.5 text-[10px] text-emerald-400 font-black">VS</span>
                <span className="text-cyan-300 truncate text-right">
                  <span className="text-slate-400">
                    ({currentMatchup.districtB.compositeScore.toLocaleString('en-IN')})
                  </span>{' '}
                  {currentMatchup.districtB.name}
                </span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700 flex">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                  style={{ width: `${currentMatchup.districtAWinSharePercent}%` }}
                />
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${currentMatchup.districtBWinSharePercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Right: District Pledge & Recruiter Filter Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDistrictFeedback(null);
                setIsDistrictModalOpen(true);
              }}
              className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-amber-200 hover:bg-amber-500/25 transition cursor-pointer"
            >
              Join Campus / City
            </button>

            <button
              type="button"
              onClick={handleToggleRecruiter}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                isRecruiterFilterOn
                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.35)]'
                  : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:border-emerald-400/60'
              }`}
            >
              {isRecruiterFilterOn
                ? `Recruiter Mode: ON (${recruiterCandidates.length})`
                : 'Recruiter Mode: Open-to-SDE'}
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MIDDLE AREA: FLOATING ACTION TRIGGERS + ACTIVE DRAWERS
      ===================================================================== */}
      <div className="relative my-auto flex flex-col sm:flex-row items-end sm:items-center justify-between gap-2">
        {/* Left Floating Action Stack */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsCompareDrawerOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-[#070B14]/92 px-3.5 py-2.5 text-xs font-bold text-cyan-200 shadow-[0_0_20px_rgba(56,189,248,0.22)] hover:border-cyan-300 backdrop-blur-md transition cursor-pointer"
          >
            <span className="text-base">⚔️</span>
            <span>Disputed Stat 1v1</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShopDrawerOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-[#E2FF32]/60 bg-[#070B14]/92 px-3.5 py-2.5 text-xs font-bold text-[#E2FF32] shadow-[0_0_20px_rgba(226,255,50,0.22)] hover:bg-slate-900 backdrop-blur-md transition cursor-pointer"
          >
            <span className="text-base">⚡</span>
            <span>Upgrade Tower / UPI Shop</span>
          </button>
        </div>

        {/* Selected 3D Skyscraper Inspector Card (if user clicked a tower in 3D) */}
        {selectedBuildingLogin && (
          <div className="pointer-events-auto w-full sm:w-80 rounded-xl border border-cyan-400/40 bg-[#070B14]/95 p-3.5 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="font-bold text-sm text-cyan-300">
                @{selectedBuildingLogin}
              </div>
              <button
                type="button"
                onClick={() => onSelectBuildingLogin?.(null)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-slate-300">
              <div>
                District:{' '}
                <span className="text-amber-300 font-semibold">
                  {getDistrictConfigBySlug(inspectedProfile?.district_slug)?.name ||
                    inspectedProfile?.district_slug ||
                    'Unassigned Skyline'}
                </span>
              </div>
              <div>
                Status:{' '}
                {inspectedProfile?.equipped_items?.includes('recruiter_hologram_beacon') ||
                inspectedProfile?.is_open_to_work ? (
                  <span className="rounded bg-emerald-500/20 border border-emerald-400/50 px-1.5 py-0.5 text-[11px] text-emerald-300 font-bold">
                    OPEN TO SDE / INTERN
                  </span>
                ) : inspectedProfile?.is_claimed ||
                  (inspectedProfile?.equipped_items?.length ?? 0) > 0 ? (
                  <span className="text-cyan-300 font-semibold">Claimed Builder</span>
                ) : (
                  <span className="text-amber-500/90">Unclaimed Rust (Claimable)</span>
                )}
              </div>
              {inspectedProfile?.role_target && (
                <div>
                  Target Role:{' '}
                  <span className="text-slate-100">{inspectedProfile.role_target}</span>
                </div>
              )}
              {inspectedProfile?.resume_or_portfolio_url && (
                <div className="pt-1">
                  <a
                    href={inspectedProfile.resume_or_portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/30"
                  >
                    Open Resume / Portfolio ↗
                  </a>
                </div>
              )}
              {(inspectedProfile?.equipped_items?.length ?? 0) > 0 && (
                <div className="pt-1 flex flex-wrap gap-1">
                  {inspectedProfile?.equipped_items.map((item) => (
                    <span
                      key={item}
                      className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] text-[#E2FF32]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. REQUIRED AGPL-3.0 COMPLIANCE & SUPPORT FOOTER PILL (BOTTOM-LEFT)
      ===================================================================== */}
      <div className="flex items-end justify-between">
        <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-700/80 bg-[#070B14]/92 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur-md shadow-lg">
          <a
            href={REPO_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-cyan-300 hover:text-cyan-200 underline decoration-cyan-500/40"
          >
            Open Source AGPL-3.0
          </a>
          <span className="text-slate-600">•</span>
          <a
            href={SUPPORT_WHATSAPP_OR_MAIL}
            className="font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Payment Support / Instant Refund Help
          </a>
        </div>
      </div>

      {/* =====================================================================
          MODAL A: JOIN CAMPUS / TECH CITY DISTRICT SELECTOR
      ===================================================================== */}
      {isDistrictModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-400/40 bg-[#070B14] p-4 sm:p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-white">
                  Assign Campus or Tech Corridor District
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Boost your campus or city in Weekly 1v1 Campus Skyline Wars.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDistrictModalOpen(false)}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              {(['all', 'campus', 'tech_hub'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDistrictFilterTab(tab)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold border transition cursor-pointer ${
                    districtFilterTab === tab
                      ? 'border-[#E2FF32] bg-[#E2FF32]/15 text-[#E2FF32]'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'all'
                    ? 'All Districts'
                    : tab === 'campus'
                    ? 'Campuses (IIT/NIT/BITS)'
                    : 'Tech Hubs (BLR/HYD/PNQ)'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveDistrictPledge} className="mt-3.5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Your GitHub Username
                </label>
                <input
                  type="text"
                  value={pledgeLoginInput}
                  onChange={(e) => setPledgeLoginInput(e.target.value)}
                  placeholder="e.g. aarav-dev"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Select District ({filteredDistrictsForModal.length})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredDistrictsForModal.map((dist) => {
                    const active = selectedDistrictSlug === dist.slug;
                    return (
                      <button
                        key={dist.slug}
                        type="button"
                        onClick={() => setSelectedDistrictSlug(dist.slug)}
                        className={`text-left rounded-lg border p-2.5 transition cursor-pointer ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/15'
                            : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span className="truncate">{dist.name}</span>
                          <span className="text-[10px] text-amber-300 ml-1">
                            {dist.composite_score.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {dist.state_or_region} • {dist.builder_count} builders
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {districtFeedback && (
                <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {districtFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingDistrict}
                className="w-full rounded-xl bg-[#E2FF32] py-2.5 text-xs font-black text-[#070B14] hover:brightness-105 disabled:opacity-50 transition cursor-pointer"
              >
                {isSavingDistrict ? 'Anchoring Tower...' : 'Confirm District Pledge'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          DRAWER B: FLOATING "DISPUTED STAT" 1V1 COMPARE + 9:16 CANVAS STORY
      ===================================================================== */}
      {isCompareDrawerOpen && (
        <div className="pointer-events-auto fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-cyan-400/40 bg-[#070B14]/97 p-4 shadow-2xl overflow-y-auto backdrop-blur-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-cyan-300">
                Disputed Stat 1v1 & 9:16 Story Card
              </h3>
              <p className="text-[11px] text-slate-400">
                Settle hostel & batchmate commit debates with a 9:16 shareable card.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCompareDrawerOpen(false)}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleRun1v1Compare} className="mt-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-amber-300 mb-1">
                  User A (You)
                </label>
                <input
                  type="text"
                  value={userAInput}
                  onChange={(e) => setUserAInput(e.target.value)}
                  placeholder="github_a"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-cyan-300 mb-1">
                  User B (Batchmate)
                </label>
                <input
                  type="text"
                  value={userBInput}
                  onChange={(e) => setUserBInput(e.target.value)}
                  placeholder="github_b"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            {compareError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {compareError}
              </div>
            )}

            <button
              type="submit"
              disabled={isComparing}
              className="w-full rounded-xl border border-cyan-400 bg-cyan-500/20 py-2.5 text-xs font-black text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50 transition cursor-pointer"
            >
              {isComparing ? 'Fetching GitHub Stats...' : 'Generate 9:16 Mog Card'}
            </button>
          </form>

          {statsA && statsB && (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                  <div className="font-bold text-amber-300">@{statsA.login}</div>
                  <div className="text-slate-300 mt-1">Repos: {statsA.publicRepos}</div>
                  <div className="text-slate-400">Followers: {statsA.followers}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                  <div className="font-bold text-cyan-300">@{statsB.login}</div>
                  <div className="text-slate-300 mt-1">Repos: {statsB.publicRepos}</div>
                  <div className="text-slate-400">Followers: {statsB.followers}</div>
                </div>
              </div>

              {storyDataUrl && (
                <div className="space-y-2">
                  <img
                    src={storyDataUrl}
                    alt={`1v1 Story Card comparing ${statsA.login} vs ${statsB.login}`}
                    className="mx-auto max-h-80 rounded-lg border border-slate-700 object-contain"
                  />
                  <a
                    href={storyDataUrl}
                    download={`codenagari-1v1-${statsA.login}-vs-${statsB.login}.png`}
                    className="block w-full rounded-xl bg-[#E2FF32] py-2 text-center text-xs font-black text-[#070B14] hover:brightness-105"
                  >
                    Download 9:16 Story PNG (WhatsApp / IG)
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Hidden HTML5 2D Canvas used for 9:16 export */}
          <canvas ref={storyCanvasRef} className="hidden" />
        </div>
      )}

      {/* =====================================================================
          DRAWER C: FLOATING "UPGRADE TOWER / COSMETIC SHOP & 3D SKY BLIMP"
      ===================================================================== */}
      {isShopDrawerOpen && (
        <div className="pointer-events-auto fixed inset-y-0 left-0 z-40 w-full max-w-md border-r border-[#E2FF32]/40 bg-[#070B14]/97 p-4 shadow-2xl overflow-y-auto backdrop-blur-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-[#E2FF32]">
                CodeNagari Impulse Shop (0% Fee UPI)
              </h3>
              <p className="text-[11px] text-slate-400">
                Personal / FamX UPI safe • Instant UTR verification
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsShopDrawerOpen(false)}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleStartUpiCheckout} className="mt-3.5 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Recipient GitHub Username (Your 3D Tower)
              </label>
              <input
                type="text"
                value={buyerLoginInput}
                onChange={(e) => setBuyerLoginInput(e.target.value)}
                placeholder="your-github-handle"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-[#E2FF32] focus:outline-none"
              />
            </div>

            {/* All 6 INR Tiers */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">Select Upgrade Tier</div>
              {CODENAGARI_SHOP_ITEM_LIST.map((item) => {
                const isSelected = item.id === selectedShopItem.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedShopItemId(item.id);
                      setShopError(null);
                    }}
                    className={`w-full text-left rounded-xl border p-3 transition cursor-pointer ${
                      isSelected
                        ? 'border-[#E2FF32] bg-[#E2FF32]/10'
                        : 'border-slate-800 bg-slate-900/75 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white">{item.name}</span>
                      <span className="shrink-0 rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-xs font-black text-emerald-300">
                        {formatInrAmount(item.priceInr)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{item.tagline}</p>
                  </button>
                );
              })}
            </div>

            {/* Conditional Inputs for ₹99 Recruiter Hologram Beacon */}
            {selectedShopItem.requiresCareerPayload && (
              <div className="space-y-2.5 rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3">
                <div className="text-xs font-bold text-emerald-300">
                  Recruiter Hologram Beacon Details
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    Target Role (e.g., SDE-1 / AI Intern)
                  </label>
                  <input
                    type="text"
                    value={roleTargetInput}
                    onChange={(e) => setRoleTargetInput(e.target.value)}
                    placeholder="SDE-1 / Backend / ML"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    Resume / Portfolio / LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={portfolioUrlInput}
                    onChange={(e) => setPortfolioUrlInput(e.target.value)}
                    placeholder="https://yourportfolio.dev"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* Conditional Inputs for ₹149 Hostel Squad 4-Pack (3 Batchmates) */}
            {selectedShopItem.maxGiftRecipients > 0 && (
              <div className="space-y-2 rounded-xl border border-pink-500/35 bg-pink-950/20 p-3">
                <div className="text-xs font-bold text-pink-300">
                  Gift Chakra Crowns to 3 Batchmates (GitHub Usernames)
                </div>
                <input
                  type="text"
                  value={giftFriend1}
                  onChange={(e) => setGiftFriend1(e.target.value)}
                  placeholder="Batchmate #1 GitHub handle"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  value={giftFriend2}
                  onChange={(e) => setGiftFriend2(e.target.value)}
                  placeholder="Batchmate #2 GitHub handle"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  value={giftFriend3}
                  onChange={(e) => setGiftFriend3(e.target.value)}
                  placeholder="Batchmate #3 GitHub handle"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            )}

            {/* Conditional Inputs for ₹999 / ₹1,999 3D Sky Blimp Sponsor */}
            {selectedShopItem.requiresBlimpPayload && (
              <div className="space-y-2.5 rounded-xl border border-sky-500/35 bg-sky-950/20 p-3">
                <div className="text-xs font-bold text-sky-300">
                  3D Sky Blimp Sponsor Config (Moderated Before Launch)
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    Sponsor / Brand Name
                  </label>
                  <input
                    type="text"
                    value={blimpSponsorName}
                    onChange={(e) => setBlimpSponsorName(e.target.value)}
                    placeholder="e.g. ChaiCode Labs"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    20-Char Blimp Headline ({blimpHeadline20.length}/20)
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={blimpHeadline20}
                    onChange={(e) => setBlimpHeadline20(e.target.value)}
                    placeholder="HIRING SDE IN BLR"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    Target Link URL
                  </label>
                  <input
                    type="url"
                    value={blimpTargetUrl}
                    onChange={(e) => setBlimpTargetUrl(e.target.value)}
                    placeholder="https://yourstartup.in"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    Target District Skyline
                  </label>
                  <select
                    value={blimpDistrictSlug}
                    onChange={(e) => setBlimpDistrictSlug(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    {districts.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {shopError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {shopError}
              </div>
            )}

            <button
              type="submit"
              disabled={isCreatingOrder}
              className="w-full rounded-xl bg-[#E2FF32] py-3 text-xs font-black text-[#070B14] hover:brightness-105 disabled:opacity-50 transition cursor-pointer"
            >
              {isCreatingOrder
                ? 'Generating UPI QR...'
                : `Pay ${formatInrAmount(selectedShopItem.priceInr)} via UPI QR`}
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL D: PERSONAL-UPI-SAFE DYNAMIC QR CHECKOUT MODAL
      ===================================================================== */}
      {activeOrder && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/50 bg-[#070B14] p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  FamGateway 0%-Fee UPI Checkout
                </div>
                <div className="text-sm font-black text-white mt-0.5">
                  {activeOrder.item_name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* STATE 1: PAYMENT VERIFIED (CELEBRATORY GREEN SCREEN) */}
            {activeOrder.status === 'PAID' ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/60 bg-emerald-950/40 p-4 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-xl font-black text-[#070B14]">
                  ✓
                </div>
                <h4 className="text-lg font-black text-emerald-300">
                  PAYMENT VERIFIED!
                </h4>
                <p className="text-xs text-emerald-100/90">
                  Unlocked for <span className="font-bold">@{activeOrder.github_login}</span>.
                  Your 3D skyline has been refreshed!
                </p>

                {activeOrder.utr_number && (
                  <div className="rounded-lg border border-emerald-500/30 bg-slate-950/80 px-3 py-2 text-xs">
                    <span className="text-slate-400">12-Digit Bank UTR Ref: </span>
                    <span className="font-black text-[#E2FF32] tracking-wider">
                      {activeOrder.utr_number}
                    </span>
                  </div>
                )}

                {activeOrder.item_id.startsWith('sky_blimp_sponsor_3d') && (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    3D Sky Blimp queued as <strong>PENDING_APPROVAL</strong> and will fly live
                    immediately after quick moderation.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveOrder(null);
                    setIsShopDrawerOpen(false);
                  }}
                  className="w-full rounded-xl bg-emerald-400 py-2.5 text-xs font-black text-[#070B14] hover:brightness-105 cursor-pointer"
                >
                  Back to CodeNagari 3D City
                </button>
              </div>
            ) : activeOrder.status === 'EXPIRED' ? (
              /* STATE 2: ORDER EXPIRED */
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-center space-y-3">
                <div className="text-sm font-black text-rose-300">
                  5-Minute UPI Window Expired
                </div>
                <p className="text-xs text-slate-300">
                  Generate a fresh QR code so your micro-paisa routing lock remains active.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="w-full rounded-xl bg-[#E2FF32] py-2.5 text-xs font-black text-[#070B14] cursor-pointer"
                >
                  Generate New QR
                </button>
              </div>
            ) : (
              /* STATE 3: PENDING QR SCAN & 2.5s AUTO-POLLING */
              <div className="mt-4 space-y-3.5">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5">
                  <div>
                    <div className="text-[11px] text-slate-400">Exact Payable Amount</div>
                    <div className="text-xl font-black text-[#E2FF32]">
                      {formatInrAmount(activeOrder.payable_amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Expires In</div>
                    <div className="text-base font-black text-cyan-300">
                      {formattedCountdown}
                    </div>
                  </div>
                </div>

                {/* Concurrency Engine 2.0 Adaptive Micro-Paisa Shield Explanation */}
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-100">
                  <strong className="text-amber-300">
                    Concurrency Shield (Adaptive Micro-Paisa):
                  </strong>{' '}
                  Catalog price is{' '}
                  <strong>{formatInrAmount(activeOrder.catalog_amount)}</strong>.
                  {activeOrder.has_micro_paisa_shield ? (
                    <>
                      {' '}
                      A +
                      {formatInrAmount(
                        Number(
                          (activeOrder.payable_amount - activeOrder.catalog_amount).toFixed(2)
                        )
                      )}{' '}
                      micro-paisa routing offset was applied so your personal UPI payment is
                      uniquely matched within seconds without overlapping other active orders.
                    </>
                  ) : (
                    <>
                      {' '}
                      No micro-paisa offset needed right now—pay the exact{' '}
                      <strong>{formatInrAmount(activeOrder.payable_amount)}</strong> shown above.
                    </>
                  )}
                </div>

                {/* Dynamic QR Image */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-white p-3">
                  {activeOrder.qr_url ? (
                    <img
                      src={activeOrder.qr_url}
                      alt={`UPI QR Code for ${formatInrAmount(activeOrder.payable_amount)}`}
                      className="h-52 w-52 object-contain"
                    />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center text-xs text-slate-700">
                      Loading QR...
                    </div>
                  )}
                </div>

                {/* 1-Tap Save QR to Phone Gallery (Single-Device Personal UPI Safe) */}
                <button
                  type="button"
                  onClick={handleSaveQrToPhone}
                  className="w-full rounded-xl border border-cyan-400/60 bg-cyan-500/20 py-2.5 text-xs font-black text-cyan-200 hover:bg-cyan-500/30 transition cursor-pointer"
                >
                  Save QR Image to Phone (Scan from Gallery in GPay / PhonePe / FamApp)
                </button>

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Auto-verifying UTR every 2.5s • Order {activeOrder.order_id}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeNagariOverlay;
