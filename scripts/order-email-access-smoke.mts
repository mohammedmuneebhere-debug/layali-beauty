/**
 * Order-email authorization. No email is sent.
 *
 * Usage: npm run test:order-email-access
 */
import { readFileSync } from 'node:fs';
import { orderEmailDecision } from '@/lib/email/order-email-access';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

assert('anonymous callers are rejected', orderEmailDecision(false, null) === 'unauthorized');
assert('a customer session is rejected', orderEmailDecision(true, 'customer') === 'forbidden');
assert('a missing role is rejected', orderEmailDecision(true, null) === 'forbidden');
assert('an admin session is allowed', orderEmailDecision(true, 'admin') === 'allow');

const route = readFileSync(new URL('../src/app/api/email/order/route.ts', import.meta.url), 'utf8');
const unauthorized = route.indexOf("decision === 'unauthorized'");
const parse = route.indexOf('request.json()');
const send = route.indexOf('sendOrderEmail(');
assert(
  'the route rejects anonymous callers before parsing or sending',
  unauthorized > 0 && parse > unauthorized && send > parse
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('order email access checks passed');
