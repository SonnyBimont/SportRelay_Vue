<script setup lang="ts">
import axios from 'axios';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Socket } from 'socket.io-client';
import { useRouter } from 'vue-router';
import { apiClient } from '../services/api';
import { createRealtimeSocket } from '../services/realtime';
import { useAuthStore } from '../stores/auth';
import type { UserRole } from '../types/auth';
import type { Product } from '../types/product';

interface ConversationThread {
  productId: number;
  productName: string;
  productImageUrl: string;
  counterpartId: number;
  counterpartDisplayName: string;
  counterpartRole: UserRole;
  latestMessageId: number;
  latestMessageContent: string;
  latestMessageAt: string;
  latestMessageSenderId: number;
  unreadCount: number;
}

interface PresenceState {
  userId: number;
  online: boolean;
}

interface MineProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const auth = useAuthStore();
const router = useRouter();
const userName = computed(() => auth.user.value?.displayName ?? 'Vendeur');
const loading = ref(true);
const error = ref<string | null>(null);
const products = ref<Product[]>([]);
const conversations = ref<ConversationThread[]>([]);
const loadingConversations = ref(false);
const onlineUserIds = ref<Set<number>>(new Set());
const dismissedConversationKeys = ref<Set<string>>(new Set());
const editingId = ref<number | null>(null);
const isSaving = ref(false);
const deletingId = ref<number | null>(null);
const successMessage = ref<string | null>(null);
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = 6;
const totalCount = ref(0);
const totalPages = ref(1);
const selectedEditFile = ref<File | null>(null);
const editImagePreviewUrl = ref<string | null>(null);
let successTimer: ReturnType<typeof setTimeout> | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let socket: Socket | null = null;

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const form = reactive({
  name: '',
  description: '',
  price: 0,
  stock: 1,
  category: 'Cyclisme',
  condition: 'occasion',
});

const categories = ['Cyclisme', 'Randonnée', 'Musculation', 'Tennis'];
const conditions = ['occasion', 'neuf', 'reconditionne'];
const DISMISSED_CONVERSATIONS_STORAGE_PREFIX = 'seller-hub-dismissed-conversations';

const hasResults = computed(() => products.value.length > 0);
const canGoPrevious = computed(() => currentPage.value > 1);
const canGoNext = computed(() => currentPage.value < totalPages.value);
const visibleConversations = computed(() =>
  conversations.value.filter(
    (thread) => !dismissedConversationKeys.value.has(getConversationDismissKey(thread)),
  ),
);

const dismissedConversationsStorageKey = computed(() => {
  const userId = auth.user.value?.id;
  return `${DISMISSED_CONVERSATIONS_STORAGE_PREFIX}:${userId ?? 'unknown'}`;
});

const getConversationDismissKey = (thread: ConversationThread) =>
  `${thread.productId}:${thread.counterpartId}:${thread.latestMessageId}`;

const dismissConversation = (thread: ConversationThread) => {
  const next = new Set(dismissedConversationKeys.value);
  next.add(getConversationDismissKey(thread));
  dismissedConversationKeys.value = next;
};

const loadDismissedConversations = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = window.localStorage.getItem(dismissedConversationsStorageKey.value);
    if (!raw) {
      dismissedConversationKeys.value = new Set();
      return;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      dismissedConversationKeys.value = new Set();
      return;
    }

    const validKeys = parsed.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
    dismissedConversationKeys.value = new Set(validKeys);
  } catch {
    dismissedConversationKeys.value = new Set();
  }
};

const persistDismissedConversations = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      dismissedConversationsStorageKey.value,
      JSON.stringify(Array.from(dismissedConversationKeys.value)),
    );
  } catch {
    // Ignore localStorage write failures.
  }
};

watch(searchQuery, () => {
  currentPage.value = 1;
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = setTimeout(() => {
    void fetchMyProducts();
  }, 300);
});

watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal) {
    currentPage.value = newTotal;
  }
});

watch(currentPage, () => {
  void fetchMyProducts();
});

watch(dismissedConversationKeys, () => {
  persistDismissedConversations();
});

watch(dismissedConversationsStorageKey, () => {
  loadDismissedConversations();
});

