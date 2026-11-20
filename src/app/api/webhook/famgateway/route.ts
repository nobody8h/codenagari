// =============================================================================
// File: src/app/api/webhook/famgateway/route.ts
// Project: CodeNagari (codenagari.in) - 3D Identity Metropolis for Indian Devs
// Description: Cryptographically verified FamGateway UPI Webhook Handler.
//              1. Reads exact raw bytes via req.text() to preserve HMAC integrity.
//              2. Validates x-famgateway-signature (HTTP_X_FAMGATEWAY_SIGNATURE)
//                 using HMAC-SHA256 + crypto.timingSafeEqual.
//              3. Calls atomic Supabase RPC confirm_famgateway_upi_order to
//                 enforce 12-digit UTR idempotency and unlock 3D cosmetics,
//                 Hostel Squad 4-Pack gifts, or PENDING_APPROVAL 3D Sky Blimps.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FamGatewayWebhookPayload {
  event?: string;
  status?: string | boolean;
  order_id?: string;
  orderId?: string;
  client_txn_id?: string;
  utr?: string;
  utr_number?: string;
  bank_utr?: string;
  upi_txn_id?: string;
  rrn?: string;
  payable_amount?: number | string;
  paid_amount?: number | string;
  amount?: number | string;
  customer_name?: string;
  data?: {
    status?: string | boolean;
    order_id?: string;
    orderId?: string;
    client_txn_id?: string;
    utr?: string;
    utr_number?: string;
    bank_utr?: string;
    upi_txn_id?: string;
    rrn?: string;
    payable_amount?: number | string;
    paid_amount?: number | string;
    amount?: number | string;
  };
}

interface ConfirmOrderRpcResult {
  ok?: boolean;
  idempotent?: boolean;
  status?: string;
  error?: string;
  message?: string;
  order_id?: string;
  item_id?: string;
  github_login?: string;
  utr_number?: string;
  gifted_recipients?: string[];
}

/**
 * Initializes the Supabase Service Role client for privileged RPC execution.
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
 * Verifies the incoming HMAC-SHA256 hex digest over the exact raw request string
 * using constant-time comparison (crypto.timingSafeEqual) to prevent timing attacks.
 */
function verifyFamGatewayHmacSignature(
  rawBody: string,
  incomingSignatureHeader: string | null,
  secretKey: string
): boolean {
  if (!incomingSignatureHeader || !secretKey) {
    return false;
  }

  // Strip optional prefix like "sha256=" if present
  const normalizedIncoming = incomingSignatureHeader
    .trim()
    .replace(/^sha256=/i, '')
    .toLowerCase();

  const expectedHex = crypto
    .createHmac('sha256', secretKey)
    .update(rawBody, 'utf8')
    .digest('hex')
    .toLowerCase();

  const incomingBuffer = Buffer.from(normalizedIncoming, 'utf8');
  const expectedBuffer = Buffer.from(expectedHex, 'utf8');

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
}

// =============================================================================
// GET /api/webhook/famgateway
// Zero-redirect 200 OK health check for FamGateway webhook verification pings
// and uptime monitors (prevents 405 Method Not Allowed or 308 Redirect errors).
// =============================================================================
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'CodeNagari FamGateway UPI Webhook Receiver',
      status: 'READY',
      timestamp: new Date().toISOString()
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    }
  );
}

