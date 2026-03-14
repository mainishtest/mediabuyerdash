"use server";

import { cookies }        from "next/headers";
import { redirect }       from "next/navigation";
import { revalidatePath } from "next/cache";
import { buildMetaOAuthUrl }    from "../../../lib/meta/auth";
import { isMetaConfigured }     from "../../../lib/meta/config";
import { fetchAccessibleAdAccounts } from "../../../lib/meta/accounts";
import {
  getMetaConnection,
  deleteMetaConnection,
  syncAccessibleAdAccounts,
  saveSelectedAdAccounts,
} from "../../../lib/meta/db";

const PAGE = "/integrations/meta";

// ── Start OAuth ───────────────────────────────────────────────────────────────

export async function startMetaOAuthAction() {
  if (!isMetaConfigured()) {
    redirect(`${PAGE}?error=not_configured`);
  }

  const state = crypto.randomUUID();

  cookies().set("meta_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 minutes
    path:     "/",
  });

  redirect(buildMetaOAuthUrl(state));
}

// ── Disconnect ────────────────────────────────────────────────────────────────

export async function disconnectMetaAction(connectionId: string) {
  await deleteMetaConnection(connectionId);
  revalidatePath(PAGE);
}

// ── Refresh accessible accounts ───────────────────────────────────────────────

export async function refreshAccountsAction(connectionId: string) {
  const conn = await getMetaConnection();
  if (!conn || conn.id !== connectionId) return;

  const accounts = await fetchAccessibleAdAccounts(conn.accessToken);
  await syncAccessibleAdAccounts(connectionId, accounts);
  revalidatePath(PAGE);
}

// ── Save selection ────────────────────────────────────────────────────────────

export async function saveSelectedAccountsAction(
  connectionId: string,
  selectedIds:  string[]
) {
  await saveSelectedAdAccounts(connectionId, selectedIds);
  revalidatePath(PAGE);
}
