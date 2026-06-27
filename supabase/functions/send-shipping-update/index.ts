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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { orderId, newStatus, trackingNumber } = await req.json()

    if (!orderId || !newStatus) {
      return new Response('Missing orderId or newStatus', { status: 400 })
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[Shipping Update] Failed to fetch order:', orderError)
      return new Response('Order not found', { status: 404 })
    }

    const customerInfo = order.customer_info
    const customerEmail = customerInfo.email
    const customerName = customerInfo.name

    // Build email content based on status
    let subject, heading, message

    switch (newStatus) {
      case 'shipped':
        subject = `Your order has been shipped! 🚚 - ${orderId}`
        heading = 'Your Order Has Been Shipped!'
        message = `Great news! Your order is on its way. You should receive it soon.`
        break
      case 'delivered':
        subject = `Your order has been delivered! 📦 - ${orderId}`
        heading = 'Your Order Has Been Delivered!'
        message = `Your order has been delivered. We hope you enjoy your purchase!`
        break
      case 'processing':
        subject = `Your order is being processed - ${orderId}`
        heading = 'Your Order Is Being Processed'
        message = `We're preparing your order for shipment. You'll receive another email when it ships.`
        break
      default:
        subject = `Order Update - ${orderId}`
        heading = 'Order Status Update'
        message = `Your order status has been updated to: ${newStatus}`
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Update - KB.ENT</title>
      </head>
      <body style="font-family:Arial,sans-serif;background-color:#f4f4f4;margin:0;padding:20px;">
        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <div style="background-color:#000;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;">KB.ENT</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#333;margin:0 0 8px 0;">${heading}</h2>
            <p style="color:#666;margin:0 0 24px 0;">Hi ${customerName},</p>
            <p style="color:#666;margin:0 0 24px 0;">${message}</p>
            
            <div style="background-color:#f9f9f9;padding:16px;border-radius:8px;margin-bottom:24px;">
              <div style="font-size:14px;color:#666;margin-bottom:8px;">Order ID: <strong style="color:#333;">${orderId}</strong></div>
              <div style="font-size:14px;color:#666;">Status: <strong style="color:#333;">${newStatus}</strong></div>
              ${trackingNumber ? `<div style="font-size:14px;color:#666;margin-top:8px;">Tracking Number: <strong style="color:#333;">${trackingNumber}</strong></div>` : ''}
            </div>

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
          subject: subject,
          html: emailHtml
        })
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[Shipping Update] Failed to send email:', error)
        return new Response('Failed to send email', { status: 500 })
      }
    } else {
      console.log('[Shipping Update] RESEND_API_KEY not set, skipping email send')
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Shipping Update] Error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})
