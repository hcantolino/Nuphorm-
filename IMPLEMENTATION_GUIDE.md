# MedReg Platform - Authentication & Stripe Implementation Guide

## ✅ Completed Components

### 1. Database Schema
- Extended User model with subscription fields:
  - `subscriptionStatus` (trial, active, canceled, expired)
  - `stripeCustomerId`, `stripeSubscriptionId`
  - `subscriptionStartDate`, `subscriptionEndDate`
  - `trialUsedCount`, `trialUsedAt`
- Created `subscriptionEvents` table for audit trail
- Migration applied successfully

### 2. Backend Services

#### server/db.ts
Added subscription helper functions:
- `getUserSubscriptionStatus(userId)` - Get user subscription info
- `getUserByStripeCustomerId(customerId)` - Lookup user by Stripe ID
- `updateUserSubscription(userId, data)` - Update subscription fields
- `incrementTrialUsage(userId)` - Increment trial counter
- `logSubscriptionEvent(userId, eventType, metadata)` - Log events
- `getSubscriptionEvents(userId, limit)` - Retrieve event history

#### server/stripe.ts
Stripe integration module:
- `stripe` - Initialized Stripe client
- `createStripeCustomer(email, name)` - Create Stripe customer
- `createCheckoutSession(customerId, priceId, returnUrl)` - Checkout session
- `cancelSubscription(subscriptionId)` - Cancel at period end
- `getSubscription(subscriptionId)` - Retrieve subscription details
- `constructWebhookEvent(body, sig)` - Verify webhook signature

#### server/routers.ts
Added tRPC subscription router with procedures:
- `subscription.getStatus` - Get current user subscription status
- `subscription.createCheckout` - Create Stripe checkout session
- `subscription.useTrial` - Use 1 free trial generation
- `subscription.cancel` - Cancel active subscription

#### server/webhooks/stripe.ts
Webhook handler for Stripe events:
- Handles subscription created/updated/deleted
- Handles payment succeeded/failed
- Updates database on events
- Logs all events for audit trail

### 3. Frontend Pages

#### client/src/pages/Login.tsx
Authentication page with:
- Manus OAuth sign-in button
- Google OAuth button (placeholder)
- Free trial promotion
- Redirect to dashboard if already authenticated

#### client/src/pages/Subscription.tsx
Subscription management page with:
- Trial card showing usage (0/1)
- Premium card with $30/month pricing
- Upgrade button that opens Stripe checkout
- Cancel subscription button
- Subscription status display
- Renewal date information

#### client/src/App.tsx
Updated routing with:
- `/login` route for authentication
- `/subscription` route for subscription management
- Protected dashboard routes (redirect to login if not authenticated)
- Proper route guards using `useAuth()` hook

## 🔧 Setup Instructions

### Step 1: Environment Variables

Add these to your `.env` file:

```env
# Stripe (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Already configured
DATABASE_URL=mysql://...
JWT_SECRET=...
VITE_OAUTH_PORTAL_URL=...
OAUTH_SERVER_URL=...
VITE_APP_ID=...
```

### Step 2: Stripe Setup

1. Create Stripe account at https://stripe.com
2. Go to Dashboard → Developers → API Keys
3. Copy Secret Key and Publishable Key
4. Create Product: "MedReg Subscription" with $30/month price
5. Copy the Price ID
6. Set up webhook endpoint:
   - Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events to listen: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
   - Copy webhook signing secret

### Step 3: Register Webhook Route

Add to `server/_core/index.ts`:

```typescript
import { handleStripeWebhook } from "../webhooks/stripe";

// Add this route (must be before other middleware)
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);
```

### Step 4: Update Sidebar Navigation

Add subscription link to `client/src/components/Sidebar.tsx`:

```typescript
<NavItem
  icon={<CreditCard className="w-5 h-5" />}
  label="Subscription"
  href="/subscription"
  active={activeItem === "subscription"}
  onClick={() => onItemClick("subscription")}
/>
```

