import axios from 'axios';

// Créer une instance d'axios avec une configuration de base
// proxy defini dans vite.config.ts redirige les requetes de /api vers http://localhost:3000 (backend)
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});