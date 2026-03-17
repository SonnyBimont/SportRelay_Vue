export interface JwtUser {
  sub: number;
  email: string;
  role: 'buyer' | 'seller' | 'admin';
}