const extractApiMessage = (err: unknown, fallback: string) => {
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

const setSuccess = (message: string) => {
  successMessage.value = message;
  if (successTimer) {
    clearTimeout(successTimer);
  }
  successTimer = setTimeout(() => {
    successMessage.value = null;
    successTimer = null;
  }, 3000);
};

const clearEditImageSelection = () => {
  if (editImagePreviewUrl.value) {
    URL.revokeObjectURL(editImagePreviewUrl.value);
  }
  editImagePreviewUrl.value = null;
  selectedEditFile.value = null;
};

const onEditFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];

  if (!file) {
    clearEditImageSelection();
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    error.value = 'Type de fichier invalide. Formats acceptes: JPEG, PNG, WEBP.';
    clearEditImageSelection();
    if (input) {
      input.value = '';
    }
    return;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    error.value = 'Image trop lourde (max 5 Mo).';
    clearEditImageSelection();
    if (input) {
      input.value = '';
    }
    return;
  }

  error.value = null;
  clearEditImageSelection();
  selectedEditFile.value = file;
  editImagePreviewUrl.value = URL.createObjectURL(file);
};

const goToPreviousPage = () => {
  if (!canGoPrevious.value) {
    return;
  }
  currentPage.value -= 1;
};

const goToNextPage = () => {
  if (!canGoNext.value) {
    return;
  }
  currentPage.value += 1;
};

const fetchConversations = async () => {
  if (!auth.isAuthenticated.value || !auth.canSell.value) {
    conversations.value = [];
    return;
  }

  loadingConversations.value = true;
  try {
    const response = await apiClient.get<ConversationThread[]>('/messages/conversations');
    conversations.value = response.data;
  } catch (err) {
    error.value = extractApiMessage(
      err,
      'Impossible de charger la messagerie vendeur.',
    );
  } finally {
    loadingConversations.value = false;
  }
};

const fetchPresence = async () => {
  const counterpartIds = Array.from(
    new Set(conversations.value.map((thread) => thread.counterpartId)),
  );

  if (counterpartIds.length === 0) {
    onlineUserIds.value = new Set();
    return;
  }

  try {
    const response = await apiClient.get<PresenceState[]>('/messages/presence', {
      params: {
        userIds: counterpartIds.join(','),
      },
    });

    const next = new Set<number>();
    for (const state of response.data) {
      if (state.online) {
        next.add(state.userId);
      }
    }
    onlineUserIds.value = next;
  } catch {
    // Presence is best-effort, keep existing state if the request fails.
  }
};

const openConversation = (thread: ConversationThread) => {
  void router.push({
    name: 'product-detail',
    params: { id: thread.productId },
    query: { withUserId: String(thread.counterpartId) },
  });
};

const teardownSocket = () => {
  if (!socket) {
    return;
  }

  socket.off('conversation-list-updated');
  socket.off('presence-updated');
  socket.disconnect();
  socket = null;
};

const setupSocket = () => {
  if (!auth.isAuthenticated.value || !auth.token.value || !auth.canSell.value) {
    teardownSocket();
    return;
  }

  teardownSocket();
  socket = createRealtimeSocket(auth.token.value);
  socket.on('conversation-list-updated', () => {
    void fetchConversations().then(() => fetchPresence());
  });
  socket.on('presence-updated', (payload: PresenceState) => {
    const next = new Set(onlineUserIds.value);
    if (payload.online) {
      next.add(payload.userId);
    } else {
      next.delete(payload.userId);
    }
    onlineUserIds.value = next;
  });
};

const fetchMyProducts = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get<MineProductsResponse>('/products/mine', {
      params: {
        page: currentPage.value,
        limit: pageSize,
        search: searchQuery.value.trim(),
      },
    });
    products.value = response.data.items;
    totalCount.value = response.data.total;
    totalPages.value = response.data.totalPages;
    currentPage.value = response.data.page;
  } catch (err) {
    error.value = extractApiMessage(
      err,
      'Impossible de charger vos annonces pour le moment.',
    );
    products.value = [];
    totalCount.value = 0;
    totalPages.value = 1;
  } finally {
    loading.value = false;
  }
};

const startEdit = (product: Product) => {
  editingId.value = product.id;
  clearEditImageSelection();
  form.name = product.name;
  form.description = product.description;
  form.price = product.price;
  form.stock = product.stock;
  form.category = product.category;
  form.condition = product.condition;
  error.value = null;
};

const cancelEdit = () => {
  clearEditImageSelection();
  editingId.value = null;
};

