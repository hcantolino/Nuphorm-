import { stripe, constructWebhookEvent } from "../stripe";
import {
  getUserByStripeCustomerId,
  updateUserSubscription,
  logSubscriptionEvent,
} from "../db";

export async function handleStripeWebhook(req: any, res: any) {
  const sig = req.headers["stripe-signature"];
  const body = req.body;

  let event: any;
  try {
    event = constructWebhookEvent(body, sig);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const customerId = event?.data?.object?.customer;
    if (!customerId) {
      console.warn("[Stripe Webhook] No customer ID in event");
      return res.json({ received: true });
    }

    const user = await getUserByStripeCustomerId(customerId);
    if (!user) {
      console.warn("[Stripe Webhook] User not found for customer:", customerId);
      return res.json({ received: true });
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        console.log("[Stripe Webhook] Subscription updated for user:", user.id);
        await updateUserSubscription(user.id, {
          subscriptionStatus: "active",
          stripeSubscriptionId: event.data.object.id,
          subscriptionStartDate: new Date(
            event.data.object.current_period_start * 1000
          ),
          subscriptionEndDate: new Date(
            event.data.object.current_period_end * 1000
          ),
        });
        await logSubscriptionEvent(user.id, "subscription_updated", {
          stripeEventId: event.id,
          subscriptionId: event.data.object.id,
        });
        break;

      case "customer.subscription.deleted":
        console.log("[Stripe Webhook] Subscription deleted for user:", user.id);
        await updateUserSubscription(user.id, {
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
        });
        await logSubscriptionEvent(user.id, "subscription_deleted", {
          stripeEventId: event.id,
        });
        break;

      case "invoice.payment_succeeded":
        console.log("[Stripe Webhook] Payment succeeded for user:", user.id);
        await logSubscriptionEvent(user.id, "payment_succeeded", {
          stripeEventId: event.id,
          invoiceId: event.data.object.id,
        });
        break;

      case "invoice.payment_failed":
        console.log("[Stripe Webhook] Payment failed for user:", user.id);
        await logSubscriptionEvent(user.id, "payment_failed", {
          stripeEventId: event.id,
          invoiceId: event.data.object.id,
        });
        break;

      default:
        console.log("[Stripe Webhook] Unhandled event type:", event.type);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook] Error processing webhook:", error);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
}
