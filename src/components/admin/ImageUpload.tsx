'use client';

import { useRef, useState } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadCatalogImage, readImageDimensionsFromFile } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: 'products' | 'combos' | 'banners';
  label?: string;
  onDimensions?: (size: { width: number; height: number } | null) => void;
}

export function ImageUpload({ value, onChange, folder, label = 'Product Image', onDimensions }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setUploading(true);
    setError('');

    const supabase = createClient();
    const { url, error: uploadError, width, height } = await uploadCatalogImage(supabase, file, folder);

    if (uploadError || !url) {
      setError(uploadError || 'Upload failed. Please try again.');
      setUploading(false);
      return;
    }

    onChange(url);
    onDimensions?.(width && height ? { width, height } : null);
    setUploading(false);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-layali-black mb-1.5">{label}</label>

      {value ? (
        <div className="relative w-full aspect-square max-w-[200px] rounded-xl overflow-hidden border border-layali-pink/30 group">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onDimensions?.(null);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full aspect-video max-h-40 rounded-xl border-2 border-dashed border-layali-pink/40',
            'flex flex-col items-center justify-center gap-2 text-layali-black/50',
            'hover:border-layali-pink hover:bg-layali-pink-light/20 transition-colors',
            uploading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {uploading ? (
            <span className="text-sm">Uploading...</span>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              <span className="text-sm">Click to upload image</span>
              <span className="text-xs">JPG, PNG, WebP up to 5MB</span>
            </>
          )}
        </button>
      )}

      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-2 text-sm text-layali-pink-dark hover:underline flex items-center gap-1"
        >
          <ImageIcon className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Replace image'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
