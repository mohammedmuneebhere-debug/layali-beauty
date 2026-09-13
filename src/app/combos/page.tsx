'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Shield, Sparkles } from 'lucide-react';
import { Card, CardImage, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils';
import { comboItemsToCartLines } from '@/lib/recommendation';
import type { ShopProduct } from '@/lib/catalog';
import type { Combo } from '@/types/database';

/**
 * Hybrid combos:
 * - Shopify collection/product_type "combo" (commerce bundles)
 * - Layali curated + AI combos from Supabase with shopify_items GIDs
 */
export default function CombosPage() {
  const [shopCombos, setShopCombos] = useState<ShopProduct[]>([]);
  const [layaliCombos, setLayaliCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [shopRes, layaliRes] = await Promise.all([
        fetch('/api/shopify/products?category=combo'),
        supabase
          .from('combos')
          .select('*')
          .eq('is_active', true)
          .eq('gender', 'female')
          .order('created_at', { ascending: false }),
      ]);

      const shopJson = (await shopRes.json()) as { products?: ShopProduct[] };
      setShopCombos(shopJson.products || []);
      setLayaliCombos((layaliRes.data as Combo[]) || []);
      setLoading(false);
    }
    void load();
  }, []);

  const addLayaliCombo = async (combo: Combo) => {
    const lines = comboItemsToCartLines(combo.shopify_items);
    if (lines.length === 0) {
      setMessage(
        combo.is_ai_generated
          ? 'This personalized combo is not linked to purchasable Shopify variants yet.'
          : 'This curated combo needs Shopify product lines. Ask an admin to re-save it with Shopify products.'
      );
      return;
    }
    setAddingId(combo.id);
    setMessage(null);
    const ok = await addItem({
      id: combo.id,
      type: 'combo',
      name: combo.name,
      price: Number(combo.price),
      image_url: combo.image_url,
      lines,
    });
    setAddingId(null);
    const unitCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    setMessage(
      ok
        ? `Added ${unitCount} item${unitCount === 1 ? '' : 's'} from “${combo.name}” to your cart.`
        : 'Could not add this combo to cart.'
    );
  };

  const hasAny = shopCombos.length > 0 || layaliCombos.length > 0;

  return (
    <div className="relative min-h-screen bg-transparent pt-24 pb-16 overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] top-0 left-1/2 -translate-x-1/2 opacity-35 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="mb-12 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-layali-pink mb-4" />
          <h1 className="font-serif text-heading-lg text-white mb-2">Curated Combos</h1>
          <p className="text-body-lg text-white/60 max-w-xl mx-auto">
            Beautifully bundled products at special prices — including AI-personalized combos
            verified by our dermatologist.
          </p>
          {message && <p className="text-sm text-white/70 mt-4">{message}</p>}
        </FadeIn>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-80 bg-layali-surface rounded-2xl animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : !hasAny ? (
          <p className="text-center text-white/45 py-20">No combos available yet.</p>
        ) : (
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopCombos.map((combo) => (
              <StaggerItem key={combo.id}>
                <Card hover>
                  <CardImage src={combo.image_url} alt={combo.name} />
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-meta uppercase bg-white/10 text-white/70 border border-white/15">
                        Shopify bundle
                      </span>
                    </div>
                    <h3 className="text-product-name text-white mb-1">{combo.name}</h3>
                    <p className="text-body text-white/45 mb-3 line-clamp-2">{combo.description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-price text-white">
                          {formatPrice(Number(combo.price))}
                        </span>
                        {combo.compare_at_price && (
                          <span className="text-meta text-white/30 line-through ms-2">
                            {formatPrice(Number(combo.compare_at_price))}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!combo.defaultVariantId}
                        onClick={() =>
                          void addItem({
                            id: combo.id,
                            type: 'product',
                            name: combo.name,
                            price: Number(combo.price),
                            image_url: combo.image_url,
                            merchandiseId: combo.defaultVariantId || undefined,
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

            {layaliCombos.map((combo) => {
              const canAdd = comboItemsToCartLines(combo.shopify_items).length > 0;
              return (
                <StaggerItem key={combo.id}>
                  <Card hover>
                    <CardImage src={combo.image_url} alt={combo.name} />
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {combo.is_ai_generated ? (
                          <span className="px-2 py-0.5 rounded-full text-meta uppercase bg-layali-pink/15 text-layali-pink-light flex items-center gap-1 border border-layali-pink/25">
                            <Sparkles className="w-3 h-3" /> AI Personalized
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-meta uppercase bg-white/10 text-white/70 border border-white/15">
                            Curated
                          </span>
                        )}
                        {combo.dermatologist_verified && (
                          <span className="px-2 py-0.5 rounded-full text-meta uppercase bg-emerald-500/10 text-emerald-300 flex items-center gap-1 border border-emerald-500/20">
                            <Shield className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>
                      <h3 className="text-product-name text-white mb-1">{combo.name}</h3>
                      <p className="text-body text-white/45 mb-3 line-clamp-2">{combo.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-price text-white">
                            {formatPrice(Number(combo.price))}
                          </span>
                          {combo.compare_at_price && (
                            <span className="text-meta text-white/30 line-through ms-2">
                              {formatPrice(Number(combo.compare_at_price))}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={addingId === combo.id}
                          disabled={!canAdd}
                          onClick={() => void addLayaliCombo(combo)}
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </Button>
                      </div>
                      {!canAdd && (
                        <p className="text-[11px] text-white/35 mt-2">
                          {combo.is_ai_generated
                            ? 'Legacy combo — retake the survey for Shopify-linked recommendations.'
                            : 'Awaiting Shopify product links from admin.'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}
