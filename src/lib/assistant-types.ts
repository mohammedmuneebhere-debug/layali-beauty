import type { Locale } from '@/lib/i18n/translations';

export type AssistantProduct = {
  id: string;
  handle: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  image_url: string | null;
  available: boolean;
  defaultVariantId: string | null;
  vendor: string;
  reason: string;
};

export type AssistantComparison = {
  columns: { handle: string; name: string }[];
  rows: { label: string; values: string[] }[];
  pick: { handle: string; name: string; reason: string } | null;
};

export type AssistantReply = {
  message: string;
  products: AssistantProduct[];
  comparison?: AssistantComparison | null;
  suggestions?: string[];
};

export type AssistantHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type AssistantPageContext = {
  currentHandle?: string | null;
  compareHandles?: string[];
  cart?: { handle: string; name: string }[];
  recentlyViewedHandles?: string[];
  lastProductHandles?: string[];
};

export type AssistantRequest = {
  query: string;
  locale?: Locale;
  history?: AssistantHistoryTurn[];
  context?: AssistantPageContext;
};
