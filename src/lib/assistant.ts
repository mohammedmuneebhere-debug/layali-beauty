import type { ShopProduct } from '@/lib/catalog';
import type { Locale } from '@/lib/i18n/translations';
import type {
  AssistantHistoryTurn,
  AssistantPageContext,
  AssistantReply,
  AssistantRequest,
} from '@/lib/assistant-types';
import {
  compareCatalogProducts,
  detectCategories,
  detectConcerns,
  detectProductTypeTerms,
  excerpt,
  getProductDetails,
  loadProductsByRefs,
  parseBudget,
  queryTokens,
  reasonForProduct,
  relevantDescription,
  searchCatalogProducts,
  toAssistantProduct,
  type CatalogConcern,
} from '@/lib/assistant-catalog';
import type { SupabaseClient } from '@supabase/supabase-js';

export type {
  AssistantComparison,
  AssistantHistoryTurn,
  AssistantPageContext,
  AssistantProduct,
  AssistantReply,
  AssistantRequest,
} from '@/lib/assistant-types';

export { detectCategories };

const FOLLOW_UP_ANSWERS =
  /^(hydration|hydrating|dry|oily|sensitive|combination|normal|the first|the second|the third|cheaper|this one|that one|yes|no|skincare|makeup|haircare|fragrance|body ?care|ترطيب|جاف|دهني|حساس|الأول|الثاني|نعم|لا)$/i;

function isShortFollowUp(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (FOLLOW_UP_ANSWERS.test(trimmed)) return true;
  return trimmed.split(/\s+/).length <= 4 && !/[?]/.test(trimmed);
}

export function resolveFollowUpQuery(query: string, history: AssistantHistoryTurn[]): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  const lastUser = [...history].reverse().find((turn) => turn.role === 'user')?.text?.trim();
  const lastAssistant = [...history].reverse().find((turn) => turn.role === 'assistant')?.text || '';
  if (!lastUser) return trimmed;
  if (isShortFollowUp(trimmed) && (lastAssistant.includes('?') || lastAssistant.includes('؟'))) {
    return `${lastUser} ${trimmed}`;
  }
  return trimmed;
}

function refersToCurrent(query: string) {
  return /\b(this|it|the product|this one|هذا|هذي|هذا المنتج)\b/i.test(query);
}

function wantsCompare(query: string) {
  return /compar|difference|vs\.?|versus|which (one|is)|better|choose|\bthese\b|الفرق|أيهما|قارن|أختار/i.test(
    query
  );
}

function ordinalIndex(query: string): number | null {
  const q = query.toLowerCase();
  if (/\b(first|1st|الأول)\b/.test(q)) return 0;
  if (/\b(second|2nd|الثاني)\b/.test(q)) return 1;
  if (/\b(third|3rd|الثالث)\b/.test(q)) return 2;
  return null;
}

function refersToListed(query: string) {
  return ordinalIndex(query) != null || /what about (it|that|this|the)\b/i.test(query);
}

function isProductQa(query: string) {
  return /tell me|about this|good for|how (do|to) use|how should i use|benefits?|ingredients?|suitable|worth buying|daily use|what makes|designed for|استخدام|فوائد|مكونات|يناسب/i.test(
    query
  );
}

function isTooVague(query: string, effective: string) {
  const q = effective.toLowerCase();
  const hasSignal =
    detectCategories(q).length > 0 ||
    detectConcerns(q).length > 0 ||
    detectProductTypeTerms(q).length > 0 ||
    parseBudget(q) != null ||
    refersToCurrent(query) ||
    wantsCompare(query) ||
    isProductQa(query);
  if (hasSignal) return false;
  return /recommend|what should i buy|help me find|for me|اقتراح|ماذا أشتري|ساعدني/.test(q);
}

function isGreeting(query: string) {
  return /^(hi|hello|hey|salam|salaam|مرحبا|هلا|السلام)\b/i.test(query.trim());
}

function isMedical(query: string) {
  return /diagnos|eczema|psoriasis|pregnan|prescription|dermatitis|مرض|تشخيص|حامل/.test(
    query.toLowerCase()
  );
}

