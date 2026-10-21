'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { COUNTRIES, CITIES } from '@/lib/constants';
import type { Region } from '@/types/database';

export default function AdminRegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');

  const load = async () => {
    const response = await fetch('/api/admin/catalog-rules', { cache: 'no-store' });
    const json = (await response.json()) as { regions?: Region[] };
    setRegions(json.regions || []);
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      load();
    });
  }, []);

  const addRegion = async () => {
    if (!country || !city) return;
    await fetch('/api/admin/catalog-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-region', country, city }),
    });
    setCountry('');
    setCity('');
    load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await fetch('/api/admin/catalog-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-region', id }),
    });
    load();
  };

  const deleteRegion = async (id: string) => {
    if (!confirm('Delete this region?')) return;
    await fetch('/api/admin/catalog-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-region', id }),
    });
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Regions & Outlets</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="font-bold text-gray-900 mb-4">Add New Region</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <Select
            label="Country"
            options={COUNTRIES}
            value={country}
            onChange={(e) => { setCountry(e.target.value); setCity(''); }}
            placeholder="Select country"
          />
          <Select
            label="City"
            options={CITIES[country] || []}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Select city"
            disabled={!country}
          />
          <Button onClick={addRegion} size="sm">
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="p-4">Country</th>
              <th className="p-4">City</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr key={region.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-4 text-sm">{region.country}</td>
                <td className="p-4 text-sm">{region.city}</td>
                <td className="p-4">
                  <button
                    onClick={() => toggleActive(region.id, region.is_active)}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      region.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {region.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-4">
                  <button onClick={() => deleteRegion(region.id)} className="p-2 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
