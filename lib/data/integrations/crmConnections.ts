import type { CRMConnection } from "../../../types/integrations";

export const crmConnections: CRMConnection[] = [
  {
    id:       "crm_shopify_1",
    platform: "shopify",
    label:    "Shopify — Brand A Store",
    status:   "disconnected",
    storeUrl: "brand-a.myshopify.com"
  },
  {
    id:          "crm_konnective_1",
    platform:    "konnective",
    label:       "Konnective — Brand B",
    status:      "disconnected",
    apiEndpoint: "https://app.konnective.com/api/v2"
  }
];