type Copy = {
  greeting: string;
  clarify: string;
  noMatch: string;
  catalogTrouble: string;
  medical: string;
  missingDetails: string;
  aboutThis: (name: string, body: string) => string;
  noCurrent: string;
  compareNeed: string;
  topRec: string;
  why: string;
  alternative: string;
  myPick: string;
  routine: string;
  budget: (n: number) => string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    greeting:
      'Hi, I’m Laila — your beauty advisor at Layali. Tell me what you need, or pick a suggestion below.',
    clarify:
      'I can help with that. Are you shopping skincare, haircare, makeup, or fragrance — and is there a concern I should know about (dryness, oil control, damage, everyday scent)?',
    noMatch:
      'I couldn’t find matching products in the current Layali catalog. Try a product type, a concern, or a budget.',
    catalogTrouble:
      'I’m having trouble accessing the product catalog right now. Please try again in a moment.',
    medical:
      'I can’t offer medical or dermatological advice. I can, however, point you to catalog products whose descriptions mention the concern you described.',
    missingDetails:
      'The catalog doesn’t list that detail for this product. I can share what’s on the page, or help you compare it with another option.',
    aboutThis: (name, body) =>
      body
        ? `**${name}**\n\n${body}`
        : `**${name}** is in the Layali catalog, but extra usage or ingredient notes aren’t listed. Open the product page for the full description.`,
    noCurrent:
      'Which product do you mean? Open a product page, or tell me the name and I’ll look it up.',
    compareNeed:
      'Tell me which products to compare, tap Compare on two cards, or ask while viewing a product.',
    topRec: '**Top recommendation**',
    why: '**Why I picked it**',
    alternative: '**Alternative**',
    myPick: '**My pick:**',
    routine: 'Here’s a simple catalog-based starting ritual from what’s available now.',
    budget: (n) => `Here are catalog options within ${n} SAR.`,
  },
  ar: {
    greeting:
      'مرحباً، أنا ليلى — مستشارتكِ في Layali. أخبريني بما تحتاجينه، أو اختاري اقتراحاً من الأسفل.',
    clarify:
      'يمكنني مساعدتكِ. هل تبحثين عن عناية بالبشرة، الشعر، المكياج، أو العطور — وهل هناك قلق معيّن (جفاف، دهون، تلف، عطر يومي)؟',
    noMatch:
      'لم أجد منتجات مطابقة في كتالوج Layali الحالي. جرّبي نوع المنتج أو احتياجاً أو ميزانية.',
    catalogTrouble: 'أواجه صعوبة في الوصول إلى الكتالوج الآن. حاولِ بعد لحظات.',
    medical:
      'لا أقدّم نصيحة طبية أو جلدية. يمكنني أن أدلّكِ على منتجات يذكر وصفها في الكتالوج القلق الذي وصفتِه.',
    missingDetails:
      'الكتالوج لا يذكر هذا التفصيل لهذا المنتج. يمكنني مشاركة ما هو متاح، أو المقارنة مع خيار آخر.',
    aboutThis: (name, body) =>
      body
        ? `**${name}**\n\n${body}`
        : `**${name}** موجود في الكتالوج، لكن تفاصيل الاستخدام أو المكونات غير مذكورة. صفحة المنتج فيها الوصف الكامل.`,
    noCurrent: 'أي منتج تقصدين؟ افتحي صفحة المنتج، أو اكتبي اسمه وسأبحث عنه.',
    compareNeed:
      'أخبريني بالمنتجات للمقارنة، أو اضغطي مقارنة على بطاقتين، أو اسألي أثناء مشاهدة منتج.',
    topRec: '**أفضل توصية**',
    why: '**لماذا اخترته**',
    alternative: '**بديل**',
    myPick: '**اختياري:**',
    routine: 'إليكِ روتيناً بسيطاً من المنتجات المتوفرة حالياً في الكتالوج.',
    budget: (n) => `خيارات من الكتالوج ضمن ${n} ر.س.`,
  },
};

function cards(products: ShopProduct[], query: string, budget: number | null, concerns: CatalogConcern[]) {
  return products.map((product) =>
    toAssistantProduct(product, reasonForProduct(product, query, budget, concerns))
  );
}

