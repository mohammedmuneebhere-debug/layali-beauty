export type UserRole = 'user' | 'admin';
export type Gender = 'female' | 'male';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type ProductCategory = 'skincare' | 'haircare' | 'fragrance' | 'bodycare' | 'makeup' | 'combo';

export type BannerPlacement = 'landing_hero' | 'shop_hero' | 'promo_grid';

export interface SiteBanner {
  id: string;
  placement: BannerPlacement;
  image_url: string;
  alt_text: string;
  href: string | null;
  span: 'full' | 'half' | null;
  image_width: number | null;
  image_height: number | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  gender: Gender | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Region {
  id: string;
  country: string;
  city: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  category: ProductCategory;
  gender: Gender;
  image_url: string | null;
  images: string[];
  ingredients: string | null;
  benefits: string[];
  stock_quantity: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  regions?: Region[];
}

export interface TrendingProduct {
  id: string;
  product_id: string | null;
  shopify_product_id?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  product?: Product;
}

export interface Combo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  gender: Gender;
  image_url: string | null;
  is_active: boolean;
  is_ai_generated: boolean;
  dermatologist_verified: boolean;
  /** AI recommendation Shopify lines (Phase 2+). Not used for curated Shopify bundles. */
  shopify_items?: AIRecommendationProduct[] | null;
  created_at: string;
  updated_at: string;
  products?: Product[];
}

export type AddressLabel = 'home' | 'work' | 'other';

export interface Address {
  id: string;
  user_id: string;
  label: AddressLabel;
  custom_label: string | null;
  receiver_name: string;
  receiver_phone: string;
  address_line: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  delivery_fee?: number | null;
  payment_method: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  phone: string;
  address_id?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  tracking?: OrderTracking[];
  profile?: Profile;
  address?: Address | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  combo_id: string | null;
  name: string;
  price: number;
  cost_price: number | null;
  quantity: number;
  created_at: string;
}

export interface OrderTracking {
  id: string;
  order_id: string;
  status: OrderStatus;
  message: string | null;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  user_id: string;
  skin_type: string | null;
  hair_type: string | null;
  skin_concerns: string[];
  hair_concerns: string[];
  allergies: string[];
  age_range: string | null;
  lifestyle: string[];
  additional_notes: string | null;
  created_at: string;
}

export interface PersonalizedCombo {
  id: string;
  user_id: string;
  survey_id: string | null;
  combo_id: string | null;
  ai_recommendation: AIRecommendation | null;
  /** Explicit Shopify GID lines (Phase 2+). Older rows may be empty. */
  recommendation_items?: AIRecommendationProduct[] | null;
  dermatologist_verified: boolean;
  dermatologist_name: string;
  created_at: string;
  combo?: Combo;
}

export interface AIRecommendationProduct {
  shopify_product_id: string;
  shopify_variant_id: string | null;
  name: string;
  reason: string;
  price?: number;
  handle?: string;
  image_url?: string | null;
  available?: boolean;
  /**
   * Legacy Supabase products.id — only present on historical JSON.
   * New recommendations must not set this.
   */
  product_id?: string;
}

export interface AIRecommendation {
  summary: string;
  products: AIRecommendationProduct[];
  routine: {
    morning: string[];
    evening: string[];
  };
  tips: string[];
}

export interface CartItem {
  id: string;
  type: 'product' | 'combo';
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
}

export interface CustomerReview {
  id: string;
  user_id: string;
  rating: number;
  title: string;
  content: string;
  is_approved: boolean;
  created_at: string;
  profile?: Pick<Profile, 'full_name' | 'city' | 'country'>;
}

export type SupportStatus = 'open' | 'closed';

export interface SupportConversation {
  id: string;
  user_id: string;
  subject: string;
  status: SupportStatus;
  last_message_at: string;
  created_at: string;
  profile?: Pick<Profile, 'full_name' | 'email' | 'city' | 'country'>;
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: UserRole;
  message: string;
  created_at: string;
  profile?: Pick<Profile, 'full_name'>;
}
