export const CONTACT_EMAIL = 'layalibeautystore@gmail.com';

/** Fixed delivery charge (SAR) per order — regardless of item count */
export const DELIVERY_FEE = 20;

export const COUNTRIES = [
  { value: 'Saudi Arabia', label: 'Saudi Arabia' },
  { value: 'UAE', label: 'United Arab Emirates' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Bahrain', label: 'Bahrain' },
];

export const CITIES: Record<string, { value: string; label: string }[]> = {
  'Saudi Arabia': [
    { value: 'Riyadh', label: 'Riyadh' },
    { value: 'Jeddah', label: 'Jeddah' },
    { value: 'Dammam', label: 'Dammam' },
  ],
  UAE: [
    { value: 'Dubai', label: 'Dubai' },
    { value: 'Abu Dhabi', label: 'Abu Dhabi' },
  ],
  Kuwait: [{ value: 'Kuwait City', label: 'Kuwait City' }],
  Qatar: [{ value: 'Doha', label: 'Doha' }],
  Bahrain: [{ value: 'Manama', label: 'Manama' }],
};

export const PRODUCT_CATEGORIES = [
  { value: 'skincare', label: 'Skincare' },
  { value: 'haircare', label: 'Haircare' },
  { value: 'fragrance', label: 'Fragrance' },
  { value: 'bodycare', label: 'Body Care' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'combo', label: 'Combo' },
];

export const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-800' },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};
