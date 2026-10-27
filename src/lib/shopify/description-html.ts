import sanitizeHtml from 'sanitize-html';

/**
 * Shopify Storefront `description` is a single line with tags removed.
 * `descriptionHtml` is the product record's formatted description.
 * This keeps that HTML's text, order, and semantic tags, and drops
 * attributes, scripts, and non-content chrome.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'a',
  'blockquote',
  'hr',
];

/** Disallowed tags whose contents are UI or executable, not description text. */
const DROPPED_WITH_CONTENTS = [
  'script',
  'style',
  'textarea',
  'option',
  'xmp',
  'noscript',
  'button',
  'svg',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'canvas',
  'video',
  'audio',
  'math',
];

function unwrapChrome(tagName: string, attribs: Record<string, string>) {
  if (tagName === 'ol' && attribs['aria-label'] === 'Conversation') {
    return { tagName: 'div', attribs: {} };
  }
  if (tagName === 'li' && attribs['data-message-role']) {
    return { tagName: 'div', attribs: {} };
  }
  return { tagName, attribs: {} };
}

export function sanitizeProductDescriptionHtml(html: string | null | undefined): string {
  if (!html?.trim()) return '';

  const cleaned = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {},
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: DROPPED_WITH_CONTENTS,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...(attribs.href ? { href: attribs.href } : {}),
          ...(attribs.title ? { title: attribs.title } : {}),
          rel: 'noopener noreferrer',
        },
      }),
      ol: unwrapChrome,
      li: unwrapChrome,
    },
  });

  return cleaned.replace(/<p>(?:\s|&nbsp;|&#160;|&#xa0;)*<\/p>/gi, '').trim();
}

/** Pair a product's own plain text with its own sanitized HTML. */
export function productDescriptionFields(product: {
  description?: string | null;
  descriptionHtml?: string | null;
}): { description: string | null; descriptionHtml: string | null } {
  const descriptionHtml = sanitizeProductDescriptionHtml(product.descriptionHtml);
  return {
    description: product.description?.trim() ? product.description : null,
    descriptionHtml: descriptionHtml || null,
  };
}
