import type {
  CompleteAnswers,
  FragranceAnswers,
  HaircareAnswers,
  LensesAnswers,
  MakeupAnswers,
  RecommendationSurveyInput,
  RitualSurveyAnswers,
  ShoppingIntent,
  SkincareAnswers,
} from '@/lib/survey/types';

export function emptySkincare(): SkincareAnswers {
  return {
    skinType: '',
    concerns: [],
    goals: [],
    routineLevel: '',
    routineTime: '',
  };
}

export function emptyHaircare(): HaircareAnswers {
  return {
    hairType: '',
    scalp: '',
    concerns: [],
    treatments: '',
    goals: '',
  };
}

export function emptyLenses(): LensesAnswers {
  return {
    lensType: '',
    look: '',
    colors: [],
    frequency: '',
    priority: '',
  };
}

export function emptyMakeup(): MakeupAnswers {
  return {
    categoryFocus: '',
    look: '',
    interests: [],
    finish: '',
    priority: '',
  };
}

export function emptyFragrance(): FragranceAnswers {
  return {
    occasion: '',
    profiles: [],
    intensity: '',
    mood: '',
  };
}

export function emptyComplete(): CompleteAnswers {
  return {
    priorities: [],
    skinType: '',
    skinConcerns: [],
    hairType: '',
    hairConcerns: [],
    makeupStyle: '',
    fragranceProfiles: [],
    lensesInterest: '',
    routineTime: '',
    values: [],
  };
}

export function emptyRitualAnswers(intent: ShoppingIntent | '' = ''): RitualSurveyAnswers {
  return {
    shoppingIntent: intent,
    skincare: emptySkincare(),
    haircare: emptyHaircare(),
    lenses: emptyLenses(),
    makeup: emptyMakeup(),
    fragrance: emptyFragrance(),
    complete: emptyComplete(),
  };
}

/** Clear branch-only answers when the user changes shopping intent. */
export function withShoppingIntent(
  prev: RitualSurveyAnswers,
  intent: ShoppingIntent
): RitualSurveyAnswers {
  if (prev.shoppingIntent === intent) {
    return { ...prev, shoppingIntent: intent };
  }
  return emptyRitualAnswers(intent);
}

type BranchKey = Exclude<keyof RitualSurveyAnswers, 'shoppingIntent'>;

function branchKey(intent: ShoppingIntent): BranchKey {
  return intent;
}

export function getFieldValue(
  answers: RitualSurveyAnswers,
  intent: ShoppingIntent,
  field: string
): string | string[] {
  const branch = answers[branchKey(intent)] as Record<string, string | string[]>;
  return branch[field] ?? '';
}

export function setSingleField(
  answers: RitualSurveyAnswers,
  intent: ShoppingIntent,
  field: string,
  value: string
): RitualSurveyAnswers {
  const key = branchKey(intent);
  return {
    ...answers,
    [key]: {
      ...answers[key],
      [field]: value,
    },
  };
}

export function toggleMultiField(
  answers: RitualSurveyAnswers,
  intent: ShoppingIntent,
  field: string,
  value: string
): RitualSurveyAnswers {
  const key = branchKey(intent);
  const branch = answers[key] as Record<string, unknown>;
  const current = Array.isArray(branch[field]) ? (branch[field] as string[]) : [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return {
    ...answers,
    [key]: {
      ...answers[key],
      [field]: next,
    },
  };
}

function usable(value: string): boolean {
  return Boolean(value && value !== 'not sure' && value !== 'not interested' && value !== 'none');
}

function joinTokens(parts: Array<string | string[] | undefined | null>): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part)) {
      for (const item of part) {
        if (usable(item)) out.push(item);
      }
    } else if (usable(part)) {
      out.push(part);
    }
  }
  return out;
}

/**
 * Map branch answers into the recommendation + DB-compatible survey shape.
 * Only the active branch contributes category signals (except Complete Routine).
 */
