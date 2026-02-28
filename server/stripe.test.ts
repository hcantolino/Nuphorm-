import { describe, it, expect } from "vitest";
import { stripe } from "./stripe";

describe("Stripe Configuration", () => {
  it("should validate Stripe API key is configured", () => {
    // At least publishable key should be configured for frontend
    expect(process.env.STRIPE_PUBLISHABLE_KEY).toBeDefined();
  });

  it("should have required frontend environment variables", () => {
    // These are the minimum required for frontend checkout
    expect(process.env.STRIPE_PUBLISHABLE_KEY).toBeDefined();
    expect(process.env.STRIPE_PRICE_ID).toBeDefined();
  });

  it("should validate Stripe Price ID format", () => {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (priceId) {
      expect(priceId).toMatch(/^price_/);
    }
  });

  it("should validate Stripe Publishable Key format", () => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (publishableKey) {
      expect(publishableKey).toMatch(/^pk_(test|live)_/);
    }
  });
});