function suggestionSet(
  locale: Locale,
  opts: { onProduct?: boolean; canCompare?: boolean }
): string[] {
  if (locale === 'ar') {
    const items = ['ساعدني في اختيار المنتج المناسب', 'ماذا توصين لي؟'];
    if (opts.onProduct) items.unshift('أخبريني المزيد عن هذا المنتج');
    if (opts.canCompare) items.unshift('أيّهما أختار؟');
    return items.slice(0, 4);
  }
  const items = ['Help me find the right product', 'What would you recommend for me?'];
  if (opts.onProduct) items.unshift('Tell me more about this product');
  if (opts.canCompare) items.unshift('Which one should I choose?');
  return items.slice(0, 4);
}

function resolveCompareRefs(query: string, context: AssistantPageContext): string[] {
  const selected = (context.compareHandles || []).filter(Boolean);
  if (selected.length >= 2) return selected.slice(0, 3);
  const last = (context.lastProductHandles || []).filter(Boolean);
  if (wantsCompare(query) && last.length >= 2) return last.slice(0, 3);
  const recent = (context.recentlyViewedHandles || []).filter(Boolean);
  if (wantsCompare(query) && recent.length >= 2) return recent.slice(0, 2);
  if (wantsCompare(query) && context.currentHandle && recent[0] && recent[0] !== context.currentHandle) {
    return [context.currentHandle, recent[0]];
  }
  return selected;
}

function resolveQaRef(query: string, context: AssistantPageContext): string | null {
  const ordinal = ordinalIndex(query);
  if (ordinal != null && context.lastProductHandles?.[ordinal]) {
    return context.lastProductHandles[ordinal];
  }
  if (context.currentHandle && (refersToCurrent(query) || isProductQa(query))) {
    return context.currentHandle;
  }
  if (refersToCurrent(query) && context.recentlyViewedHandles?.[0]) {
    return context.recentlyViewedHandles[0];
  }
  if (isProductQa(query) && context.lastProductHandles?.[0] && !detectProductTypeTerms(query).length) {
    return context.lastProductHandles[0];
  }
  return context.currentHandle || null;
}

function formatRecommendation(
  copy: Copy,
  picks: ShopProduct[],
  query: string,
  budget: number | null,
  concerns: CatalogConcern[],
  intro?: string
): AssistantReply {
  if (picks.length === 0) {
    return { message: copy.noMatch, products: [], suggestions: ['I need a moisturizer', 'Something for dry skin'] };
  }
  const top = picks[0];
  const alt = picks[1];
  const topReason = reasonForProduct(top, query, budget, concerns);
  const whyBits = [
    top.benefits[0] ? top.benefits[0] : null,
    top.category ? `${top.category}${top.vendor ? ` · ${top.vendor}` : ''}` : null,
    `${Math.round(Number(top.price))} SAR`,
    top.available ? 'In stock' : 'Currently unavailable',
  ].filter(Boolean);

  const lines = [
    intro || copy.topRec,
    '',
    `**${top.name}**`,
    topReason,
    '',
    copy.why,
    ...whyBits.map((bit) => `• ${bit}`),
  ];
  if (alt) {
    lines.push(
      '',
      copy.alternative,
      `**${alt.name}** — ${reasonForProduct(alt, query, budget, concerns)}`
    );
  }

  return {
    message: lines.join('\n'),
    products: cards(picks.slice(0, 4), query, budget, concerns),
    suggestions: ['Which one should I buy?', 'Tell me more about this product'],
  };
}

function formatComparison(
  copy: Copy,
  products: ShopProduct[],
  query: string
): AssistantReply {
  const result = compareCatalogProducts(products, query);
  if (result.products.length < 2) {
    return { message: copy.compareNeed, products: cards(result.products, query, null, detectConcerns(query)) };
  }
  const pickLine = result.pick
    ? `${copy.myPick} **${result.pick.product.name}** — ${result.pick.reason}`
    : '';
  const names = result.products.map((p) => p.name).join(' vs ');
  return {
    message: [`Here’s a catalog comparison of ${names}.`, pickLine].filter(Boolean).join('\n\n'),
    products: cards(
      result.products,
      query,
      parseBudget(query),
      detectConcerns(query)
    ).map((product) => ({
      ...product,
      reason: result.pick?.product.handle === product.handle ? result.pick.reason : product.reason,
    })),
    comparison: {
      columns: result.products.map((p) => ({ handle: p.handle, name: p.name })),
      rows: result.rows,
      pick: result.pick
        ? {
            handle: result.pick.product.handle,
            name: result.pick.product.name,
            reason: result.pick.reason,
          }
        : null,
    },
    suggestions: ['Which one is better for dry skin?', 'Which one gives better value?'],
  };
}

