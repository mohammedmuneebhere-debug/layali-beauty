/**
 * Merchandising and care records on the Shopify shop metafield.
 * Empty regional rules do not hide the catalog.
 */
import { readShopJson, writeShopJson } from '@/lib/shopify/shop-records';
import type {
  AddressLabel,
  Combo,
  CustomerReview,
  Region,
  SiteBanner,
  SupportConversation,
  SupportMessage,
} from '@/types/database';
import type { TrendingConfigRow } from '@/lib/trending';

export type CatalogRules = {
  regions: Region[];
  productRegions: { shopifyProductId: string; regionId: string; isAvailable: boolean }[];
  metadata: { shopifyProductId: string; benefits: string[]; featured: boolean }[];
  costs: { shopifyProductId: string; costPrice: number }[];
};

export type SupportStore = {
  conversations: SupportConversation[];
  messages: SupportMessage[];
};

export type OrderWorkflow = {
  id: string;
  status: string;
  trackingNumber: string | null;
  notes: string | null;
  updatedAt: string;
};

const EMPTY_RULES: CatalogRules = {
  regions: [],
  productRegions: [],
  metadata: [],
  costs: [],
};

function id(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export async function listBanners(): Promise<SiteBanner[]> {
  const rows = await readShopJson<SiteBanner[]>('banners', []);
  return [...rows].sort((a, b) => a.placement.localeCompare(b.placement) || a.sort_order - b.sort_order);
}

export async function saveBanner(input: Partial<SiteBanner> & { id?: string }): Promise<SiteBanner[]> {
  const rows = await listBanners();
  if (input.id) {
    const next = rows.map((row) =>
      row.id === input.id ? { ...row, ...input, id: row.id, updated_at: now() } : row
    );
    await writeShopJson('banners', next);
    return next;
  }
  const created: SiteBanner = {
    id: id(),
    placement: input.placement || 'landing_hero',
    image_url: input.image_url || '',
    alt_text: input.alt_text || '',
    href: input.href ?? null,
    span: input.span ?? null,
    image_width: input.image_width ?? null,
    image_height: input.image_height ?? null,
    sort_order: input.sort_order ?? rows.length,
    is_active: input.is_active !== false,
    starts_at: input.starts_at ?? null,
    ends_at: input.ends_at ?? null,
    created_at: now(),
    updated_at: now(),
  };
  const next = [...rows, created];
  await writeShopJson('banners', next);
  return next;
}

export async function deleteBanner(bannerId: string): Promise<void> {
  const rows = await listBanners();
  await writeShopJson(
    'banners',
    rows.filter((row) => row.id !== bannerId)
  );
}

export async function listCombos(): Promise<Combo[]> {
  const rows = await readShopJson<Combo[]>('combos', []);
  return [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function saveCombo(input: Partial<Combo> & { id?: string }): Promise<Combo> {
  const rows = await listCombos();
  if (input.id) {
    const existing = rows.find((row) => row.id === input.id);
    if (!existing) throw new Error('Combo not found');
    const updated: Combo = { ...existing, ...input, id: existing.id, updated_at: now() };
    await writeShopJson(
      'combos',
      rows.map((row) => (row.id === updated.id ? updated : row))
    );
    return updated;
  }
  const created: Combo = {
    id: id(),
    name: input.name || 'Combo',
    description: input.description ?? null,
    price: Number(input.price || 0),
    compare_at_price: input.compare_at_price ?? null,
    cost_price: input.cost_price ?? null,
    gender: input.gender || 'female',
    image_url: input.image_url ?? null,
    is_active: input.is_active !== false,
    is_ai_generated: Boolean(input.is_ai_generated),
    dermatologist_verified: Boolean(input.dermatologist_verified),
    shopify_items: input.shopify_items || [],
    created_at: now(),
    updated_at: now(),
  };
  await writeShopJson('combos', [created, ...rows]);
  return created;
}

export async function deleteCombo(comboId: string): Promise<void> {
  const rows = await listCombos();
  await writeShopJson(
    'combos',
    rows.filter((row) => row.id !== comboId)
  );
}

export async function readCatalogRules(): Promise<CatalogRules> {
  const rules = await readShopJson<Partial<CatalogRules>>('catalog_rules', EMPTY_RULES);
  return {
    regions: rules.regions || [],
    productRegions: rules.productRegions || [],
    metadata: rules.metadata || [],
    costs: rules.costs || [],
  };
}

export async function writeCatalogRules(rules: CatalogRules): Promise<void> {
  await writeShopJson('catalog_rules', rules);
}

export async function listTrendingRows(): Promise<TrendingConfigRow[]> {
  return readShopJson<TrendingConfigRow[]>('trending', []);
}

export async function writeTrendingRows(rows: TrendingConfigRow[]): Promise<void> {
  await writeShopJson('trending', rows);
}

export async function listReviews(): Promise<CustomerReview[]> {
  return readShopJson<CustomerReview[]>('reviews', []);
}

export async function addReview(input: {
  userId: string;
  fullName: string;
  city: string | null;
  country: string | null;
  rating: number;
  title: string;
  content: string;
}): Promise<void> {
  const rows = await listReviews();
  const created: CustomerReview = {
    id: id(),
    user_id: input.userId,
    rating: input.rating,
    title: input.title,
    content: input.content,
    is_approved: false,
    created_at: now(),
    profile: {
      full_name: input.fullName,
      city: input.city,
      country: input.country,
    },
  };
  await writeShopJson('reviews', [created, ...rows]);
}

export async function updateReview(reviewId: string, patch: Partial<CustomerReview>): Promise<void> {
  const rows = await listReviews();
  await writeShopJson(
    'reviews',
    rows.map((row) => (row.id === reviewId ? { ...row, ...patch, id: row.id } : row))
  );
}

export async function deleteReview(reviewId: string): Promise<void> {
  const rows = await listReviews();
  await writeShopJson(
    'reviews',
    rows.filter((row) => row.id !== reviewId)
  );
}

async function readSupport(): Promise<SupportStore> {
  const store = await readShopJson<Partial<SupportStore>>('support', { conversations: [], messages: [] });
  return {
    conversations: store.conversations || [],
    messages: store.messages || [],
  };
}

export async function customerSupportThread(userId: string): Promise<{
  conversation: SupportConversation | null;
  messages: SupportMessage[];
}> {
  const store = await readSupport();
  const conversation =
    store.conversations
      .filter((row) => row.user_id === userId && row.status === 'open')
      .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))[0] || null;
  const messages = conversation
    ? store.messages
        .filter((row) => row.conversation_id === conversation.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : [];
  return { conversation, messages };
}

export async function listSupport(): Promise<SupportStore> {
  const store = await readSupport();
  return {
    conversations: [...store.conversations].sort((a, b) =>
      (b.last_message_at || '').localeCompare(a.last_message_at || '')
    ),
    messages: store.messages,
  };
}

export async function addSupportMessage(input: {
  userId: string;
  fullName: string;
  email: string;
  city: string | null;
  country: string | null;
  senderRole: 'user' | 'admin';
  message: string;
  conversationId?: string | null;
}): Promise<{ conversation: SupportConversation; message: SupportMessage }> {
  const store = await readSupport();
  let conversation = input.conversationId
    ? store.conversations.find((row) => row.id === input.conversationId) || null
    : store.conversations.find((row) => row.user_id === input.userId && row.status === 'open') || null;
  if (!conversation) {
    conversation = {
      id: id(),
      user_id: input.userId,
      subject: 'Customer inquiry',
      status: 'open',
      last_message_at: now(),
      created_at: now(),
      profile: {
        full_name: input.fullName,
        email: input.email,
        city: input.city,
        country: input.country,
      },
    };
    store.conversations.push(conversation);
  }
  const message: SupportMessage = {
    id: id(),
    conversation_id: conversation.id,
    sender_id: input.userId,
    sender_role: input.senderRole,
    message: input.message,
    created_at: now(),
    profile: { full_name: input.fullName },
  };
  conversation.last_message_at = message.created_at;
  store.messages.push(message);
  await writeShopJson('support', store);
  return { conversation, message };
}

export async function closeSupportConversation(conversationId: string): Promise<void> {
  const store = await readSupport();
  await writeShopJson('support', {
    ...store,
    conversations: store.conversations.map((row) =>
      row.id === conversationId ? { ...row, status: 'closed' as const } : row
    ),
  });
}

export async function readOrderWorkflow(): Promise<Record<string, OrderWorkflow>> {
  return readShopJson<Record<string, OrderWorkflow>>('order_workflow', {});
}

export async function writeOrderWorkflow(orderId: string, patch: Partial<OrderWorkflow>): Promise<OrderWorkflow> {
  const all = await readOrderWorkflow();
  const current = all[orderId];
  const next: OrderWorkflow = {
    id: orderId,
    status: patch.status || current?.status || 'pending',
    trackingNumber: patch.trackingNumber ?? current?.trackingNumber ?? null,
    notes: patch.notes ?? current?.notes ?? null,
    updatedAt: now(),
  };
  all[orderId] = next;
  await writeShopJson('order_workflow', all);
  return next;
}

export type AddressGeoRecord = {
  label: AddressLabel;
  customLabel: string | null;
  latitude: number | null;
  longitude: number | null;
};
