import { shopifyAdminFetch } from '@/lib/shopify/admin';
import { readCatalogRules, readOrderWorkflow, writeOrderWorkflow } from '@/lib/content/store';
import type { AnalyticsOrderRow } from '@/lib/analytics';
import type { Order, OrderStatus } from '@/types/database';

type AdminOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt?: string | null;
  email?: string | null;
  note?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  customer?: { displayName?: string | null; email?: string | null; phone?: string | null } | null;
  totalPriceSet?: { shopMoney?: { amount?: string } | null } | null;
  totalShippingPriceSet?: { shopMoney?: { amount?: string } | null } | null;
  shippingAddress?: {
    name?: string | null;
    phone?: string | null;
    address1?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  lineItems?: {
    nodes?: {
      title?: string | null;
      quantity?: number | null;
      originalUnitPriceSet?: { shopMoney?: { amount?: string } | null } | null;
      variant?: { product?: { id?: string | null } | null } | null;
    }[];
  } | null;
};

const RECENT_ORDERS = `#graphql
  query LayaliRecentOrders {
    orders(first: 50, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        cancelledAt
        email
        note
        displayFinancialStatus
        displayFulfillmentStatus
        customer { displayName email phone }
        totalPriceSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        shippingAddress { name phone address1 city country }
        lineItems(first: 50) {
          nodes {
            title
            quantity
            originalUnitPriceSet { shopMoney { amount } }
            variant { product { id } }
          }
        }
      }
    }
  }
`;

function shopifyStatus(node: AdminOrderNode): OrderStatus {
  if (node.cancelledAt) return 'cancelled';
  const fulfillment = (node.displayFulfillmentStatus || '').toUpperCase();
  if (fulfillment === 'FULFILLED') return 'delivered';
  if (fulfillment === 'PARTIALLY_FULFILLED' || fulfillment === 'IN_PROGRESS') return 'processing';
  if ((node.displayFinancialStatus || '').toUpperCase() === 'PAID') return 'confirmed';
  return 'pending';
}

function asStatus(value: string | undefined): OrderStatus {
  if (value === 'confirmed' || value === 'processing' || value === 'shipped' || value === 'delivered' || value === 'cancelled') {
    return value;
  }
  return 'pending';
}

export async function loadAdminOrderBoard(): Promise<{
  orders: Order[];
  analytics: AnalyticsOrderRow[];
  costs: { shopifyProductId: string; costPrice: number }[];
}> {
  const [{ data }, rules, workflow] = await Promise.all([
    shopifyAdminFetch<{ orders: { nodes: AdminOrderNode[] } }>(RECENT_ORDERS, undefined, {
      retries: 0,
      timeoutMs: 20_000,
      allowPartialData: true,
    }),
    readCatalogRules(),
    readOrderWorkflow(),
  ]);
  const costMap = new Map(rules.costs.map((row) => [row.shopifyProductId, row.costPrice]));
  const orders: Order[] = [];
  const analytics: AnalyticsOrderRow[] = [];

  for (const node of data.orders?.nodes || []) {
    const overlay = workflow[node.id];
    const status = overlay?.status ? asStatus(overlay.status) : shopifyStatus(node);
    const items = (node.lineItems?.nodes || []).map((line, index) => {
      const productId = line.variant?.product?.id || null;
      const price = Number(line.originalUnitPriceSet?.shopMoney?.amount || 0);
      return {
        id: `${node.id}:${index}`,
        order_id: node.id,
        product_id: productId,
        combo_id: null,
        name: line.title || 'Item',
        price,
        cost_price: productId ? costMap.get(productId) ?? null : null,
        quantity: Number(line.quantity || 0),
        created_at: node.createdAt,
      };
    });
    const order: Order = {
      id: node.id,
      user_id: '',
      status,
      total_amount: Number(node.totalPriceSet?.shopMoney?.amount || 0),
      delivery_fee: Number(node.totalShippingPriceSet?.shopMoney?.amount || 0),
      payment_method: 'cod',
      shipping_address: node.shippingAddress?.address1 || '',
      shipping_city: node.shippingAddress?.city || '',
      shipping_country: node.shippingAddress?.country || '',
      phone: node.shippingAddress?.phone || node.customer?.phone || '',
      receiver_name: node.shippingAddress?.name || node.customer?.displayName || null,
      tracking_number: overlay?.trackingNumber || null,
      notes: overlay?.notes || node.note || null,
      created_at: node.createdAt,
      updated_at: overlay?.updatedAt || node.createdAt,
      items,
      profile: {
        id: '',
        email: node.customer?.email || node.email || '',
        full_name: node.customer?.displayName || node.shippingAddress?.name || 'Customer',
        role: 'user',
        gender: null,
        country: node.shippingAddress?.country || null,
        city: node.shippingAddress?.city || null,
        phone: node.customer?.phone || null,
        address: null,
        onboarding_completed: true,
        created_at: node.createdAt,
        updated_at: node.createdAt,
      },
    };
    orders.push(order);
    analytics.push({
      id: node.name || node.id,
      status,
      total_amount: order.total_amount,
      delivery_fee: order.delivery_fee ?? null,
      created_at: node.createdAt,
      items: items.map((item) => ({
        product_id: item.product_id,
        combo_id: null,
        name: item.name,
        price: item.price,
        cost_price: item.cost_price,
        quantity: item.quantity,
      })),
    });
  }

  return { orders, analytics, costs: rules.costs };
}

export async function recordAdminOrderUpdate(input: {
  id: string;
  status?: OrderStatus;
  trackingNumber?: string | null;
  message?: string | null;
}): Promise<void> {
  const note = [input.message, input.trackingNumber ? `Tracking: ${input.trackingNumber}` : '']
    .filter(Boolean)
    .join('\n');
  await writeOrderWorkflow(input.id, {
    status: input.status,
    trackingNumber: input.trackingNumber,
    notes: note || null,
  });
  if (!note) return;
  await shopifyAdminFetch(
    `#graphql
      mutation LayaliOrderNote($input: OrderInput!) {
        orderUpdate(input: $input) {
          order { id }
          userErrors { message }
        }
      }
    `,
    { input: { id: input.id, note } },
    { retries: 0, timeoutMs: 15_000, allowPartialData: true }
  );
}
