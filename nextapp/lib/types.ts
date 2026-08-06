/* ============================================
   KB.ENT Types
   ============================================ */

export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice: number | null;
  discount: number | null;
  rating: number;
  reviews: number;
  category: string;
  brand: string | null;
  gender: string;
  style: string;
  sizes: string[];
  colors: string[];
  colorStock: Record<string, boolean>;
  images: string[];
  tag: string | null;
  description: string | null;
  inStock: boolean;
}

export interface CartItem {
  productId: number;
  size: string;
  color: string;
  quantity: number;
  _dbId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'customer' | 'admin';
}

export interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  paymentMethod?: string;
  paymentRef?: string | null;
  userId?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: OrderItem[];
}

export interface OrderItem {
  productId: number;
  size: string;
  color: string;
  quantity: number;
}

export interface Review {
  id: string;
  userId: string;
  user: string;
  text: string;
  rating: number;
  verified: boolean;
  date: string;
}

export interface Testimonial {
  name: string;
  text: string;
  rating: number;
  verified: boolean;
}
