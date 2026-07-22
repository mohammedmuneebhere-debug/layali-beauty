import type { OrderItem, OrderStatus } from '@/types/database';

export type AnalyticsOrderRow = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  delivery_fee: number | null;
  created_at: string;
  items: Pick<OrderItem, 'product_id' | 'combo_id' | 'name' | 'price' | 'cost_price' | 'quantity'>[];
};

export type DateSeriesPoint = {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  units: number;
  orders: number;
};

export type ProductAnalyticsRow = {
  key: string;
  name: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
};

export type AnalyticsSummary = {
  orders: number;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  deliveryRevenue: number;
  avgOrderValue: number;
  marginPercent: number;
};

const COMPLETED_STATUSES: OrderStatus[] = ['delivered', 'shipped', 'processing', 'confirmed'];

export function isCountableOrder(status: OrderStatus, includePending: boolean) {
  if (status === 'cancelled') return false;
  if (includePending) return true;
  return COMPLETED_STATUSES.includes(status) || status === 'pending';
}

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

function lineRevenue(item: AnalyticsOrderRow['items'][number]) {
  return Number(item.price) * item.quantity;
}

function lineCost(item: AnalyticsOrderRow['items'][number]) {
  const unitCost = item.cost_price == null ? 0 : Number(item.cost_price);
  return unitCost * item.quantity;
}

export function filterOrders(
  orders: AnalyticsOrderRow[],
  options: {
    from?: string;
    to?: string;
    productIds?: string[];
    includePending?: boolean;
  }
) {
  const productSet = options.productIds?.length ? new Set(options.productIds) : null;

  return orders
    .filter((order) => isCountableOrder(order.status, options.includePending ?? false))
    .filter((order) => {
      const day = toDateKey(order.created_at);
      if (options.from && day < options.from) return false;
      if (options.to && day > options.to) return false;
      return true;
    })
    .map((order) => {
      if (!productSet) return order;
      const items = order.items.filter(
        (item) => item.product_id && productSet.has(item.product_id)
      );
      return { ...order, items };
    })
    .filter((order) => order.items.length > 0);
}

export function computeSummary(orders: AnalyticsOrderRow[]): AnalyticsSummary {
  let units = 0;
  let revenue = 0;
  let cost = 0;
  let deliveryRevenue = 0;

  for (const order of orders) {
    deliveryRevenue += Number(order.delivery_fee || 0);
    for (const item of order.items) {
      units += item.quantity;
      revenue += lineRevenue(item);
      cost += lineCost(item);
    }
  }

  const profit = revenue - cost;
  const ordersCount = orders.length;

  return {
    orders: ordersCount,
    units,
    revenue,
    cost,
    profit,
    deliveryRevenue,
    avgOrderValue: ordersCount ? (revenue + deliveryRevenue) / ordersCount : 0,
    marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
  };
}

export function computeDateSeries(orders: AnalyticsOrderRow[]): DateSeriesPoint[] {
  const map = new Map<string, DateSeriesPoint>();

  for (const order of orders) {
    const date = toDateKey(order.created_at);
    const point =
      map.get(date) ||
      ({ date, revenue: 0, cost: 0, profit: 0, units: 0, orders: 0 } satisfies DateSeriesPoint);

    point.orders += 1;

    for (const item of order.items) {
      const rev = lineRevenue(item);
      const c = lineCost(item);
      point.revenue += rev;
      point.cost += c;
      point.profit += rev - c;
      point.units += item.quantity;
    }

    map.set(date, point);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function computeProductBreakdown(orders: AnalyticsOrderRow[]): ProductAnalyticsRow[] {
  const map = new Map<string, ProductAnalyticsRow>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = item.product_id || item.combo_id || item.name;
      const row =
        map.get(key) ||
        ({
          key,
          name: item.name,
          units: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        } satisfies ProductAnalyticsRow);

      const rev = lineRevenue(item);
      const c = lineCost(item);
      row.units += item.quantity;
      row.revenue += rev;
      row.cost += c;
      row.profit += rev - c;
      map.set(key, row);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function computeStatusBreakdown(orders: AnalyticsOrderRow[]) {
  const counts: Record<string, number> = {};
  for (const order of orders) {
    counts[order.status] = (counts[order.status] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
