import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCustomerContext, sealedSessionNeedsCookieWrite } from '@/lib/auth/current-customer';
import { safeSessionCommitReturn } from '@/lib/auth/session-cookie-write';
import { AdminShell } from './admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (await sealedSessionNeedsCookieWrite()) {
    const path = safeSessionCommitReturn((await headers()).get('x-layali-path'), '/admin');
    redirect(`/api/customer-account/commit-session?return=${encodeURIComponent(path.startsWith('/admin') ? path : '/admin')}`);
  }
  const context = await getCustomerContext();
  if (!context.signedIn) redirect('/auth/admin/signin');
  if (!context.customer.staff) redirect('/');
  return <AdminShell>{children}</AdminShell>;
}
