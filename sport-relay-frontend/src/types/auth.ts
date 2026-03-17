export type UserRole = 'buyer' | 'seller' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
