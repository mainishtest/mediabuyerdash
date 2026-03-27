import type {
  MetaConnectionSession,
  MetaAccessibleAdAccount,
  MetaSyncStatus
} from "../../types/metaConnection";

// Simulates the state after a successful Facebook OAuth flow.
export const mockMetaSession: MetaConnectionSession = {
  userId:      "fb_user_999",
  userName:    "David McMenomey",
  userEmail:   "david@agency.com",
  accessToken: "mock_access_token_placeholder",
  connectedAt: "2024-03-01",
  expiresAt:   "2024-06-01",
  isActive:    true
};

// Simulates the ad accounts returned by /me/adaccounts after OAuth.
// Includes a disabled account to show the full range of states.
export const mockAccessibleAccounts: MetaAccessibleAdAccount[] = [
  {
    id:            "act_111111",
    name:          "Brand A — Main",
    currency:      "USD",
    timezone:      "America/New_York",
    businessName:  "Brand A LLC",
    accountStatus: "active",
    lifetimeSpend: 12_450.00
  },
  {
    id:            "act_222222",
    name:          "Brand B — Ecommerce",
    currency:      "USD",
    timezone:      "America/Chicago",
    businessName:  "Brand B Inc",
    accountStatus: "active",
    lifetimeSpend: 8_920.00
  },
  {
    id:            "act_333333",
    name:          "Brand C — Lead Gen",
    currency:      "USD",
    timezone:      "America/Los_Angeles",
    businessName:  "Brand C Corp",
    accountStatus: "active",
    lifetimeSpend: 5_200.00
  },
  {
    id:            "act_444444",
    name:          "Brand D — Retargeting",
    currency:      "USD",
    timezone:      "America/New_York",
    businessName:  "Brand D LLC",
    accountStatus: "disabled",
    lifetimeSpend: 0
  },
  {
    id:            "act_555555",
    name:          "Internal Test Account",
    currency:      "USD",
    timezone:      "America/New_York",
    accountStatus: "active",
    lifetimeSpend: 120.00
  }
];

// The two accounts already chosen for dashboard sync.
export const mockInitialSelectedIds: string[] = ["act_111111", "act_222222"];

// Sync status for the initially selected accounts.
export const mockSyncStatuses: MetaSyncStatus[] = [
  {
    adAccountId:   "act_111111",
    status:        "completed",
    lastAttemptAt: "2024-03-10T08:00:00Z",
    lastSuccessAt: "2024-03-10T08:00:00Z",
    recordsSynced: 142
  },
  {
    adAccountId:   "act_222222",
    status:        "completed",
    lastAttemptAt: "2024-03-10T08:05:00Z",
    lastSuccessAt: "2024-03-10T08:05:00Z",
    recordsSynced: 98
  }
];