export function toRecommendationSurvey(
  answers: RitualSurveyAnswers
): RecommendationSurveyInput {
  const intent = answers.shoppingIntent;
  if (!intent) {
    return { shopping_intent: '', additional_notes: null };
  }

  const baseNotes = [`Shopping for ${intent}`, `intent:${intent}`];

  if (intent === 'skincare') {
    const s = answers.skincare;
    return {
      shopping_intent: intent,
      skin_type: usable(s.skinType) ? s.skinType : null,
      hair_type: null,
      skin_concerns: s.concerns.filter(usable),
      hair_concerns: [],
      allergies: [],
      age_range: null,
      lifestyle: joinTokens([s.routineLevel, s.routineTime]),
      additional_notes: [...baseNotes, ...joinTokens([s.goals])].join(' | '),
    };
  }

  if (intent === 'haircare') {
    const h = answers.haircare;
    return {
      shopping_intent: intent,
      skin_type: null,
      hair_type: usable(h.hairType) ? h.hairType : null,
      skin_concerns: [],
      hair_concerns: h.concerns.filter(usable),
      allergies: [],
      age_range: null,
      lifestyle: joinTokens([h.scalp, h.treatments, h.goals]),
      additional_notes: [...baseNotes, ...joinTokens([h.scalp, h.treatments, h.goals])].join(
        ' | '
      ),
    };
  }

  if (intent === 'lenses') {
    const l = answers.lenses;
    const tokens = joinTokens([l.lensType, l.look, l.colors, l.frequency, l.priority]);
    return {
      shopping_intent: intent,
      skin_type: null,
      hair_type: null,
      skin_concerns: [],
      hair_concerns: [],
      allergies: [],
      age_range: null,
      lifestyle: tokens,
      additional_notes: [...baseNotes, ...tokens].join(' | '),
    };
  }

  if (intent === 'makeup') {
    const m = answers.makeup;
    const tokens = joinTokens([
      m.categoryFocus,
      m.look,
      m.interests,
      m.finish,
      m.priority,
    ]);
    return {
      shopping_intent: intent,
      skin_type: null,
      hair_type: null,
      skin_concerns: [],
      hair_concerns: [],
      allergies: [],
      age_range: null,
      lifestyle: tokens,
      additional_notes: [...baseNotes, ...tokens].join(' | '),
    };
  }

  if (intent === 'fragrance') {
    const f = answers.fragrance;
    const tokens = joinTokens([f.occasion, f.profiles, f.intensity, f.mood]);
    return {
      shopping_intent: intent,
      skin_type: null,
      hair_type: null,
      skin_concerns: [],
      hair_concerns: [],
      allergies: [],
      age_range: null,
      lifestyle: tokens,
      additional_notes: [...baseNotes, ...tokens].join(' | '),
    };
  }

  // complete
  const c = answers.complete;
  return {
    shopping_intent: intent,
    skin_type: usable(c.skinType) ? c.skinType : null,
    hair_type: usable(c.hairType) ? c.hairType : null,
    skin_concerns: c.skinConcerns.filter(usable),
    hair_concerns: c.hairConcerns.filter(usable),
    allergies: [],
    age_range: null,
    lifestyle: joinTokens([
      c.priorities,
      c.makeupStyle,
      c.fragranceProfiles,
      c.lensesInterest,
      c.routineTime,
      c.values,
    ]),
    additional_notes: [
      ...baseNotes,
      ...joinTokens([
        c.priorities,
        c.makeupStyle,
        c.fragranceProfiles,
        c.lensesInterest === 'yes' ? 'lenses' : '',
        c.routineTime,
        c.values,
      ]),
    ].join(' | '),
  };
}

/** Columns accepted by survey_responses insert. */
export function toSurveyResponseRow(survey: RecommendationSurveyInput) {
  return {
    skin_type: survey.skin_type ?? null,
    hair_type: survey.hair_type ?? null,
    skin_concerns: survey.skin_concerns ?? [],
    hair_concerns: survey.hair_concerns ?? [],
    allergies: survey.allergies ?? [],
    age_range: survey.age_range ?? null,
    lifestyle: survey.lifestyle ?? [],
    additional_notes: survey.additional_notes ?? null,
  };
}