const saveEdit = async (productId: number) => {
  if (form.price <= 0) {
    error.value = 'Le prix doit etre superieur a 0.';
    return;
  }
  if (form.stock <= 0) {
    error.value = 'Le stock doit etre superieur a 0.';
    return;
  }

  isSaving.value = true;
  error.value = null;
  try {
    let imageUrl: string | undefined;
    if (selectedEditFile.value) {
      const formData = new FormData();
      formData.append('file', selectedEditFile.value);
      const uploadResponse = await apiClient.post<{ url: string }>(
        '/products/upload',
        formData,
      );
      imageUrl = uploadResponse.data.url;
    }

    await apiClient.patch(`/products/${productId}`, {
      name: form.name,
      description: form.description,
      price: form.price,
      stock: form.stock,
      category: form.category,
      condition: form.condition,
      ...(imageUrl ? { imageUrl } : {}),
    });

    cancelEdit();
    await fetchMyProducts();
    setSuccess('Annonce modifiee avec succes.');
  } catch (err) {
    error.value = extractApiMessage(err, 'Modification impossible pour le moment.');
  } finally {
    isSaving.value = false;
  }
};

const deleteProduct = async (productId: number, productName: string) => {
  const isConfirmed = window.confirm(
    `Supprimer l annonce \"${productName}\" ? Cette action est definitive.`,
  );
  if (!isConfirmed) {
    return;
  }

  deletingId.value = productId;
  error.value = null;
  try {
    await apiClient.delete(`/products/${productId}`);
    await fetchMyProducts();
    if (editingId.value === productId) {
      cancelEdit();
    }
    setSuccess('Annonce supprimee avec succes.');
  } catch (err) {
    error.value = extractApiMessage(err, 'Suppression impossible pour le moment.');
  } finally {
    deletingId.value = null;
  }
};

onMounted(() => {
  loadDismissedConversations();
  fetchMyProducts();
  fetchConversations().then(() => fetchPresence());
  setupSocket();
});

onBeforeUnmount(() => {
  if (successTimer) {
    clearTimeout(successTimer);
  }
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  teardownSocket();
  clearEditImageSelection();
});
</script>

