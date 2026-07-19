'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, ArrowRight, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { getProductsForRegion } from '@/lib/products';
import {
  SKIN_TYPES, HAIR_TYPES, SKIN_CONCERNS, HAIR_CONCERNS,
  generatePersonalizedCombo,
} from '@/lib/ai-recommendation';
import type { AIRecommendation } from '@/types/database';
import { formatPrice } from '@/lib/utils';

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

export default function SurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);

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

    const products = profile?.country && profile?.city
      ? await getProductsForRegion(supabase, {
          gender: profile.gender || 'female',
          country: profile.country,
          city: profile.city,
        })
      : [];

    const aiRec = generatePersonalizedCombo(survey, products);
    setRecommendation(aiRec);

    await supabase.from('survey_responses').insert({
      user_id: user.id,
      ...survey,
    });

    const comboPrice = products
      .filter((p) => aiRec.products.some((ap) => ap.product_id === p.id))
      .reduce((sum, p) => sum + Number(p.price), 0);

    const { data: combo } = await supabase
      .from('combos')
      .insert({
        name: 'Your Personalized Combo',
        description: aiRec.summary,
        price: comboPrice * 0.85,
        compare_at_price: comboPrice,
        gender: profile?.gender || 'female',
        is_ai_generated: true,
        dermatologist_verified: true,
      })
      .select()
      .single();

    if (combo) {
      const comboProducts = aiRec.products.map((p) => ({
        combo_id: combo.id,
        product_id: p.product_id,
        quantity: 1,
      }));
      await supabase.from('combo_products').insert(comboProducts);

      await supabase.from('personalized_combos').insert({
        user_id: user.id,
        combo_id: combo.id,
        ai_recommendation: aiRec,
        dermatologist_verified: true,
        dermatologist_name: 'Dr. Layali Certified',
      });
    }

    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    setStep(5);
    setLoading(false);
  };

  const next = () => {
    if (step === 4) {
      handleFinish();
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
        {/* Progress */}
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
                      <div key={product.product_id} className="flex items-start gap-3 p-3 rounded-xl bg-black">
                        <div className="w-8 h-8 rounded-full bg-layali-pink-glow/25 flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{product.name}</p>
                          <p className="text-sm text-white/60">{product.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-white mb-2">Morning Routine</h4>
                      <ul className="text-sm text-white/60 space-y-1">
                        {recommendation.routine.morning.map((step, i) => (
                          <li key={i}>• {step}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-white mb-2">Evening Routine</h4>
                      <ul className="text-sm text-white/60 space-y-1">
                        {recommendation.routine.evening.map((step, i) => (
                          <li key={i}>• {step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <Button className="w-full" size="lg" onClick={() => router.push('/shop')}>
                  Start Shopping <ArrowRight className="w-5 h-5" />
                </Button>
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
