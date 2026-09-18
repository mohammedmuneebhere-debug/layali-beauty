import { OrdersListClient } from './OrdersListClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function OrdersPage() {
  return <OrdersListClient />;
}
