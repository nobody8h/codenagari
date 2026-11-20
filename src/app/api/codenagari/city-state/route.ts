// =============================================================================
// File: src/app/api/codenagari/city-state/route.ts
// Project: CodeNagari (codenagari.in) - 3D Identity Metropolis for Indian Devs
// Description:
//   - GET: Edge/CDN-cached Metropolis Telemetry endpoint returning:
//       1. All Indian Campuses & Tech Hub districts ranked by fair composite
//          war score + 1v1 Weekly Campus Skyline War matchups.
//       2. Active 3D Sky Blimps (status = 'ACTIVE' and non-expired).
//       3. Enriched codenagari_profiles (claimed towers, equipped 3D items,
//          gifted crowns, and Recruiter Skyline Filter candidates).
//     Serves Cache-Control: public, s-maxage=30, stale-while-revalidate=60
//     so Cloudflare / Vercel CDN absorbs viral traffic spikes at ₹0 DB load.
//   - POST: Allows builders to pledge/switch their github_login to an Indian
//     Campus or Tech Hub district_slug, and update their Recruiter Beacon
//     career metadata (is_open_to_work, role_target, resume_or_portfolio_url)
//     if they have unlocked recruiter_hologram_beacon.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  INDIAN_DISTRICTS,
  DistrictLiveMetrics,
  computeDistrictWarScore,
  buildWeeklyCampusWarMatchups,
  getDistrictConfigBySlug,
  normalizeGitHubLogin
} from '@/lib/codenagari-config';

export const runtime = 'nodejs';

const CDN_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
  'CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
};

interface ProfileRow {
  github_login: string;
  district_slug: string | null;
  is_claimed: boolean;
  claimed_at: string | null;
  is_open_to_work: boolean;
  role_target: string | null;
  resume_or_portfolio_url: string | null;
  equipped_items: string[] | null;
  gifted_by: string | null;
  updated_at?: string;
}

interface SkyBlimpRow {
  id: string;
  order_id: string | null;
  sponsor_name: string | null;
  badge_text: string | null;
  target_url: string | null;
  district_slug: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

interface UpdateCityProfileRequestBody {
  github_login?: string;
  district_slug?: string | null;
  commit_contribution_delta?: number;
  is_open_to_work?: boolean;
  role_target?: string;
  resume_or_portfolio_url?: string;
}

/**
 * Initializes the Supabase client (uses Service Role key on server for reliable reads/mutations).
 */
function getSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Sanitizes an external portfolio / resume URL.
 */
function sanitizePortfolioUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString().slice(0, 300);
  } catch {
    return null;
  }
}

/**
 * Sanitizes short role target strings (e.g., "SDE-1 Full-Stack / Backend Intern").
 */
function sanitizeRoleTarget(rawRole: string | undefined | null): string | null {
  if (!rawRole || typeof rawRole !== 'string') return null;
  const cleaned = rawRole
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, 64) : null;
}

