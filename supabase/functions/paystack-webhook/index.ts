import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Get the signature from the header
    const signature = req.headers.get('x-paystack-signature')
    if (!signature) {
      console.error('[Paystack Webhook] Missing signature header')
      return new Response('Missing signature', { status: 400 })
    }

    // Get the raw body
    const bodyText = await req.text()
    
    // Verify the signature
    const crypto = await import('https://deno.land/std@0.168.0/crypto/mod.ts')
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(PAYSTACK_SECRET_KEY),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    
    const signatureComputed = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(bodyText)
    )
    
    const signatureComputedHex = Array.from(new Uint8Array(signatureComputed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    if (signature !== signatureComputedHex) {
      console.error('[Paystack Webhook] Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    // Parse the webhook payload
    const payload = JSON.parse(bodyText)
    const event = payload.event
    
    console.log('[Paystack Webhook] Received event:', event)

    // Handle charge.success event
    if (event === 'charge.success') {
      const { reference, transaction, amount, customer } = payload.data
      
      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'processing',
          payment_ref: reference,
          payment_method: 'paystack'
        })
        .eq('id', reference)
      
      if (updateError) {
        console.error('[Paystack Webhook] Failed to update order:', updateError)
        return new Response('Failed to update order', { status: 500 })
      }
      
      console.log('[Paystack Webhook] Order updated successfully:', reference)
    }

    // Return 200 OK to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Paystack Webhook] Error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})