function qaMessage(copy: Copy, product: ShopProduct, query: string): AssistantReply {
  const q = query.toLowerCase();
  const parts: string[] = [];
  const body = relevantDescription(product, query);
  if (/how (do|to) use|استخدام|apply/i.test(q)) {
    const useLine = (product.description || '')
      .split(/[.!?]/)
      .map((s) => s.trim())
      .find((s) => /apply|use|massage|pump|am\b|pm\b|daily|استخدم|طبّق/i.test(s));
    parts.push(useLine || copy.missingDetails);
  } else if (/ingredient|مكون/i.test(q)) {
    parts.push(
      product.ingredients
        ? excerpt(product.ingredients, 280)
        : copy.missingDetails
    );
  } else if (/benefit|good for|designed|فوائد|يناسب/i.test(q)) {
    if (product.benefits.length) parts.push(product.benefits.slice(0, 4).join(' · '));
    if (body) parts.push(body);
    if (parts.length === 0) parts.push(copy.missingDetails);
  } else {
    if (body) parts.push(body);
    else if (product.benefits.length) parts.push(product.benefits.slice(0, 4).join(' · '));
    else parts.push('');
  }
  if (/daily|يومي/.test(q) && !/night|ليل/.test(q)) {
    parts.push(
      /night|pm|retinol/i.test(`${product.name} ${product.description || ''}`)
        ? 'The catalog description leans more evening/repair than a simple daily essential — check the product page before using it every morning.'
        : 'Nothing in the catalog flags this against daily use, but follow the product directions on the page.'
    );
  }
  const message = copy.aboutThis(product.name, parts.filter(Boolean).join('\n\n'));
  return {
    message,
    products: [
      toAssistantProduct(
        product,
        reasonForProduct(product, query, null, detectConcerns(query))
      ),
    ],
    suggestions: ['Is this worth buying?', 'Compare this with another option'],
  };
}

export async function answerWithCatalog(
  supabase: SupabaseClient,
  request: AssistantRequest
): Promise<AssistantReply> {
  const locale: Locale = request.locale === 'ar' ? 'ar' : 'en';
  const copy = COPY[locale];
  const history = request.history || [];
  const context = request.context || {};
  const raw = request.query.trim();
  if (!raw) {
    return { message: copy.greeting, products: [], suggestions: suggestionSet(locale, { onProduct: Boolean(context.currentHandle) }) };
  }

  const effective = resolveFollowUpQuery(raw, history);
  const historyBlob = history.map((turn) => turn.text).join(' ');
  const budget = parseBudget(`${effective} ${historyBlob}`);
  const concerns = detectConcerns(`${effective} ${historyBlob}`);
  const categories = detectCategories(effective);

  if (isGreeting(raw) && raw.split(/\s+/).length <= 4) {
    return {
      message: copy.greeting,
      products: [],
      suggestions: suggestionSet(locale, {
        onProduct: Boolean(context.currentHandle),
        canCompare: (context.compareHandles || []).length >= 2,
      }),
    };
  }

  if (isMedical(effective)) {
    const found = await searchCatalogProducts(supabase, {
      query: effective,
      maxPrice: budget ?? undefined,
      limit: 4,
    });
    if (found.length === 0) {
      return { message: `${copy.medical}\n\n${copy.noMatch}`, products: [] };
    }
    const rec = formatRecommendation(copy, found, effective, budget, concerns, copy.medical);
    return rec;
  }

  const compareRefs = resolveCompareRefs(effective, context);
  if (wantsCompare(effective) || compareRefs.length >= 2) {
    if (compareRefs.length >= 2) {
      const products = await loadProductsByRefs(supabase, compareRefs);
      if (products.length >= 2) return formatComparison(copy, products, `${effective} ${historyBlob}`);
    }
    const named = await searchCatalogProducts(supabase, { query: effective, limit: 4 });
    if (named.length >= 2 && /compar|vs|difference|الفرق|قارن/.test(effective.toLowerCase())) {
      return formatComparison(copy, named.slice(0, 3), effective);
    }
    if (compareRefs.length < 2 && named.length < 2) {
      return { message: copy.compareNeed, products: cards(named, effective, budget, concerns) };
    }
  }

  const qaRef = resolveQaRef(effective, context);
  if (isProductQa(effective) || refersToCurrent(effective) || refersToListed(effective)) {
    if (!qaRef) {
      const found = await searchCatalogProducts(supabase, { query: effective, limit: 4 });
      if (found[0]) return qaMessage(copy, found[0], effective);
      return { message: copy.noCurrent, products: [] };
    }
    const product = await getProductDetails(supabase, qaRef);
    if (!product) return { message: copy.noCurrent, products: [] };
    return qaMessage(copy, product, effective);
  }

  if (isTooVague(raw, effective) && !context.currentHandle) {
    return {
      message: copy.clarify,
      products: [],
      suggestions:
        locale === 'ar'
          ? ['أحتاج شيئاً للبشرة الجافة', 'رشّحي لي مرطباً']
          : ['I need something for dry skin', 'Recommend me a good moisturizer'],
    };
  }

  if (context.currentHandle && /worth buying|should i buy this|أشتريه/.test(effective.toLowerCase())) {
    const product = await getProductDetails(supabase, context.currentHandle);
    if (product) {
      const similar = await searchCatalogProducts(supabase, {
        query: `${product.category} ${product.name}`,
        category: product.category,
        limit: 4,
      });
      const others = similar.filter((p) => p.id !== product.id).slice(0, 2);
      const rec = formatRecommendation(
        copy,
        [product, ...others],
        effective,
        budget,
        concerns,
        `If you like the sound of **${product.name}**, it’s a solid catalog match for this page.`
      );
      return rec;
    }
  }

  const found = await searchCatalogProducts(supabase, {
    query: effective,
    category: categories.length === 1 ? categories[0] : undefined,
    maxPrice: budget ?? undefined,
    limit: /routine|ritual|regimen|روتيني/.test(effective.toLowerCase()) ? 4 : 6,
  });

  if (found.length === 0) {
    return { message: copy.noMatch, products: [], suggestions: suggestionSet(locale, {}) };
  }

  const intro = /routine|ritual|regimen|روتيني/.test(effective.toLowerCase())
    ? copy.routine
    : budget != null
      ? copy.budget(budget)
      : undefined;

  return formatRecommendation(copy, found, effective, budget, concerns, intro);
}

