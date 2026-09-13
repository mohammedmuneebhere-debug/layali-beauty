export type TimelineStepId = 'placed' | 'processing' | 'shipped' | 'delivered';
export type TimelineStepState = 'complete' | 'current' | 'upcoming';

export type CustomerTracking = {
  company: string | null;
  number: string | null;
  url: string | null;
};

export type CustomerOrderItem = {
  name: string;
  variantTitle: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
  imageAlt: string | null;
};

export type CustomerShippingAddress = {
  name: string;
  phone: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string | null;
  zip: string | null;
  country: string | null;
};

export type CustomerOrderSummary = {
  ref: string;
  number: string;
  createdAt: string | null;
  itemCount: number;
  previewImageUrl: string | null;
  previewAlt: string | null;
  totalAmount: number;
  currencyCode: string;
  paymentMethod: 'cod';
  paymentDue: boolean;
  cancelled: boolean;
  currentStep: TimelineStepId;
  statusKey: TimelineStepId | 'cancelled';
};

export type CustomerOrderDetail = CustomerOrderSummary & {
  items: CustomerOrderItem[];
  subtotalAmount: number;
  shippingAmount: number;
  shippingAddress: CustomerShippingAddress | null;
  tracking: CustomerTracking[];
  timeline: { id: TimelineStepId; state: TimelineStepState; at: string | null }[];
};
