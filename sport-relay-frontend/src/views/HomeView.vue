<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { apiClient } from '../services/api';
import ProductCard from '../components/ProductCard.vue';
import AddProductModal from '../components/AddProductModal.vue';
import { useAuthStore } from '../stores/auth';
import type { Product } from '../types/product';
import type { UserRole } from '../types/auth';

interface OfferNotificationItem {
  id: number;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  buyer?: {
    displayName: string;
  };
  product?: {
    id: number;
    name: string;
  };
}

interface MessageNotificationItem {
  id: number;
  senderId: number;
  recipientId: number;
  readAt?: string | null;
  product?: {
    id: number;
    name: string;
  };
  sender?: {
    displayName: string;
    role: UserRole;
  };
}

interface SaleNotificationItem {
  id: number;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  buyer?: {
    displayName: string;
  };
  product?: {
    id: number;
    name: string;
  };
}

interface ConnectionNotification {
  id: string;
  type: 'offer' | 'purchase' | 'message';
  text: string;
  productId?: number;
  withUserId?: number;
}

const products = ref<Product[]>([]);
const selectedCategory = ref('Tous');
const searchQuery = ref(''); 
const categories = ['Tous', 'Cyclisme', 'Randonnée', 'Musculation', 'Tennis']
const loading = ref(true);
const error = ref<string | null>(null);
const isModalOpen = ref(false);
const successToast = ref<string | null>(null);
const connectionNotifications = ref<ConnectionNotification[]>([]);
const dismissedNotificationIds = ref<Set<string>>(new Set());
const auth = useAuthStore();
const router = useRouter();
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const DISMISSED_NOTIFICATIONS_STORAGE_PREFIX = 'home-dismissed-notifications';

const dismissedNotificationsStorageKey = computed(() => {
  const userId = auth.user.value?.id;
  return userId ? `${DISMISSED_NOTIFICATIONS_STORAGE_PREFIX}:${userId}` : null;
});

const loadDismissedNotifications = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = dismissedNotificationsStorageKey.value;
  if (!storageKey) {
    dismissedNotificationIds.value = new Set();
    return;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      dismissedNotificationIds.value = new Set();
      return;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      dismissedNotificationIds.value = new Set();
      return;
    }

    const validIds = parsed.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
    dismissedNotificationIds.value = new Set(validIds);
  } catch {
    dismissedNotificationIds.value = new Set();
  }
};

const persistDismissedNotifications = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = dismissedNotificationsStorageKey.value;
  if (!storageKey) {
    return;
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(Array.from(dismissedNotificationIds.value)),
    );
  } catch {
    // Ignore localStorage write failures.
  }
};

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

const shouldShowSellerHubButton = computed(
  () => !auth.isAuthenticated.value || auth.role.value !== 'buyer',
);

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

