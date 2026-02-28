# MedReg Platform - Testing Guide

## Test Environment Setup

### Prerequisites
- Stripe test account (https://stripe.com)
- Stripe CLI installed locally
- Test Stripe keys in `.env`
- Local dev server running

### Test Stripe Keys

Use these for testing (never use production keys):
- **Publishable Key**: `pk_test_...`
- **Secret Key**: `sk_test_...`
- **Webhook Secret**: `whsec_...` (from `stripe listen`)

### Test Card Numbers

| Card Number | Status | Use Case |
|---|---|---|
| 4242 4242 4242 4242 | Success | Normal payment |
| 4000 0000 0000 0002 | Decline | Payment failure |
| 4000 0025 0000 3155 | Decline | CVC failure |
| 5555 5555 5555 4444 | Success | Mastercard |

Use any future expiry date and any 3-digit CVC.

## Test Scenarios

### 1. User Registration & Login

**Scenario**: New user signs up and logs in

**Steps**:
1. Navigate to `/login`
2. Click "Sign in with Manus"
3. Complete Manus OAuth flow
4. Verify redirected to `/dashboard`
5. Check user created in database with `subscriptionStatus = 'trial'`

**Expected Results**:
- User authenticated
- Session cookie set
- User can access dashboard
- `trialUsedCount = 0`

**Database Check**:
```sql
SELECT id, email, subscriptionStatus, trialUsedCount FROM users WHERE email = 'test@example.com';
```

---

### 2. Trial Generation

**Scenario**: User uses their 1 free trial generation

**Steps**:
1. Login as new user
2. Navigate to `/biostatistics`
3. Click "Generate Chart" or similar
4. Verify trial is used
5. Try to generate again

**Expected Results**:
- First generation succeeds
- `trialUsedCount` increments to 1
- Second generation fails with "Trial used" message
- User redirected to `/subscription` page

**Database Check**:
```sql
SELECT trialUsedCount, trialUsedAt FROM users WHERE id = ?;
```

**Event Log Check**:
```sql
SELECT eventType, createdAt FROM subscriptionEvents WHERE userId = ? ORDER BY createdAt DESC;
```

---

### 3. Upgrade to Premium

**Scenario**: User upgrades from trial to premium subscription

**Steps**:
1. After trial is used, navigate to `/subscription`
2. Click "Upgrade Now" on Premium card
3. Verify Stripe checkout page opens
4. Enter test card: `4242 4242 4242 4242`
5. Enter any future expiry date
6. Enter any 3-digit CVC
7. Click "Pay"
8. Verify redirected back to dashboard
9. Check subscription status updated

**Expected Results**:
- Stripe checkout opens
- Payment succeeds
- User redirected to dashboard
- `subscriptionStatus` changes to "active"
- `stripeCustomerId` and `stripeSubscriptionId` populated
- `subscriptionEndDate` set to 1 month from now

**Database Check**:
```sql
SELECT 
  subscriptionStatus, 
  stripeCustomerId, 
  stripeSubscriptionId, 
  subscriptionEndDate 
FROM users WHERE id = ?;
```

**Webhook Verification**:
```bash
# In another terminal, watch webhook events
stripe logs tail

# Should see customer.subscription.created and customer.subscription.updated
```

---

### 4. Generate with Active Subscription

**Scenario**: User with active subscription generates unlimited charts

**Steps**:
1. Login with upgraded account
2. Navigate to `/biostatistics`
3. Generate chart (should succeed)
4. Generate another chart (should succeed)
5. Repeat multiple times

**Expected Results**:
- All generations succeed
- No rate limiting
- No trial deduction
- User can generate unlimited charts

---

### 5. Cancel Subscription

**Scenario**: User cancels their subscription

**Steps**:
1. Navigate to `/subscription`
2. Verify "Cancel Subscription" button visible
3. Click "Cancel Subscription"
4. Confirm cancellation dialog
5. Verify status updates

**Expected Results**:
- Subscription marked for cancellation at period end
- `subscriptionStatus` changes to "canceled"
- User can still generate until period ends
- "Cancel Subscription" button becomes "Upgrade Now"

**Database Check**:
```sql
SELECT subscriptionStatus, subscriptionEndDate FROM users WHERE id = ?;
```

---

### 6. Webhook Events

**Scenario**: Stripe webhooks update subscription status correctly

**Setup**:
```bash
# Terminal 1: Start webhook listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 2: Run tests
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

**Expected Results**:
- Each event triggers webhook handler
- Database updates correctly
- Event logged in `subscriptionEvents` table
- No errors in server logs

**Log Check**:
```bash
# Check server logs for webhook processing
tail -f .manus-logs/devserver.log | grep "Stripe Webhook"
```

---

### 7. Payment Failure

**Scenario**: Payment fails and subscription is not created

**Steps**:
1. Navigate to `/subscription`
2. Click "Upgrade Now"
3. Enter test card: `4000 0000 0000 0002` (decline)
4. Complete checkout
5. Verify error message

**Expected Results**:
- Payment declined
- Error message displayed
- Checkout session canceled
- `subscriptionStatus` remains "trial"
- No `stripeSubscriptionId` created

---

### 8. Subscription Renewal

**Scenario**: Subscription automatically renews

**Steps**:
1. Create subscription with test card
2. Wait for renewal date (or use Stripe test mode to simulate)
3. Verify renewal payment processed
4. Check `subscriptionEndDate` updated

**Expected Results**:
- Renewal payment succeeds
- `subscriptionEndDate` extends by 1 month
- `invoice.payment_succeeded` webhook triggered
- User continues to have access

---

## Automated Test Checklist

- [ ] User can login with Manus OAuth
- [ ] New user starts with `subscriptionStatus = 'trial'`
- [ ] Trial generation works (1 use)
- [ ] Second generation fails with "Trial used"
- [ ] Upgrade button opens Stripe checkout
- [ ] Test card payment succeeds
- [ ] Subscription status updates to "active"
- [ ] Active subscription allows unlimited generations
- [ ] Cancel subscription button works
- [ ] Canceled subscription shows "Upgrade Now"
- [ ] Webhook events update database correctly
- [ ] Failed payment doesn't create subscription
- [ ] User can view subscription status page
- [ ] Subscription end date displays correctly
- [ ] All database fields populated correctly

## Performance Testing

### Load Test: Multiple Concurrent Users

```bash
# Use Apache Bench or similar
ab -n 100 -c 10 http://localhost:3000/api/trpc/subscription.getStatus

# Expected: All requests succeed, < 100ms response time
```

### Database Query Performance

```sql
-- Check subscription status lookup time
EXPLAIN SELECT * FROM users WHERE id = ?;

-- Check event log retrieval
EXPLAIN SELECT * FROM subscriptionEvents WHERE userId = ? ORDER BY createdAt DESC LIMIT 50;
```

## Security Testing

### 1. Trial Guard
- [ ] Unauthenticated user cannot use trial
- [ ] Trial can only be used once
- [ ] Trial counter increments correctly
- [ ] Cannot bypass trial with direct API calls

### 2. Subscription Verification
- [ ] Canceled subscription blocks generation
- [ ] Expired subscription blocks generation
- [ ] Only active subscription allows generation
- [ ] Stripe customer ID verified before checkout

### 3. Webhook Security
- [ ] Invalid webhook signature rejected
- [ ] Missing signature header rejected
- [ ] Tampered webhook body rejected
- [ ] Only Stripe can trigger webhooks

## Debugging

### Common Issues

**Issue**: Stripe checkout not opening
```
Solution: 
1. Check STRIPE_PRICE_ID is correct
2. Verify Stripe publishable key in frontend
3. Check browser console for errors
4. Verify customer creation succeeded
```

**Issue**: Webhook not triggering
```
Solution:
1. Verify webhook URL is publicly accessible
2. Check webhook signing secret matches
3. Verify events are selected in Stripe dashboard
4. Check server logs: tail -f .manus-logs/devserver.log
5. Test with: stripe trigger customer.subscription.created
```

**Issue**: Trial not incrementing
```
Solution:
1. Check database connection
2. Verify user ID is correct
3. Check trialUsedCount column exists
4. Review server logs for errors
5. Check mutation response in browser DevTools
```

### Useful Commands

```bash
# Check database connection
mysql -u root -p medreg_platform -e "SELECT COUNT(*) FROM users;"

# View recent webhook events
stripe logs tail

# Trigger test webhook
stripe trigger customer.subscription.created

# View Stripe test data
stripe customers list
stripe subscriptions list

# Check server logs
tail -f .manus-logs/devserver.log
tail -f .manus-logs/browserConsole.log
```

## Reporting Issues

When reporting issues, include:
1. Steps to reproduce
2. Expected vs actual result
3. Error message/logs
4. Database state (user subscription info)
5. Stripe event ID (if webhook related)
6. Browser console errors
7. Server logs
