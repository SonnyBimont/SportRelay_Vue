import type { AuthUser } from '../types/auth';

const TOKEN_KEY = 'sportrelay_token';
const USER_KEY = 'sportrelay_user';
const PERSIST_KEY = 'sportrelay_persist';

const getActiveStorage = (): Storage => {
  if (localStorage.getItem(TOKEN_KEY)) {
    return localStorage;
  }
  if (sessionStorage.getItem(TOKEN_KEY)) {
    return sessionStorage;
  }

  const persisted = localStorage.getItem(PERSIST_KEY) === '1';
  return persisted ? localStorage : sessionStorage;
};

const clearStorageBucket = (storage: Storage): void => {
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
};

const clearAllBuckets = (): void => {
  clearStorageBucket(localStorage);
  clearStorageBucket(sessionStorage);
  localStorage.removeItem(PERSIST_KEY);
};

export const getStoredToken = (): string | null => {
  const localToken = localStorage.getItem(TOKEN_KEY);
  if (localToken) {
    localStorage.setItem(PERSIST_KEY, '1');
    return localToken;
  }

  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) {
    localStorage.setItem(PERSIST_KEY, '0');
    return sessionToken;
  }

  const token = null;
  return token;
};

export const setStoredToken = (token: string, persist: boolean): void => {
  clearAllBuckets();
  localStorage.setItem(PERSIST_KEY, persist ? '1' : '0');
  const targetStorage = persist ? localStorage : sessionStorage;
  targetStorage.setItem(TOKEN_KEY, token);
};

export const getStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearAllBuckets();
    return null;
  }
};

export const setStoredUser = (user: AuthUser): void => {
  const targetStorage = getActiveStorage();
  targetStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearStoredSession = (): void => {
  clearAllBuckets();
};
