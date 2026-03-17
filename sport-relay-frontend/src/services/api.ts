import axios from 'axios';
import { clearStoredSession, getStoredToken } from './authStorage';

// Créer une instance d'axios avec une configuration de base
// proxy defini dans vite.config.ts redirige les requetes de /api vers http://localhost:3000 (backend)
export const apiClient = axios.create({
  baseURL: '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearStoredSession();
    }
    return Promise.reject(error);
  },
);