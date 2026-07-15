'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadCatalogImage } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface MultiImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: 'products' | 'combos';
  label?: string;
  maxImages?: number;
}

export function MultiImageUpload({
  value,
  onChange,
  folder = 'products',
  label = 'Product Photos',
  maxImages = 8,
}: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const remaining = maxImages - value.length;
    if (remaining <= 0) {
      setError(`You can upload up to ${maxImages} images.`);
      return;
    }

    setUploading(true);
    setError('');
    const supabase = createClient();
    const selected = Array.from(files).slice(0, remaining);
    const uploaded: string[] = [];

    for (const file of selected) {
      const { url, error: uploadError } = await uploadCatalogImage(supabase, file, folder);
      if (uploadError || !url) {
        setError(uploadError || 'Upload failed. Please try again.');
        continue;
      }
      uploaded.push(url);
    }

    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
    }
    setUploading(false);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-layali-black mb-1.5">{label}</label>
      <p className="text-xs text-gray-500 mb-3">
        Upload multiple photos. The first image is used as the main product photo.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {value.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="relative aspect-square rounded-xl overflow-hidden border border-layali-pink/30 group"
          >
            <img src={url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
            {index === 0 && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-layali-black text-white">
                Main
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {value.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'aspect-square rounded-xl border-2 border-dashed border-layali-pink/40',
              'flex flex-col items-center justify-center gap-1 text-layali-black/50',
              'hover:border-layali-pink hover:bg-layali-pink-light/20 transition-colors',
              uploading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Upload className="w-5 h-5" />
            <span className="text-xs">{uploading ? 'Uploading...' : 'Add'}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