// =============================================================================
// POST /api/webhook/famgateway
// Processes signed payment confirmation webhooks from FamGateway.
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    // 1. Read exact raw request body string BEFORE any JSON parsing
    const rawBody = await req.text();

    if (!rawBody || rawBody.trim().length === 0) {
      return NextResponse.json(
        { received: false, error: 'EMPTY_BODY', message: 'Webhook body cannot be empty.' },
        { status: 400 }
      );
    }

    // 2. Load FamGateway API Key / Webhook Secret
    const famGatewaySecret =
      process.env.FAMGATEWAY_WEBHOOK_SECRET || process.env.FAMGATEWAY_API_KEY;

    if (!famGatewaySecret) {
      console.error('[CodeNagari Webhook Error]: Missing FAMGATEWAY_API_KEY environment variable.');
      return NextResponse.json(
        {
          received: false,
          error: 'SERVER_MISCONFIGURED',
          message: 'FAMGATEWAY_API_KEY is not configured on the server.'
        },
        { status: 500 }
      );
    }

    // 3. Extract signature header (HTTP_X_FAMGATEWAY_SIGNATURE -> x-famgateway-signature)
    const signatureHeader =
      req.headers.get('x-famgateway-signature') ||
      req.headers.get('http-x-famgateway-signature') ||
      req.headers.get('x-webhook-signature');

    // 4. Verify HMAC-SHA256 signature using constant-time crypto.timingSafeEqual
    const isSignatureValid = verifyFamGatewayHmacSignature(
      rawBody,
      signatureHeader,
      famGatewaySecret
    );

    if (!isSignatureValid) {
      console.warn('[CodeNagari Webhook Security Alert]: Invalid HMAC signature rejected.');
      return NextResponse.json(
        {
          received: false,
          error: 'INVALID_SIGNATURE',
          message: 'HMAC-SHA256 signature verification failed.'
        },
        { status: 401 }
      );
    }

    // 5. Parse JSON payload after signature is verified
    let payload: FamGatewayWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as FamGatewayWebhookPayload;
    } catch {
      return NextResponse.json(
        { received: false, error: 'MALFORMED_JSON', message: 'Unable to parse JSON payload.' },
        { status: 400 }
      );
    }

    const nested = payload.data ?? payload;

    // Check if webhook event is a non-payment failure/pending ping
    const rawStatus = String(nested.status ?? payload.status ?? 'SUCCESS')
      .trim()
      .toUpperCase();

    if (
      rawStatus === 'FAILED' ||
      rawStatus === 'EXPIRED' ||
      rawStatus === 'CANCELLED' ||
      rawStatus === 'PENDING'
    ) {
      return NextResponse.json(
        {
          received: true,
          status: 'IGNORED_NON_PAID_EVENT',
          upstream_status: rawStatus
        },
        { status: 200 }
      );
    }

    // 6. Extract order_id, utr_number, and payable_amount
    const orderId = (
      nested.order_id ??
      nested.orderId ??
      nested.client_txn_id ??
      payload.order_id ??
      payload.orderId ??
      payload.client_txn_id ??
      ''
    )
      .toString()
      .trim();

    const utrNumber = (
      nested.utr ??
      nested.utr_number ??
      nested.bank_utr ??
      nested.upi_txn_id ??
      nested.rrn ??
      payload.utr ??
      payload.utr_number ??
      payload.bank_utr ??
      payload.upi_txn_id ??
      payload.rrn ??
      ''
    )
      .toString()
      .trim();

    const rawAmount =
      nested.payable_amount ??
      nested.paid_amount ??
      nested.amount ??
      payload.payable_amount ??
      payload.paid_amount ??
      payload.amount ??
      0;

    const paidAmount = Number(rawAmount);

    if (!orderId || !utrNumber) {
      return NextResponse.json(
        {
          received: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'Both order_id and utr (or utr_number / bank_utr) are required.'
        },
        { status: 400 }
      );
    }

    // 7. Execute atomic PostgreSQL RPC confirm_famgateway_upi_order
    const supabase = getSupabaseServiceRoleClient();

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'confirm_famgateway_upi_order',
      {
        p_order_id: orderId,
        p_utr_number: utrNumber,
        p_paid_amount: Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : null
      }
    );

    if (rpcError) {
      console.error('[CodeNagari Webhook RPC Error]:', rpcError);
      return NextResponse.json(
        {
          received: false,
          error: 'RPC_EXECUTION_ERROR',
          message: rpcError.message
        },
        { status: 500 }
      );
    }

    const result = (rpcData ?? {}) as ConfirmOrderRpcResult;

    if (!result.ok) {
      // Business logic rejections (e.g., UTR_ALREADY_USED, ORDER_NOT_FOUND, AMOUNT_MISMATCH)
      console.warn('[CodeNagari Webhook Order Rejection]:', result);
      return NextResponse.json(
        {
          received: true,
          status: 'REJECTED',
          reason: result.error ?? 'VERIFICATION_FAILED',
          details: result
        },
        { status: 200 }
      );
    }

    // 8. Immediate 200 OK response with zero redirect hops
    return NextResponse.json(
      {
        received: true,
        status: 'VERIFIED',
        idempotent: Boolean(result.idempotent),
        order_id: result.order_id ?? orderId,
        item_id: result.item_id ?? null,
        github_login: result.github_login ?? null,
        utr_number: result.utr_number ?? utrNumber,
        gifted_recipients: result.gifted_recipients ?? []
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    );
  } catch (err) {
    console.error('[CodeNagari Unhandled Webhook Exception]:', err);
    return NextResponse.json(
      {
        received: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected webhook processing failure.'
      },
      { status: 500 }
    );
  }
}
