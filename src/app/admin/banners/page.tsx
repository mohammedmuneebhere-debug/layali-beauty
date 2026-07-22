'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, ImageIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { BANNER_PLACEMENTS, fetchAllBanners } from '@/lib/site-banners';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUpload } from '@/components/admin/ImageUpload';
import type { BannerPlacement, SiteBanner } from '@/types/database';

type FormValues = {
  placement: BannerPlacement;
  alt_text: string;
  href: string;
  span: string;
  sort_order: string;
  is_active: string;
  starts_at: string;
  ends_at: string;
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<SiteBanner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SiteBanner | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const [imageHeight, setImageHeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>();
  const placement = watch('placement');

  const loadData = async () => {
    const supabase = createClient();
    const rows = await fetchAllBanners(supabase);
    setBanners(rows);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setImageUrl(null);
    setImageWidth(null);
    setImageHeight(null);
    reset({
      placement: 'landing_hero',
      alt_text: '',
      href: '',
      span: 'half',
      sort_order: String(banners.length),
      is_active: 'true',
      starts_at: '',
      ends_at: '',
    });
    setShowForm(true);
  };

  const openEdit = (banner: SiteBanner) => {
    setEditing(banner);
    setImageUrl(banner.image_url);
    setImageWidth(banner.image_width);
    setImageHeight(banner.image_height);
    setValue('placement', banner.placement);
    setValue('alt_text', banner.alt_text);
    setValue('href', banner.href || '');
    setValue('span', banner.span || 'half');
    setValue('sort_order', String(banner.sort_order));
    setValue('is_active', banner.is_active ? 'true' : 'false');
    setValue('starts_at', banner.starts_at ? banner.starts_at.slice(0, 16) : '');
    setValue('ends_at', banner.ends_at ? banner.ends_at.slice(0, 16) : '');
    setShowForm(true);
  };

  const onSubmit = async (data: FormValues) => {
    if (!imageUrl) {
      alert('Please upload a banner image.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      placement: data.placement,
      image_url: imageUrl,
      alt_text: data.alt_text,
      href: data.href || null,
      span: data.placement === 'promo_grid' ? (data.span as 'full' | 'half') : null,
      image_width: imageWidth,
      image_height: imageHeight,
      sort_order: Number(data.sort_order) || 0,
      is_active: data.is_active === 'true',
      starts_at: data.starts_at ? new Date(data.starts_at).toISOString() : null,
      ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      await supabase.from('site_banners').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('site_banners').insert(payload);
    }

    setShowForm(false);
    setEditing(null);
    setImageUrl(null);
    reset();
    await loadData();
    setLoading(false);
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    const supabase = createClient();
    await supabase.from('site_banners').delete().eq('id', id);
    await loadData();
  };

  const placementLabel = (value: BannerPlacement) =>
    BANNER_PLACEMENTS.find((p) => p.value === value)?.label || value;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners & Ads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage hero carousels and promo tiles on the landing and shop pages — no code changes needed.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" /> Add Banner
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {BANNER_PLACEMENTS.map((p) => (
          <div key={p.value} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">{p.label}</p>
            <p className="text-xs text-gray-500 mt-1">{p.description}</p>
            <p className="text-lg font-bold text-layali-pink mt-2">
              {banners.filter((b) => b.placement === p.value && b.is_active).length} active
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Preview</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Placement</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Alt / Link</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No banners yet. Add your first advertisement above.
                  </td>
                </tr>
              ) : (
                banners.map((banner) => (
                  <tr key={banner.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <img
                        src={banner.image_url}
                        alt={banner.alt_text}
                        className="h-14 w-24 object-cover rounded-lg border border-gray-200"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{placementLabel(banner.placement)}</p>
                      {banner.span && (
                        <p className="text-xs text-gray-500 capitalize">{banner.span} width</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="truncate text-gray-900">{banner.alt_text}</p>
                      {banner.href && (
                        <p className="text-xs text-layali-pink truncate">{banner.href}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{banner.sort_order}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          banner.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {banner.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(banner)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBanner(banner.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">{editing ? 'Edit Banner' : 'Add Banner'}</h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Select
                tone="light"
                label="Placement"
                options={BANNER_PLACEMENTS.map((p) => ({ value: p.value, label: p.label }))}
                {...register('placement', { required: true })}
              />
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                onDimensions={(size) => {
                  setImageWidth(size?.width ?? null);
                  setImageHeight(size?.height ?? null);
                }}
                folder="banners"
                label="Banner Image"
              />
              <Input
                tone="light"
                label="Alt text (accessibility)"
                placeholder="Describe the advertisement"
                {...register('alt_text', { required: true })}
              />
              <Input
                tone="light"
                label="Link URL (optional)"
                placeholder="/shop or https://..."
                {...register('href')}
              />
              {placement === 'promo_grid' && (
                <Select
                  tone="light"
                  label="Grid width"
                  options={[
                    { value: 'full', label: 'Full width row' },
                    { value: 'half', label: 'Half width tile' },
                  ]}
                  {...register('span')}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <Input tone="light" label="Sort order" type="number" {...register('sort_order')} />
                <Select
                  tone="light"
                  label="Status"
                  options={[
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Hidden' },
                  ]}
                  {...register('is_active')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  tone="light"
                  label="Start (optional)"
                  type="datetime-local"
                  {...register('starts_at')}
                />
                <Input
                  tone="light"
                  label="End (optional)"
                  type="datetime-local"
                  {...register('ends_at')}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : editing ? 'Update Banner' : 'Create Banner'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
