import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Validate env vars at startup so misconfiguration is caught immediately
if (!PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is not set')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is not set')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

// Service-role client bypasses RLS — only use inside verified webhook handler
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Statuses that are terminal — do not re-process a webhook if already here
const TERMINAL_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled', 'paid']

/** Verify Paystack HMAC-SHA512 signature using the Web Crypto API built into Deno */
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(PAYSTACK_SECRET_KEY!),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const computed = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return computed === signature
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const signature = req.headers.get('x-paystack-signature')
    if (!signature) {
      console.error('[Webhook] Missing x-paystack-signature header')
      return new Response('Missing signature', { status: 400 })
    }

    const bodyText = await req.text()

    // ── 1. Verify signature ─────────────────────────────────────────────────
    const isValid = await verifySignature(bodyText, signature)
    if (!isValid) {
      console.error('[Webhook] Signature mismatch — possible spoofed request')
      return new Response('Invalid signature', { status: 401 })
    }

    const payload = JSON.parse(bodyText)
    console.log('[Webhook] Event received:', payload.event)

    // ── 2. Only handle charge.success ───────────────────────────────────────
    if (payload.event !== 'charge.success') {
      return new Response(JSON.stringify({ received: true, handled: false }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })
    }

    const { reference, amount } = payload.data

    // ── 3. Fetch the order from DB ──────────────────────────────────────────
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, total')
      .eq('id', reference)
      .single()

    if (fetchError || !order) {
      console.error('[Webhook] Order not found for reference:', reference, fetchError)
      // Return 200 anyway — Paystack will retry on non-2xx, no point retrying a missing order
      return new Response(JSON.stringify({ received: true, error: 'Order not found' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })
    }

    // ── 4. Idempotency guard — skip if already processed ───────────────────
    if (TERMINAL_STATUSES.includes(order.status)) {
      console.log('[Webhook] Order already processed, skipping. Status:', order.status)
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })
    }

    // ── 5. Amount verification — compare pesewas to DB total in GHS ────────
    // Paystack sends amount in pesewas (1 GHS = 100 pesewas)
    const expectedAmountPesewas = Math.round(Number(order.total) * 100)
    if (amount !== expectedAmountPesewas) {
      console.error(
        `[Webhook] Amount mismatch! Paid: ${amount} pesewas, Expected: ${expectedAmountPesewas} pesewas for order ${reference}`
      )
      // Mark as payment_failed so admin is alerted; do not fulfil the order
      await supabase.from('orders').update({ status: 'payment_failed', payment_ref: reference }).eq('id', reference)
      return new Response(JSON.stringify({ received: true, error: 'Amount mismatch' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })
    }

    // ── 6. All checks passed — mark order as Processing ────────────────────
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'Processing', payment_ref: reference, payment_method: 'paystack' })
      .eq('id', reference)

    if (updateError) {
      console.error('[Webhook] DB update failed:', updateError)
      return new Response('DB update failed', { status: 500 })
    }

    console.log('[Webhook] Order confirmed and set to Processing:', reference)

    return new Response(JSON.stringify({ received: true, processed: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Webhook] Unhandled error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})

