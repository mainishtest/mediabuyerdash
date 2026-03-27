// Meta / Facebook connection flow types.
// Kept separate from types/integrations.ts (generic integration types) and
// types/media.ts (ad-hierarchy domain types) so the OAuth and sync layer
// can evolve independently.

// --- Sync / session state ----------------------------------------------------

export type MetaSyncStatusValue =
  | "idle"
  | "pending"
  | "syncing"
  | "completed"
  | "failed";

// Represents an authenticated Meta user session.
// accessToken is a placeholder — in production this comes from Facebook OAuth.
export interface MetaConnectionSession {
  userId:      string;
  userName:    string;
  userEmail:   string;
  accessToken: string;    // placeholder in mock; real value from OAuth
  connectedAt: string;    // ISO date
  expiresAt:   string;    // ISO date
  isActive:    boolean;
}

// --- Ad account discovery ----------------------------------------------------

// An ad account visible to the authenticated Meta user.
// Returned by the /me/adaccounts endpoint in the future.
export interface MetaAccessibleAdAccount {
  id:            string;   // Meta format: "act_XXXXXXX"
  name:          string;
  currency:      string;
  timezone:      string;
  businessName?: string;
  accountStatus: "active" | "disabled" | "unsettled";
  lifetimeSpend: number;
}

// An ad account the agency has chosen to sync into the dashboard.
export interface MetaSelectedAdAccount {
  adAccountId:   string;   // FK → MetaAccessibleAdAccount.id
  addedAt:       string;   // ISO date
  syncEnabled:   boolean;
  lastSyncedAt?: string;   // ISO datetime of last successful sync
}

// --- Sync status -------------------------------------------------------------

// Tracks the sync state for a single selected ad account.
export interface MetaSyncStatus {
  adAccountId:    string;
  status:         MetaSyncStatusValue;
  lastAttemptAt?: string;   // ISO datetime
  lastSuccessAt?: string;   // ISO datetime
  errorMessage?:  string;
  recordsSynced?: number;
}
