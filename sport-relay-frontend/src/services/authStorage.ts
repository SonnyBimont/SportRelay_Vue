import type { AuthUser } from '../types/auth';

const USER_KEY = 'sportrelay_user';
const PERSIST_KEY = 'sportrelay_persist';

const getActiveStorage = (): Storage => {
  const persisted = localStorage.getItem(PERSIST_KEY) === '1';
  return persisted ? localStorage : sessionStorage;
};

const clearStorageBucket = (storage: Storage): void => {
  storage.removeItem(USER_KEY);
};

const clearAllBuckets = (): void => {
  clearStorageBucket(localStorage);
  clearStorageBucket(sessionStorage);
  localStorage.removeItem(PERSIST_KEY);
};

export const getStoredToken = (): string | null => {
  // Le token n'est plus exposé au JavaScript (cookie HttpOnly).
  return null;
};

export const setStoredToken = (token: string, persist: boolean): void => {
  void token;
  localStorage.setItem(PERSIST_KEY, persist ? '1' : '0');
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
