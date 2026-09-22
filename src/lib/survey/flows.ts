import type { FlowQuestion, ShoppingIntent } from '@/lib/survey/types';

/**
 * Category-specific Find Your Ritual flows.
 * Option values are keyword-friendly for recommendation scoring against
 * product name / description / benefits / tags.
 *
 * Lens + makeup options are grounded in the live Layali catalog taxonomy
 * (colored/cosmetic lenses; foundation, mascara, blush, etc.).
 */

export const SHOPPING_FOR_OPTIONS: { id: ShoppingIntent; label: string }[] = [
  { id: 'skincare', label: 'Skincare' },
  { id: 'haircare', label: 'Haircare' },
  { id: 'lenses', label: 'Lenses' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'complete', label: 'Complete Routine' },
];

const skincareQuestions: FlowQuestion[] = [
  {
    id: 'skin-type',
    title: "What's your skin type?",
    subtitle: 'Select the one that best describes your skin',
    mode: 'single',
    field: 'skinType',
    options: [
      { value: 'oily', label: 'Oily' },
      { value: 'dry', label: 'Dry' },
      { value: 'combination', label: 'Combination' },
      { value: 'normal', label: 'Normal' },
      { value: 'sensitive', label: 'Sensitive' },
      { value: 'not sure', label: 'Not sure' },
    ],
  },
  {
    id: 'skin-concerns',
    title: 'What are your main skin concerns?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'concerns',
    options: [
      { value: 'acne', label: 'Acne & breakouts' },
      { value: 'dark spots', label: 'Dark spots / pigmentation' },
      { value: 'uneven skin tone', label: 'Uneven skin tone' },
      { value: 'dryness', label: 'Dryness / dehydration' },
      { value: 'oiliness', label: 'Excess oil' },
      { value: 'large pores', label: 'Large-looking pores' },
      { value: 'wrinkles', label: 'Fine lines / aging concerns' },
      { value: 'dullness', label: 'Dullness' },
      { value: 'redness', label: 'Sensitivity / redness' },
      { value: 'general maintenance', label: 'None / general maintenance' },
    ],
  },
  {
    id: 'skin-goals',
    title: 'What are you looking for from your skincare routine?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'goals',
    options: [
      { value: 'hydration', label: 'Hydration' },
      { value: 'brightening', label: 'Brightening' },
      { value: 'acne control', label: 'Acne control' },
      { value: 'oil control', label: 'Oil control' },
      { value: 'barrier', label: 'Skin barrier support' },
      { value: 'anti-aging', label: 'Anti-aging' },
      { value: 'soothing', label: 'Soothing' },
      { value: 'pore care', label: 'Pore care' },
      { value: 'general maintenance', label: 'General maintenance' },
    ],
  },
  {
    id: 'skin-routine-level',
    title: 'How would you describe your current skincare routine?',
    mode: 'single',
    field: 'routineLevel',
    options: [
      { value: 'none', label: "I don't have one" },
      { value: 'very simple', label: 'Very simple' },
      { value: 'basic routine', label: 'Basic routine' },
      { value: 'multi-step', label: 'Multi-step routine' },
      { value: 'advanced', label: 'Advanced routine' },
    ],
  },
  {
    id: 'skin-routine-time',
    title: 'How much time do you want to spend on your routine?',
    mode: 'single',
    field: 'routineTime',
    options: [
      { value: 'minimal', label: 'Minimal / under 5 minutes' },
      { value: '5-10 minutes', label: '5–10 minutes' },
      { value: '10-15 minutes', label: '10–15 minutes' },
      { value: 'detailed', label: 'I enjoy a detailed routine' },
    ],
  },
];

