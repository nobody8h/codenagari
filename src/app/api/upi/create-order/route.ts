// =============================================================================
// File: src/app/api/upi/create-order/route.ts
// Project: CodeNagari (codenagari.in) - 3D Identity Metropolis for Indian Devs
// Description: Next.js 16 App Router API Route for creating FamGateway 0%-Fee
//              UPI orders (with Concurrency Engine 2.0 Adaptive Micro-Paisa
//              payable_amount support) and polling real-time order status.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  getShopItemById,
  getDistrictConfigBySlug,
  normalizeGitHubLogin,
  sanitizeGiftRecipients,
  BlimpOrderPayload
} from '@/lib/codenagari-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FAMGATEWAY_CREATE_ORDER_ENDPOINT = 'https://famgateway.in/api/create-order';
const ORDER_TTL_SECONDS = 300; // 5-minute Micro-Paisa concurrency lock window

interface CreateOrderRequestBody {
  github_login?: string;
  item_id?: string;
  gift_recipients?: string[];
  blimp_payload?: BlimpOrderPayload;
  role_target?: string;
  resume_or_portfolio_url?: string;
}

interface FamGatewayRawResponse {
  status?: boolean | string;
  success?: boolean;
  message?: string;
  error?: string;
  order_id?: string;
  amount?: number | string;
  payable_amount?: number | string;
  qr_url?: string;
  qr_code?: string;
  qr_image?: string;
  upi_intent?: string;
  checkout_url?: string;
  payment_url?: string;
  expires_in?: number | string;
  data?: {
    order_id?: string;
    amount?: number | string;
    payable_amount?: number | string;
    qr_url?: string;
    qr_code?: string;
    qr_image?: string;
    upi_intent?: string;
    checkout_url?: string;
    payment_url?: string;
    expires_in?: number | string;
  };
  result?: {
    order_id?: string;
    amount?: number | string;
    payable_amount?: number | string;
    qr_url?: string;
    qr_code?: string;
    qr_image?: string;
    upi_intent?: string;
    checkout_url?: string;
    payment_url?: string;
    expires_in?: number | string;
  };
}

/**
 * Initializes a server-side Supabase Service Role client to bypass RLS safely.
 */
function getSupabaseServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Sanitizes URLs submitted for Recruiter Portfolios or 3D Sky Blimp targets.
 */
function sanitizeHttpUrl(rawUrl: string | undefined | null): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return parsed.toString().slice(0, 300);
  } catch {
    return undefined;
  }
}

/**
 * Sanitizes short text fields (sponsor names, blimp badge text, role targets).
 */
