export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  // Forge key takes priority; fall back to OPENAI_API_KEY for OpenAI-compatible path.
  // ANTHROPIC_API_KEY is read directly in llm.ts (Anthropic path bypasses this field).
  forgeApiKey:
    process.env.BUILT_IN_FORGE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  stripePriceId: process.env.STRIPE_PRICE_ID ?? "",
};
