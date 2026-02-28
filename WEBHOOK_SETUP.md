# Stripe Webhook Setup

## Step 1: Register Webhook Route

Add this to `server/_core/index.ts` BEFORE other middleware:

```typescript
import express from "express";
import { handleStripeWebhook } from "../webhooks/stripe";

// ... existing imports ...

// Add this BEFORE the JSON middleware
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Then add JSON middleware for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... rest of middleware ...
```

## Step 2: Configure Stripe Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add an endpoint"
3. Enter endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)
7. Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`

## Step 3: Test Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or
choco install stripe-cli  # Windows
# or
sudo apt-get install stripe-cli  # Linux

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# This will output a signing secret - add to .env
```

## Step 4: Verify Webhook Handler

The webhook handler (`server/webhooks/stripe.ts`) handles:

- **customer.subscription.created**: Updates user subscription status to "active"
- **customer.subscription.updated**: Updates subscription dates and status
- **customer.subscription.deleted**: Sets status to "canceled"
- **invoice.payment_succeeded**: Logs successful payment
- **invoice.payment_failed**: Logs failed payment

## Step 5: Monitor Webhooks

In Stripe Dashboard:
1. Go to Developers → Webhooks
2. Click your endpoint
3. View recent deliveries
4. Check for any failed deliveries
5. Retry failed deliveries if needed

## Troubleshooting

### Webhook Not Triggering
- Verify endpoint URL is publicly accessible
- Check webhook signing secret matches
- Verify events are selected in Stripe dashboard
- Check server logs for errors

### Signature Verification Failed
- Ensure `STRIPE_WEBHOOK_SECRET` is correct
- Verify webhook is using raw body (not parsed JSON)
- Check that middleware order is correct (raw body before JSON)

### Database Not Updating
- Verify database connection is working
- Check user exists in database
- Verify Stripe customer ID matches
- Check database logs for errors

## Testing Webhook Events

Use Stripe CLI to send test events:

```bash
# Send a subscription created event
stripe trigger customer.subscription.created

# Send a subscription updated event
stripe trigger customer.subscription.updated

# Send a subscription deleted event
stripe trigger customer.subscription.deleted

# Send a payment succeeded event
stripe trigger invoice.payment_succeeded
```

## Production Deployment

1. Update webhook URL to production domain
2. Use production Stripe keys
3. Update webhook signing secret in production env
4. Test complete flow with real payment
5. Monitor webhook deliveries in Stripe dashboard
6. Set up alerts for failed webhooks
