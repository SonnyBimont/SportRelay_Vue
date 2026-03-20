import axios from 'axios';
import { clearStoredSession } from './authStorage';

// Créer une instance d'axios avec une configuration de base
// proxy defini dans vite.config.ts redirige les requetes de /api vers http://localhost:3000 (backend)
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
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