const haircareQuestions: FlowQuestion[] = [
  {
    id: 'hair-type',
    title: "What's your hair type?",
    subtitle: 'Select the one that best describes your hair',
    mode: 'single',
    field: 'hairType',
    options: [
      { value: 'straight', label: 'Straight' },
      { value: 'wavy', label: 'Wavy' },
      { value: 'curly', label: 'Curly' },
      { value: 'coily', label: 'Coily' },
      { value: 'not sure', label: 'Not sure' },
    ],
  },
  {
    id: 'scalp',
    title: 'How would you describe your scalp?',
    mode: 'single',
    field: 'scalp',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'oily', label: 'Oily' },
      { value: 'dry', label: 'Dry' },
      { value: 'sensitive', label: 'Sensitive' },
      { value: 'dandruff', label: 'Flaky / dandruff-prone' },
      { value: 'not sure', label: 'Not sure' },
    ],
  },
  {
    id: 'hair-concerns',
    title: 'What are your main hair concerns?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'concerns',
    options: [
      { value: 'hair loss', label: 'Hair fall' },
      { value: 'dryness', label: 'Dryness' },
      { value: 'frizz', label: 'Frizz' },
      { value: 'breakage', label: 'Damage' },
      { value: 'split ends', label: 'Split ends' },
      { value: 'dandruff', label: 'Dandruff' },
      { value: 'oiliness', label: 'Oily scalp' },
      { value: 'weak hair', label: 'Weak/brittle hair' },
      { value: 'lack of volume', label: 'Lack of volume' },
      { value: 'lack of shine', label: 'Lack of shine' },
      { value: 'growth', label: 'Slow growth' },
      { value: 'general care', label: 'None / general care' },
    ],
  },
  {
    id: 'hair-treatments',
    title: 'What has your hair been through recently?',
    mode: 'single',
    field: 'treatments',
    options: [
      { value: 'no treatment', label: 'No chemical treatment' },
      { value: 'coloring', label: 'Hair coloring' },
      { value: 'bleaching', label: 'Bleaching' },
      { value: 'heat styling', label: 'Heat styling' },
      { value: 'straightening', label: 'Straightening / smoothing' },
      { value: 'perming', label: 'Perming' },
      { value: 'multiple treatments', label: 'Multiple treatments' },
    ],
  },
  {
    id: 'hair-goals',
    title: 'What result are you mainly looking for?',
    mode: 'single',
    field: 'goals',
    options: [
      { value: 'growth', label: 'Growth / stronger hair' },
      { value: 'repair', label: 'Repair' },
      { value: 'hydration', label: 'Hydration' },
      { value: 'frizz control', label: 'Frizz control' },
      { value: 'scalp health', label: 'Scalp health' },
      { value: 'volume', label: 'Volume' },
      { value: 'shine', label: 'Shine' },
      { value: 'general maintenance', label: 'General maintenance' },
    ],
  },
];

