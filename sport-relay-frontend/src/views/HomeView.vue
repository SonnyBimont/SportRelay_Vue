<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiClient } from '../services/api';
import ProductCard from '../components/ProductCard.vue';
import AddProductModal from '../components/AddProductModal.vue';
import { useAuthStore } from '../stores/auth';
import type { Product } from '../types/product';

const products = ref<Product[]>([]);
const selectedCategory = ref('Tous');
const searchQuery = ref(''); 
const categories = ['Tous', 'Cyclisme', 'Randonnée', 'Musculation', 'Tennis']
const loading = ref(true);
const error = ref<string | null>(null);
const isModalOpen = ref(false);
const successToast = ref<string | null>(null);
const auth = useAuthStore();
const router = useRouter();
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const showSuccessToast = (message: string) => {
  successToast.value = message;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    successToast.value = null;
    toastTimer = null;
  }, 3500);
};

const currentUserLabel = computed(() => {
  if (!auth.user.value) {
    return 'Visiteur';
  }
  return `${auth.user.value.displayName} (${auth.user.value.role})`;
});

const sellTooltip = computed(() => {
  if (!auth.isAuthenticated.value) {
    return 'Connecte-toi pour publier une annonce.';
  }
  if (!auth.canSell.value) {
    return 'Action reservee aux vendeurs et admins.';
  }
  return 'Publier une annonce';
});

const sellerHubTooltip = computed(() => {
  if (!auth.isAuthenticated.value) {
    return 'Connecte-toi pour acceder a l espace vendeur.';
  }
  if (!auth.canSell.value) {
    return 'Ton role actuel n autorise pas cette page.';
  }
  return 'Ouvrir l espace vendeur';
});

const filteredProducts = computed(() => {
  return products.value.filter(product => {
    const matchCategory = selectedCategory.value === 'Tous' || product.category === selectedCategory.value;
    const matchSearch = product.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchCategory && matchSearch;
  });
});

const fetchProducts = async () => {
  loading.value = true;
  error.value = null;
  try {
    let response = await apiClient.get<Product[]>('/products');

    if (response.data.length === 0) {
      await apiClient.post('/auth/fake-seed');
      response = await apiClient.get<Product[]>('/products');
    }

    products.value = response.data;
  } catch (err) {
    error.value =
      'Impossible de charger les produits. Verifie que le backend est demarre sur le port 3000.';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const openSellModal = () => {
  if (!auth.isAuthenticated.value) {
    void router.push({ name: 'auth', query: { redirect: '/home' } });
    return;
  }
  if (!auth.canSell.value) {
    alert('Seuls les vendeurs et admins peuvent publier une annonce.');
    return;
  }

  isModalOpen.value = true;
};

const openSellerHub = () => {
  if (!auth.isAuthenticated.value) {
    void router.push({ name: 'auth', query: { redirect: '/seller' } });
    return;
  }
  if (!auth.canSell.value) {
    return;
  }
  void router.push({ name: 'seller-hub' });
};

const logout = () => {
  auth.logout();
  void router.push({ name: 'auth' });
};

const runFakeSeed = async () => {
  loading.value = true;
  error.value = null;
  try {
    await apiClient.post('/auth/fake-seed');
    await fetchProducts();
  } catch {
    error.value = 'Fake seeding impossible. Backend indisponible ou erreur serveur.';
    loading.value = false;
  }
};

const handleProductAdded = async (payload: { name: string }) => {
  await fetchProducts();
  const productName = payload.name?.trim();
  if (productName) {
    showSuccessToast(`Annonce "${productName}" publiee avec succes.`);
    return;
  }
  showSuccessToast('Annonce publiee avec succes.');
};

onMounted(() => {
  fetchProducts();
});

onBeforeUnmount(() => {
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
});
</script>

<template>
  <div class="app-shell min-h-screen">
    <header class="bg-white/70 backdrop-blur-md border-b border-white/60 sticky top-0 z-10">
      <div class="container mx-auto p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <router-link :to="{ name: 'home' }" class="text-2xl font-black text-blue-600 tracking-tight hover:text-blue-700">SportRelay</router-link>
        
        <div class="relative w-full max-w-md">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Rechercher un équipement..." 
            class="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl bg-white/80 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        <div class="flex items-center gap-4">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {{ currentUserLabel }}
          </span>

          <nav class="hidden lg:flex space-x-2">
            <button 
              v-for="cat in categories" 
              :key="cat"
              @click="selectedCategory = cat"
              :class="[
                'px-4 py-2 rounded-full text-xs font-bold uppercase transition-all',
                selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
              ]"
            >
              {{ cat }}
            </button>
          </nav>

          <router-link
            v-if="auth.isAuthenticated"
            :to="{ name: 'account' }"
            class="text-xs font-bold text-gray-600 hover:text-blue-600"
          >
            Mon compte
          </router-link>

          <button
            v-else
            type="button"
            disabled
            title="Connecte-toi pour voir ton compte."
            class="text-xs font-bold text-gray-400 cursor-not-allowed"
          >
            Mon compte
          </button>

          <button
            type="button"
            :disabled="!auth.canSell"
            :title="sellerHubTooltip"
            @click="openSellerHub"
            :class="[
              'text-xs font-bold transition',
              auth.canSell ? 'text-gray-600 hover:text-blue-600' : 'text-gray-400 cursor-not-allowed'
            ]"
          >
            Espace vendeur
          </button>

          <router-link
            v-if="!auth.isAuthenticated"
            :to="{ name: 'auth' }"
            class="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            Se connecter
          </router-link>

          <button
            v-else
            @click="logout"
            class="text-xs font-bold text-red-600 hover:text-red-700"
          >
            Deconnexion
          </button>

          <button 
            @click="openSellModal"
            :disabled="!auth.canSell"
            :title="sellTooltip"
            :class="[
              'px-5 py-2 rounded-xl font-bold transition',
              auth.canSell
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-100'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            ]"
          >
            Vendre
          </button>
        </div>
      </div>
    </header>

    <main class="container mx-auto p-6">
      <div v-if="loading" class="text-center py-20 font-medium text-gray-500">
        Chargement du matériel...
      </div>

      <div v-else-if="error" class="bg-red-50/80 text-red-600 p-4 rounded-xl text-center border border-red-100 space-y-3">
        <p>{{ error }}</p>
        <button
          type="button"
          @click="runFakeSeed"
          class="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold"
        >
          Charger des donnees fake
        </button>
      </div>
      
      <div v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <ProductCard 
            v-for="product in filteredProducts" 
            :key="product.id" 
            :product="product" 
          />
        </div>
        
        <div v-if="filteredProducts.length === 0" class="text-center py-20">
          <p class="text-gray-400 text-lg font-medium">Aucun article ne correspond à votre recherche.</p>
        </div>
      </div>
    </main>

    <AddProductModal 
      v-if="isModalOpen" 
      @close="isModalOpen = false" 
      @product-added="handleProductAdded" 
    />

    <Transition name="toast-fade">
      <div
        v-if="successToast"
        class="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-green-200 bg-white px-4 py-3 shadow-2xl"
      >
        <div class="flex items-start gap-3">
          <span class="mt-0.5 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          <p class="text-sm font-semibold text-gray-800">{{ successToast }}</p>
          <button
            type="button"
            class="ml-auto text-xs font-bold uppercase text-gray-400 hover:text-gray-600"
            @click="successToast = null"
          >
            Fermer
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>