const fetchConnectionNotifications = async () => {
  if (!auth.isAuthenticated.value || !auth.user.value) {
    connectionNotifications.value = [];
    return;
  }

  const notices: ConnectionNotification[] = [];

  if (auth.canSell.value) {
    try {
      const receivedOffers = await apiClient.get<OfferNotificationItem[]>('/offers/received');
      const pendingOffers = receivedOffers.data.filter((offer) => offer.status === 'pending');
      for (const offer of pendingOffers.slice(0, 3)) {
        const productName = offer.product?.name ?? 'un produit';
        const buyerName = offer.buyer?.displayName ?? 'un acheteur';
        notices.push({
          id: `offer-${offer.id}`,
          type: 'offer',
          text: `Nouvelle proposition: ${Number(offer.amount).toFixed(2)} EUR de ${buyerName} sur ${productName}.`,
          productId: offer.product?.id,
        });
      }
    } catch {
      // Best-effort notifications only.
    }

    try {
      const sales = await apiClient.get<SaleNotificationItem[]>('/orders/sales');
      const directPurchases = sales.data.filter((order) => order.status === 'pending');
      for (const order of directPurchases.slice(0, 3)) {
        const productName = order.product?.name ?? 'un produit';
        const buyerName = order.buyer?.displayName ?? 'un acheteur';
        notices.push({
          id: `purchase-${order.id}`,
          type: 'purchase',
          text: `Achat direct: ${buyerName} a achete ${order.quantity} x ${productName} (${Number(order.totalPrice).toFixed(2)} EUR).`,
          productId: order.product?.id,
        });
      }
    } catch {
      // Best-effort notifications only.
    }
  }

  try {
    const myMessages = await apiClient.get<MessageNotificationItem[]>('/messages/my');
    const unreadMessages = myMessages.data.filter(
      (message) => message.recipientId === auth.user.value!.id && !message.readAt,
    );

    const perProductCounts = new Map<string, number>();
    const productIds = new Map<string, number | undefined>();
    const counterpartIds = new Map<string, number | undefined>();
    const counterpartNames = new Map<string, string | undefined>();
    for (const message of unreadMessages) {
      const productKey = `${message.product?.id ?? 0}:${message.senderId}`;
      perProductCounts.set(productKey, (perProductCounts.get(productKey) ?? 0) + 1);
      if (!productIds.has(productKey)) {
        productIds.set(productKey, message.product?.id);
      }
      if (!counterpartIds.has(productKey)) {
        counterpartIds.set(productKey, message.senderId);
      }
      if (!counterpartNames.has(productKey)) {
        counterpartNames.set(productKey, message.sender?.displayName);
      }
    }

    for (const [productKey, count] of perProductCounts.entries()) {
      const productId = productIds.get(productKey);
      const withUserId = counterpartIds.get(productKey);
      const displayName = counterpartNames.get(productKey);
      const productName =
        unreadMessages.find(
          (message) => `${message.product?.id ?? 0}:${message.senderId}` === productKey,
        )?.product?.name ?? 'une annonce';

      notices.push({
        id: `message-${productKey}`,
        type: 'message',
        text: `Nouveau message: ${count} non lu(s) de ${displayName ?? 'un acheteur'} sur ${productName}.`,
        productId,
        withUserId,
      });
    }
  } catch {
    // Best-effort notifications only.
  }

  connectionNotifications.value = notices
    .filter((notice) => !dismissedNotificationIds.value.has(notice.id))
    .slice(0, 5);
};

const dismissNotification = (notificationId: string) => {
  const next = new Set(dismissedNotificationIds.value);
  next.add(notificationId);
  dismissedNotificationIds.value = next;
  connectionNotifications.value = connectionNotifications.value.filter(
    (item) => item.id !== notificationId,
  );
};

const openNotificationProduct = (notification: ConnectionNotification) => {
  dismissNotification(notification.id);

  if (!notification.productId) {
    return;
  }
  void router.push({
    name: 'product-detail',
    params: { id: notification.productId },
    query:
      notification.type === 'message' && notification.withUserId
        ? { withUserId: String(notification.withUserId) }
        : undefined,
  });
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
  loadDismissedNotifications();
  void fetchProducts();
  void fetchConnectionNotifications();
});

watch(dismissedNotificationIds, () => {
  persistDismissedNotifications();
});

watch(dismissedNotificationsStorageKey, () => {
  loadDismissedNotifications();
  void fetchConnectionNotifications();
});

watch(
  () => auth.isAuthenticated.value,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      dismissedNotificationIds.value = new Set();
      connectionNotifications.value = [];
      return;
    }
    loadDismissedNotifications();
    void fetchConnectionNotifications();
  },
);

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
            v-if="shouldShowSellerHubButton"
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
      <div
        v-if="connectionNotifications.length > 0"
        class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <p class="text-sm font-black text-amber-800">Notifications a la connexion</p>
        <ul class="mt-2 space-y-1">
          <li
            v-for="notification in connectionNotifications"
            :key="notification.id"
            class="text-sm flex items-start gap-2"
          >
            <button
              v-if="notification.productId"
              type="button"
              class="font-semibold text-amber-800 underline decoration-amber-500 underline-offset-2 hover:text-amber-900"
              @click="openNotificationProduct(notification)"
            >
              {{ notification.text }}
            </button>
            <span v-else class="font-medium text-amber-700">
              {{ notification.text }}
            </span>
            <button
              type="button"
              class="ml-auto rounded border border-amber-300 bg-white/70 px-1.5 py-0.5 text-[10px] font-black text-amber-700 hover:bg-white"
              title="Masquer"
              @click="dismissNotification(notification.id)"
            >
              ✓
            </button>
          </li>
        </ul>
      </div>

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