/** Lens options match Layali catalog: colored / cosmetic / Korea-style monthly contacts. */
const lensesQuestions: FlowQuestion[] = [
  {
    id: 'lens-type',
    title: 'What type of lenses are you looking for?',
    subtitle: 'Based on styles available in the Layali collection',
    mode: 'single',
    field: 'lensType',
    options: [
      { value: 'colored contact', label: 'Colored contact lenses' },
      { value: 'cosmetic lenses', label: 'Cosmetic lenses' },
      { value: 'korea style monthly', label: 'Korea-style monthly lenses' },
      { value: 'everyday wear', label: 'Everyday wear' },
      { value: 'not sure', label: 'Not sure' },
    ],
  },
  {
    id: 'lens-look',
    title: 'What kind of lens look are you after?',
    mode: 'single',
    field: 'look',
    options: [
      { value: 'natural', label: 'Very natural' },
      { value: 'subtle', label: 'Subtle enhancement' },
      { value: 'noticeable', label: 'Noticeably different' },
      { value: 'dramatic', label: 'Bold / dramatic' },
      { value: 'not sure', label: 'Not sure' },
    ],
  },
  {
    id: 'lens-colors',
    title: 'What colors are you interested in?',
    subtitle: 'Select all that apply — matches shade names in the catalog',
    mode: 'multi',
    field: 'colors',
    options: [
      { value: 'brown', label: 'Brown' },
      { value: 'gray', label: 'Grey' },
      { value: 'hazel', label: 'Hazel' },
      { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' },
      { value: 'flexible', label: 'Other / flexible' },
    ],
  },
  {
    id: 'lens-frequency',
    title: 'How often do you plan to wear them?',
    mode: 'single',
    field: 'frequency',
    options: [
      { value: 'occasionally', label: 'Occasionally' },
      { value: 'regularly', label: 'Regularly' },
      { value: 'daily', label: 'Daily' },
      { value: 'special occasions', label: 'Special occasions' },
    ],
  },
  {
    id: 'lens-priority',
    title: "What's most important to you?",
    mode: 'single',
    field: 'priority',
    options: [
      { value: 'natural appearance', label: 'Natural appearance' },
      { value: 'color', label: 'Color' },
      { value: 'comfort', label: 'Comfort' },
      { value: 'dramatic effect', label: 'Dramatic effect' },
      { value: 'everyday versatility', label: 'Everyday versatility' },
    ],
  },
];

/** Makeup interests grounded in catalog product types (mascara, foundation, blush, etc.). */
const makeupQuestions: FlowQuestion[] = [
  {
    id: 'makeup-focus',
    title: 'What kind of makeup are you looking for?',
    mode: 'single',
    field: 'categoryFocus',
    options: [
      { value: 'everyday makeup', label: 'Everyday makeup' },
      { value: 'eye makeup', label: 'Eye makeup' },
      { value: 'lip makeup', label: 'Lip makeup' },
      { value: 'face makeup', label: 'Face makeup' },
      { value: 'complexion', label: 'Base / complexion' },
      { value: 'full makeup', label: 'Full makeup routine' },
    ],
  },
  {
    id: 'makeup-look',
    title: 'What kind of makeup look do you love?',
    mode: 'single',
    field: 'look',
    options: [
      { value: 'natural', label: 'Natural' },
      { value: 'soft glam', label: 'Soft glam' },
      { value: 'full glam', label: 'Full glam' },
      { value: 'matte', label: 'Matte' },
      { value: 'dewy', label: 'Dewy' },
      { value: 'bold', label: 'Bold' },
      { value: 'minimal', label: 'Minimal' },
    ],
  },
  {
    id: 'makeup-interests',
    title: 'What are you most interested in right now?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'interests',
    options: [
      { value: 'foundation', label: 'Foundation / complexion' },
      { value: 'concealer', label: 'Concealer' },
      { value: 'blush', label: 'Blush' },
      { value: 'highlighter', label: 'Highlighter' },
      { value: 'eyeshadow', label: 'Eyeshadow' },
      { value: 'eyeliner', label: 'Eyeliner' },
      { value: 'mascara', label: 'Mascara' },
      { value: 'brow', label: 'Brow' },
      { value: 'lipstick', label: 'Lipstick' },
      { value: 'lip gloss', label: 'Lip gloss' },
      { value: 'primer', label: 'Primer' },
      { value: 'setting', label: 'Setting / powder' },
    ],
  },
  {
    id: 'makeup-finish',
    title: 'What finish do you prefer?',
    mode: 'single',
    field: 'finish',
    options: [
      { value: 'matte', label: 'Matte' },
      { value: 'natural', label: 'Natural' },
      { value: 'satin', label: 'Satin' },
      { value: 'dewy', label: 'Dewy' },
      { value: 'glossy', label: 'Glossy' },
    ],
  },
  {
    id: 'makeup-priority',
    title: "What's your priority?",
    mode: 'single',
    field: 'priority',
    options: [
      { value: 'long-lasting', label: 'Long-lasting' },
      { value: 'natural appearance', label: 'Natural appearance' },
      { value: 'high coverage', label: 'High coverage' },
      { value: 'lightweight', label: 'Lightweight' },
      { value: 'everyday', label: 'Easy everyday use' },
      { value: 'statement', label: 'Statement look' },
    ],
  },
];

const fragranceQuestions: FlowQuestion[] = [
  {
    id: 'fragrance-occasion',
    title: 'What kind of fragrance are you looking for?',
    mode: 'single',
    field: 'occasion',
    options: [
      { value: 'everyday', label: 'Everyday' },
      { value: 'date night', label: 'Date night' },
      { value: 'work', label: 'Work / office' },
      { value: 'special occasions', label: 'Special occasions' },
      { value: 'evening', label: 'Evening' },
      { value: 'gift', label: 'Gift' },
    ],
  },
  {
    id: 'fragrance-profiles',
    title: 'What kind of scent are you drawn to?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'profiles',
    options: [
      { value: 'floral', label: 'Floral' },
      { value: 'fresh', label: 'Fresh' },
      { value: 'woody', label: 'Woody' },
      { value: 'sweet', label: 'Sweet' },
      { value: 'fruity', label: 'Fruity' },
      { value: 'musky', label: 'Musky' },
      { value: 'oriental', label: 'Oriental / warm' },
      { value: 'citrus', label: 'Citrus' },
      { value: 'oud', label: 'Oud' },
    ],
  },
  {
    id: 'fragrance-intensity',
    title: 'How strong do you like your fragrance?',
    mode: 'single',
    field: 'intensity',
    options: [
      { value: 'light', label: 'Light / subtle' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'strong', label: 'Strong' },
      { value: 'long-lasting', label: 'Long-lasting / noticeable' },
    ],
  },
  {
    id: 'fragrance-mood',
    title: 'What mood do you want?',
    mode: 'single',
    field: 'mood',
    options: [
      { value: 'fresh', label: 'Fresh' },
      { value: 'elegant', label: 'Elegant' },
      { value: 'romantic', label: 'Romantic' },
      { value: 'warm', label: 'Warm' },
      { value: 'mysterious', label: 'Mysterious' },
      { value: 'playful', label: 'Playful' },
      { value: 'bold', label: 'Bold' },
    ],
  },
];

const completeQuestions: FlowQuestion[] = [
  {
    id: 'complete-priorities',
    title: 'Tell us about your beauty routine.',
    subtitle: 'What are your main beauty priorities? Select all that apply',
    mode: 'multi',
    field: 'priorities',
    options: [
      { value: 'skincare', label: 'Skincare' },
      { value: 'haircare', label: 'Haircare' },
      { value: 'makeup', label: 'Makeup' },
      { value: 'fragrance', label: 'Fragrance' },
      { value: 'lenses', label: 'Lenses' },
    ],
  },
  {
    id: 'complete-skin',
    title: 'Tell us about your skin.',
    subtitle: 'Skin type',
    mode: 'single',
    field: 'skinType',
    options: [
      { value: 'oily', label: 'Oily' },
      { value: 'dry', label: 'Dry' },
      { value: 'combination', label: 'Combination' },
      { value: 'normal', label: 'Normal' },
      { value: 'sensitive', label: 'Sensitive' },
      { value: 'not sure', label: 'Not sure' },
    ],
  },
  {
    id: 'complete-skin-concerns',
    title: 'Any skin concerns?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'skinConcerns',
    options: [
      { value: 'acne', label: 'Acne & breakouts' },
      { value: 'dryness', label: 'Dryness' },
      { value: 'oiliness', label: 'Oiliness' },
      { value: 'dullness', label: 'Dullness' },
      { value: 'dark spots', label: 'Dark spots' },
      { value: 'general maintenance', label: 'None / general' },
    ],
  },
  {
    id: 'complete-hair',
    title: 'Tell us about your hair.',
    subtitle: 'Hair type',
    mode: 'single',
    field: 'hairType',
    options: [
      { value: 'straight', label: 'Straight' },
      { value: 'wavy', label: 'Wavy' },
      { value: 'curly', label: 'Curly' },
      { value: 'coily', label: 'Coily' },
      { value: 'not sure', label: 'Not sure' },
    ],
  },
  {
    id: 'complete-hair-concerns',
    title: 'Any hair concerns?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'hairConcerns',
    options: [
      { value: 'frizz', label: 'Frizz' },
      { value: 'dryness', label: 'Dryness' },
      { value: 'hair loss', label: 'Hair fall' },
      { value: 'dandruff', label: 'Dandruff' },
      { value: 'breakage', label: 'Damage' },
      { value: 'general care', label: 'None / general' },
    ],
  },
  {
    id: 'complete-makeup',
    title: 'What makeup style do you prefer?',
    mode: 'single',
    field: 'makeupStyle',
    options: [
      { value: 'natural', label: 'Natural' },
      { value: 'soft glam', label: 'Soft glam' },
      { value: 'full glam', label: 'Full glam' },
      { value: 'minimal', label: 'Minimal' },
      { value: 'not interested', label: 'Not interested in makeup' },
    ],
  },
  {
    id: 'complete-fragrance',
    title: 'What fragrance profiles do you like?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'fragranceProfiles',
    options: [
      { value: 'floral', label: 'Floral' },
      { value: 'fresh', label: 'Fresh' },
      { value: 'woody', label: 'Woody' },
      { value: 'sweet', label: 'Sweet' },
      { value: 'oud', label: 'Oud' },
      { value: 'not interested', label: 'Not interested' },
    ],
  },
  {
    id: 'complete-lenses',
    title: 'Are you interested in lenses?',
    mode: 'single',
    field: 'lensesInterest',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'maybe', label: 'Maybe' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'complete-time',
    title: 'How much time do you want to spend on your overall routine?',
    mode: 'single',
    field: 'routineTime',
    options: [
      { value: 'minimal', label: 'Minimal / under 5 minutes' },
      { value: '5-10 minutes', label: '5–10 minutes' },
      { value: '10-15 minutes', label: '10–15 minutes' },
      { value: 'detailed', label: 'I enjoy a detailed routine' },
    ],
  },
  {
    id: 'complete-values',
    title: 'What matters most?',
    subtitle: 'Select all that apply',
    mode: 'multi',
    field: 'values',
    options: [
      { value: 'simplicity', label: 'Simplicity' },
      { value: 'results', label: 'Results' },
      { value: 'premium', label: 'Premium products' },
      { value: 'value', label: 'Value' },
      { value: 'complete routine', label: 'Complete routine' },
      { value: 'discovering', label: 'Discovering new products' },
    ],
  },
];

export const SURVEY_FLOWS: Record<ShoppingIntent, FlowQuestion[]> = {
  skincare: skincareQuestions,
  haircare: haircareQuestions,
  lenses: lensesQuestions,
  makeup: makeupQuestions,
  fragrance: fragranceQuestions,
  complete: completeQuestions,
};

export function flowForIntent(intent: ShoppingIntent | ''): FlowQuestion[] {
  if (!intent) return [];
  return SURVEY_FLOWS[intent] || [];
}

/** Question steps = intent picker + branch questions (results excluded). */
export function questionStepCount(intent: ShoppingIntent | ''): number {
  return 1 + flowForIntent(intent).length;
}
