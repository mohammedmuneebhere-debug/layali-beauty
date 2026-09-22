/**
 * Find Your Ritual — branching survey types.
 * Shopping intent selects the active question flow and recommendation focus.
 */

export type ShoppingIntent =
  | 'skincare'
  | 'haircare'
  | 'lenses'
  | 'makeup'
  | 'fragrance'
  | 'complete';

export type SkincareAnswers = {
  skinType: string;
  concerns: string[];
  goals: string[];
  routineLevel: string;
  routineTime: string;
};

export type HaircareAnswers = {
  hairType: string;
  scalp: string;
  concerns: string[];
  treatments: string;
  goals: string;
};

export type LensesAnswers = {
  lensType: string;
  look: string;
  colors: string[];
  frequency: string;
  priority: string;
};

export type MakeupAnswers = {
  categoryFocus: string;
  look: string;
  interests: string[];
  finish: string;
  priority: string;
};

export type FragranceAnswers = {
  occasion: string;
  profiles: string[];
  intensity: string;
  mood: string;
};

export type CompleteAnswers = {
  priorities: string[];
  skinType: string;
  skinConcerns: string[];
  hairType: string;
  hairConcerns: string[];
  makeupStyle: string;
  fragranceProfiles: string[];
  lensesInterest: string;
  routineTime: string;
  values: string[];
};

export type RitualSurveyAnswers = {
  shoppingIntent: ShoppingIntent | '';
  skincare: SkincareAnswers;
  haircare: HaircareAnswers;
  lenses: LensesAnswers;
  makeup: MakeupAnswers;
  fragrance: FragranceAnswers;
  complete: CompleteAnswers;
};

export type FlowQuestion = {
  id: string;
  title: string;
  subtitle?: string;
  mode: 'single' | 'multi';
  /** Field name on the active branch answers object */
  field: string;
  options: { value: string; label: string }[];
};

/** Optional API-only field (not a survey_responses column). */
export type RecommendationSurveyInput = {
  shopping_intent?: ShoppingIntent | '';
  skin_type?: string | null;
  hair_type?: string | null;
  skin_concerns?: string[];
  hair_concerns?: string[];
  allergies?: string[];
  age_range?: string | null;
  lifestyle?: string[];
  additional_notes?: string | null;
};
