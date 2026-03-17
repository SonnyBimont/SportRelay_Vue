<script setup lang="ts">
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

      <h1 class="text-2xl font-black text-gray-900">Authentification</h1>
      <p class="text-sm text-gray-500 mt-2">Connecte-toi pour vendre, commander et acceder aux pages protegees.</p>

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
        <input v-model="loginForm.password" type="password" required placeholder="Mot de passe" class="w-full border rounded-lg p-3" />
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input v-model="rememberMe" type="checkbox" class="accent-blue-600" />
          Se souvenir de moi (session persistante)
        </label>
        <button :disabled="loading" type="submit" class="w-full bg-blue-600 text-white rounded-lg py-3 font-bold disabled:bg-gray-400">
          {{ loading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <form v-else @submit.prevent="submitRegister" class="space-y-4 mt-6">
        <input v-model="registerForm.displayName" type="text" required placeholder="Nom affiche" class="w-full border rounded-lg p-3" />
        <input v-model="registerForm.email" type="email" required placeholder="Email" class="w-full border rounded-lg p-3" />
        <input v-model="registerForm.password" type="password" required placeholder="Mot de passe" class="w-full border rounded-lg p-3" />
        <select v-model="registerForm.role" class="w-full border rounded-lg p-3">
          <option value="buyer">Acheteur</option>
          <option value="seller">Vendeur</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input v-model="rememberMe" type="checkbox" class="accent-blue-600" />
          Se souvenir de moi (session persistante)
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
