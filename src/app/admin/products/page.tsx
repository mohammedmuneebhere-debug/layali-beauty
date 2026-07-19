'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { saveProductRegions, getProductRegionIds } from '@/lib/products';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MultiImageUpload } from '@/components/admin/MultiImageUpload';
import { formatPrice } from '@/lib/utils';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import type { Product, Region } from '@/types/database';

type ProductRow = Product & {
  product_regions?: { region_id: string; regions: Region | null }[];
};

function productImages(product: Product): string[] {
  if (product.images?.length) return product.images;
  return product.image_url ? [product.image_url] : [];
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [regionError, setRegionError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm();

  const loadData = async () => {
    const supabase = createClient();
    const [productsRes, regionsRes] = await Promise.all([
      supabase
        .from('products')
        .select('*, product_regions(region_id, regions(id, country, city))')
        .order('created_at', { ascending: false }),
      supabase.from('regions').select('*').eq('is_active', true).order('country').order('city'),
    ]);

    setProducts((productsRes.data as ProductRow[]) || []);
    setRegions(regionsRes.data || []);
  };

  useEffect(() => { loadData(); }, []);

  const toggleRegion = (regionId: string) => {
    setRegionError('');
    setSelectedRegionIds((prev) =>
      prev.includes(regionId) ? prev.filter((id) => id !== regionId) : [...prev, regionId]
    );
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedRegionIds([]);
    setRegionError('');
    setImages([]);
    reset();
    setShowForm(true);
  };

  const openEdit = async (product: ProductRow) => {
    setEditing(product);
    setValue('name', product.name);
    setValue('description', product.description || '');
    setValue('ingredients', product.ingredients || '');
    setValue('benefits', (product.benefits || []).join(', '));
    setValue('price', product.price);
    setValue('compare_at_price', product.compare_at_price || '');
    setValue('category', product.category);
    setValue('gender', product.gender);
    setValue('stock_quantity', product.stock_quantity);
    setImages(productImages(product));
    setValue('is_active', product.is_active ? 'true' : 'false');
    setValue('is_featured', product.is_featured ? 'true' : 'false');

    const supabase = createClient();
    const regionIds = await getProductRegionIds(supabase, product.id);
    setSelectedRegionIds(regionIds);
    setRegionError('');
    setShowForm(true);
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    if (selectedRegionIds.length === 0) {
      setRegionError('Select at least one region/outlet for this product.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      name: data.name as string,
      description: data.description as string,
      ingredients: (data.ingredients as string) || null,
      benefits: String(data.benefits || '')
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
      price: Number(data.price),
      compare_at_price: data.compare_at_price ? Number(data.compare_at_price) : null,
      category: data.category as string,
      gender: data.gender as string,
      stock_quantity: Number(data.stock_quantity) || 0,
      image_url: images[0] || null,
      images,
      is_active: data.is_active === 'true' || data.is_active === true,
      is_featured: data.is_featured === 'true' || data.is_featured === true,
    };

    let productId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) {
        setLoading(false);
        return;
      }
    } else {
      const { data: created, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error || !created) {
        setLoading(false);
        return;
      }
      productId = created.id;
    }

    if (productId) {
      await saveProductRegions(supabase, productId, selectedRegionIds);
    }

    setShowForm(false);
    setEditing(null);
    setSelectedRegionIds([]);
    setImages([]);
    reset();
    loadData();
    setLoading(false);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    loadData();
  };

  const regionsByCountry = regions.reduce<Record<string, Region[]>>((acc, region) => {
    if (!acc[region.country]) acc[region.country] = [];
    acc[region.country].push(region);
    return acc;
  }, {});

  const getProductRegionLabels = (product: ProductRow) => {
    const labels = (product.product_regions || [])
      .map((pr) => pr.regions?.city)
      .filter(Boolean) as string[];
    return labels;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Assign products to regional outlets so users only see what&apos;s available in their city.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input tone="light" label="Name" {...register('name', { required: true })} />
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea {...register('description')} className="w-full px-4 py-3 rounded-xl border border-layali-pink/30" rows={4} placeholder="Tell customers about this product..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Ingredients</label>
                <textarea {...register('ingredients')} className="w-full px-4 py-3 rounded-xl border border-layali-pink/30" rows={2} placeholder="Key ingredients..." />
              </div>
              <Input
                tone="light"
                label="Benefits (comma separated)"
                placeholder="hydrating, brightening, anti-aging"
                {...register('benefits')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input tone="light" label="Price (SAR)" type="number" step="0.01" {...register('price', { required: true })} />
                <Input tone="light" label="Compare Price" type="number" step="0.01" {...register('compare_at_price')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select tone="light" label="Category" options={PRODUCT_CATEGORIES} {...register('category', { required: true })} />
                <Select tone="light" label="Gender" options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} {...register('gender', { required: true })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input tone="light" label="Stock" type="number" {...register('stock_quantity')} />
              </div>
              <MultiImageUpload
                value={images}
                onChange={setImages}
                folder="products"
                label="Product Photos"
              />
              <div className="grid grid-cols-2 gap-4">
                <Select tone="light" label="Active" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} {...register('is_active')} />
                <Select tone="light" label="Featured" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} {...register('is_featured')} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Available Regions / Outlets
                </label>
                <p className="text-xs text-gray-500 mb-3">Select which cities this product is stocked in.</p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3 space-y-4">
                  {Object.entries(regionsByCountry).map(([country, countryRegions]) => (
                    <div key={country}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{country}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {countryRegions.map((region) => (
                          <label
                            key={region.id}
                            className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg border transition-colors ${
                              selectedRegionIds.includes(region.id)
                                ? 'border-layali-pink-dark bg-layali-pink-light/30'
                                : 'border-gray-100 hover:border-layali-pink/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRegionIds.includes(region.id)}
                              onChange={() => toggleRegion(region.id)}
                              className="rounded"
                            />
                            {region.city}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {regions.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No regions found. Add outlets in the Regions page first.
                    </p>
                  )}
                </div>
                {regionError && <p className="mt-1 text-sm text-red-500">{regionError}</p>}
              </div>

              <Button type="submit" className="w-full" loading={loading}>
                {editing ? 'Update Product' : 'Create Product'}
              </Button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="p-4">Product</th>
              <th className="p-4">Category</th>
              <th className="p-4">Gender</th>
              <th className="p-4">Regions</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const regionLabels = getProductRegionLabels(product);
              return (
                <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-layali-pink-light/30 flex items-center justify-center overflow-hidden">
                        {productImages(product)[0] ? (
                          <img src={productImages(product)[0]} alt="" className="w-full h-full object-cover" />
                        ) : '✦'}
                      </div>
                      <div>
                        <span className="text-sm font-medium block">{product.name}</span>
                        {productImages(product).length > 1 && (
                          <span className="text-xs text-gray-400">{productImages(product).length} photos</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm capitalize">{product.category}</td>
                  <td className="p-4 text-sm capitalize">{product.gender}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                      {regionLabels.length > 0 ? regionLabels.map((city) => (
                        <span key={city} className="px-2 py-0.5 rounded-full text-xs bg-layali-pink-light/50 text-layali-black">
                          {city}
                        </span>
                      )) : (
                        <span className="text-xs text-red-400">No regions</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-sm font-medium">{formatPrice(Number(product.price))}</td>
                  <td className="p-4 text-sm">{product.stock_quantity}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(product)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => deleteProduct(product.id)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">No products yet. Add your first product!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