function sanitizeTextField(rawText: string | undefined | null, maxLength: number): string | undefined {
  if (!rawText || typeof rawText !== 'string') return undefined;
  const cleaned = rawText
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

/**
 * Adaptive Micro-Paisa Shield fallback calculator if FamGateway returns only catalog amount
 * or if local concurrency collision resolution is required.
 */
async function resolveAdaptivePayableAmount(
  supabase: SupabaseClient,
  catalogAmount: number,
  gatewayPayableAmount: number | null
): Promise<number> {
  if (
    gatewayPayableAmount !== null &&
    Number.isFinite(gatewayPayableAmount) &&
    gatewayPayableAmount >= catalogAmount &&
    gatewayPayableAmount < catalogAmount + 1
  ) {
    return Number(gatewayPayableAmount.toFixed(2));
  }

  // Query active PENDING orders for the same catalog amount within the 300s window
  const nowIso = new Date().toISOString();
  const { data: activeOrders } = await supabase
    .from('codenagari_upi_orders')
    .select('payable_amount')
    .eq('status', 'PENDING')
    .eq('catalog_amount', catalogAmount)
    .gt('expires_at', nowIso);

  const takenAmounts = new Set<string>(
    (activeOrders ?? []).map((row) => Number(row.payable_amount).toFixed(2))
  );

  // Use clean catalog amount (e.g., 49.00) if available; otherwise increment by 0.01 up to +0.99
  for (let paisa = 0; paisa <= 99; paisa++) {
    const candidate = (catalogAmount + paisa / 100).toFixed(2);
    if (!takenAmounts.has(candidate)) {
      return Number(candidate);
    }
  }

  return Number(catalogAmount.toFixed(2));
}

/**
 * Builds a fallback UPI deep-link and dynamic QR URL if the upstream response omits qr_url
 * or when testing in staging before live FamGateway credentials are injected.
 */
function buildFallbackQrAndCheckout(
  payableAmount: number,
  orderId: string,
  githubLogin: string
): { qrUrl: string; checkoutUrl: string } {
  const merchantVpa = process.env.FAMGATEWAY_FALLBACK_VPA || 'famgateway@upi';
  const merchantName = encodeURIComponent('CodeNagari');
  const note = encodeURIComponent(`CN ${orderId} ${githubLogin}`);
  const formattedAmount = payableAmount.toFixed(2);

  const upiIntent = `upi://pay?pa=${encodeURIComponent(
    merchantVpa
  )}&pn=${merchantName}&am=${formattedAmount}&cu=INR&tn=${note}&tr=${encodeURIComponent(orderId)}`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(
    upiIntent
  )}`;

  return {
    qrUrl,
    checkoutUrl: upiIntent
  };
}

// =============================================================================
// POST /api/upi/create-order
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    let body: CreateOrderRequestBody;
    try {
      body = (await request.json()) as CreateOrderRequestBody;
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
          message: 'Please provide a valid GitHub username (without spaces).'
        },
        { status: 400 }
      );
    }

    // 2. Validate SKU item_id and enforce authoritative server-side INR price
    const shopItem = getShopItemById(body.item_id ?? '');
    if (!shopItem) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_ITEM_ID',
          message: 'Selected shop item does not exist in the CodeNagari catalog.'
        },
        { status: 400 }
      );
    }

    const catalogAmount = Number(shopItem.priceInr.toFixed(2));

    // 3. Sanitize optional batchmate gift recipients (for hostel_squad_4pack)
    const giftRecipients = sanitizeGiftRecipients(
      body.gift_recipients,
      githubLogin,
      shopItem.maxGiftRecipients
    );

    // 4. Sanitize optional Blimp & Recruiter Career metadata stored in blimp_payload JSONB
    const rawPayload: BlimpOrderPayload = body.blimp_payload ?? {};
    const sanitizedDistrict = getDistrictConfigBySlug(rawPayload.district_slug)?.slug;

    const sanitizedMetadata: BlimpOrderPayload = {};

    const sponsorName = sanitizeTextField(rawPayload.sponsor_name, 48);
    if (sponsorName) sanitizedMetadata.sponsor_name = sponsorName;

    const badgeText = sanitizeTextField(rawPayload.badge_text, 64);
    if (badgeText) sanitizedMetadata.badge_text = badgeText;

    const targetUrl = sanitizeHttpUrl(rawPayload.target_url);
    if (targetUrl) sanitizedMetadata.target_url = targetUrl;

    if (sanitizedDistrict) {
      sanitizedMetadata.district_slug = sanitizedDistrict;
    }

    const roleTarget = sanitizeTextField(
      body.role_target ?? rawPayload.role_target,
      60
    );
    if (roleTarget) sanitizedMetadata.role_target = roleTarget;

    const resumeOrPortfolioUrl = sanitizeHttpUrl(
      body.resume_or_portfolio_url ?? rawPayload.resume_or_portfolio_url
    );
    if (resumeOrPortfolioUrl) {
      sanitizedMetadata.resume_or_portfolio_url = resumeOrPortfolioUrl;
    }

    if (shopItem.requiresBlimpPayload && (!sanitizedMetadata.sponsor_name || !sanitizedMetadata.badge_text)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'MISSING_BLIMP_DETAILS',
          message: 'Please enter both a Sponsor Name and a 3D Blimp Banner message.'
        },
        { status: 400 }
      );
    }

    // 5. Generate cryptographic unique order_id
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const orderId = `CN_${Date.now()}_${randomHex}`;

    const supabase = getSupabaseServiceRoleClient();

    // 6. Call FamGateway Production REST API (https://famgateway.in/api/create-order)
    const famGatewayApiKey = process.env.FAMGATEWAY_API_KEY;
    let gatewayPayableAmount: number | null = null;
    let gatewayQrUrl: string | null = null;
    let gatewayCheckoutUrl: string | null = null;
    let gatewayExpiresSeconds = ORDER_TTL_SECONDS;

    if (famGatewayApiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const fgResponse = await fetch(FAMGATEWAY_CREATE_ORDER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Api-Key': famGatewayApiKey
          },
          body: JSON.stringify({
            amount: catalogAmount,
            order_id: orderId,
            customer_name: githubLogin
          }),
          signal: controller.signal,
          cache: 'no-store'
        });

        clearTimeout(timeoutId);

        const rawJson = (await fgResponse.json().catch(() => ({}))) as FamGatewayRawResponse;
        const nested = rawJson.data ?? rawJson.result ?? rawJson;

        if (!fgResponse.ok && rawJson.status === false) {
          return NextResponse.json(
            {
              ok: false,
              error: 'FAMGATEWAY_UPSTREAM_ERROR',
              message:
                rawJson.message ||
                rawJson.error ||
                'Unable to initialize UPI QR with FamGateway. Please retry in a few seconds.'
            },
            { status: 502 }
          );
        }

        const parsedPayable = Number(nested.payable_amount ?? rawJson.payable_amount ?? nested.amount ?? rawJson.amount);
        if (Number.isFinite(parsedPayable) && parsedPayable > 0) {
          gatewayPayableAmount = Number(parsedPayable.toFixed(2));
        }

        gatewayQrUrl =
          nested.qr_url ??
          nested.qr_code ??
          nested.qr_image ??
          rawJson.qr_url ??
          rawJson.qr_code ??
          rawJson.qr_image ??
          null;

        gatewayCheckoutUrl =
          nested.checkout_url ??
          nested.payment_url ??
          nested.upi_intent ??
          rawJson.checkout_url ??
          rawJson.payment_url ??
          rawJson.upi_intent ??
          null;

        const parsedTtl = Number(nested.expires_in ?? rawJson.expires_in);
        if (Number.isFinite(parsedTtl) && parsedTtl >= 60 && parsedTtl <= 900) {
          gatewayExpiresSeconds = Math.floor(parsedTtl);
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        console.error('[CodeNagari FamGateway CreateOrder Error]:', fetchErr);
        return NextResponse.json(
          {
            ok: false,
            error: 'FAMGATEWAY_NETWORK_TIMEOUT',
            message: 'FamGateway UPI endpoint timed out. Please try again.'
          },
          { status: 504 }
        );
      }
    }

    // 7. Resolve Concurrency Engine 2.0 payable_amount & fallback QR if needed
    const finalPayableAmount = await resolveAdaptivePayableAmount(
      supabase,
      catalogAmount,
      gatewayPayableAmount
    );

    const fallbackAssets = buildFallbackQrAndCheckout(
      finalPayableAmount,
      orderId,
      githubLogin
    );

    const finalQrUrl = gatewayQrUrl || fallbackAssets.qrUrl;
    const finalCheckoutUrl = gatewayCheckoutUrl || fallbackAssets.checkoutUrl;
    const expiresAtIso = new Date(Date.now() + gatewayExpiresSeconds * 1000).toISOString();

    // 8. Persist order into public.codenagari_upi_orders
    // Note: For sky_blimp_3d_3days / 7days, we store the canonical DB item_id so
    // confirm_famgateway_upi_order RPC matches LIKE 'sky_blimp_sponsor_3d%' seamlessly.
    const dbItemId = shopItem.dbCanonicalId;

    const { error: insertError } = await supabase.from('codenagari_upi_orders').insert({
      order_id: orderId,
      github_login: githubLogin,
      item_id: dbItemId,
      gift_recipients: giftRecipients,
      blimp_payload: Object.keys(sanitizedMetadata).length > 0 ? sanitizedMetadata : null,
      catalog_amount: catalogAmount,
      payable_amount: finalPayableAmount,
      qr_url: finalQrUrl,
      checkout_url: finalCheckoutUrl,
      status: 'PENDING',
      expires_at: expiresAtIso
    });

    if (insertError) {
      console.error('[CodeNagari Supabase Order Insert Error]:', insertError);
      return NextResponse.json(
        {
          ok: false,
          error: 'DATABASE_INSERT_FAILED',
          message: 'Could not save order in database. Please try again.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        order: {
          order_id: orderId,
          github_login: githubLogin,
          item_id: shopItem.id,
          db_item_id: dbItemId,
          item_name: shopItem.name,
          catalog_amount: catalogAmount,
          payable_amount: finalPayableAmount,
          has_micro_paisa_shield: finalPayableAmount !== catalogAmount,
          qr_url: finalQrUrl,
          checkout_url: finalCheckoutUrl,
          gift_recipients: giftRecipients,
          status: 'PENDING',
          expires_at: expiresAtIso,
          ttl_seconds: gatewayExpiresSeconds
        }
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[CodeNagari Unhandled POST /api/upi/create-order Error]:', err);
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

// =============================================================================
// GET /api/upi/create-order?order_id=CN_...
// Client modal polls this endpoint every 2.5 seconds to detect instant webhook
// confirmation (status === 'PAID' + utr_number) or order expiry.
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id')?.trim();

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_ORDER_ID', message: 'Query param order_id is required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRoleClient();

    const { data: order, error } = await supabase
      .from('codenagari_upi_orders')
      .select(
        'order_id, github_login, item_id, gift_recipients, catalog_amount, payable_amount, qr_url, checkout_url, utr_number, status, expires_at, created_at, paid_at'
      )
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) {
      console.error('[CodeNagari Poll Order Error]:', error);
      return NextResponse.json(
        { ok: false, error: 'DB_QUERY_FAILED', message: 'Failed to query order status.' },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { ok: false, error: 'ORDER_NOT_FOUND', message: 'Order ID not found.' },
        { status: 404 }
      );
    }

    // Auto-transition PENDING -> EXPIRED if past the 300s window
    let currentStatus = order.status;
    const isPastExpiry = new Date(order.expires_at).getTime() <= Date.now();

    if (currentStatus === 'PENDING' && isPastExpiry) {
      currentStatus = 'EXPIRED';
      await supabase
        .from('codenagari_upi_orders')
        .update({ status: 'EXPIRED' })
        .eq('order_id', orderId)
        .eq('status', 'PENDING');
    }

    return NextResponse.json(
      {
        ok: true,
        order: {
          order_id: order.order_id,
          github_login: order.github_login,
          item_id: order.item_id,
          gift_recipients: order.gift_recipients ?? [],
          catalog_amount: Number(order.catalog_amount),
          payable_amount: Number(order.payable_amount),
          qr_url: order.qr_url,
          checkout_url: order.checkout_url,
          utr_number: order.utr_number ?? null,
          status: currentStatus,
          expires_at: order.expires_at,
          paid_at: order.paid_at ?? null
        }
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    );
  } catch (err) {
    console.error('[CodeNagari Unhandled GET /api/upi/create-order Error]:', err);
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