export async function runAssistant(
  supabase: SupabaseClient,
  request: AssistantRequest
): Promise<AssistantReply> {
  const locale: Locale = request.locale === 'ar' ? 'ar' : 'en';
  const copy = COPY[locale];
  const raw = request.query.trim();
  const history = request.history || [];
  const effective = resolveFollowUpQuery(raw, history);
  const skipLlm =
    !raw ||
    (isGreeting(raw) && raw.split(/\s+/).length <= 4) ||
    (isTooVague(raw, effective) && !request.context?.currentHandle);

  if (!skipLlm && (process.env.OPENAI_API_KEY || process.env.LAILA_AI_API_KEY)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22_000);
    try {
      const { runLailaLlm } = await import('@/lib/assistant-llm');
      const llm = await runLailaLlm(supabase, request, controller.signal);
      if (llm) {
        console.info('[laila-llm] using Gemini/OpenRouter reply');
        return llm;
      }
      console.info('[laila-llm] no structured reply, using catalog advisor');
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        console.error('Laila LLM failed, using catalog advisor', err);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    return await answerWithCatalog(supabase, request);
  } catch (err) {
    console.error('Laila catalog advisor failed', err);
    return { message: copy.catalogTrouble, products: [] };
  }
}

/** @deprecated Prefer runAssistant — kept for any leftover catalog-only callers. */
export function answerCatalogQuery(query: string, catalog: ShopProduct[]): AssistantReply {
  const budget = parseBudget(query);
  const concerns = detectConcerns(query);
  const categories = detectCategories(query);
  const tokens = queryTokens(query);
  const scored = catalog
    .filter((p) => p.handle)
    .map((product) => {
      const name = product.name.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (name.includes(token)) score += 3;
      }
      if (categories.includes(product.category)) score += 4;
      if (budget != null && Number(product.price) <= budget) score += 2;
      return { product, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((row) => row.product);

  if (scored.length === 0) {
    return { message: COPY.en.noMatch, products: [] };
  }
  return formatRecommendation(COPY.en, scored, query, budget, concerns);
}
