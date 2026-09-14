/**
 * Optional OpenAI-compatible tool calling for Ask Laila.
 * Catalog tools remain the source of product facts — the model must not invent them.
 * Final replies must go through submitAnswer (or parseable JSON) and a lightweight check.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShopProduct } from '@/lib/catalog';
import type {
  AssistantPageContext,
  AssistantProduct,
  AssistantReply,
  AssistantRequest,
} from '@/lib/assistant-types';
import {
  compactProduct,
  compareCatalogProducts,
  getProductDetails,
  loadProductsByRefs,
  parseBudget,
  reasonForProduct,
  searchCatalogProducts,
  toAssistantProduct,
} from '@/lib/assistant-catalog';
import {
  knownHandles,
  parseAnswerFromText,
  parseGroundedAnswer,
  validateGroundedMessage,
  type GroundedAnswer,
} from '@/lib/assistant-grounding';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: unknown;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  reasoning?: unknown;
  reasoning_details?: unknown;
  reasoning_content?: unknown;
  extra_content?: unknown;
};

type ToolCall = {
  id: string;
  type?: 'function';
  function?: { name?: string; arguments?: unknown };
  thought_signature?: unknown;
  extra_content?: unknown;
  index?: number;
};

type ToolChoice = 'auto' | 'required' | { type: 'function'; function: { name: string } };

const CATALOG_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description:
        'Search the live Layali Shopify catalog by natural-language query, category, concern, or price.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          category: {
            type: 'string',
            enum: ['skincare', 'makeup', 'haircare', 'fragrance', 'bodycare', 'lenses'],
          },
          concern: { type: 'string' },
          maxPrice: { type: 'number' },
          minPrice: { type: 'number' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProductDetails',
      description: 'Load catalog details for one product by handle or Shopify product id.',
      parameters: {
        type: 'object',
        properties: { ref: { type: 'string' } },
        required: ['ref'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compareProducts',
      description: 'Compare 2–3 catalog products by handle and return a structured comparison.',
      parameters: {
        type: 'object',
        properties: {
          handles: { type: 'array', items: { type: 'string' } },
          question: { type: 'string' },
        },
        required: ['handles'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCurrentProductContext',
      description:
        'Return the product the customer is viewing, compare selection, recently viewed, last recommended handles, and cart product names.',
      parameters: { type: 'object', properties: {} },
    },
  },
] as const;

const ANSWER_TOOL = {
  type: 'function',
  function: {
    name: 'submitAnswer',
    description:
      'Submit the customer-facing reply. For any product fact, call catalog tools first. productHandles must be catalog handles from tool results.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description:
            'Natural customer-facing reply. Do not mention tools or “catalog data”. Quote product wording only when it appeared in tool results. If a fact is missing, say so plainly.',
        },
        productHandles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Handles of catalog products mentioned or recommended. Empty if none.',
        },
      },
      required: ['message', 'productHandles'],
    },
  },
} as const;

function llmConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LAILA_AI_API_KEY || '';
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || process.env.LAILA_AI_MODEL || 'gpt-4o-mini';
  return { apiKey, baseUrl, model };
}

export function isLailaLlmConfigured() {
  return Boolean(llmConfig().apiKey);
}

function queryLooksProductSpecific(query: string, context: AssistantPageContext) {
  const q = query.toLowerCase();
  if (context.currentHandle && /\b(this|it|the product|this one|هذا|هذي|هذا المنتج)\b/i.test(query)) {
    return true;
  }
  if ((context.compareHandles || []).length >= 2 && /\b(these|which|compar|vs|أيهما|قارن)\b/i.test(query)) {
    return true;
  }
  if (/\b(first|second|third|1st|2nd|3rd|الأول|الثاني|الثالث)\b/i.test(query)) return true;
  if (
    /ingredient|benefit|price|stock|suitable|how (do|to) use|recommend|moisturizer|serum|toner|dry skin|hydrat|tell me|about this|which one|compare|مكوّن|مكونات|ترطيب|جاف/i.test(
      q
    )
  ) {
    return true;
  }
  return Boolean(context.currentHandle && /this|product|it\b/i.test(q));
}

function systemPrompt(locale: string, contextBlock: string) {
  return `You are Laila, the in-store beauty shopping advisor for Layali, a premium Gulf beauty store.

Personality: helpful, confident, concise, friendly, premium. No emoji spam. No “as an AI” disclaimers. Do not repeat the customer’s question. Never say “according to the catalog” or mention tools.

PRODUCT FACTS vs REASONING:
- Facts (name, price, currency, ingredients, benefits, description, usage, suitability, availability, size, category) may only come from tool results or the storefront context JSON below.
- You may reason (“I’d choose A because hydration is your priority”) only when that product’s retrieved text supports the reason.
- Do not leap to clinical claims (“will repair your barrier”, “cures acne”) unless that wording appears in retrieved text.
- If retrieved data does not establish something, do not present it as a fact. Say you don’t see it when the customer asked.
- Never invent ingredients, INCI lists, benefits, specifications, prices, stock, suitability, or medical claims — even if the customer asks confidently.
- Only mention products that appear in tool results or storefront context. Never invent a product name.

TOOLS:
- For product questions (this / these / the first / the second / ingredients / compare / recommend), call catalog tools before submitAnswer.
- Finish with submitAnswer. That is the only customer-visible reply.

When recommending, prefer: top pick + why (quoting retrieved wording) + an alternative when useful. For comparisons, make a clear pick when retrieved fields support one.

Do not give medical or dermatological diagnoses. Off-topic questions: answer briefly without forcing a product rec.

${locale === 'ar' ? 'Reply in Arabic if the customer writes in Arabic.' : 'Reply in the customer’s language.'}

Storefront context:
${contextBlock || 'No extra page context.'}`;
}

function extraContentOf(call: ToolCall): Record<string, unknown> {
  return call.extra_content && typeof call.extra_content === 'object' && !Array.isArray(call.extra_content)
    ? { ...(call.extra_content as Record<string, unknown>) }
    : {};
}

function googleThoughtSignature(call: ToolCall): unknown {
  const extra = extraContentOf(call);
  const google = extra.google && typeof extra.google === 'object' && !Array.isArray(extra.google)
    ? (extra.google as Record<string, unknown>)
    : null;
  return google?.thought_signature;
}

function encryptedSignatureForCall(details: unknown, callId: string): unknown {
  if (!Array.isArray(details) || !callId) return undefined;
  const match = details.find((row) => {
    if (!row || typeof row !== 'object') return false;
    const item = row as Record<string, unknown>;
    return item.type === 'reasoning.encrypted' && item.id === callId && item.data != null;
  }) as Record<string, unknown> | undefined;
  return match?.data;
}

/**
 * Echo the original OpenRouter assistant turn.
 * OpenRouter returns the Gemini function-call thought signature as
 * reasoning.encrypted data with the same id as the tool call, not as
 * extra_content. Google's OpenAI-compat API expects that blob on
 * tool_calls[].extra_content.google.thought_signature. Sending both
 * copies produces HTTP 400 "Corrupted thought signature".
 */
