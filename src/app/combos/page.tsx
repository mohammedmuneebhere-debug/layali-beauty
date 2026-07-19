'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Shield, Sparkles } from 'lucide-react';
import { Card, CardImage, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import type { Combo } from '@/types/database';

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data } = await supabase
        .from('combos')
        .select('*')
        .eq('is_active', true)
        .eq('gender', 'female')
        .order('created_at', { ascending: false });

      setCombos(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="relative min-h-screen bg-transparent pt-24 pb-16 overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] top-0 left-1/2 -translate-x-1/2 opacity-35 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="mb-12 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-layali-pink mb-4" />
          <h1 className="font-serif text-4xl font-bold text-white mb-2">Curated Combos</h1>
          <p className="text-white/60 max-w-xl mx-auto">
            Beautifully bundled products at special prices — including AI-personalized combos
            verified by our dermatologist.
          </p>
        </FadeIn>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-layali-surface rounded-2xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : combos.length === 0 ? (
          <p className="text-center text-white/45 py-20">No combos available yet.</p>
        ) : (
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combos.map((combo) => (
              <StaggerItem key={combo.id}>
                <Card hover>
                  <CardImage src={combo.image_url} alt={combo.name} />
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {combo.is_ai_generated && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase bg-layali-pink/15 text-layali-pink-light flex items-center gap-1 border border-layali-pink/25">
                          <Sparkles className="w-3 h-3" /> AI Personalized
                        </span>
                      )}
                      {combo.dermatologist_verified && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase bg-emerald-500/10 text-emerald-300 flex items-center gap-1 border border-emerald-500/20">
                          <Shield className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-xl text-white mb-1">{combo.name}</h3>
                    <p className="text-sm text-white/45 mb-3 line-clamp-2">{combo.description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-serif text-lg text-white">
                          {formatPrice(Number(combo.price))}
                        </span>
                        {combo.compare_at_price && (
                          <span className="text-sm text-white/30 line-through ml-2">
                            {formatPrice(Number(combo.compare_at_price))}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          addItem({
                            id: combo.id,
                            type: 'combo',
                            name: combo.name,
                            price: Number(combo.price),
                            image_url: combo.image_url,
                          })
                        }
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}
