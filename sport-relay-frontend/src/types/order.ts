import type { Product } from './product';
import type { AuthUser } from './auth';

export interface Order {
  id: number;
  buyerId: number;
  productId: number;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  product?: Product;
  buyer?: AuthUser;
  createdAt: string;
  updatedAt: string;
}