// =============================================================================
// GET /api/codenagari/city-state
// =============================================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filterDistrict = searchParams.get('district')?.trim().toLowerCase() || null;
    const onlyRecruiterPool = searchParams.get('recruiter_only') === 'true';

    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    // Execute all 3 queries in parallel for sub-50ms execution
    const [districtsResult, blimpsResult, profilesResult] = await Promise.all([
      supabase
        .from('codenagari_districts')
        .select(
          'slug, name, category, total_commits, builder_count, rival_slug, is_featured_matchup'
        ),
      supabase
        .from('codenagari_sky_blimps')
        .select(
          'id, sponsor_name, badge_text, target_url, district_slug, status, expires_at, created_at'
        )
        .eq('status', 'ACTIVE')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(20),
      (() => {
        let query = supabase
          .from('codenagari_profiles')
          .select(
            'github_login, district_slug, is_claimed, claimed_at, is_open_to_work, role_target, resume_or_portfolio_url, equipped_items, gifted_by, updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(500);

        if (filterDistrict) {
          query = query.eq('district_slug', filterDistrict);
        }
        if (onlyRecruiterPool) {
          query = query.eq('is_open_to_work', true);
        }
        return query;
      })()
    ]);

    // 1. Merge DB district metrics with rich static Indian District coordinates & colors
    const liveDistrictRows: DistrictLiveMetrics[] =
      districtsResult.data && districtsResult.data.length > 0
        ? (districtsResult.data as DistrictLiveMetrics[])
        : INDIAN_DISTRICTS.map((d) => ({
            slug: d.slug,
            name: d.name,
            category: d.category,
            total_commits: d.defaultTotalCommits,
            builder_count: d.defaultBuilderCount,
            rival_slug: d.rivalSlug,
            is_featured_matchup: d.isFeaturedMatchup
          }));

    const enrichedDistricts = liveDistrictRows
      .map((row) => {
        const staticConfig = getDistrictConfigBySlug(row.slug);
        const scoreBreakdown = computeDistrictWarScore(row);

        return {
          slug: row.slug,
          name: row.name,
          short_label: staticConfig?.shortLabel ?? row.name,
          category: row.category,
          state_or_region: staticConfig?.stateOrRegion ?? 'India',
          rival_slug: row.rival_slug,
          is_featured_matchup: row.is_featured_matchup,
          primary_color_hex: staticConfig?.primaryColorHex ?? '#E2FF32',
          secondary_color_hex: staticConfig?.secondaryColorHex ?? '#38BDF8',
          coordinates: staticConfig?.coordinates ?? { gridOffsetX: 0, gridOffsetZ: 0 },
          total_commits: scoreBreakdown.totalCommits,
          builder_count: scoreBreakdown.builderCount,
          avg_commits_per_builder: scoreBreakdown.avgCommitsPerBuilder,
          volume_component: scoreBreakdown.volumeComponent,
          density_component: scoreBreakdown.densityComponent,
          composite_score: scoreBreakdown.compositeScore
        };
      })
      .sort((a, b) => b.composite_score - a.composite_score);

    // 2. Compute Head-to-Head Weekly 1v1 Campus & Tech Hub Matchups
    const weeklyMatchups = buildWeeklyCampusWarMatchups(liveDistrictRows);

    // 3. Format Active 3D Sky Blimps
    const activeSkyBlimps = ((blimpsResult.data ?? []) as SkyBlimpRow[]).map((blimp) => ({
      id: blimp.id,
      sponsor_name: blimp.sponsor_name ?? 'CodeNagari Partner',
      badge_text: blimp.badge_text ?? 'BUILDING IN INDIA',
      target_url: blimp.target_url ?? 'https://codenagari.in',
      district_slug: blimp.district_slug,
      expires_at: blimp.expires_at
    }));

    // 4. Format Enriched Builder Profiles & Recruiter Skyline Filter Index
    const profiles = ((profilesResult.data ?? []) as ProfileRow[]).map((p) => {
      const items = Array.isArray(p.equipped_items) ? p.equipped_items : [];
      const hasRecruiterBeacon = items.includes('recruiter_hologram_beacon');

      return {
        github_login: p.github_login,
        district_slug: p.district_slug,
        is_claimed: Boolean(p.is_claimed),
        claimed_at: p.claimed_at,
        is_open_to_work: Boolean(p.is_open_to_work && hasRecruiterBeacon),
        role_target: hasRecruiterBeacon ? p.role_target : null,
        resume_or_portfolio_url: hasRecruiterBeacon ? p.resume_or_portfolio_url : null,
        equipped_items: items,
        gifted_by: p.gifted_by,
        updated_at: p.updated_at ?? null
      };
    });

    const profilesByLogin: Record<string, (typeof profiles)[number]> = {};
    for (const profile of profiles) {
      profilesByLogin[profile.github_login] = profile;
    }

    const recruiterSpotlight = profiles.filter((p) => p.is_open_to_work);

    return NextResponse.json(
      {
        ok: true,
        generated_at: nowIso,
        districts: enrichedDistricts,
        weekly_matchups: weeklyMatchups,
        active_sky_blimps: activeSkyBlimps,
        profiles,
        profiles_by_login: profilesByLogin,
        recruiter_spotlight: recruiterSpotlight
      },
      {
        status: 200,
        headers: CDN_CACHE_HEADERS
      }
    );
  } catch (err) {
    console.error('[CodeNagari GET /api/codenagari/city-state Error]:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'TELEMETRY_FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Unable to fetch city telemetry.'
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/codenagari/city-state
// Assigns a user's 3D skyscraper to an Indian Campus or Tech Corridor District,
// and updates their Recruiter Skyline Filter profile if they own
// recruiter_hologram_beacon.
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    let body: UpdateCityProfileRequestBody;
    try {
      body = (await req.json()) as UpdateCityProfileRequestBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }

    // 1. Validate GitHub username
    const githubLogin = normalizeGitHubLogin(body.github_login);
    if (!githubLogin) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_GITHUB_LOGIN',
          message: 'A valid GitHub username is required.'
        },
        { status: 400 }
      );
    }

    // 2. Validate district_slug if provided
    let validatedDistrictSlug: string | null | undefined = undefined;
    if (body.district_slug !== undefined) {
      if (body.district_slug === null || body.district_slug === '') {
        validatedDistrictSlug = null;
      } else {
        const districtCfg = getDistrictConfigBySlug(body.district_slug);
        if (!districtCfg) {
          return NextResponse.json(
            {
              ok: false,
              error: 'INVALID_DISTRICT_SLUG',
              message: 'Selected Campus or Tech Hub district does not exist.'
            },
            { status: 400 }
          );
        }
        validatedDistrictSlug = districtCfg.slug;
      }
    }

    const supabase = getSupabaseServerClient();

    // 3. Load existing profile row (if any) to verify unlocked items and previous district
    const { data: existingProfile, error: fetchError } = await supabase
      .from('codenagari_profiles')
      .select(
        'github_login, district_slug, is_claimed, claimed_at, is_open_to_work, role_target, resume_or_portfolio_url, equipped_items, gifted_by'
      )
      .eq('github_login', githubLogin)
      .maybeSingle();

    if (fetchError) {
      console.error('[CodeNagari Profile Lookup Error]:', fetchError);
      return NextResponse.json(
        { ok: false, error: 'DB_READ_ERROR', message: 'Failed to inspect existing profile.' },
        { status: 500 }
      );
    }

    const currentItems: string[] = Array.isArray(existingProfile?.equipped_items)
      ? (existingProfile.equipped_items as string[])
      : [];

    const hasRecruiterBeacon = currentItems.includes('recruiter_hologram_beacon');

    // 4. Enforce Recruiter Beacon ownership check if user tries to enable recruiter settings
    const wantsCareerUpdate =
      body.is_open_to_work !== undefined ||
      body.role_target !== undefined ||
      body.resume_or_portfolio_url !== undefined;

    if (wantsCareerUpdate && !hasRecruiterBeacon) {
      // If they only updated district_slug alongside default career fields, ignore career fields;
      // If they explicitly requested career activation without owning the beacon, return 403.
      if (body.is_open_to_work === true && validatedDistrictSlug === undefined) {
        return NextResponse.json(
          {
            ok: false,
            error: 'RECRUITER_BEACON_REQUIRED',
            message:
              'Unlock the Recruiter Hologram Beacon (₹99) to activate the Open-to-Work Rooftop Laser and Recruiter Skyline Filter.'
          },
          { status: 403 }
        );
      }
    }

    // 5. Assemble sanitized upsert fields
    const nextDistrictSlug =
      validatedDistrictSlug !== undefined
        ? validatedDistrictSlug
        : (existingProfile?.district_slug ?? null);

    const nextIsOpenToWork = hasRecruiterBeacon
      ? body.is_open_to_work !== undefined
        ? Boolean(body.is_open_to_work)
        : Boolean(existingProfile?.is_open_to_work ?? true)
      : false;

    const nextRoleTarget = hasRecruiterBeacon
      ? body.role_target !== undefined
        ? sanitizeRoleTarget(body.role_target)
        : (existingProfile?.role_target ?? 'SDE / Full-Stack Intern')
      : (existingProfile?.role_target ?? null);

    const nextPortfolioUrl = hasRecruiterBeacon
      ? body.resume_or_portfolio_url !== undefined
        ? sanitizePortfolioUrl(body.resume_or_portfolio_url)
        : (existingProfile?.resume_or_portfolio_url ?? null)
      : (existingProfile?.resume_or_portfolio_url ?? null);

    const nowIso = new Date().toISOString();

    const { data: upsertedProfile, error: upsertError } = await supabase
      .from('codenagari_profiles')
      .upsert(
        {
          github_login: githubLogin,
          district_slug: nextDistrictSlug,
          is_claimed: true,
          claimed_at: existingProfile?.claimed_at ?? nowIso,
          is_open_to_work: nextIsOpenToWork,
          role_target: nextRoleTarget,
          resume_or_portfolio_url: nextPortfolioUrl,
          equipped_items: currentItems,
          gifted_by: existingProfile?.gifted_by ?? null,
          updated_at: nowIso
        },
        { onConflict: 'github_login' }
      )
      .select(
        'github_login, district_slug, is_claimed, claimed_at, is_open_to_work, role_target, resume_or_portfolio_url, equipped_items, gifted_by, updated_at'
      )
      .single();

    if (upsertError) {
      console.error('[CodeNagari Profile Upsert Error]:', upsertError);
      return NextResponse.json(
        { ok: false, error: 'PROFILE_UPDATE_FAILED', message: 'Failed to update profile.' },
        { status: 500 }
      );
    }

    // 6. Optional: When a builder newly pledges to a district for the first time,
    //    increment that district's total_commits by a bounded contribution delta
    const previousDistrictSlug = existingProfile?.district_slug ?? null;
    if (nextDistrictSlug && nextDistrictSlug !== previousDistrictSlug) {
      const boundedCommitBoost = Math.min(
        2500,
        Math.max(50, Math.floor(Number(body.commit_contribution_delta) || 250))
      );

      const { data: targetDistrictRow } = await supabase
        .from('codenagari_districts')
        .select('total_commits')
        .eq('slug', nextDistrictSlug)
        .maybeSingle();

      if (targetDistrictRow) {
        const updatedCommits =
          Math.max(0, Number(targetDistrictRow.total_commits) || 0) + boundedCommitBoost;
        await supabase
          .from('codenagari_districts')
          .update({
            total_commits: updatedCommits,
            updated_at: nowIso
          })
          .eq('slug', nextDistrictSlug);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        profile: upsertedProfile,
        has_recruiter_beacon: hasRecruiterBeacon
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    );
  } catch (err) {
    console.error('[CodeNagari POST /api/codenagari/city-state Error]:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected server error.'
      },
      { status: 500 }
    );
  }
}
