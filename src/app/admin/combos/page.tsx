'use client';

/**
 * Admin curated combos — product lines reference Shopify GIDs via combos.shopify_items.
 * Does not write combo_products (legacy UUID junction) for new/updated saves.
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { formatPrice } from '@/lib/utils';
import { isVariantGid } from '@/lib/recommendation';
import type { ShopProduct } from '@/lib/catalog';
import type { Combo, ComboShopifyItem } from '@/types/database';

type SelectedLine = ComboShopifyItem;

export default function AdminCombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [catalog, setCatalog] = useState<ShopProduct[]>([]);
  const [catalogConfigured, setCatalogConfigured] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([]);
  const [legacyNeedsMigration, setLegacyNeedsMigration] = useState(false);
  const [search, setSearch] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue } = useForm();

  const load = async () => {
    const supabase = createClient();
    const [combosRes, catalogRes] = await Promise.all([
      supabase.from('combos').select('*').order('created_at', { ascending: false }),
      fetch('/api/shopify/products'),
    ]);
    setCombos((combosRes.data as Combo[]) || []);
    const catalogJson = (await catalogRes.json()) as {
      products?: ShopProduct[];
      configured?: boolean;
    };
    setCatalogConfigured(catalogJson.configured !== false);
    setCatalog(catalogJson.products || []);
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
    });
  }, []);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) =>
      `${p.name} ${p.category} ${p.handle}`.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const selectedVariantIds = useMemo(
    () => new Set(selectedLines.map((l) => l.shopify_variant_id).filter(Boolean)),
    [selectedLines]
  );

  const toggleProduct = (product: ShopProduct) => {
    if (!product.defaultVariantId || !isVariantGid(product.defaultVariantId)) return;

    setSelectedLines((prev) => {
      const exists = prev.some((l) => l.shopify_variant_id === product.defaultVariantId);
      if (exists) {
        return prev.filter((l) => l.shopify_variant_id !== product.defaultVariantId);
      }
      return [
        ...prev,
        {
          shopify_product_id: product.shopifyProductId,
          shopify_variant_id: product.defaultVariantId,
          quantity: 1,
          name: product.name,
          price: Number(product.price),
          handle: product.handle,
          image_url: product.image_url,
          available: product.available,
        },
      ];
    });
  };

  const setQuantity = (variantId: string, quantity: number) => {
    setSelectedLines((prev) =>
      prev.map((l) =>
        l.shopify_variant_id === variantId
          ? { ...l, quantity: Math.max(1, quantity) }
          : l
      )
    );
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedLines([]);
    setLegacyNeedsMigration(false);
    setFormError(null);
    setImageUrl(null);
    setSearch('');
    reset();
    setShowForm(true);
  };

  const openEdit = async (combo: Combo) => {
    setEditing(combo);
    setValue('name', combo.name);
    setValue('description', combo.description || '');
    setValue('price', combo.price);
    setValue('compare_at_price', combo.compare_at_price || '');
    setValue('cost_price', combo.cost_price ?? '');
    setValue('gender', combo.gender);
    setValue('dermatologist_verified', combo.dermatologist_verified ? 'true' : 'false');
    setImageUrl(combo.image_url);
    setFormError(null);
    setSearch('');

    const items = (combo.shopify_items || []).filter((i) =>
      isVariantGid(i.shopify_variant_id)
    );

    if (items.length > 0) {
      setSelectedLines(
        items.map((i) => ({
          ...i,
          quantity: Math.max(1, Number(i.quantity) || 1),
        }))
      );
      setLegacyNeedsMigration(false);
    } else {
      setSelectedLines([]);
      // Historical UUID-only combos cannot be auto-mapped
      const supabase = createClient();
      const { data } = await supabase
        .from('combo_products')
        .select('product_id')
        .eq('combo_id', combo.id);
      setLegacyNeedsMigration((data || []).length > 0);
    }

    setShowForm(true);
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    setFormError(null);
    const supabase = createClient();

    if (selectedLines.length === 0) {
      setFormError('Select at least one Shopify product/variant for this curated combo.');
      setLoading(false);
      return;
    }

    const shopifyItems: ComboShopifyItem[] = selectedLines.map((l) => ({
      shopify_product_id: l.shopify_product_id,
      shopify_variant_id: l.shopify_variant_id,
      quantity: Math.max(1, Number(l.quantity) || 1),
      name: l.name,
      price: l.price,
      handle: l.handle,
      image_url: l.image_url,
      available: l.available,
    }));

    const payload: Record<string, unknown> = {
      name: data.name as string,
      description: data.description as string,
      price: Number(data.price),
      compare_at_price: data.compare_at_price ? Number(data.compare_at_price) : null,
      cost_price: data.cost_price ? Number(data.cost_price) : null,
      gender: data.gender as string,
      image_url: imageUrl,
      is_active: true,
      is_ai_generated: editing?.is_ai_generated ?? false,
      dermatologist_verified: data.dermatologist_verified === 'true',
      shopify_items: shopifyItems,
    };

    let comboId = editing?.id;
    let errorMessage: string | null = null;

    if (editing) {
      const { error } = await supabase.from('combos').update(payload).eq('id', editing.id);
      if (error) {
        if (String(error.message).toLowerCase().includes('shopify_items')) {
          delete payload.shopify_items;
          const retry = await supabase.from('combos').update(payload).eq('id', editing.id);
          errorMessage = retry.error?.message || null;
          if (!retry.error) {
            setFormError(
              'Combo saved without shopify_items. Run the Phase 3 SQL migration, then re-save.'
            );
          }
        } else {
          errorMessage = error.message;
        }
      }
    } else {
      const { data: created, error } = await supabase
        .from('combos')
        .insert(payload)
        .select('id')
        .single();
      if (error || !created) {
        if (error && String(error.message).toLowerCase().includes('shopify_items')) {
          delete payload.shopify_items;
          const retry = await supabase.from('combos').insert(payload).select('id').single();
          if (retry.data) {
            comboId = retry.data.id;
            setFormError(
              'Combo created without shopify_items. Run the Phase 3 SQL migration, then edit and re-save.'
            );
          } else {
            errorMessage = retry.error?.message || error.message;
          }
        } else {
          errorMessage = error?.message || 'Could not create combo';
        }
      } else {
        comboId = created.id;
      }
    }

    if (errorMessage) {
      setFormError(errorMessage);
      setLoading(false);
      return;
    }

    // Do not write combo_products (legacy UUID FK). Leave historical rows intact.
    void comboId;

    setShowForm(false);
    setEditing(null);
    setSelectedLines([]);
    setImageUrl(null);
    reset();
    await load();
    setLoading(false);
  };

  const deleteCombo = async (id: string) => {
    if (!confirm('Delete this combo?')) return;
    const supabase = createClient();
    await supabase.from('combos').delete().eq('id', id);
    await load();
  };

  const linkedCount = (combo: Combo) =>
    (combo.shopify_items || []).filter((i) => isVariantGid(i.shopify_variant_id)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Curated combos reference Shopify product/variant GIDs. Commerce price and inventory
            remain in Shopify; optional Layali COGS stays on the combo row.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" /> Create Combo
        </Button>
      </div>

      {!catalogConfigured && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Shopify Storefront is not configured. Combos cannot select products until catalog env
          vars are set.
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">{editing ? 'Edit Combo' : 'Create Combo'}</h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {legacyNeedsMigration && (
              <div className="mb-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  This combo only has legacy Supabase product UUID links. Those cannot be mapped
                  automatically. Select Shopify products below to migrate it.
                </p>
              </div>
            )}

            {formError && (
              <p className="mb-4 text-sm text-red-600">{formError}</p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                folder="combos"
                label="Combo Photo"
              />
              <Input tone="light" label="Combo Name" {...register('name', { required: true })} />
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  {...register('description')}
                  className="w-full px-4 py-3 rounded-xl border border-layali-pink/30"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  tone="light"
                  label="Price (SAR)"
                  type="number"
                  step="0.01"
                  {...register('price', { required: true })}
                />
                <Input
                  tone="light"
                  label="Compare Price"
                  type="number"
                  step="0.01"
                  {...register('compare_at_price')}
                />
                <Input
                  tone="light"
                  label="Cost price (COGS)"
                  type="number"
                  step="0.01"
                  {...register('cost_price')}
                />
              </div>
              <Select
                tone="light"
                label="Gender"
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                ]}
                {...register('gender', { required: true })}
              />
              <Select
                tone="light"
                label="Dermatologist Verified"
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
                {...register('dermatologist_verified')}
              />

              <div>
                <label className="block text-sm font-medium mb-2">Select Shopify products</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search catalog…"
                    className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-xl p-3">
                  {filteredCatalog.length === 0 ? (
                    <p className="text-sm text-gray-500">No Shopify products found.</p>
                  ) : (
                    filteredCatalog.map((p) => {
                      const checked = selectedVariantIds.has(p.defaultVariantId);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!p.defaultVariantId}
                            onChange={() => toggleProduct(p)}
                            className="rounded"
                          />
                          {p.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <span className="flex-1 min-w-0 truncate">
                            {p.name} — {formatPrice(Number(p.price))}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedLines.length > 0 && (
                <div className="space-y-2 border border-gray-100 rounded-xl p-3">
                  <p className="text-sm font-medium text-gray-800">Selected lines</p>
                  {selectedLines.map((line) => (
                    <div
                      key={line.shopify_variant_id || line.shopify_product_id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="flex-1 truncate">{line.name || line.shopify_product_id}</span>
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        Qty
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            setQuantity(
                              line.shopify_variant_id || '',
                              Number(e.target.value) || 1
                            )
                          }
                          className="w-14 rounded border border-gray-200 px-2 py-1"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                {editing ? 'Update Combo' : 'Create Combo'}
              </Button>
            </form>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {combos.map((combo) => (
          <div
            key={combo.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="aspect-video bg-layali-pink-light/30 relative">
              {combo.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={combo.image_url} alt={combo.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-layali-pink">
                  ✦
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{combo.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{combo.gender}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void openEdit(combo)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCombo(combo.id)}
                    className="p-1 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{combo.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg">{formatPrice(Number(combo.price))}</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {combo.is_ai_generated && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                      AI
                    </span>
                  )}
                  {combo.dermatologist_verified && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                      Verified
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {linkedCount(combo)} Shopify lines
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {combos.length === 0 && (
          <p className="text-gray-400 col-span-full text-center py-12">No combos yet</p>
        )}
      </div>
    </div>
  );
}
