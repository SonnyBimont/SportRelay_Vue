<script setup lang="ts">
import axios from 'axios';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiClient } from '../services/api';
import { useAuthStore } from '../stores/auth';
import type { UserRole } from '../types/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const mode = ref<'login' | 'register'>('login');
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const seedResult = ref<string | null>(null);
const rememberMe = ref(false);
const currentUser = computed(() => auth.user.value);

const showLoginPassword = ref(false);
const showRegisterPassword = ref(false);
const showResetPassword = ref(false);
const forgotPanelOpen = ref(false);
const forgotLoading = ref(false);
const forgotEmail = ref('');
const resetToken = ref('');
const resetNewPassword = ref('');
const forgotHint = ref<string | null>(null);

const loginForm = ref({
  email: '',
  password: '',
});

const registerForm = ref({
  email: '',
  password: '',
  displayName: '',
  role: 'buyer' as Exclude<UserRole, 'admin'>,
});

const redirectTarget = computed(() => {
  const raw = route.query.redirect;
  return typeof raw === 'string' && raw.length > 0 ? raw : '/home';
});

const extractApiMessage = (err: unknown, fallback: string): string => {
  if (!axios.isAxiosError(err)) {
    return fallback;
  }

  const responseData = err.response?.data as
    | { message?: string | string[] }
    | undefined;

  if (Array.isArray(responseData?.message) && responseData.message.length > 0) {
    return responseData.message.join(' | ');
  }

  if (typeof responseData?.message === 'string' && responseData.message.length > 0) {
    return responseData.message;
  }

  return fallback;
};

const disconnectAndStayHere = () => {
  auth.logout();
  loginForm.value = { email: '', password: '' };
  registerForm.value = {
    email: '',
    password: '',
    displayName: '',
    role: 'buyer',
  };
  mode.value = 'login';
  success.value = 'Session fermee. Connecte-toi avec un autre compte.';
};

const toggleForgotPanel = () => {
  forgotPanelOpen.value = !forgotPanelOpen.value;
  forgotHint.value = null;
  error.value = null;
};

const submitForgotPassword = async () => {
  forgotLoading.value = true;
  error.value = null;
  success.value = null;
  forgotHint.value = null;

  try {
    const response = await apiClient.post<{
      message: string;
      resetToken?: string;
    }>('/auth/forgot-password', {
      email: forgotEmail.value,
    });

    forgotHint.value = response.data.message;
    if (response.data.resetToken) {
      resetToken.value = response.data.resetToken;
      forgotHint.value =
        'Token de reinitialisation genere (mode test). Tu peux maintenant definir un nouveau mot de passe.';
    }
  } catch (err) {
    error.value = extractApiMessage(
      err,
      'Impossible de lancer la reinitialisation pour le moment.',
    );
  } finally {
    forgotLoading.value = false;
  }
};

const submitResetPassword = async () => {
  forgotLoading.value = true;
  error.value = null;
  success.value = null;

  try {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', {
      token: resetToken.value,
      newPassword: resetNewPassword.value,
    });

    success.value = response.data.message;
    forgotPanelOpen.value = false;
    forgotHint.value = null;
    resetToken.value = '';
    resetNewPassword.value = '';
    mode.value = 'login';
  } catch (err) {
    error.value = extractApiMessage(
      err,
      'Impossible de reinitialiser le mot de passe.',
    );
  } finally {
    forgotLoading.value = false;
  }
};

const submitLogin = async () => {
  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    await auth.login({
      ...loginForm.value,
      rememberMe: rememberMe.value,
    });
    await router.push(redirectTarget.value);
  } catch {
    error.value = 'Connexion invalide. Verifie email et mot de passe.';
  } finally {
    loading.value = false;
  }
};

const submitRegister = async () => {
  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    await auth.register({
      ...registerForm.value,
      rememberMe: rememberMe.value,
    });
    success.value = 'Compte cree avec succes.';
    await router.push('/home');
  } catch {
    error.value = 'Inscription impossible. Verifie les informations.';
  } finally {
    loading.value = false;
  }
};

