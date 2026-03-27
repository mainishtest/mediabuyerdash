import type { MetaAdAccountConnection } from "../../../types/integrations";

// Simulates the list of ad accounts a Facebook user has access to.
// isSelected = true means the agency has added it to this dashboard.
export const availableMetaAccounts: MetaAdAccountConnection[] = [
  {
    id:           "act_111111",
    name:         "Brand A — Main",
    currency:     "USD",
    timezone:     "America/New_York",
    businessName: "Brand A LLC",
    isSelected:   true
  },
  {
    id:           "act_222222",
    name:         "Brand B — Ecommerce",
    currency:     "USD",
    timezone:     "America/Chicago",
    businessName: "Brand B Inc",
    isSelected:   false
  },
  {
    id:           "act_333333",
    name:         "Brand C — Lead Gen",
    currency:     "USD",
    timezone:     "America/Los_Angeles",
    businessName: "Brand C Corp",
    isSelected:   false
  }
];
