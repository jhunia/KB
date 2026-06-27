import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { orderId } = await req.json()

    if (!orderId) {
      return new Response('Missing orderId', { status: 400 })
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (
            name,
            images
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[Order Confirmation] Failed to fetch order:', orderError)
      return new Response('Order not found', { status: 404 })
    }

    const customerInfo = order.customer_info
    const customerEmail = customerInfo.email
    const customerName = customerInfo.name

    // Build email content
    const itemsHtml = order.order_items.map(item => `
      <div style="display:flex;align-items:center;margin-bottom:16px;padding:16px;background:#f9f9f9;border-radius:8px;">
        <img src="${item.products.images[0]}" alt="${item.products.name}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;margin-right:16px;">
        <div style="flex:1;">
          <div style="font-weight:600;color:#333;margin-bottom:4px;">${item.products.name}</div>
          <div style="font-size:14px;color:#666;">Qty: ${item.quantity}${item.size ? ` • Size: ${item.size}` : ''}${item.color ? ` • Color: ${item.color}` : ''}</div>
        </div>
        <div style="font-weight:600;color:#333;">$${(item.quantity * (order.total / order.order_items.reduce((sum, i) => sum + i.quantity, 0))).toFixed(2)}</div>
      </div>
    `).join('')

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - KB.ENT</title>
      </head>
      <body style="font-family:Arial,sans-serif;background-color:#f4f4f4;margin:0;padding:20px;">
        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <div style="background-color:#000;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;">KB.ENT</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#333;margin:0 0 8px 0;">Order Confirmed!</h2>
            <p style="color:#666;margin:0 0 24px 0;">Hi ${customerName},</p>
            <p style="color:#666;margin:0 0 24px 0;">Thank you for your order! We've received it and will begin processing it shortly.</p>
            
            <div style="background-color:#f9f9f9;padding:16px;border-radius:8px;margin-bottom:24px;">
              <div style="font-size:14px;color:#666;margin-bottom:8px;">Order ID: <strong style="color:#333;">${order.id}</strong></div>
              <div style="font-size:14px;color:#666;">Total: <strong style="color:#333;">$${order.total.toFixed(2)}</strong></div>
            </div>

            <h3 style="color:#333;margin:0 0 16px 0;">Order Items</h3>
            ${itemsHtml}

            <div style="margin-top:24px;padding-top:24px;border-top:1px solid #eee;">
              <p style="color:#666;margin:0 0 8px 0;">If you have any questions, please contact us at:</p>
              <p style="color:#333;margin:0;">support@kb.ent</p>
            </div>
          </div>
          <div style="background-color:#000;padding:16px;text-align:center;">
            <p style="color:#fff;margin:0;font-size:14px;">&copy; 2026 KB.ENT. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send email using Resend
    if (RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'KB.ENT <orders@kb.ent>',
          to: customerEmail,
          subject: `Order Confirmation - ${order.id}`,
          html: emailHtml
        })
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[Order Confirmation] Failed to send email:', error)
        return new Response('Failed to send email', { status: 500 })
      }
    } else {
      console.log('[Order Confirmation] RESEND_API_KEY not set, skipping email send')
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Order Confirmation] Error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})
