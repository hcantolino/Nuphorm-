import Stripe from 'stripe';
import { ENV } from './_core/env';

// Initialize Stripe client (lazy initialization to avoid errors when key is missing)
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!ENV.stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeInstance = new Stripe(ENV.stripeSecretKey, {});
  }
  return stripeInstance;
}

// For backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get: (target, prop) => {
    const instance = getStripe();
    return (instance as any)[prop];
  },
});

export async function createStripeCustomer(email: string, name?: string) {
  return stripe.customers.create({
    email,
    name,
  });
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  returnUrl: string
) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: returnUrl + (returnUrl.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}',
    cancel_url: returnUrl,
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function constructWebhookEvent(body: any, sig: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  
  return getStripe().webhooks.constructEvent(body, sig, webhookSecret);
}
