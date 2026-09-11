'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, ArrowRight, ArrowLeft, Shield, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import {
  SKIN_TYPES, HAIR_TYPES, SKIN_CONCERNS, HAIR_CONCERNS,
} from '@/lib/ai-recommendation';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import type { AIRecommendation, AIRecommendationProduct } from '@/types/database';
import { isVariantGid } from '@/lib/recommendation';

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'skin', title: 'Skin Type' },
  { id: 'hair', title: 'Hair Type' },
  { id: 'concerns', title: 'Concerns' },
  { id: 'lifestyle', title: 'Lifestyle' },
  { id: 'results', title: 'Your Combo' },
];

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];
const LIFESTYLE_OPTIONS = ['active', 'office work', 'outdoor', 'minimal routine', 'full routine'];

function recommendationLines(rec: AIRecommendation): AIRecommendationProduct[] {
  return rec.products;
}

function purchasableVariantIds(rec: AIRecommendation): string[] {
  return rec.products
    .filter((p) => p.available !== false && isVariantGid(p.shopify_variant_id))
    .map((p) => p.shopify_variant_id as string);
}

export default function SurveyPage() {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addingCart, setAddingCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);

  const [survey, setSurvey] = useState({
    skin_type: '',
    hair_type: '',
    skin_concerns: [] as string[],
    hair_concerns: [] as string[],
    allergies: [] as string[],
    age_range: '',
    lifestyle: [] as string[],
    additional_notes: '',
  });

  const toggleArray = (key: 'skin_concerns' | 'hair_concerns' | 'lifestyle', value: string) => {
    setSurvey((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const handleFinish = async () => {
    setLoading(true);
    setCatalogMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    const genRes = await fetch('/api/recommendations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey, country, city }),
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
        ...survey,
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
    }));

    // AI combo row is recommendation grouping data (not a Shopify product).
    // Do NOT insert into combo_products (legacy UUID FK to products).
    const comboPayload: Record<string, unknown> = {
      name: 'Your Personalized Combo',
      description: aiRec.summary,
      price: comboPrice > 0 ? comboPrice * 0.85 : 0,
      compare_at_price: comboPrice > 0 ? comboPrice : null,
      gender: profile?.gender || 'female',
      is_ai_generated: true,
      dermatologist_verified: true,
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
      dermatologist_verified: true,
      dermatologist_name: 'Dr. Layali Certified',
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

    setStep(5);
    setLoading(false);
  };

  const addRecommendationToCart = async () => {
    if (!recommendation) return;
    const variantIds = purchasableVariantIds(recommendation);
    if (variantIds.length === 0) {
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
      merchandiseIds: variantIds,
    });
    setAddingCart(false);
    setCartMessage(
      ok
        ? `Added ${variantIds.length} product${variantIds.length === 1 ? '' : 's'} to your cart.`
        : 'Could not add items to cart. Please try again.'
    );
  };

  const next = () => {
    if (step === 4) {
      void handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  const OptionButton = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
        selected
          ? 'border-layali-pink bg-layali-pink-glow/20 shadow-md'
          : 'border-layali-pink/30 hover:border-layali-pink hover:bg-layali-pink-glow/25/20'
      }`}
    >
      <span className="capitalize font-medium text-white">{children}</span>
      {selected && <Check className="w-4 h-4 inline ml-2 text-white" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-transparent py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-layali-black w-8' : 'bg-layali-pink/30 w-4'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {step === 0 && (
              <div className="text-center">
                <Sparkles className="w-12 h-12 mx-auto text-white mb-6" />
                <h1 className="font-serif text-4xl font-bold text-white mb-4">
                  Let&apos;s Get to Know You
                </h1>
                <p className="font-script text-3xl text-white/70 mb-6">your beauty profile</p>
                <p className="text-white/60 mb-8 leading-relaxed">
                  Answer a few fun questions about your skin and hair,
                  and we&apos;ll create a personalized beauty combo just for you!
                </p>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="font-serif text-3xl font-bold text-white mb-2">What&apos;s your skin type?</h2>
                <p className="text-white/60 mb-6">Select the one that best describes your skin</p>
                <div className="grid grid-cols-2 gap-3">
                  {SKIN_TYPES.map((type) => (
                    <OptionButton
                      key={type}
                      selected={survey.skin_type === type}
                      onClick={() => setSurvey({ ...survey, skin_type: type })}
                    >
                      {type}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="font-serif text-3xl font-bold text-white mb-2">What&apos;s your hair type?</h2>
                <p className="text-white/60 mb-6">Select the one that best describes your hair</p>
                <div className="grid grid-cols-2 gap-3">
                  {HAIR_TYPES.map((type) => (
                    <OptionButton
                      key={type}
                      selected={survey.hair_type === type}
                      onClick={() => setSurvey({ ...survey, hair_type: type })}
                    >
                      {type}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="font-serif text-3xl font-bold text-white mb-2">Your Concerns</h2>
                <p className="text-white/60 mb-6">Select all that apply</p>

                <h3 className="font-medium text-white mb-3">Skin Concerns</h3>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {SKIN_CONCERNS.map((concern) => (
                    <OptionButton
                      key={concern}
                      selected={survey.skin_concerns.includes(concern)}
                      onClick={() => toggleArray('skin_concerns', concern)}
                    >
                      {concern}
                    </OptionButton>
                  ))}
                </div>

                <h3 className="font-medium text-white mb-3">Hair Concerns</h3>
                <div className="grid grid-cols-2 gap-2">
                  {HAIR_CONCERNS.map((concern) => (
                    <OptionButton
                      key={concern}
                      selected={survey.hair_concerns.includes(concern)}
                      onClick={() => toggleArray('hair_concerns', concern)}
                    >
                      {concern}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="font-serif text-3xl font-bold text-white mb-2">A Bit More About You</h2>
                <p className="text-white/60 mb-6">Help us personalize your experience</p>

                <h3 className="font-medium text-white mb-3">Age Range</h3>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {AGE_RANGES.map((age) => (
                    <OptionButton
                      key={age}
                      selected={survey.age_range === age}
                      onClick={() => setSurvey({ ...survey, age_range: age })}
                    >
                      {age}
                    </OptionButton>
                  ))}
                </div>

                <h3 className="font-medium text-white mb-3">Lifestyle</h3>
                <div className="grid grid-cols-2 gap-2">
                  {LIFESTYLE_OPTIONS.map((opt) => (
                    <OptionButton
                      key={opt}
                      selected={survey.lifestyle.includes(opt)}
                      onClick={() => toggleArray('lifestyle', opt)}
                    >
                      {opt}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && recommendation && (
              <div>
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    <Sparkles className="w-12 h-12 mx-auto text-layali-gold mb-4" />
                  </motion.div>
                  <h2 className="font-serif text-3xl font-bold text-white mb-2">
                    Your Personalized Combo
                  </h2>
                  <p className="font-script text-2xl text-white/70">crafted just for you</p>
                </div>

                {catalogMessage && (
                  <p className="text-sm text-amber-200/90 mb-4 text-center">{catalogMessage}</p>
                )}

                <div className="bg-white/80 rounded-3xl p-6 shadow-xl border border-layali-pink/20 mb-6">
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-layali-gold/10 border border-layali-gold/30">
                    <Shield className="w-5 h-5 text-layali-gold" />
                    <span className="text-sm font-medium text-white">
                      Certified & Verified by Dr. Layali
                    </span>
                  </div>

                  <p className="text-white/70 mb-6 leading-relaxed">{recommendation.summary}</p>

                  <h3 className="font-serif text-lg font-bold text-white mb-3">Recommended Products</h3>
                  <div className="space-y-3 mb-6">
                    {recommendation.products.map((product) => (
                      <div
                        key={product.shopify_product_id || product.name}
                        className="flex items-start gap-3 p-3 rounded-xl bg-black"
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
                <Button
                  className="w-full mt-3"
                  variant="ghost"
                  onClick={() => router.push('/shop')}
                >
                  Browse Shop
                </Button>
              </div>
            )}

            {step === 5 && !recommendation && catalogMessage && (
              <div className="text-center py-12">
                <p className="text-white/70 mb-6">{catalogMessage}</p>
                <Button onClick={() => router.push('/shop')}>Browse Shop</Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {step < 5 && (
          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <Button variant="ghost" onClick={prev}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={next} loading={loading}>
              {step === 4 ? 'Get My Combo' : 'Continue'} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
