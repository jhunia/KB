# KB.ENT Production Readiness Implementation Plan

## Phase 1: Critical Fixes (1-2 days)

### 1. Paystack Payment Mode

**Task 1: Get live Paystack key and whitelist production domain**
- Go to [Paystack Dashboard](https://dashboard.paystack.co)
- Navigate to Settings → API Keys
- Copy the **Live Public Key** (`pk_live_...`)
- Add to Vercel environment variables: `VITE_PAYSTACK_KEY=pk_live_...`
- In Paystack Dashboard → Settings → Domains
- Add your production domain (e.g., `kb.ent.vercel.app` or custom domain)
- Wait for domain verification (usually instant)

**Task 2: Remove demo mode from Paystack integration**
- File: `app/js/paystack.js`
- Remove lines 7-9 (demo mode detection)
- Remove lines 66-77 (demo mode simulation)
- Keep only the real Paystack popup logic
- Test on localhost with test key first
- Deploy and test with live key on production

### 2. Payment Verification (Webhook)

**Task 3: Create Supabase Edge Function for Paystack webhook**
- Create directory: `supabase/functions/paystack-webhook/index.ts`
- Install Supabase CLI: `npm install -g supabase`
- Initialize Supabase functions: `supabase functions init`
- Create Edge Function structure:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Webhook verification logic
})
```

**Task 4: Add webhook signature verification**
- In Edge Function, extract `x-paystack-signature` header
- Verify signature using Paystack secret key
- Parse webhook payload
- Validate event type (`charge.success`)
- Return 200 OK on success

**Task 5: Update order status after webhook verification**
- Connect to Supabase in Edge Function
- On successful payment, update order status: `pending_payment` → `processing`
- Update `payment_ref` and `payment_method` fields
- Log verification in database for audit trail
- Configure Paystack webhook URL: `https://your-project.supabase.co/functions/v1/paystack-webhook`

### 3. Legal Pages

**Task 6: Create Terms of Service page**
- File: `app/terms.html`
- Include sections:
  - Acceptance of terms
  - Account responsibilities
  - Product information
  - Pricing and payment
  - Shipping and delivery
  - Returns and refunds
  - Intellectual property
  - Limitation of liability
  - Governing law
- Add consistent styling with existing pages
- Link from footer

**Task 7: Create Privacy Policy page**
- File: `app/privacy.html`
- Include sections:
  - Data collection
  - Data usage
  - Data storage
  - Third-party services (Supabase, Paystack)
  - User rights
  - Cookies
  - Contact information
- Add consistent styling
- Link from footer

**Task 8: Create Refund Policy page**
- File: `app/refund.html`
- Include sections:
  - Return eligibility
  - Return process
  - Refund timeline
  - Shipping costs
  - Damaged/defective items
  - Contact for returns
- Add consistent styling
- Link from footer

**Task 9: Add legal page links to footer**
- File: `app/css/styles.css` (footer section)
- Add links to Terms, Privacy, Refund pages
- Ensure links are visible on all pages
- Add hover states for better UX

---

## Phase 2: Important Fixes (2-3 days)

### 4. Email Notifications

**Task 10: Configure Supabase email templates for auth**
- Go to Supabase Dashboard → Authentication → Email Templates
- Customize:
  - Confirm signup email
  - Reset password email
  - Email change email
- Add your branding (logo, colors)
- Test with a signup flow

**Task 11: Add order confirmation email notification**
- Create Supabase Edge Function: `send-order-confirmation`
- Trigger on order status change to `processing`
- Use email service (Resend, SendGrid, or Supabase Email)
- Include order details, items, total, tracking info
- Add to order creation flow in `app/js/cart.js`

**Task 12: Add shipping status email notifications**
- Create Edge Function: `send-shipping-update`
- Trigger on order status changes (shipped, delivered)
- Send email to customer with new status
- Include tracking number if available
- Add to admin dashboard status update in `app/admin/js/dashboard.js`

### 5. Order Fulfillment Workflow

**Task 13: Enable Supabase real-time for order status updates**
- Go to Supabase Dashboard → Database → Replication
- Enable real-time for `orders` table
- Add RLS policy for real-time subscriptions
- File: `app/js/profile.js` - add real-time listener:
```javascript
supabase
  .channel('orders')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
    // Update UI with new status
  })
  .subscribe()
```

