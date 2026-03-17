import type { UserRole } from './auth';

export interface ProductSeller {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  condition: string;
  category: string;
  stock: number;
  imageUrl: string;
  sellerId?: number | null;
  seller?: ProductSeller | null;
}
