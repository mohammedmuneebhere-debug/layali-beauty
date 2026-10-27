/**
 * Product description fidelity. No network and no Shopify writes.
 * Usage: npm run test:product-description
 */
import { productDescriptionFields, sanitizeProductDescriptionHtml } from '@/lib/shopify/description-html';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function textOf(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

const richText = `<p> </p>
<p><span>Bourjois Twist Up The Volume Mascara.</span></p>
<p><span>Key Benefits</span></p>
<ul>
<li><span>001 Ultra Black shade.</span></li>
<li><span>2-in-1 twistable brush.</span></li>
</ul>
<p><span>How to Use</span></p>
<ol>
<li><span>Twist the brush into Position 1.</span></li>
<li><span>Apply from the roots.</span></li>
</ol>
<p><strong>Ingredients</strong></p>
<p><em>Aqua</em> and <a href="https://example.com/inci" onclick="alert(1)">water</a>.</p>`;

const rich = sanitizeProductDescriptionHtml(richText);

assert('keeps separate paragraphs', (rich.match(/<p>/g) || []).length === 5);
assert('keeps bullet list', /<ul>/.test(rich) && (rich.match(/<li>/g) || []).length === 4);
assert('keeps numbered list after bullets', rich.indexOf('<ol>') > rich.indexOf('<ul>'));
assert('does not promote Key Benefits into a heading', !/<h[1-6][^>]*>Key Benefits/.test(rich));
assert('keeps emphasis and a safe link', /<strong>Ingredients<\/strong>/.test(rich) && /<em>Aqua<\/em>/.test(rich));
assert(
  'link href is preserved and handlers are not',
  /href="https:\/\/example\.com\/inci"/.test(rich) && !/onclick|javascript:/i.test(rich)
);
assert(
  'rich text order matches the Shopify html',
  textOf(rich) ===
    'Bourjois Twist Up The Volume Mascara.\nKey Benefits\n001 Ultra Black shade.\n2-in-1 twistable brush.\nHow to Use\nTwist the brush into Position 1.\nApply from the roots.\nIngredients\nAqua and water.'
);

const chatPaste = `<div data-octane-hydrate-id=":in-1:">
<ol class="chat" aria-label="Conversation">
<li data-message-role="assistant" id="msg">
<section aria-label="DIL content">
<p><span data-d-streaming-word="">Isntree</span> <span data-d-streaming-word="">toner</span> hydrates.</p>
<h2 data-d-component="title"><span>Key Benefits</span></h2>
<ul><li><span>Moisture.</span></li></ul>
<h2>How to Use</h2>
<ol><li><span>Apply nightly.</span></li></ol>
</section>
<div aria-label="Response actions">
<button aria-label="Copy response"><svg><use></use></svg>Copy</button>
</div>
</li>
</ol>
</div>
<script>alert(1)</script>
<img src="x" onerror="alert(1)">
<a href="javascript:alert(1)">bad</a>
<p onclick="alert(1)">Safe line</p>`;

const chat = sanitizeProductDescriptionHtml(chatPaste);

assert('chat chrome is not a wrapping numbered list', (chat.match(/<ol>/g) || []).length === 1);
assert('keeps the real headings', (chat.match(/<h2>/g) || []).length === 2);
assert('drops copy button text and scripts', !/Copy|alert|<script|onerror|onclick|javascript:/i.test(chat));
assert('unsafe link text remains without a javascript href', textOf(chat).includes('bad') && !/javascript:/i.test(chat));
assert(
  'chat paste text stays in source order',
  textOf(chat) === 'Isntree toner hydrates.\nKey Benefits\nMoisture.\nHow to Use\nApply nightly.\nbad\nSafe line'
);

const arabic = sanitizeProductDescriptionHtml('<p>مرطب للبشرة</p><ul><li>يرطب</li><li>يلطف</li></ul>');
assert('preserves Arabic text and list order', textOf(arabic) === 'مرطب للبشرة\nيرطب\nيلطف');

assert('empty description stays empty', sanitizeProductDescriptionHtml('   ') === '');
assert('empty paragraph stays empty', sanitizeProductDescriptionHtml('<p>&nbsp;</p>') === '');
assert(
  'does not double-escape entities',
  textOf(sanitizeProductDescriptionHtml('<p>skin &amp; care</p>')) === 'skin & care'
);

const first = sanitizeProductDescriptionHtml('<p>Alpha benefits</p><ul><li>One</li></ul>');
const second = sanitizeProductDescriptionHtml('<h2>Beta</h2><p>Other product</p>');
assert('descriptions are not mixed across products', !first.includes('Beta') && !second.includes('Alpha'));

const alpha = productDescriptionFields({
  description: 'Alpha plain',
  descriptionHtml: '<p>Alpha <strong>benefits</strong></p><ul><li>One</li></ul>',
});
const beta = productDescriptionFields({
  description: 'Beta plain',
  descriptionHtml: '<h2>How to Use</h2><ol><li>Apply</li></ol>',
});

assert('plain description stays with its own product', alpha.description === 'Alpha plain');
assert(
  'html comes from that same product',
  alpha.descriptionHtml === '<p>Alpha <strong>benefits</strong></p><ul><li>One</li></ul>'
);
assert(
  'a second product does not reuse the first description',
  beta.description === 'Beta plain' &&
    beta.descriptionHtml?.includes('How to Use') === true &&
    !beta.descriptionHtml?.includes('Alpha')
);
assert(
  'empty html does not invent a description',
  productDescriptionFields({ description: '', descriptionHtml: '  ' }).descriptionHtml === null &&
    productDescriptionFields({ description: '', descriptionHtml: '' }).description === null
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('product description smoke passed');