const runFakeSeed = async () => {
  loading.value = true;
  error.value = null;
  success.value = null;
  seedResult.value = null;

  try {
    const response = await apiClient.post('/auth/fake-seed');
    seedResult.value = JSON.stringify(response.data, null, 2);
    success.value = 'Fake seeding execute. Tu peux te connecter avec les comptes de demo.';
  } catch {
    error.value = 'Le fake seeding a echoue.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <section class="app-shell min-h-screen flex items-center justify-center p-6">
    <div class="glass-card w-full max-w-xl border rounded-2xl shadow-sm p-8">
      <div
        v-if="auth.isAuthenticated"
        class="mb-6 p-4 rounded-xl border border-blue-100 bg-blue-50"
      >
        <p class="text-sm text-blue-900 font-semibold">
          Session active: {{ currentUser?.displayName }} ({{ currentUser?.role }})
        </p>
        <div class="flex gap-3 mt-3">
          <router-link
            to="/home"
            class="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold"
          >
            Continuer
          </router-link>
          <button
            type="button"
            @click="disconnectAndStayHere"
            class="px-3 py-2 rounded-lg bg-white border text-sm font-bold text-gray-700"
          >
            Changer de compte
          </button>
        </div>
      </div>

      <p class="text-lg font-black tracking-[0.5em] text-blue-500 uppercase">Sport Relay</p>
      <h1 class="text-2xl font-black text-gray-900 mt-2">Authentification</h1>
      <p class="text-sm text-gray-500 mt-2">Connecte-toi ou inscris-toi pour vendre et acheter.</p>

      <div class="flex gap-2 mt-6">
        <button
          @click="mode = 'login'"
          :class="['px-4 py-2 rounded-lg text-sm font-bold', mode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600']"
        >
          Connexion
        </button>
        <button
          @click="mode = 'register'"
          :class="['px-4 py-2 rounded-lg text-sm font-bold', mode === 'register' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600']"
        >
          Inscription
        </button>
      </div>

      <form v-if="mode === 'login'" @submit.prevent="submitLogin" class="space-y-4 mt-6">
        <input v-model="loginForm.email" type="email" required placeholder="Email" class="w-full border rounded-lg p-3" />
        <div class="relative">
          <input
            v-model="loginForm.password"
            :type="showLoginPassword ? 'text' : 'password'"
            required
            placeholder="Mot de passe"
            class="w-full border rounded-lg p-3 pr-28"
          />
          <button
            type="button"
            @click="showLoginPassword = !showLoginPassword"
            :aria-label="showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-blue-700 bg-blue-50 rounded-md p-2"
          >
            <svg
              v-if="!showLoginPassword"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              class="h-4 w-4"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.27 2.943 9.542 7-1.273 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              class="h-4 w-4"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.584 10.587A2 2 0 0012 14a2 2 0 001.414-.586" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.363 5.365A9.466 9.466 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.132 5.411" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.228 6.228A9.965 9.965 0 002.458 12c1.274 4.057 5.065 7 9.542 7a9.45 9.45 0 004.213-.97" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          @click="toggleForgotPanel"
          class="text-sm text-blue-700 hover:text-blue-900 font-semibold"
        >
          {{ forgotPanelOpen ? 'Fermer' : 'Mot de passe oublie ?' }}
        </button>

        <div v-if="forgotPanelOpen" class="border rounded-xl p-4 bg-blue-50 space-y-3">
          <p class="text-sm font-semibold text-blue-900">Reinitialiser le mot de passe</p>

          <div class="space-y-2">
            <input
              v-model="forgotEmail"
              type="email"
              required
              placeholder="Email du compte"
              class="w-full border rounded-lg p-2"
            />
            <button
              type="button"
              @click="submitForgotPassword"
              :disabled="forgotLoading"
              class="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold disabled:bg-gray-400"
            >
              {{ forgotLoading ? 'Envoi...' : 'Recevoir un token de reinitialisation' }}
            </button>
          </div>

          <p v-if="forgotHint" class="text-xs text-blue-800">{{ forgotHint }}</p>

          <div class="space-y-2 pt-2 border-t">
            <input
              v-model="resetToken"
              type="text"
              required
              placeholder="Token de reinitialisation"
              class="w-full border rounded-lg p-2"
            />
            <div class="relative">
              <input
                v-model="resetNewPassword"
                :type="showResetPassword ? 'text' : 'password'"
                required
                placeholder="Nouveau mot de passe"
                class="w-full border rounded-lg p-2 pr-24"
              />
              <button
                type="button"
                @click="showResetPassword = !showResetPassword"
                :aria-label="showResetPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-blue-700 bg-blue-50 rounded-md p-2"
              >
                <svg
                  v-if="!showResetPassword"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  class="h-4 w-4"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.27 2.943 9.542 7-1.273 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  class="h-4 w-4"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.584 10.587A2 2 0 0012 14a2 2 0 001.414-.586" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.363 5.365A9.466 9.466 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.132 5.411" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.228 6.228A9.965 9.965 0 002.458 12c1.274 4.057 5.065 7 9.542 7a9.45 9.45 0 004.213-.97" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              @click="submitResetPassword"
              :disabled="forgotLoading"
              class="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-bold disabled:bg-gray-400"
            >
              {{ forgotLoading ? 'Traitement...' : 'Definir le nouveau mot de passe' }}
            </button>
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input v-model="rememberMe" type="checkbox" class="accent-blue-600" />
          Se souvenir de moi
        </label>
        <button :disabled="loading" type="submit" class="w-full bg-blue-600 text-white rounded-lg py-3 font-bold disabled:bg-gray-400">
          {{ loading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <form v-else @submit.prevent="submitRegister" class="space-y-4 mt-6">
        <input v-model="registerForm.displayName" type="text" required placeholder="Nom affiche" class="w-full border rounded-lg p-3" />
        <input v-model="registerForm.email" type="email" required placeholder="Email" class="w-full border rounded-lg p-3" />
        <div class="relative">
          <input
            v-model="registerForm.password"
            :type="showRegisterPassword ? 'text' : 'password'"
            required
            placeholder="Mot de passe"
            class="w-full border rounded-lg p-3 pr-28"
          />
          <button
            type="button"
            @click="showRegisterPassword = !showRegisterPassword"
            :aria-label="showRegisterPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-blue-700 bg-blue-50 rounded-md p-2"
          >
            <svg
              v-if="!showRegisterPassword"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              class="h-4 w-4"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.27 2.943 9.542 7-1.273 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              class="h-4 w-4"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.584 10.587A2 2 0 0012 14a2 2 0 001.414-.586" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.363 5.365A9.466 9.466 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.132 5.411" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.228 6.228A9.965 9.965 0 002.458 12c1.274 4.057 5.065 7 9.542 7a9.45 9.45 0 004.213-.97" />
            </svg>
          </button>
        </div>
        <select v-model="registerForm.role" class="w-full border rounded-lg p-3">
          <option value="buyer">Acheteur</option>
          <option value="seller">Vendeur</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input v-model="rememberMe" type="checkbox" class="accent-blue-600" />
          Se souvenir de moi
        </label>
        <button :disabled="loading" type="submit" class="w-full bg-blue-600 text-white rounded-lg py-3 font-bold disabled:bg-gray-400">
          {{ loading ? 'Inscription...' : 'Creer mon compte' }}
        </button>
      </form>

      <div class="mt-6 border-t pt-6">
        <button
          @click="runFakeSeed"
          :disabled="loading"
          type="button"
          class="w-full bg-gray-900 text-white rounded-lg py-3 font-bold disabled:bg-gray-400"
        >
          Lancer un fake seeding (users + produits)
        </button>
      </div>

      <p v-if="error" class="text-sm text-red-600 mt-4">{{ error }}</p>
      <p v-if="success" class="text-sm text-green-600 mt-4">{{ success }}</p>

      <pre v-if="seedResult" class="mt-4 p-3 bg-gray-100 text-xs rounded-lg overflow-auto max-h-60">{{ seedResult }}</pre>
    </div>
  </section>
</template>
