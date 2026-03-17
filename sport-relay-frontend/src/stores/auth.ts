import { computed, ref } from 'vue';
import { apiClient } from '../services/api';
import {
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../services/authStorage';
import type { AuthResponse, AuthUser, UserRole } from '../types/auth';

const token = ref<string | null>(getStoredToken());
const user = ref<AuthUser | null>(getStoredUser());

const isAuthenticated = computed(() => Boolean(token.value && user.value));
const role = computed<UserRole | null>(() => user.value?.role ?? null);
const canSell = computed(() => role.value === 'seller' || role.value === 'admin');

const setSession = (payload: AuthResponse, rememberMe: boolean) => {
  token.value = payload.accessToken;
  user.value = payload.user;
  setStoredToken(payload.accessToken, rememberMe);
  setStoredUser(payload.user);
};

const clearSession = () => {
  token.value = null;
  user.value = null;
  clearStoredSession();
};

const register = async (payload: {
  email: string;
  password: string;
  displayName: string;
  role: Exclude<UserRole, 'admin'>;
  rememberMe: boolean;
}) => {
  const response = await apiClient.post<AuthResponse>('/auth/register', {
    email: payload.email,
    password: payload.password,
    displayName: payload.displayName,
    role: payload.role,
  });
  setSession(response.data, payload.rememberMe);
};

const login = async (payload: {
  email: string;
  password: string;
  rememberMe: boolean;
}) => {
  const response = await apiClient.post<AuthResponse>('/auth/login', {
    email: payload.email,
    password: payload.password,
  });
  setSession(response.data, payload.rememberMe);
};

const restoreSession = async () => {
  if (!token.value) {
    return;
  }

  try {
    const response = await apiClient.get<AuthUser>('/auth/me');
    user.value = response.data;
    setStoredUser(response.data);
  } catch {
    clearSession();
  }
};

const logout = () => {
  clearSession();
};

export const useAuthStore = () => {
  return {
    token,
    user,
    role,
    canSell,
    isAuthenticated,
    register,
    login,
    restoreSession,
    logout,
  };
};
