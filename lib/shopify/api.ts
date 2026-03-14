import { SHOPIFY_API_VERSION } from "./config";

// ── Raw API types ──────────────────────────────────────────────────────────────

export interface RawShopifyMoneyBag {
  shopMoney: { amount: string };
}

export interface RawShopifyLineItem {
  id:       string;
  product?: { id: string };
  variant?: { id: string };
  title:    string;
  quantity: number;
  originalUnitPriceSet: RawShopifyMoneyBag;
}

export interface RawShopifyOrder {
  id:          string; // "gid://shopify/Order/12345"
  name:        string; // "#1001"
  processedAt: string;
  currencyCode: string;
  totalPriceSet:      RawShopifyMoneyBag;
  subtotalPriceSet:   RawShopifyMoneyBag;
  totalTaxSet:        RawShopifyMoneyBag;
  totalDiscountsSet:  RawShopifyMoneyBag;
  customer?: { id: string };
  utmParameters?: {
    source?:   string;
    medium?:   string;
    campaign?: string;
    content?:  string;
    term?:     string;
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
          processedAt
          currencyCode
          totalPriceSet      { shopMoney { amount } }
          subtotalPriceSet   { shopMoney { amount } }
          totalTaxSet        { shopMoney { amount } }
          totalDiscountsSet  { shopMoney { amount } }
          customer           { id }
          utmParameters      { source medium campaign content term }
          lineItems(first: 50) {
            edges {
              node {
                id
                product { id }
                variant { id }
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
 * Fetch all orders processed within the last `dayRange` days.
 * Uses cursor-based pagination so large stores are handled safely.
 */
export async function fetchRecentOrders(
  shopDomain: string,
  accessToken: string,
  dayRange = 30
): Promise<RawShopifyOrder[]> {
  const since = new Date();
  since.setDate(since.getDate() - dayRange);
  const sinceStr = since.toISOString().slice(0, 10);

  const allOrders: RawShopifyOrder[] = [];
  let cursor: string | null = null;
  let hasNextPage             = true;
  const pageSize              = 50;

  while (hasNextPage) {
    const data = await shopifyGraphQL<OrdersQueryData>(
      shopDomain,
      accessToken,
      ORDERS_QUERY,
      {
        first: pageSize,
        after: cursor,
        query: `processed_at:>='${sinceStr}'`,
      }
    );

    allOrders.push(...data.orders.edges.map((e) => e.node));
    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor      = data.orders.pageInfo.endCursor;
  }

  return allOrders;
}
