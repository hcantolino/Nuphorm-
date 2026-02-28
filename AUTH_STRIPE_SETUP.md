# MedReg Platform - Authentication & Stripe Integration Guide

## Quick Start

This guide integrates user authentication, 1-free-trial system, and Stripe $30/month subscription.

## Database Schema ✅ COMPLETE
- Extended User model with subscription fields (subscriptionStatus, stripeCustomerId, trialUsedCount, etc.)
- Created subscriptionEvents table for audit trail
- Migration applied successfully

## Environment Variables Required

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Already configured
DATABASE_URL=...
JWT_SECRET=...
VITE_OAUTH_PORTAL_URL=...
```

## Implementation Steps

### 1. Backend: Add Stripe Service
Create `server/stripe.ts` with Stripe client initialization and helper functions for:
- Creating checkout sessions
- Canceling subscriptions
- Handling webhook events

### 2. Backend: Add Subscription Procedures
Update `server/routers.ts` with tRPC procedures:
- `subscription.getStatus` - Get user subscription status
- `subscription.createCheckout` - Create Stripe checkout session
- `subscription.useTrial` - Increment trial usage
- `subscription.cancel` - Cancel subscription

### 3. Backend: Add Webhook Handler
Create webhook endpoint at `/api/webhooks/stripe` to handle:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 4. Frontend: Create Login Page
Add `/login` route with Manus OAuth and Google OAuth buttons

### 5. Frontend: Create Subscription Page
Add `/subscription` route showing:
- Trial status (0/1 used)
- Premium upgrade button
- Active subscription management

### 6. Frontend: Add Generation Guard
Protect chart generation with subscription check:
- If trial: use trial and generate
- If trial used: show upgrade modal
- If active: generate
- If canceled: show upgrade modal

## Testing Checklist

- [ ] Database migrations applied
- [ ] Stripe test keys configured
- [ ] Login flow works
- [ ] Trial generation works (1 use)
- [ ] Upgrade flow works
- [ ] Webhook receives events
- [ ] Subscription status updates correctly
- [ ] Cancel subscription works

## Key Files Modified

- `drizzle/schema.ts` - Extended User model
- `server/db.ts` - Add subscription helpers
- `server/routers.ts` - Add subscription procedures
- `client/src/App.tsx` - Add auth guard
- `package.json` - Dependencies merged

## Next Phase

After setup, implement:
1. Email notifications
2. Usage analytics
3. Admin dashboard
4. Team management
5. Refund handling
