import { headers } from 'next/headers';
import {
  customerAccountConfig,
  customerAccountsOfferedOnHost,
} from '@/lib/shopify/customer-account';
import SignInForm from './sign-in-form';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || '';
  const customerAccountsEnabled =
    customerAccountConfig(process.env).ok && customerAccountsOfferedOnHost(host);

  return <SignInForm customerAccountsEnabled={customerAccountsEnabled} shopifyConnected={false} />;
}