**Task 14: Add order status display in customer profile**
- File: `app/profile.html`
- Add order status badges (pending, processing, shipped, delivered)
- Add estimated delivery dates
- Add tracking number display
- Style status badges with colors

### 6. Admin Security

**Task 15: Test admin RLS policies thoroughly**
- Create test admin account
- Test admin can view all orders
- Test customer can only view their own orders
- Test admin can edit products
- Test customer cannot edit products
- Test admin can delete products
- Test customer cannot delete products
- Document any issues found

**Task 16: Add 2FA for admin login**
- Use Supabase Auth MFA (if available) or custom solution
- File: `app/admin/js/login.js`
- Add TOTP (Time-based One-Time Password) setup
- Require 2FA for admin role only
- Store 2FA secret in user metadata
- Add verification step after password

---

## Phase 3: Nice-to-Have (1-2 days)

### 7. SEO Optimization

**Task 17: Add Open Graph meta tags to all pages**
- File: All HTML files (`index.html`, `category.html`, `product.html`, etc.)
- Add to `<head>`:
```html
<meta property="og:title" content="KB.ENT - Product Name">
<meta property="og:description" content="Product description">
<meta property="og:image" content="https://kb.ent/assets/images/product.jpg">
<meta property="og:url" content="https://kb.ent/product.html?id=1">
<meta property="og:type" content="product">
```
- Add Twitter Card tags

**Task 18: Add structured data (JSON-LD) for products**
- File: `app/js/product.js`
- Add JSON-LD schema to product pages:
```javascript
const schema = {
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": product.name,
  "image": product.images,
  "description": product.description,
  "brand": { "@type": "Brand", "name": product.brand },
  "offers": {
    "@type": "Offer",
    "price": product.price,
    "priceCurrency": "GHS",
    "availability": product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
  }
}
```
- Inject into `<head>` as JSON-LD

**Task 19: Create sitemap.xml**
- File: `app/sitemap.xml`
- List all important pages
- Include product pages dynamically
- Submit to Google Search Console

### 8. Analytics

**Task 20: Add Google Analytics integration**
- Create GA4 property in Google Analytics
- Add tracking ID to Vercel env: `VITE_GA_ID`
- File: `app/index.html` - add GA script:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', import.meta.env.VITE_GA_ID);
</script>
```
- Track key events: add_to_cart, begin_checkout, purchase

### 9. Customer Support

**Task 21: Create contact page with form**
- File: `app/contact.html`
- Add form fields: name, email, subject, message
- Submit to Supabase `contact_messages` table
- Create table in Supabase:
```sql
CREATE TABLE contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Add RLS policies
- Style consistently with other pages

### 10. Testing

**Task 22: Add basic E2E tests for checkout flow**
- Install Playwright: `npm install -D @playwright/test`
- Create test file: `app/e2e/checkout.spec.ts`
- Test scenarios:
  - Add product to cart
  - Proceed to checkout
  - Fill shipping info
  - Complete payment (mock)
  - Verify order created
- Add to `package.json` scripts:
```json
"test:e2e": "playwright test"
```

---

## Deployment Checklist

Before going live:
- [ ] All critical fixes completed
- [ ] All important fixes completed
- [ ] Test full checkout flow with live Paystack key
- [ ] Test admin dashboard functionality
- [ ] Test email notifications
- [ ] Verify RLS policies
- [ ] Set up environment variables in Vercel
- [ ] Enable SSL (automatic on Vercel)
- [ ] Set up custom domain (optional)
- [ ] Configure DNS if using custom domain
- [ ] Test on mobile devices
- [ ] Test payment with real card (small amount)
- [ ] Set up error monitoring (Sentry, optional)
- [ ] Set up backup strategy for Supabase

## Estimated Timeline

- **Phase 1 (Critical):** 1-2 days
- **Phase 2 (Important):** 2-3 days
- **Phase 3 (Nice-to-Have):** 1-2 days
- **Testing & Deployment:** 1 day

**Total:** 5-8 days to full production readiness
