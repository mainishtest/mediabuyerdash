import {
  getMetaConfig,
  META_GRAPH_BASE,
  META_DIALOG_BASE,
  META_SCOPES,
} from "./config";

// ── OAuth URL ─────────────────────────────────────────────────────────────────

export function buildMetaOAuthUrl(state: string): string {
  const config = getMetaConfig();
  if (!config) throw new Error("Meta credentials not configured");

  const params = new URLSearchParams({
    client_id:     config.appId,
    redirect_uri:  config.redirectUri,
    state,
    scope:         META_SCOPES,
    response_type: "code",
  });
  return `${META_DIALOG_BASE}?${params}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export interface MetaTokenResponse {
  access_token: string;
  token_type:   string;
  expires_in?:  number;
}

export async function exchangeCodeForToken(
  code: string
): Promise<MetaTokenResponse> {
  const config = getMetaConfig();
  if (!config) throw new Error("Meta credentials not configured");

  const params = new URLSearchParams({
    client_id:     config.appId,
    client_secret: config.appSecret,
    redirect_uri:  config.redirectUri,
    code,
  });

  const res = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?${params}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${JSON.stringify(body)}`);
  }
  return res.json() as Promise<MetaTokenResponse>;
}

// ── User info ─────────────────────────────────────────────────────────────────

export interface MetaUserInfo {
  id:   string;
  name: string;
}

export async function fetchMetaUserInfo(
  accessToken: string
): Promise<MetaUserInfo> {
  const res = await fetch(
    `${META_GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch Meta user info");
  return res.json() as Promise<MetaUserInfo>;
}
