'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Check, ArrowRight, ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import type { AIRecommendation, AIRecommendationProduct } from '@/types/database';
import { isVariantGid } from '@/lib/recommendation';
import { track } from '@/lib/track';
import {
  emptyRitualAnswers,
  getFieldValue,
  setSingleField,
  toggleMultiField,
  toRecommendationSurvey,
  toSurveyResponseRow,
  withShoppingIntent,
} from '@/lib/survey/answers';
import { flowForIntent, questionStepCount, SHOPPING_FOR_OPTIONS } from '@/lib/survey/flows';
import type { RitualSurveyAnswers, ShoppingIntent } from '@/lib/survey/types';

function recommendationLines(rec: AIRecommendation): AIRecommendationProduct[] {
  return rec.products;
}

function purchasableVariantIds(rec: AIRecommendation): string[] {
  return rec.products
    .filter((p) => p.available !== false && isVariantGid(p.shopify_variant_id))
    .map((p) => p.shopify_variant_id as string);
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
        selected
          ? 'border-layali-pink bg-layali-pink-glow/20 shadow-md'
          : 'border-layali-pink/30 hover:border-layali-pink hover:bg-layali-pink-glow/25/20'
      }`}
    >
      <span className="font-medium text-white">{children}</span>
      {selected && <Check className="w-4 h-4 inline ml-2 text-white" />}
    </button>
  );
}

export default function SurveyPage() {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  /** 0 = shopping intent; 1..n = branch questions; results is a separate phase */
  const [step, setStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingCart, setAddingCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<RitualSurveyAnswers>(() => emptyRitualAnswers());

  const intent = answers.shoppingIntent;
  const branchQuestions = useMemo(() => flowForIntent(intent), [intent]);
  const totalQuestionSteps = questionStepCount(intent);
  const progressSlots = Math.max(totalQuestionSteps, 1);
  const currentQuestion = step > 0 ? branchQuestions[step - 1] : null;

  useEffect(() => {
    track({ event: 'survey_start' });
  }, []);

  const selectIntent = (next: ShoppingIntent) => {
    setAnswers((prev) => withShoppingIntent(prev, next));
    setStep(0);
    // Changing intent invalidates any in-progress branch answers / results
    setRecommendation(null);
    setCatalogMessage(null);
    setShowResults(false);
  };

  const handleFinish = async () => {
    setLoading(true);
    setCatalogMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth/signin');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('gender, country, city')
      .eq('id', user.id)
      .single();

    const country = profile?.country || undefined;
    const city = profile?.city || undefined;
    const surveyPayload = toRecommendationSurvey(answers);

    const genRes = await fetch('/api/recommendations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        survey: surveyPayload,
        country,
        city,
      }),
    });

    const genJson = (await genRes.json()) as {
      recommendation?: AIRecommendation | null;
      configured?: boolean;
      empty?: boolean;
      message?: string;
      error?: string;
    };

    if (!genRes.ok || !genJson.recommendation) {
      setCatalogMessage(genJson.error || 'Unable to generate your combo right now. Please try again.');
      setLoading(false);
      return;
    }

    if (genJson.configured === false) {
      setCatalogMessage('Product catalog is not configured yet. Please try again later.');
      setLoading(false);
      return;
    }

    const aiRec = genJson.recommendation;
    setRecommendation(aiRec);
    if (genJson.empty || aiRec.products.length === 0) {
      setCatalogMessage(
        genJson.message || 'No matching products were found for your profile yet.'
      );
    }

    const { data: surveyRow } = await supabase
      .from('survey_responses')
      .insert({
        user_id: user.id,
        ...toSurveyResponseRow(surveyPayload),
      })
      .select('id')
      .single();

    const lines = recommendationLines(aiRec);
    const comboPrice = lines.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const shopifyItems = lines.map((p) => ({
      shopify_product_id: p.shopify_product_id,
      shopify_variant_id: p.shopify_variant_id,
      name: p.name,
      price: p.price || 0,
      handle: p.handle || '',
      image_url: p.image_url || null,
      reason: p.reason,
      available: p.available !== false,
      quantity: 1,
    }));

    const comboPayload: Record<string, unknown> = {
      name: 'Your Personalized Combo',
      description: aiRec.summary,
      price: comboPrice > 0 ? comboPrice * 0.85 : 0,
      compare_at_price: comboPrice > 0 ? comboPrice : null,
      gender: profile?.gender || 'female',
      is_ai_generated: true,
      dermatologist_verified: false,
      shopify_items: shopifyItems,
      image_url: lines[0]?.image_url || null,
    };

    let { data: combo, error: comboError } = await supabase
      .from('combos')
      .insert(comboPayload)
      .select()
      .single();

    if (comboError && String(comboError.message).toLowerCase().includes('shopify_items')) {
      delete comboPayload.shopify_items;
      const retry = await supabase.from('combos').insert(comboPayload).select().single();
      combo = retry.data;
      comboError = retry.error;
    }

    if (comboError) {
      console.error('Failed to save AI combo row', comboError.message);
    }

    const personalizedPayload: Record<string, unknown> = {
      user_id: user.id,
      survey_id: surveyRow?.id || null,
      combo_id: combo?.id || null,
      ai_recommendation: aiRec,
      recommendation_items: shopifyItems,
      dermatologist_verified: false,
      dermatologist_name: '',
    };

    let { error: pcError } = await supabase
      .from('personalized_combos')
      .insert(personalizedPayload);

    if (pcError && String(pcError.message).toLowerCase().includes('recommendation_items')) {
      delete personalizedPayload.recommendation_items;
      const retry = await supabase.from('personalized_combos').insert(personalizedPayload);
      pcError = retry.error;
    }

    if (pcError) {
      console.error('Failed to save personalized combo', pcError.message);
    }

    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    setShowResults(true);
    setLoading(false);
    track({ event: 'survey_complete' });
  };

  const addRecommendationToCart = async () => {
    if (!recommendation) return;
    const lines = recommendation.products
      .filter((p) => p.available !== false && isVariantGid(p.shopify_variant_id))
      .map((p) => ({
        merchandiseId: p.shopify_variant_id as string,
        quantity: Math.max(1, Number(p.quantity) || 1),
      }));
    if (lines.length === 0) {
      setCartMessage('None of the recommended products are available to purchase right now.');
      return;
    }

    setAddingCart(true);
    setCartMessage(null);
    const ok = await addItem({
      id: 'ai-recommendation',
      type: 'combo',
      name: 'Your Personalized Combo',
      price: recommendation.products.reduce((s, p) => s + Number(p.price || 0), 0),
      image_url: recommendation.products[0]?.image_url || null,
      lines,
    });
    setAddingCart(false);
    const unitCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    setCartMessage(
      ok
        ? `Added ${unitCount} product${unitCount === 1 ? '' : 's'} to your cart.`
        : 'Could not add items to cart. Please try again.'
    );
  };

  const isLastQuestion = intent !== '' && step === branchQuestions.length;
  const canContinue =
    step === 0 ? Boolean(intent) : Boolean(intent && currentQuestion);

  const next = () => {
    if (step === 0 && !intent) return;
    if (isLastQuestion) {
      void handleFinish();
      return;
    }
    setStep((s) => s + 1);
  };

  const prev = () => {
    if (showResults) {
      setShowResults(false);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const motionKey = showResults
    ? 'results'
    : step === 0
      ? 'intent'
      : `${intent}-q-${currentQuestion?.id || step}`;

  let stepContent: ReactNode = null;
  if (showResults && recommendation) {
    stepContent = (
              <div>
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    <Sparkles className="w-12 h-12 mx-auto text-layali-gold mb-4" />
                  </motion.div>
                  <h2 className="font-serif text-heading-md text-white mb-2">Your Layali Ritual</h2>
                  <p className="font-script text-heading-sm text-white/70">
                    crafted from the catalog
                  </p>
                </div>

                {catalogMessage && (
                  <p className="text-sm text-amber-200/90 mb-4 text-center">{catalogMessage}</p>
                )}

                <div className="glass-panel rounded-3xl p-6 mb-6">
                  <p className="text-xs leading-relaxed text-white/45 mb-5">
                    These suggestions are based on your answers and available Layali products. They
                    are not medical or dermatological advice.
                  </p>

                  <p className="text-white/70 mb-6 leading-relaxed">{recommendation.summary}</p>

                  <h3 className="text-ui-heading text-white mb-3">Recommended Products</h3>
                  <div className="space-y-3 mb-6">
                    {recommendation.products.map((product) => (
                      <div
                        key={product.shopify_product_id || product.name}
                        className="flex items-start gap-3 p-3 rounded-xl bg-black/40"
                      >
                        <div className="w-8 h-8 rounded-full bg-layali-pink-glow/25 flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">{product.name}</p>
                          <p className="text-sm text-white/60">{product.reason}</p>
                          {product.price != null && (
                            <p className="text-sm text-layali-pink mt-1">
                              {formatPrice(Number(product.price))}
                            </p>
                          )}
                          {product.available === false && (
                            <p className="text-xs text-amber-300/80 mt-1">Currently unavailable</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-white mb-2">Morning Routine</h4>
                      <ul className="text-sm text-white/60 space-y-1">
                        {recommendation.routine.morning.map((line, i) => (
                          <li key={i}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-white mb-2">Evening Routine</h4>
                      <ul className="text-sm text-white/60 space-y-1">
                        {recommendation.routine.evening.map((line, i) => (
                          <li key={i}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {cartMessage && (
                  <p className="text-sm text-center text-white/70 mb-3">{cartMessage}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1"
                    size="lg"
                    loading={addingCart}
                    onClick={() => void addRecommendationToCart()}
                    disabled={purchasableVariantIds(recommendation).length === 0}
                  >
                    <ShoppingBag className="w-5 h-5" /> Add Combo to Cart
                  </Button>
                  <Button
                    className="flex-1"
                    size="lg"
                    variant="outline"
                    onClick={() => router.push('/cart')}
                  >
                    View Cart <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
                <Button className="w-full mt-3" variant="ghost" onClick={() => router.push('/shop')}>
                  Browse Shop
                </Button>
              </div>
    );
  } else if (showResults && !recommendation && catalogMessage) {
    stepContent = (
              <div className="text-center py-12">
                <p className="text-white/70 mb-6">{catalogMessage}</p>
                <Button onClick={() => router.push('/shop')}>Browse Shop</Button>
              </div>
    );
  } else if (step === 0) {
    stepContent = (
              <div className="text-center">
                <Sparkles className="w-12 h-12 mx-auto text-layali-gold-light mb-6" />
                <h1 className="font-serif text-heading-lg text-white mb-4">Your Layali Ritual</h1>
                <p className="font-script text-heading-md text-white/70 mb-6">
                  beauty, curated for you
                </p>
                <p className="text-white/60 mb-8 leading-relaxed">
                  A few questions help us match products from the live catalog to your routine.
                  This is not a medical or dermatological diagnosis.
                </p>
                <h2 className="font-serif text-heading-sm text-white mb-4">
                  What are you shopping for?
                </h2>
                <div className="grid grid-cols-2 gap-3 text-start">
                  {SHOPPING_FOR_OPTIONS.map((option) => (
                    <OptionButton
                      key={option.id}
                      selected={intent === option.id}
                      onClick={() => selectIntent(option.id)}
                    >
                      {option.label}
                    </OptionButton>
                  ))}
                </div>
              </div>
    );
  } else if (currentQuestion && intent) {
    stepContent = (
              <div>
                <h2 className="font-serif text-heading-md text-white mb-2">
                  {currentQuestion.title}
                </h2>
                {currentQuestion.subtitle ? (
                  <p className="text-white/60 mb-6">{currentQuestion.subtitle}</p>
                ) : (
                  <div className="mb-6" />
                )}
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options.map((option) => {
                    const value = getFieldValue(answers, intent, currentQuestion.field);
                    const selected =
                      currentQuestion.mode === 'multi'
                        ? Array.isArray(value) && value.includes(option.value)
                        : value === option.value;
                    return (
                      <OptionButton
                        key={option.value}
                        selected={selected}
                        onClick={() => {
                          if (currentQuestion.mode === 'multi') {
                            setAnswers((prev) =>
                              toggleMultiField(prev, intent, currentQuestion.field, option.value)
                            );
                          } else {
                            setAnswers((prev) =>
                              setSingleField(prev, intent, currentQuestion.field, option.value)
                            );
                          }
                        }}
                      >
                        {option.label}
                      </OptionButton>
                    );
                  })}
                </div>
              </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {!showResults && (
          <div className="mb-8">
            <div className="flex justify-center gap-2 mb-3">
              {Array.from({ length: progressSlots }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i <= step ? 'bg-layali-pink w-8' : 'bg-white/15 w-4'
                  }`}
                />
              ))}
            </div>
            {intent && step > 0 && (
              <p className="text-center text-xs text-white/45">
                Question {step + 1} of {totalQuestionSteps}
              </p>
            )}
          </div>
        )}

        <motion.div
          key={motionKey}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          data-survey-step={showResults ? 'results' : step}
          data-survey-intent={intent || 'none'}
        >
          {stepContent}
        </motion.div>

        {!showResults && (
          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <Button variant="ghost" onClick={prev}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={next} loading={loading} disabled={!canContinue}>
              {isLastQuestion ? 'Get My Combo' : 'Continue'} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
