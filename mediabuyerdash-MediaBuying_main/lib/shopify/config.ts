export const SHOPIFY_API_VERSION = "2024-10";
export const SHOPIFY_SCOPES     = "read_orders,read_customers";

export interface ShopifyConfig {
  appKey:      string;
  appSecret:   string;
  redirectUri: string;
}

export function getShopifyConfig(): ShopifyConfig | null {
  const appKey    = process.env.SHOPIFY_APP_KEY;
  const appSecret = process.env.SHOPIFY_APP_SECRET;
  if (!appKey || !appSecret) return null;

  const redirectUri =
    process.env.SHOPIFY_REDIRECT_URI ??
    "http://localhost:3000/api/auth/shopify/callback";

  return { appKey, appSecret, redirectUri };
}

export function isShopifyConfigured(): boolean {
  return getShopifyConfig() !== null;
}

/** Normalise user-entered shop domain to "mystore.myshopify.com". */
export function normaliseShopDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/\/$/, "");
  if (!domain.includes(".")) {
    domain = `${domain}.myshopify.com`;
  }
  return domain;
}
