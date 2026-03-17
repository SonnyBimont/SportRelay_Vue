<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiClient } from '../services/api';
import { setStoredUser } from '../services/authStorage';
import { useAuthStore } from '../stores/auth';
import type { AuthUser } from '../types/auth';
import type { Order } from '../types/order';

const auth = useAuthStore();
const loading = ref(true);
const error = ref<string | null>(null);

const profile = ref<AuthUser | null>(null);
const myOrders = ref<Order[]>([]);
const sales = ref<Order[]>([]);
const profileSaving = ref(false);
const passwordSaving = ref(false);
const avatarSaving = ref(false);
const profileNotice = ref<string | null>(null);
const passwordNotice = ref<string | null>(null);
const avatarNotice = ref<string | null>(null);

const profileForm = ref({
  displayName: '',
  email: '',
});

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const canSeeSales = computed(() => auth.canSell.value);

const totalPurchasesAmount = computed(() => {
  return myOrders.value.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
});

const totalSalesAmount = computed(() => {
  return sales.value.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
});

const formatOrderDate = (value: string) => {
  return new Date(value).toLocaleString();
};

const fetchData = async () => {
  loading.value = true;
  error.value = null;

  try {
    const profilePromise = apiClient.get<AuthUser>('/auth/me');
    const myOrdersPromise = apiClient.get<Order[]>('/orders/my');
    const salesPromise = canSeeSales.value
      ? apiClient.get<Order[]>('/orders/sales')
      : Promise.resolve({ data: [] as Order[] });

    const [profileRes, myOrdersRes, salesRes] = await Promise.all([
      profilePromise,
      myOrdersPromise,
      salesPromise,
    ]);

    profile.value = profileRes.data;
    profileForm.value.displayName = profileRes.data.displayName;
    profileForm.value.email = profileRes.data.email;
    myOrders.value = myOrdersRes.data;
    sales.value = salesRes.data;
  } catch {
    error.value = 'Impossible de charger ton compte pour le moment.';
  } finally {
    loading.value = false;
  }
};

const saveProfile = async () => {
  profileSaving.value = true;
  profileNotice.value = null;

  try {
    const response = await apiClient.patch<AuthUser>('/auth/me', {
      displayName: profileForm.value.displayName,
      email: profileForm.value.email,
    });
    profile.value = response.data;
    profileNotice.value = 'Informations mises a jour.';
    auth.user.value = response.data;
    setStoredUser(response.data);
  } catch {
    profileNotice.value = 'Impossible de mettre a jour les informations.';
  } finally {
    profileSaving.value = false;
  }
};

const uploadAvatar = async (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  avatarSaving.value = true;
  avatarNotice.value = null;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<AuthUser>('/auth/me/avatar', formData);
    profile.value = response.data;
    auth.user.value = response.data;
    setStoredUser(response.data);
    avatarNotice.value = 'Photo de profil mise a jour.';
  } catch {
    avatarNotice.value = 'Mise a jour de la photo impossible.';
  } finally {
    avatarSaving.value = false;
    if (input) {
      input.value = '';
    }
  }
};

const changePassword = async () => {
  passwordSaving.value = true;
  passwordNotice.value = null;

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordNotice.value = 'La confirmation du mot de passe est differente.';
    passwordSaving.value = false;
    return;
  }

  try {
    await apiClient.patch('/auth/password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    passwordNotice.value = 'Mot de passe modifie avec succes.';
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
  } catch {
    passwordNotice.value = 'Modification du mot de passe impossible.';
  } finally {
    passwordSaving.value = false;
  }
};

onMounted(() => {
  void fetchData();
});
</script>

