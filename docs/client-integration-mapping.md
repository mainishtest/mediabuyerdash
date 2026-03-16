# Client Integration Mapping

## Overview

Integration mapping connects workspace-level data sources (Meta ad accounts,
Shopify stores) to a specific `ClientAccount`. This enables scoped reporting,
reconciliation, and optimization per client.

**Mapping is association only — no sync runs until explicitly triggered.**

---

## Data Model

```
Workspace
  └── MetaConnection (one per connected Meta user)
        └── MetaAccessibleAdAccount (all accounts from Meta API)
              └── MetaSelectedAdAccount → ClientAccount?   ← mapping field
  └── ShopifyConnection → ClientAccount?                   ← mapping field
  └── ClientAccount
        ├── metaSelectedAccounts[]   (reverse: Meta accounts mapped here)
        └── shopifyConnections[]     (reverse: Shopify stores mapped here)
```

**Mapping fields (already in schema, no migration needed):**
- `MetaSelectedAdAccount.clientAccountId String?` — nullable FK to ClientAccount
- `ShopifyConnection.clientAccountId String?` — nullable FK to ClientAccount

---

## Meta Account Mapping

### Prerequisites
1. Workspace admin connects Meta at `/integrations/meta`
2. Admin selects ad accounts → `MetaSelectedAdAccount` records are created

### Mapping flow
1. Open a client detail page `/clients/[clientId]`
2. Scroll to **Client Integrations → Meta Ad Accounts**
3. Available selected accounts are listed
4. Click **Add** on an account → `assignMetaAccountToClientAction` fires
5. `MetaSelectedAdAccount.clientAccountId` is updated to `clientId`
6. The account moves to "Mapped to this client"

### Rules
- Multiple Meta ad accounts can be mapped to one client
- One Meta account can only be mapped to one client at a time
- Accounts mapped to other clients appear with a "Mapped Elsewhere" badge (read-only)
- Remove a mapping via the **Remove** button on a mapped account

### Server action
```typescript
// app/clients/[clientId]/actions.ts
assignMetaAccountToClientAction(clientId, selectedAccountId)
unmapMetaAccountFromClientAction(clientId, selectedAccountId)
```

---

## Shopify Store Mapping

### Prerequisites
1. Workspace admin connects a Shopify store at `/integrations/shopify`
2. `ShopifyConnection` record is created with `clientAccountId = null`

### Mapping flow
1. Open a client detail page `/clients/[clientId]`
2. Scroll to **Client Integrations → Shopify Store**
3. Available Shopify connections are listed
4. Click **Assign** on a store → `assignShopifyConnectionToClientAction` fires
5. `ShopifyConnection.clientAccountId` is updated to `clientId`
6. The store shows as "Mapped to this client"

### Rules
- Each client supports one Shopify store (enforced in UI, flexible in schema)
- Each Shopify connection can only be mapped to one client at a time
- Stores mapped to other clients appear with a "Mapped Elsewhere" badge
- Remove a mapping via the **Unmap** button

### Server action
```typescript
// app/clients/[clientId]/actions.ts
assignShopifyConnectionToClientAction(clientId, connectionId)
unmapShopifyFromClientAction(clientId, connectionId)
```

---

## Client Readiness

Shown as a 3-item strip at the top of the integrations section:

| Item | Ready condition |
|---|---|
| Meta Account | `metaSelectedAccounts.length > 0` for this client |
| Shopify Store | `ShopifyConnection.clientAccountId === clientId` |
| Ready for Sync | Both Meta and Shopify mapped |

When all three are green, the client is ready for its first sync.

---

## Query Layer

```typescript
// lib/clientIntegrations.ts
getClientIntegrationStatus(clientId): Promise<ClientIntegrationStatus>
```

Returns:
- `metaState: "not_connected" | "available" | "mapped"`
- `shopifyState: "not_connected" | "available" | "mapped"`
- `readyForSync: boolean`
- `mappedMetaAccounts[]` — Meta accounts mapped to this client
- `availableMetaAccounts[]` — all other selected accounts in workspace
- `mappedShopifyConnection` — Shopify store mapped to this client (or null)
- `availableShopifyConnections[]` — all other Shopify connections in workspace

---

## What This Enables Next

Once mapping is complete:

1. **Scoped Meta sync** — sync campaigns, ad sets, ads for only the mapped ad accounts
2. **Scoped Shopify sync** — pull orders from the mapped Shopify store
3. **Reconciliation** — match Meta delivery metrics against CRM orders per client
4. **Goal-aware optimization** — evaluate campaign performance against client goals
5. **Dashboard stats** — client-scoped spend, ROAS, CPA from reconciled data

---

## Architecture Notes

- `lib/clientIntegrations.ts` — read-only queries, never mutates
- `app/clients/[clientId]/actions.ts` — all mutations, session-verified
- `ClientIntegrationsSection.tsx` — pure UI, calls server actions, no direct DB access
- No coupling to Meta sync logic, Shopify sync logic, or reconciliation engine