function replayAssistantMessage(raw: ChatMessage | undefined): ChatMessage | undefined {
  if (!raw) return raw;
  const replay: ChatMessage = { ...raw };
  delete (replay as ChatMessage & { refusal?: unknown }).refusal;
  if (replay.reasoning == null) delete replay.reasoning;
  if (replay.reasoning_content == null) delete replay.reasoning_content;

  if (!raw.tool_calls?.length) return replay;

  let stamped = false;
  replay.tool_calls = raw.tool_calls.map((call) => {
    if (googleThoughtSignature(call) != null) {
      stamped = true;
      return call;
    }
    const signature = encryptedSignatureForCall(raw.reasoning_details, call.id);
    if (signature == null) return call;
    stamped = true;
    const extra = extraContentOf(call);
    const google =
      extra.google && typeof extra.google === 'object' && !Array.isArray(extra.google)
        ? { ...(extra.google as Record<string, unknown>) }
        : {};
    return {
      ...call,
      extra_content: {
        ...extra,
        google: {
          ...google,
          thought_signature: signature,
        },
      },
    };
  });
  if (stamped) delete replay.reasoning_details;
  return replay;
}

async function chat(
  messages: ChatMessage[],
  signal: AbortSignal,
  tools: unknown[],
  toolChoice: ToolChoice
) {
  const { apiKey, baseUrl, model } = llmConfig();
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_tokens: 1200,
    tools,
    tool_choice: toolChoice,
    messages,
  };
  if (baseUrl.includes('openrouter.ai')) {
    body.reasoning = { effort: 'low' };
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(apiKey, baseUrl),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: ChatMessage }[];
  };
  const normalized = replayAssistantMessage(json.choices?.[0]?.message);
  console.info(
    '[laila-llm]',
    JSON.stringify({
      host: llmHost(),
      model,
      tools: (normalized?.tool_calls || []).map((call) => call.function?.name),
      hasContent: Boolean(messageText(normalized?.content)),
      hasReasoningDetails: Array.isArray(normalized?.reasoning_details),
      reasoningDetailCount: Array.isArray(normalized?.reasoning_details)
        ? normalized.reasoning_details.length
        : 0,
    })
  );
  return normalized;
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string') return {};
  try {
    const value = JSON.parse(raw || '{}') as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function llmHost() {
  try {
    return new URL(llmConfig().baseUrl).host;
  } catch {
    return 'invalid-host';
  }
}

function openRouterHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (baseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://layali.local';
    headers['X-Title'] = 'Layali Ask Laila';
  }
  return headers;
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

export async function runLailaLlm(
  supabase: SupabaseClient,
  request: AssistantRequest,
  signal?: AbortSignal
): Promise<AssistantReply | null> {
  if (!isLailaLlmConfigured()) return null;

  const locale = request.locale === 'ar' ? 'ar' : 'en';
  const context = request.context || {};
  const catalogProducts = new Map<string, ShopProduct>();
  const searchedProducts: ShopProduct[] = [];
  let lastComparison: AssistantReply['comparison'] = null;
  let usedCatalogTool = false;

  const remember = (products: ShopProduct[], fromSearch = false) => {
    for (const product of products) catalogProducts.set(product.handle, product);
    if (fromSearch) searchedProducts.splice(0, searchedProducts.length, ...products);
  };

  const prefetchRefs = [
    context.currentHandle,
    ...(context.compareHandles || []),
    ...(context.recentlyViewedHandles || []).slice(0, 4),
    ...(context.lastProductHandles || []).slice(0, 4),
  ].filter((v): v is string => Boolean(v));

  if (prefetchRefs.length) {
    remember(await loadProductsByRefs(supabase, prefetchRefs));
  }

  const current = context.currentHandle ? catalogProducts.get(context.currentHandle) : undefined;
  const contextBlock = [
    current
      ? `Currently viewing: ${JSON.stringify(compactProduct(current))}`
      : context.currentHandle
        ? `Currently viewing handle: ${context.currentHandle}`
        : 'Currently viewing: none',
    context.compareHandles?.length
      ? `Selected for comparison: ${(context.compareHandles || []).join(', ')}`
      : '',
    context.lastProductHandles?.length
      ? `Last recommended handles (first/second/third): ${context.lastProductHandles.slice(0, 4).join(', ')}`
      : '',
    context.recentlyViewedHandles?.length
      ? `Recently viewed handles: ${context.recentlyViewedHandles.slice(0, 6).join(', ')}`
      : '',
    context.cart?.length
      ? `Cart (names only): ${context.cart.map((c) => c.name).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const history = (request.history || []).slice(-8).map((turn) => ({
    role: turn.role,
    content: turn.text.slice(0, 500),
  }));

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(locale, contextBlock) },
    ...history,
    { role: 'user', content: request.query.slice(0, 500) },
  ];

  const productSpecific = queryLooksProductSpecific(request.query, context);
  const hasProductFacts = () => catalogProducts.size > 0;

  const executeCatalogTool = async (name: string, args: Record<string, unknown>) => {
    if (name === 'searchProducts') {
      usedCatalogTool = true;
      const products = await searchCatalogProducts(supabase, {
        query: typeof args.query === 'string' ? args.query : request.query,
        category: typeof args.category === 'string' ? args.category : undefined,
        concern: typeof args.concern === 'string' ? args.concern : undefined,
        maxPrice: typeof args.maxPrice === 'number' ? args.maxPrice : parseBudget(request.query) ?? undefined,
        minPrice: typeof args.minPrice === 'number' ? args.minPrice : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 6,
      });
      remember(products, true);
      return products.map(compactProduct);
    }
    if (name === 'getProductDetails') {
      usedCatalogTool = true;
      const ref = typeof args.ref === 'string' ? args.ref : '';
      const product = ref ? await getProductDetails(supabase, ref) : null;
      if (product) remember([product]);
      return product ? compactProduct(product) : { error: 'Product not found in the catalog.' };
    }
    if (name === 'compareProducts') {
      usedCatalogTool = true;
      const handles = Array.isArray(args.handles)
        ? args.handles.filter((h): h is string => typeof h === 'string')
        : [];
      const question = typeof args.question === 'string' ? args.question : request.query;
      const products = await loadProductsByRefs(
        supabase,
        handles.length >= 2 ? handles : context.compareHandles || []
      );
      remember(products, true);
      const comparison = compareCatalogProducts(products, question);
      lastComparison = {
        columns: comparison.products.map((p) => ({ handle: p.handle, name: p.name })),
        rows: comparison.rows,
        pick: comparison.pick
          ? {
              handle: comparison.pick.product.handle,
              name: comparison.pick.product.name,
              reason: comparison.pick.reason,
            }
          : null,
      };
      return {
        products: comparison.products.map(compactProduct),
        rows: comparison.rows,
        pick: lastComparison.pick,
      };
    }
    if (name === 'getCurrentProductContext') {
      usedCatalogTool = true;
      return {
        current: current ? compactProduct(current) : context.currentHandle || null,
        compareHandles: context.compareHandles || [],
        lastProductHandles: context.lastProductHandles || [],
        recentlyViewedHandles: context.recentlyViewedHandles || [],
        cart: context.cart || [],
      };
    }
    return { error: 'Unknown tool' };
  };

  const finalize = (answer: GroundedAnswer): AssistantReply | null => {
    const handles = knownHandles(answer.productHandles, catalogProducts);
    const mentioned = [...catalogProducts.values()].filter((product) =>
      handles.includes(product.handle)
    );
    const checkProducts = mentioned.length > 0 ? mentioned : [...catalogProducts.values()];
    if (productSpecific && checkProducts.length === 0) {
      if (answer.productHandles.length > 0) return null;
      if (/\b(?:SAR|ر\.?\s*س|in stock|ingredients?:)\b/i.test(answer.message)) return null;
    }
    const grounded = validateGroundedMessage(answer.message, checkProducts, request.query);
    if (!grounded.ok) {
      console.error('Laila LLM grounding rejected', grounded.reason);
      return null;
    }
    if (productSpecific && !hasProductFacts() && !usedCatalogTool) {
      return null;
    }
    const products = pickReplyProducts(
      answer.message,
      catalogProducts,
      searchedProducts,
      request.query,
      context,
      handles
    );
    return {
      message: answer.message,
      products,
      comparison: lastComparison,
      suggestions: followUps(context),
    };
  };

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) return null;
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    for (let round = 0; round < 4; round += 1) {
      const forceCatalogFirst =
        round === 0 && productSpecific && !hasProductFacts();
      const lastRound = round === 3;
      const tools = forceCatalogFirst
        ? [...CATALOG_TOOLS]
        : lastRound
          ? [ANSWER_TOOL]
          : [...CATALOG_TOOLS, ANSWER_TOOL];
      const toolChoice: ToolChoice = forceCatalogFirst
        ? 'required'
        : lastRound
          ? { type: 'function', function: { name: 'submitAnswer' } }
          : round === 0 && !productSpecific
            ? 'auto'
            : 'required';

      const message = await chat(messages, controller.signal, tools, toolChoice);
      if (!message) return null;

      if (message.tool_calls?.length) {
        messages.push(message);
        let submitted: GroundedAnswer | null = null;
        for (const call of message.tool_calls) {
          const name = call.function?.name || '';
          const args = parseArgs(call.function?.arguments);
          if (name === 'submitAnswer') {
            const parsed = parseGroundedAnswer(args);
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name,
              content: JSON.stringify(
                parsed
                  ? { status: 'received' }
                  : { error: 'Invalid answer. Provide message and productHandles.' }
              ),
            });
            if (parsed) submitted = parsed;
            continue;
          }
          const result = await executeCatalogTool(name, args);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify(result),
          });
        }
        if (submitted) {
          if (productSpecific && !hasProductFacts()) {
            messages.push({
              role: 'user',
              content:
                'Retrieve catalog information with the tools before submitAnswer. Do not invent product facts.',
            });
            continue;
          }
          return finalize(submitted);
        }
        continue;
      }

      const text = messageText(message.content).trim();
      const asJson = text ? parseAnswerFromText(text) : null;
      if (asJson) return finalize(asJson);

      if (!productSpecific && text) {
        const conversational = validateGroundedMessage(text, [...catalogProducts.values()], request.query);
        if (conversational.ok) {
          return { message: text, products: [], suggestions: followUps(context) };
        }
      }
      return null;
    }
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  return null;
}

function pickReplyProducts(
  text: string,
  catalog: Map<string, ShopProduct>,
  searched: ShopProduct[],
  query: string,
  context: AssistantPageContext,
  preferredHandles: string[]
): AssistantProduct[] {
  const fromHandles = preferredHandles
    .map((handle) => catalog.get(handle))
    .filter((p): p is ShopProduct => Boolean(p));
  const lower = text.toLowerCase();
  const matched: ShopProduct[] = [];
  for (const product of catalog.values()) {
    if (lower.includes(product.name.toLowerCase()) || lower.includes(product.handle.toLowerCase())) {
      matched.push(product);
    }
  }
  const source =
    fromHandles.length > 0
      ? fromHandles
      : matched.length > 0
        ? matched
        : searched.length > 0
          ? searched
          : [...catalog.values()].filter(
              (p) =>
                (context.compareHandles || []).includes(p.handle) || p.handle === context.currentHandle
            );
  const unique = source.filter(
    (product, index, arr) => arr.findIndex((p) => p.id === product.id) === index
  );
  const budget = parseBudget(query);
  return unique.slice(0, 4).map((product) =>
    toAssistantProduct(product, reasonForProduct(product, query, budget, []))
  );
}

function followUps(context: AssistantPageContext): string[] {
  if ((context.compareHandles || []).length >= 2) return ['Which one should I choose?'];
  if (context.currentHandle) return ['Is this worth buying?', 'How do I use this?'];
  return ['Help me find the right product', 'Compare products for me'];
}