<template>
  <section class="app-shell min-h-screen p-6">
    <header class="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl max-w-5xl mx-auto p-4 flex items-center justify-between mb-6">
      <router-link :to="{ name: 'home' }" class="text-xl font-black text-blue-600 hover:text-blue-700">SportRelay</router-link>
      <div class="flex items-center gap-4">
        <router-link :to="{ name: 'home' }" class="text-sm font-bold text-gray-700 hover:text-blue-600">Accueil</router-link>
        <router-link :to="{ name: 'account' }" class="text-sm font-bold text-blue-600">Mon compte</router-link>
      </div>
    </header>

    <div class="max-w-5xl mx-auto space-y-6">
      <header class="glass-card border rounded-2xl p-6">
        <span class="text-xs font-semibold text-gray-500 uppercase">Compte securise</span>
        <h1 class="text-3xl font-black text-gray-900">Mon compte</h1>
        <p class="text-sm text-gray-500 mt-2">
          Page protegee: informations du profil et historique des commandes.
        </p>
      </header>

      <div v-if="loading" class="bg-white border rounded-2xl p-6 text-gray-500">
        Chargement des donnees de compte...
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
        {{ error }}
      </div>

      <template v-else>
        <section class="glass-card border rounded-2xl p-6">
          <h2 class="text-xl font-bold text-gray-900">Profil</h2>
          <div class="mt-4 flex items-center gap-4">
            <img
              :src="profile?.profileImageUrl || 'https://via.placeholder.com/96'"
              alt="Photo de profil"
              class="h-16 w-16 rounded-full border object-cover bg-gray-100"
            />
            <div>
              <label class="inline-flex cursor-pointer items-center rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black">
                {{ avatarSaving ? 'Upload...' : 'Changer la photo' }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden"
                  :disabled="avatarSaving"
                  @change="uploadAvatar"
                />
              </label>
              <p v-if="avatarNotice" class="mt-2 text-xs text-gray-600">{{ avatarNotice }}</p>
            </div>
          </div>

          <div class="grid md:grid-cols-3 gap-4 mt-4 text-sm">
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-gray-500">Nom</p>
              <p class="font-semibold text-gray-900">{{ profile?.displayName }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-gray-500">Email</p>
              <p class="font-semibold text-gray-900">{{ profile?.email }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-gray-500">Role</p>
              <p class="font-semibold uppercase text-gray-900">{{ profile?.role }}</p>
            </div>
          </div>

          <form @submit.prevent="saveProfile" class="grid md:grid-cols-2 gap-4 mt-6">
            <div>
              <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Nom affiche</label>
              <input v-model="profileForm.displayName" required class="w-full border rounded-lg p-3 bg-white/80" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Email</label>
              <input v-model="profileForm.email" type="email" required class="w-full border rounded-lg p-3 bg-white/80" />
            </div>
            <div class="md:col-span-2 flex items-center gap-3">
              <button :disabled="profileSaving" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold disabled:bg-gray-400">
                {{ profileSaving ? 'Enregistrement...' : 'Mettre a jour le profil' }}
              </button>
              <span v-if="profileNotice" class="text-sm text-gray-600">{{ profileNotice }}</span>
            </div>
          </form>

          <form @submit.prevent="changePassword" class="grid md:grid-cols-3 gap-4 mt-6">
            <div>
              <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Mot de passe actuel</label>
              <input v-model="passwordForm.currentPassword" type="password" required class="w-full border rounded-lg p-3 bg-white/80" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Nouveau mot de passe</label>
              <input v-model="passwordForm.newPassword" type="password" required minlength="8" class="w-full border rounded-lg p-3 bg-white/80" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Confirmer</label>
              <input v-model="passwordForm.confirmPassword" type="password" required minlength="8" class="w-full border rounded-lg p-3 bg-white/80" />
            </div>
            <div class="md:col-span-3 flex items-center gap-3">
              <button :disabled="passwordSaving" class="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold disabled:bg-gray-400">
                {{ passwordSaving ? 'Mise a jour...' : 'Changer le mot de passe' }}
              </button>
              <span v-if="passwordNotice" class="text-sm text-gray-600">{{ passwordNotice }}</span>
            </div>
          </form>
        </section>

        <section class="glass-card border rounded-2xl p-6">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-xl font-bold text-gray-900">Historique achats</h2>
            <p class="text-sm font-semibold text-gray-600">
              Total: {{ totalPurchasesAmount.toFixed(2) }} EUR
            </p>
          </div>

          <div v-if="myOrders.length === 0" class="text-sm text-gray-500 mt-4">
            Aucune commande pour le moment.
          </div>

          <div v-else class="space-y-3 mt-4">
            <article
              v-for="order in myOrders"
              :key="order.id"
              class="border rounded-xl p-4"
            >
              <div class="flex items-start gap-3">
                <img
                  :src="order.product?.imageUrl || 'https://via.placeholder.com/72'"
                  :alt="order.product?.name || 'Produit'"
                  class="h-16 w-16 rounded-lg border object-cover bg-gray-100"
                />
                <div class="min-w-0">
                  <p class="font-semibold text-gray-900">
                    {{ order.product?.name || 'Produit supprime' }}
                  </p>
                  <p class="text-sm text-gray-600 mt-1">
                    Statut: {{ order.status }} | Quantite: {{ order.quantity }} | Total: {{ order.totalPrice }} EUR
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    Date: {{ formatOrderDate(order.createdAt) }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section v-if="canSeeSales" class="glass-card border rounded-2xl p-6">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-xl font-bold text-gray-900">Historique ventes</h2>
            <p class="text-sm font-semibold text-gray-600">
              Total: {{ totalSalesAmount.toFixed(2) }} EUR
            </p>
          </div>

          <div v-if="sales.length === 0" class="text-sm text-gray-500 mt-4">
            Aucune vente pour le moment.
          </div>

          <div v-else class="space-y-3 mt-4">
            <article
              v-for="order in sales"
              :key="`sale-${order.id}`"
              class="border rounded-xl p-4"
            >
              <div class="flex items-start gap-3">
                <img
                  :src="order.product?.imageUrl || 'https://via.placeholder.com/72'"
                  :alt="order.product?.name || 'Produit'"
                  class="h-16 w-16 rounded-lg border object-cover bg-gray-100"
                />
                <div class="min-w-0">
                  <p class="font-semibold text-gray-900">
                    {{ order.product?.name || 'Produit supprime' }}
                  </p>
                  <p class="text-sm text-gray-600 mt-1">
                    Acheteur: {{ order.buyer?.displayName || 'Inconnu' }} | Statut: {{ order.status }} | Total: {{ order.totalPrice }} EUR
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    Date: {{ formatOrderDate(order.createdAt) }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>
