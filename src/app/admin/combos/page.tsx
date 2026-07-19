'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { formatPrice } from '@/lib/utils';
import type { Combo, Product } from '@/types/database';

export default function AdminCombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm();

  const load = async () => {
    const supabase = createClient();
    const [combosRes, productsRes] = await Promise.all([
      supabase.from('combos').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('is_active', true),
    ]);
    setCombos(combosRes.data || []);
    setProducts(productsRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedProducts([]);
    setImageUrl(null);
    reset();
    setShowForm(true);
  };

  const openEdit = async (combo: Combo) => {
    setEditing(combo);
    setValue('name', combo.name);
    setValue('description', combo.description || '');
    setValue('price', combo.price);
    setValue('compare_at_price', combo.compare_at_price || '');
    setValue('gender', combo.gender);
    setValue('dermatologist_verified', combo.dermatologist_verified ? 'true' : 'false');
    setImageUrl(combo.image_url);

    const supabase = createClient();
    const { data } = await supabase
      .from('combo_products')
      .select('product_id')
      .eq('combo_id', combo.id);

    setSelectedProducts((data || []).map((row) => row.product_id));
    setShowForm(true);
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    const supabase = createClient();

    const payload = {
      name: data.name as string,
      description: data.description as string,
      price: Number(data.price),
      compare_at_price: data.compare_at_price ? Number(data.compare_at_price) : null,
      gender: data.gender as string,
      image_url: imageUrl,
      is_active: true,
      is_ai_generated: false,
      dermatologist_verified: data.dermatologist_verified === 'true',
    };

    let comboId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('combos').update(payload).eq('id', editing.id);
      if (error) {
        setLoading(false);
        return;
      }
    } else {
      const { data: created, error } = await supabase.from('combos').insert(payload).select('id').single();
      if (error || !created) {
        setLoading(false);
        return;
      }
      comboId = created.id;
    }

    if (comboId) {
      await supabase.from('combo_products').delete().eq('combo_id', comboId);
      if (selectedProducts.length > 0) {
        await supabase.from('combo_products').insert(
          selectedProducts.map((pid) => ({ combo_id: comboId, product_id: pid, quantity: 1 }))
        );
      }
    }

    setShowForm(false);
    setEditing(null);
    setSelectedProducts([]);
    setImageUrl(null);
    reset();
    load();
    setLoading(false);
  };

  const deleteCombo = async (id: string) => {
    if (!confirm('Delete this combo?')) return;
    const supabase = createClient();
    await supabase.from('combos').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Combos</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" /> Create Combo
        </Button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">{editing ? 'Edit Combo' : 'Create Combo'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
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
                <textarea {...register('description')} className="w-full px-4 py-3 rounded-xl border border-layali-pink/30" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input tone="light" label="Price (SAR)" type="number" step="0.01" {...register('price', { required: true })} />
                <Input tone="light" label="Compare Price" type="number" step="0.01" {...register('compare_at_price')} />
              </div>
              <Select tone="light" label="Gender" options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} {...register('gender', { required: true })} />
              <Select tone="light" label="Dermatologist Verified" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} {...register('dermatologist_verified')} />

              <div>
                <label className="block text-sm font-medium mb-2">Select Products</label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-xl p-3">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="rounded"
                      />
                      {p.image_url && (
                        <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                      )}
                      {p.name} — {formatPrice(Number(p.price))}
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" loading={loading}>
                {editing ? 'Update Combo' : 'Create Combo'}
              </Button>
            </form>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {combos.map((combo) => (
          <div key={combo.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="aspect-video bg-layali-pink-light/30 relative">
              {combo.image_url ? (
                <img src={combo.image_url} alt={combo.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-layali-pink">✦</div>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{combo.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{combo.gender}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(combo)} className="p-1 hover:bg-gray-100 rounded">
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button onClick={() => deleteCombo(combo.id)} className="p-1 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{combo.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg">{formatPrice(Number(combo.price))}</span>
                <div className="flex gap-1">
                  {combo.is_ai_generated && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">AI</span>
                  )}
                  {combo.dermatologist_verified && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Verified</span>
                  )}
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
