import { computed, ref } from 'vue';
import { apiClient } from '../services/api';
import {
  clearStoredSession,
  getStoredUser,
  setStoredUser,
} from '../services/authStorage';
import type { AuthResponse, AuthUser, UserRole } from '../types/auth';

const user = ref<AuthUser | null>(getStoredUser());

const isAuthenticated = computed(() => Boolean(user.value));
const role = computed<UserRole | null>(() => user.value?.role ?? null);
const canSell = computed(() => role.value === 'seller' || role.value === 'admin');

const setSession = (payload: AuthResponse, rememberMe: boolean) => {
  user.value = payload.user;
  localStorage.setItem('sportrelay_persist', rememberMe ? '1' : '0');
  setStoredUser(payload.user);
};

const clearSession = () => {
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
    rememberMe: payload.rememberMe,
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
    rememberMe: payload.rememberMe,
  });
  setSession(response.data, payload.rememberMe);
};

const restoreSession = async () => {
  try {
    const response = await apiClient.get<AuthUser>('/auth/me');
    user.value = response.data;
    setStoredUser(response.data);
  } catch {
    clearSession();
  }
};

const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // On force quand meme la deconnexion locale si l'appel echoue.
  }
  clearSession();
};

export const useAuthStore = () => {
  return {
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
