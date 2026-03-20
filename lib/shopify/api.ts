import { SHOPIFY_API_VERSION } from "./config";

// ── Raw API types ──────────────────────────────────────────────────────────────

export interface RawShopifyMoneyBag {
  shopMoney: { amount: string };
}

export interface RawShopifyLineItem {
  id:       string;
  title:    string;
  quantity: number;
  originalUnitPriceSet: RawShopifyMoneyBag;
}

export interface RawShopifyOrder {
  id:           string; // "gid://shopify/Order/12345"
  name:         string; // "#1001"
  createdAt:    string; // ISO — when the order was created in Shopify
  currencyCode: string;
  totalPriceSet:      RawShopifyMoneyBag;
  subtotalPriceSet:   RawShopifyMoneyBag;
  totalTaxSet:        RawShopifyMoneyBag;
  totalDiscountsSet:  RawShopifyMoneyBag;
  customer?: { id: string; email?: string };
  customerJourneySummary?: {
    firstVisit?: {
      utmParameters?: {
        source?:   string;
        medium?:   string;
        campaign?: string;
        content?:  string;
        term?:     string;
      };
      landingPage?:  string;
      referrerUrl?:  string;
    };
  };
  lineItems: {
    edges: Array<{ node: RawShopifyLineItem }>;
  };
}

interface OrdersQueryData {
  orders: {
    edges:    Array<{ node: RawShopifyOrder }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// ── GraphQL query ──────────────────────────────────────────────────────────────

const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          currencyCode
          totalPriceSet      { shopMoney { amount } }
          subtotalPriceSet   { shopMoney { amount } }
          totalTaxSet        { shopMoney { amount } }
          totalDiscountsSet  { shopMoney { amount } }
          customer           { id email }
          customerJourneySummary {
            firstVisit {
              utmParameters { source medium campaign content term }
              landingPage
              referrerUrl
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet { shopMoney { amount } }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// ── GraphQL executor ───────────────────────────────────────────────────────────

async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type":           "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${JSON.stringify(body)}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Stream orders page-by-page since `since`, calling `onPage` after each page.
 * This avoids accumulating all orders in memory and lets the caller write to
 * the DB incrementally — critical for large stores or tight serverless timeouts.
 */
export async function streamOrdersSince(
  shopDomain: string,
  accessToken: string,
  since: Date,
  onPage: (orders: RawShopifyOrder[]) => Promise<void>
): Promise<void> {
  const sinceStr  = since.toISOString().slice(0, 10);
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: OrdersQueryData = await shopifyGraphQL<OrdersQueryData>(
      shopDomain,
      accessToken,
      ORDERS_QUERY,
      { first: 50, after: cursor, query: `created_at:>='${sinceStr}'` }
    );

    const orders = data.orders.edges.map((e: { node: RawShopifyOrder }) => e.node);
    if (orders.length > 0) await onPage(orders);

    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor      = data.orders.pageInfo.endCursor;
  }
}

/** @deprecated Use streamOrdersSince for large stores. Kept for compatibility. */
export async function fetchRecentOrders(
  shopDomain: string,
  accessToken: string,
  dayRange = 30
): Promise<RawShopifyOrder[]> {
  const since = new Date();
  since.setDate(since.getDate() - dayRange);
  const all: RawShopifyOrder[] = [];
  await streamOrdersSince(shopDomain, accessToken, since, async (page) => {
    all.push(...page);
  });
  return all;
}
