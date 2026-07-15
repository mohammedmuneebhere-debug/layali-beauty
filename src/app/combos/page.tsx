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
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('combos')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Logged-in users see combos for their gender; guests see all
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single();
        if (profile?.gender) {
          query = query.eq('gender', profile.gender);
        }
      }

      const { data } = await query;
      setCombos(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-layali-cream py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="mb-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-layali-gold mb-4" />
          <h1 className="font-serif text-4xl font-bold text-layali-black mb-2">Curated Combos</h1>
          <p className="text-layali-black/60 max-w-xl mx-auto">
            Beautifully bundled products at special prices — including AI-personalized combos verified by our dermatologist.
          </p>
        </FadeIn>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-layali-pink-light/30 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : combos.length === 0 ? (
          <p className="text-center text-layali-black/60 py-20">No combos available yet.</p>
        ) : (
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combos.map((combo) => (
              <StaggerItem key={combo.id}>
                <Card hover>
                  <CardImage src={combo.image_url} alt={combo.name} />
                  <CardContent>
                    <div className="flex gap-2 mb-2">
                      {combo.is_ai_generated && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> AI Personalized
                        </span>
                      )}
                      {combo.dermatologist_verified && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-lg font-bold text-layali-black mb-1">{combo.name}</h3>
                    <p className="text-sm text-layali-black/60 mb-3 line-clamp-2">{combo.description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-layali-black">{formatPrice(Number(combo.price))}</span>
                        {combo.compare_at_price && (
                          <span className="text-sm text-layali-black/40 line-through ml-2">
                            {formatPrice(Number(combo.compare_at_price))}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addItem({
                          id: combo.id,
                          type: 'combo',
                          name: combo.name,
                          price: Number(combo.price),
                          image_url: combo.image_url,
                        })}
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
