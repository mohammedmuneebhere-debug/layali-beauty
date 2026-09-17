/**
 * Server-only writes to shopify_order_links.
 * Never call from the browser. Service role only — customer JWTs cannot insert/update.
 */
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase/service';
import { isShopifyOrderGid } from '@/lib/shopify/admin-orders';

export type OrderLinkUpsertResult = 'linked' | 'refused_foreign' | 'skipped' | 'failed';

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === UNIQUE_VIOLATION) return true;
  return /duplicate key|unique constraint/i.test(error.message || '');
}

/**
 * Attach a Shopify Order GID to the authenticated user.
 * Refuses to reassign a GID already owned by a different user.
 */
export async function upsertOwnedShopifyOrderLink(params: {
  userId: string;
  shopifyOrderId: string;
  shopifyOrderName?: string | null;
  submissionId?: string | null;
}): Promise<OrderLinkUpsertResult> {
  if (!params.userId || !isShopifyOrderGid(params.shopifyOrderId)) {
    return 'skipped';
  }
  if (!hasServiceRoleKey()) {
    console.error('shopify_order_links write skipped — service role is not configured');
    return 'failed';
  }

  const admin = createServiceClient();
  const now = new Date().toISOString();
  const shopifyOrderName = params.shopifyOrderName?.trim() || null;
  const submissionId = params.submissionId?.trim() || null;

  const { data: existing, error: readError } = await admin
    .from('shopify_order_links')
    .select('supabase_user_id')
    .eq('shopify_order_id', params.shopifyOrderId)
    .maybeSingle();

  if (readError) {
    console.error('shopify_order_links ownership read failed', readError.message);
    return 'failed';
  }

  if (existing?.supabase_user_id && existing.supabase_user_id !== params.userId) {
    return 'refused_foreign';
  }

  const patch: Record<string, unknown> = {
    shopify_order_name: shopifyOrderName,
    updated_at: now,
  };
  if (submissionId) patch.submission_id = submissionId;

  if (existing?.supabase_user_id === params.userId) {
    let { error } = await admin
      .from('shopify_order_links')
      .update(patch)
      .eq('shopify_order_id', params.shopifyOrderId)
      .eq('supabase_user_id', params.userId);

    if (error && submissionId && /submission_id/i.test(error.message || '')) {
      const { shopify_order_name, updated_at } = patch;
      ({ error } = await admin
        .from('shopify_order_links')
        .update({ shopify_order_name, updated_at })
        .eq('shopify_order_id', params.shopifyOrderId)
        .eq('supabase_user_id', params.userId));
    }

    if (error) {
      console.error('shopify_order_links update failed', error.message);
      return 'failed';
    }
    return 'linked';
  }

  const insertRow: Record<string, unknown> = {
    supabase_user_id: params.userId,
    shopify_order_id: params.shopifyOrderId,
    shopify_order_name: shopifyOrderName,
    updated_at: now,
  };
  if (submissionId) insertRow.submission_id = submissionId;

  let { error: insertError } = await admin.from('shopify_order_links').insert(insertRow);

  if (insertError && submissionId && /submission_id/i.test(insertError.message || '')) {
    ({ error: insertError } = await admin.from('shopify_order_links').insert({
      supabase_user_id: params.userId,
      shopify_order_id: params.shopifyOrderId,
      shopify_order_name: shopifyOrderName,
      updated_at: now,
    }));
  }

  if (insertError && isUniqueViolation(insertError)) {
    const { data: raced } = await admin
      .from('shopify_order_links')
      .select('supabase_user_id')
      .eq('shopify_order_id', params.shopifyOrderId)
      .maybeSingle();
    if (raced?.supabase_user_id && raced.supabase_user_id !== params.userId) {
      return 'refused_foreign';
    }
    if (raced?.supabase_user_id === params.userId) {
      return 'linked';
    }
    console.error('shopify_order_links unique conflict without owner row', insertError.message);
    return 'failed';
  }

  if (insertError) {
    console.error('shopify_order_links insert failed', insertError.message);
    return 'failed';
  }

  return 'linked';
}