### Step 5: Add Trial Guard to Chart Generation

In `client/src/pages/Biostatistics.tsx`, add before generation:

```typescript
import { trpc } from "@/lib/trpc";

const subscription = trpc.subscription.getStatus.useQuery();

async function handleGenerate() {
  if (!subscription.data) {
    toast.error("Loading subscription status...");
    return;
  }

  // Check if trial is available
  if (subscription.data.subscriptionStatus === "trial" && subscription.data.trialUsedCount >= 1) {
    toast.error("Trial used. Please upgrade to continue.");
    setLocation("/subscription");
    return;
  }

  // Use trial if available
  if (subscription.data.subscriptionStatus === "trial") {
    try {
      await trpc.subscription.useTrial.mutate();
    } catch (error) {
      toast.error("Failed to use trial");
      return;
    }
  }

  // Check if subscription is active
  if (subscription.data.subscriptionStatus !== "active" && subscription.data.subscriptionStatus !== "trial") {
    toast.error("Please upgrade your subscription");
    setLocation("/subscription");
    return;
  }

  // Proceed with generation
  generateChart();
}
```

## 🧪 Testing

### Local Testing with Stripe Test Keys

1. Use test Stripe keys (sk_test_...)
2. Test card: `4242 4242 4242 4242`
3. Any future expiry date and CVC

### Test Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy webhook signing secret to .env
```

### Test Scenarios

1. **Trial Generation**
   - Login → Generate chart (uses trial)
   - Try to generate again (should fail with "Trial used")
   - Click upgrade

2. **Stripe Checkout**
   - Click upgrade → Stripe checkout opens
   - Use test card 4242 4242 4242 4242
   - Complete payment
   - Verify subscription status updates to "active"

3. **Cancel Subscription**
   - Go to /subscription
   - Click "Cancel Subscription"
   - Verify status changes to "canceled"

## 📊 Database Queries

Check subscription status:
```sql
SELECT id, email, subscriptionStatus, trialUsedCount, stripeCustomerId 
FROM users 
WHERE id = ?;
```

View subscription events:
```sql
SELECT * FROM subscriptionEvents 
WHERE userId = ? 
ORDER BY createdAt DESC;
```

## 🚀 Deployment Checklist

- [ ] Add all Stripe environment variables to production
- [ ] Set up Stripe webhook in production environment
- [ ] Update webhook URL in Stripe dashboard
- [ ] Test complete flow in production
- [ ] Set up email notifications for subscription events
- [ ] Monitor webhook delivery in Stripe dashboard
- [ ] Set up error alerts for failed webhooks
- [ ] Document subscription policies for users

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Use environment variables only
2. **Webhook signature verification** - Always verify webhook signatures
3. **Rate limiting** - Add rate limiting to checkout endpoint
4. **HTTPS only** - Webhook endpoint must be HTTPS
5. **Idempotency** - Handle duplicate webhook events gracefully
6. **Logging** - Log all subscription events for audit trail

## 📞 Support & Troubleshooting

### Stripe Checkout Not Loading
- Verify `STRIPE_PRICE_ID` is correct
- Check Stripe publishable key in frontend
- Verify customer creation succeeded

### Webhook Not Triggering
- Check webhook URL is publicly accessible
- Verify webhook signing secret matches
- Check Stripe dashboard for failed deliveries
- Review server logs for errors

### Trial Not Incrementing
- Verify database connection
- Check user ID is correct
- Verify `trialUsedCount` column exists
- Check for database transaction errors

## 📚 Additional Resources

- Stripe Docs: https://stripe.com/docs
- tRPC Docs: https://trpc.io
- Drizzle ORM: https://orm.drizzle.team
- React Hooks: https://react.dev/reference/react

## Next Steps

1. Implement email notifications (welcome, upgrade reminders, etc.)
2. Add usage analytics dashboard
3. Implement refund handling
4. Add team/organization support
5. Create admin panel for subscription management
6. Set up automated billing reminders
7. Implement feature flags based on subscription tier