<template>
  <section class="app-shell min-h-screen p-6">
    <div class="glass-card max-w-6xl mx-auto border rounded-2xl p-8">
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 class="text-3xl font-black text-gray-900">Espace Vendeur</h1>
          <p class="text-gray-600 mt-2">Bonjour {{ userName }}, gere tes annonces ici.</p>
        </div>

        <router-link :to="{ name: 'home' }" class="text-blue-600 font-bold">
          ← Retour catalogue
        </router-link>
      </div>

      <p v-if="successMessage" class="mt-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
        {{ successMessage }}
      </p>

      <p v-if="error" class="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        {{ error }}
      </p>

      <section class="mt-6 rounded-2xl border border-gray-200 bg-white/80 p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-black text-gray-900">Inbox vendeur</h2>
          <button
            type="button"
            class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
            @click="fetchConversations"
          >
            Rafraichir
          </button>
        </div>

        <p v-if="loadingConversations" class="mt-3 text-sm text-gray-500">Chargement des conversations...</p>
        <p v-else-if="visibleConversations.length === 0" class="mt-3 text-sm text-gray-500">Aucune conversation pour le moment.</p>

        <ul v-else class="mt-3 space-y-2">
          <li
            v-for="thread in visibleConversations"
            :key="thread.latestMessageId"
            class="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between"
          >
            <div class="flex items-center gap-3">
              <img
                :src="thread.productImageUrl"
                :alt="thread.productName"
                class="h-12 w-12 rounded-lg object-cover bg-gray-100"
              />
              <div>
                <p class="text-sm font-black text-gray-900">{{ thread.productName }}</p>
                <p class="text-xs text-gray-500 flex items-center gap-2">
                  <span
                    class="inline-block h-2 w-2 rounded-full"
                    :class="onlineUserIds.has(thread.counterpartId) ? 'bg-green-500' : 'bg-gray-300'"
                  />
                  {{ thread.counterpartDisplayName }} ({{ thread.counterpartRole }})
                </p>
                <p class="text-xs text-gray-600 truncate max-w-[420px]">{{ thread.latestMessageContent }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button
                type="button"
                class="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-black text-gray-600 hover:bg-gray-100"
                title="Masquer cette conversation"
                @click="dismissConversation(thread)"
              >
                ✓
              </button>
              <span
                v-if="thread.unreadCount > 0"
                class="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white"
              >
                {{ thread.unreadCount }} non lu{{ thread.unreadCount > 1 ? 's' : '' }}
              </span>
              <p class="text-xs text-gray-400">{{ new Date(thread.latestMessageAt).toLocaleString() }}</p>
              <button
                type="button"
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                @click="openConversation(thread)"
              >
                Ouvrir
              </button>
            </div>
          </li>
        </ul>
      </section>

      <div v-if="!loading" class="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher dans mes annonces..."
          class="w-full md:max-w-md rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {{ totalCount }} resultat(s)
        </p>
      </div>

      <div v-if="loading" class="mt-8 text-gray-500 font-medium">
        Chargement de vos annonces...
      </div>

      <div v-else-if="products.length === 0" class="mt-8 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
        Aucune annonce pour le moment. Retourne sur l accueil pour en publier une.
      </div>

      <div v-else-if="!hasResults" class="mt-8 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
        Aucune annonce ne correspond a ta recherche.
      </div>

      <div v-else class="mt-8 space-y-4">
        <article
          v-for="product in products"
          :key="product.id"
          class="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm"
        >
          <div class="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
            <img
              :src="product.imageUrl"
              :alt="product.name"
              class="h-44 w-full rounded-xl object-cover bg-gray-100"
            />

            <div>
              <div v-if="editingId !== product.id" class="space-y-3">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h2 class="text-lg font-black text-gray-900">{{ product.name }}</h2>
                    <p class="text-sm text-gray-500">{{ product.category }} · {{ product.condition }}</p>
                  </div>
                  <p class="text-lg font-black text-gray-900">{{ product.price }} €</p>
                </div>

                <p class="text-sm text-gray-700">{{ product.description }}</p>
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Stock: {{ product.stock }}
                </p>

                <div class="flex gap-2 pt-1">
                  <button
                    type="button"
                    @click="startEdit(product)"
                    class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    :disabled="deletingId === product.id"
                    @click="deleteProduct(product.id, product.name)"
                    class="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:bg-red-300"
                  >
                    {{ deletingId === product.id ? 'Suppression...' : 'Supprimer' }}
                  </button>
                </div>
              </div>

              <form v-else @submit.prevent="saveEdit(product.id)" class="space-y-3">
                <div>
                  <label class="mb-1 block text-xs font-bold uppercase text-gray-500">Nom</label>
                  <input v-model="form.name" type="text" required class="w-full rounded-lg border p-2 bg-gray-50" />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase text-gray-500">Prix (€)</label>
                    <input v-model.number="form.price" type="number" min="1" required class="w-full rounded-lg border p-2 bg-gray-50" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase text-gray-500">Stock</label>
                    <input v-model.number="form.stock" type="number" min="1" required class="w-full rounded-lg border p-2 bg-gray-50" />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase text-gray-500">Categorie</label>
                    <select v-model="form.category" class="w-full rounded-lg border p-2 bg-gray-50">
                      <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase text-gray-500">Etat</label>
                    <select v-model="form.condition" class="w-full rounded-lg border p-2 bg-gray-50">
                      <option v-for="state in conditions" :key="state" :value="state">{{ state }}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-bold uppercase text-gray-500">Description</label>
                  <textarea v-model="form.description" rows="3" required class="w-full rounded-lg border p-2 bg-gray-50"></textarea>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-bold uppercase text-gray-500">Photo (optionnel)</label>
                  <div class="mb-2 h-36 w-full overflow-hidden rounded-lg bg-gray-100">
                    <img
                      :src="editImagePreviewUrl || product.imageUrl"
                      :alt="product.name"
                      class="h-full w-full object-cover"
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="onEditFileChange"
                    class="w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p class="mt-1 text-xs text-gray-500">JPEG, PNG ou WEBP. Taille max 5 Mo.</p>
                </div>

                <div class="flex gap-2 pt-1">
                  <button
                    type="submit"
                    :disabled="isSaving"
                    class="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:bg-green-300"
                  >
                    {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
                  </button>
                  <button
                    type="button"
                    @click="cancelEdit"
                    class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </article>

        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between rounded-xl border border-gray-200 bg-white/80 px-4 py-3"
        >
          <button
            type="button"
            :disabled="!canGoPrevious"
            @click="goToPreviousPage"
            class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Precedent
          </button>

          <p class="text-sm font-semibold text-gray-600">
            Page {{ currentPage }} / {{ totalPages }}
          </p>

          <button
            type="button"
            :disabled="!canGoNext"
            @click="goToNextPage"
            class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
