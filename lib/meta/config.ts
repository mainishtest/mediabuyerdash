export const META_GRAPH_VERSION = "v20.0";
export const META_GRAPH_BASE   = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_DIALOG_BASE  = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
export const META_SCOPES       = "ads_read,ads_management,business_management";

export interface MetaConfig {
  appId:       string;
  appSecret:   string;
  redirectUri: string;
}

/**
 * Returns Meta app credentials from env vars, or null if they are not set.
 * All Meta auth logic must call this before doing anything.
 */
export function getMetaConfig(): MetaConfig | null {
  const appId     = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;

  const redirectUri =
    process.env.META_REDIRECT_URI ??
    "http://localhost:3000/api/auth/meta/callback";

  return { appId, appSecret, redirectUri };
}

export function isMetaConfigured(): boolean {
  return getMetaConfig() !== null;
}
