<script setup lang="ts">
import axios from "axios";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Socket } from "socket.io-client";
import { apiClient } from "../services/api";
import { createRealtimeSocket } from "../services/realtime";
import { useAuthStore } from "../stores/auth";
import type { Product } from "../types/product";
import type { UserRole } from "../types/auth";
import { getCategoryBadgeClass } from "../utils/categoryBadge";

interface ApiUser {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
}

interface OfferItem {
  id: number;
  productId: number;
  buyerId: number;
  amount: number;
  quantity: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "paid";
  sellerResponse: string | null;
  createdAt: string;
  buyer?: ApiUser;
}

interface MessageItem {
  id: number;
  productId: number;
  senderId: number;
  recipientId: number;
  content: string;
  createdAt: string;
  readAt?: string | null;
  sender?: ApiUser;
  recipient?: ApiUser;
}

interface PresenceState {
  userId: number;
  online: boolean;
}

interface FavoriteIdsResponse {
  productIds: number[];
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const currentUser = computed(() => auth.user.value);
const product = ref<Product | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const actionMessage = ref<string | null>(null);
const buying = ref(false);
const sendingOffer = ref(false);
const updatingOfferId = ref<number | null>(null);
const quantity = ref(1);
const offerPrice = ref<number | null>(null);
const offerQuantity = ref(1);
const offerMessage = ref("");
const chatInput = ref("");
const offers = ref<OfferItem[]>([]);
const messages = ref<MessageItem[]>([]);
const loadingInteractions = ref(false);
const selectedRecipientId = ref<number | null>(null);
const onlineUserIds = ref<Set<number>>(new Set());
const favoriteLoading = ref(false);
const isFavorite = ref(false);
let socket: Socket | null = null;

const canInteract = computed(() => {
  if (!product.value || !auth.user.value) {
    return false;
  }
  return product.value.sellerId !== auth.user.value.id;
});

const isSellerView = computed(() => {
  if (!product.value || !auth.user.value) {
    return false;
  }
  return product.value.sellerId === auth.user.value.id;
});

const sortedMessages = computed(() => {
  return [...messages.value].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
});

const recipientOptions = computed(() => {
  if (!auth.user.value) {
    return [] as ApiUser[];
  }

  const map = new Map<number, ApiUser>();

  for (const offer of offers.value) {
    if (offer.buyer && offer.buyer.id !== auth.user.value.id) {
      map.set(offer.buyer.id, offer.buyer);
    }
  }

  for (const message of messages.value) {
    if (message.sender && message.sender.id !== auth.user.value.id) {
      map.set(message.sender.id, message.sender);
    }
    if (message.recipient && message.recipient.id !== auth.user.value.id) {
      map.set(message.recipient.id, message.recipient);
    }
  }

  return Array.from(map.values());
});

const resolvedRecipientId = computed(() => {
  if (!product.value || !auth.user.value) {
    return null;
  }

  if (!isSellerView.value) {
    return product.value.sellerId ?? null;
  }

  if (selectedRecipientId.value) {
    return selectedRecipientId.value;
  }

  return recipientOptions.value[0]?.id ?? null;
});

const sellerOnline = computed(() => {
  const sellerId = Number(product.value?.sellerId ?? 0);
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return false;
  }
  return onlineUserIds.value.has(sellerId);
});

const canBuyNow = computed(() => {
  if (!product.value) {
    return false;
  }
  return canInteract.value && product.value.stock > 0;
});

const canSendOffer = computed(() => {
  if (!product.value) {
    return false;
  }
  return canInteract.value && product.value.stock > 0;
});

const extractApiMessage = (err: unknown, fallback: string) => {
  if (!axios.isAxiosError(err)) {
    return fallback;
  }

  const responseData = err.response?.data as
    | { message?: string | string[] }
    | undefined;

  if (Array.isArray(responseData?.message) && responseData.message.length > 0) {
    return responseData.message.join(" | ");
  }

  if (
    typeof responseData?.message === "string" &&
    responseData.message.length > 0
  ) {
    return responseData.message;
  }

  return fallback;
};

const requireAuthOrRedirect = () => {
  if (auth.isAuthenticated.value) {
    return true;
  }

  void router.push({
    name: "auth",
    query: { redirect: route.fullPath },
  });
  return false;
};

const fetchProduct = async () => {
  const response = await apiClient.get<Product>(`/products/${route.params.id}`);
  product.value = response.data;
};

const fetchFavoriteState = async () => {
  if (!auth.isAuthenticated.value || !product.value) {
    isFavorite.value = false;
    return;
  }

  try {
    const response = await apiClient.get<FavoriteIdsResponse>('/favorites/my');
    isFavorite.value = response.data.productIds.includes(product.value.id);
  } catch {
    isFavorite.value = false;
  }
};

const toggleFavorite = async () => {
  if (!product.value) {
    return;
  }

  if (!requireAuthOrRedirect()) {
    return;
  }

  favoriteLoading.value = true;
  try {
    if (isFavorite.value) {
      await apiClient.delete(`/favorites/${product.value.id}`);
      isFavorite.value = false;
      actionMessage.value = 'Retire des favoris.';
    } else {
      await apiClient.post(`/favorites/${product.value.id}`);
      isFavorite.value = true;
      actionMessage.value = 'Ajoute aux favoris.';
    }
  } catch {
    error.value = 'Impossible de mettre a jour les favoris pour le moment.';
  } finally {
    favoriteLoading.value = false;
  }
};

const fetchOffers = async () => {
  if (!product.value || !auth.isAuthenticated.value) {
    offers.value = [];
    return;
  }

  const response = await apiClient.get<OfferItem[]>(
    `/offers/product/${product.value.id}`,
  );
  offers.value = response.data;
};

const fetchMessages = async () => {
  if (!product.value || !auth.isAuthenticated.value) {
    messages.value = [];
    return;
  }

  const params: Record<string, number> = {};
  if (isSellerView.value && selectedRecipientId.value) {
    params.withUserId = selectedRecipientId.value;
  }

  const response = await apiClient.get<MessageItem[]>(
    `/messages/product/${product.value.id}`,
    { params },
  );
  messages.value = response.data;
};

const fetchPresence = async () => {
  const ids = new Set<number>();

  const sellerId = Number(product.value?.sellerId ?? 0);
  if (Number.isFinite(sellerId) && sellerId > 0) {
    ids.add(sellerId);
  }

  for (const recipient of recipientOptions.value) {
    ids.add(recipient.id);
  }

  if (ids.size === 0) {
    onlineUserIds.value = new Set();
    return;
  }

  try {
    const response = await apiClient.get<PresenceState[]>(
      "/messages/presence",
      {
        params: {
          userIds: Array.from(ids).join(","),
        },
      },
    );

    const next = new Set<number>();
    for (const state of response.data) {
      if (state.online) {
        next.add(state.userId);
      }
    }
    onlineUserIds.value = next;
  } catch {
    // Presence is best-effort.
  }
};

const markCurrentConversationAsRead = async () => {
  if (!auth.isAuthenticated.value || !product.value || !auth.user.value) {
    return;
  }

  const withUserId = resolvedRecipientId.value;
  if (!withUserId) {
    return;
  }

  const hasUnreadForCurrentUser = messages.value.some(
    (message) =>
      message.recipientId === auth.user.value!.id &&
      message.senderId === withUserId &&
      !message.readAt,
  );

  if (!hasUnreadForCurrentUser) {
    return;
  }

  try {
    await apiClient.post("/messages/read", {
      productId: product.value.id,
      withUserId,
    });
  } catch {
    // Read receipts are best-effort.
  }
};

const refreshInteractions = async () => {
  if (!auth.isAuthenticated.value) {
    offers.value = [];
    messages.value = [];
    return;
  }

  loadingInteractions.value = true;
  try {
    await Promise.allSettled([fetchProduct(), fetchOffers(), fetchMessages()]);
    await fetchPresence();
    await markCurrentConversationAsRead();
  } finally {
    loadingInteractions.value = false;
  }
};

const applyRouteConversationQuery = () => {
  const raw = route.query.withUserId;
  const maybeValue = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(maybeValue) && maybeValue > 0) {
    selectedRecipientId.value = maybeValue;
  }
};

const teardownSocket = () => {
  if (!socket) {
    return;
  }

  if (product.value) {
    socket.emit("leave-product", { productId: product.value.id });
  }

  socket.off("connect");
  socket.off("message-created");
  socket.off("offer-updated");
  socket.off("messages-read");
  socket.off("presence-updated");
  socket.disconnect();
  socket = null;
};

const setupSocket = () => {
  if (!auth.isAuthenticated.value || !auth.token.value || !product.value) {
    teardownSocket();
    return;
  }

  teardownSocket();
  socket = createRealtimeSocket(auth.token.value);

  socket.on("connect", () => {
    if (!product.value || !socket) {
      return;
    }
    socket.emit("join-product", { productId: product.value.id });
  });

  socket.on("message-created", () => {
    void fetchMessages();
  });

  socket.on("offer-updated", () => {
    void Promise.allSettled([fetchProduct(), fetchOffers()]);
  });

  socket.on("messages-read", () => {
    void fetchMessages();
  });

  socket.on("presence-updated", (payload: PresenceState) => {
    const next = new Set(onlineUserIds.value);
    if (payload.online) {
      next.add(payload.userId);
    } else {
      next.delete(payload.userId);
    }
    onlineUserIds.value = next;
  });
};

const handlePayment = async (
  qty: number,
  options?: { isOffer?: boolean; offerId?: number },
) => {
  if (!product.value) return;

  if (!requireAuthOrRedirect()) {
    return;
  }

  if (!Number.isInteger(qty) || qty <= 0) {
    error.value = "La quantite doit etre superieure a 0.";
    return;
  }

  if (!options?.isOffer && qty > product.value.stock) {
    error.value = "Stock insuffisant pour cette quantite.";
    return;
  }

  buying.value = true;
  try {
    const response = await apiClient.post("/payments/create-checkout-session", {
      productId: product.value.id,
      quantity: qty,
      isOffer: Boolean(options?.isOffer),
      offerId: options?.offerId,
    });

    if (response.data.url) {
      window.location.href = response.data.url;
    }
  } catch (err) {
    error.value = "Erreur lors de l'initialisation du paiement.";
  } finally {
    buying.value = false;
  }
};

const sendOffer = async () => {
  error.value = null;
  actionMessage.value = null;

  if (!requireAuthOrRedirect()) {
    return;
  }

  if (!canInteract.value) {
    error.value = "Tu ne peux pas faire une offre sur ta propre annonce.";
    return;
  }

  if (!canSendOffer.value) {
    error.value = "Cette annonce n accepte plus d offres.";
    return;
  }

  if (!product.value) {
    return;
  }

  if (!offerPrice.value || offerPrice.value <= 0) {
    error.value = "Entre un montant d offre valide.";
    return;
  }

  if (
    !product.value ||
    !Number.isInteger(offerQuantity.value) ||
    offerQuantity.value <= 0
  ) {
    error.value = "Entre une quantite d offre valide.";
    return;
  }

  if (offerQuantity.value > product.value.stock) {
    error.value = "La quantite demandee depasse le stock disponible.";
    return;
  }

  sendingOffer.value = true;
  try {
    await apiClient.post("/offers", {
      productId: product.value.id,
      amount: offerPrice.value,
      quantity: offerQuantity.value,
      message: offerMessage.value.trim(),
    });

    actionMessage.value = "Offre envoyee au vendeur.";
    offerMessage.value = "";
    offerQuantity.value = 1;
    await refreshInteractions();
  } catch (err) {
    error.value = extractApiMessage(
      err,
      "Envoi de l offre impossible pour le moment.",
    );
  } finally {
    sendingOffer.value = false;
  }
};

const updateOfferStatus = async (
  offerId: number,
  status: "accepted" | "rejected",
) => {
  error.value = null;
  actionMessage.value = null;

  if (!requireAuthOrRedirect()) {
    return;
  }

  updatingOfferId.value = offerId;
  try {
    await apiClient.patch(`/offers/${offerId}/status`, { status });
    actionMessage.value =
      status === "accepted" ? "Offre acceptee." : "Offre refusee.";
    await refreshInteractions();
  } catch (err) {
    error.value = extractApiMessage(
      err,
      "Mise a jour de l offre impossible pour le moment.",
    );
  } finally {
    updatingOfferId.value = null;
  }
};

const sendChatMessage = async () => {
  error.value = null;
  actionMessage.value = null;

  if (!requireAuthOrRedirect()) {
    return;
  }

  if (!product.value) {
    return;
  }

  const recipientId = resolvedRecipientId.value;
  if (!recipientId) {
    error.value =
      "Selectionne un destinataire. Le vendeur doit d abord recevoir au moins un contact.";
    return;
  }

  if (auth.user.value && recipientId === auth.user.value.id) {
    error.value = "Tu ne peux pas te contacter toi-meme sur cette annonce.";
    return;
  }

  const text = chatInput.value.trim();
  if (!text) {
    error.value = "Le message ne peut pas etre vide.";
    return;
  }

  try {
    await apiClient.post("/messages", {
      productId: product.value.id,
      recipientId,
      content: text,
    });

    chatInput.value = "";
    actionMessage.value = "Message envoye.";
    await refreshInteractions();
  } catch (err) {
    error.value = extractApiMessage(
      err,
      "Envoi du message impossible pour le moment.",
    );
  }
};

onMounted(async () => {
  loading.value = true;
  error.value = null;

  try {
    await fetchProduct();
    applyRouteConversationQuery();
    if (product.value?.price) {
      offerPrice.value = Number(product.value.price);
    }

    if (auth.isAuthenticated.value) {
      await fetchFavoriteState();
      await refreshInteractions();
      setupSocket();
    }
  } catch (err) {
    error.value = extractApiMessage(
      err,
      "Produit introuvable ou indisponible.",
    );
  } finally {
    loading.value = false;
  }
});

watch(
  () => auth.isAuthenticated.value,
  (isAuthenticated) => {
    if (isAuthenticated) {
      void fetchFavoriteState();
      void refreshInteractions();
      setupSocket();
      return;
    }

    isFavorite.value = false;
    offers.value = [];
    messages.value = [];
    teardownSocket();
  },
);

watch(
  () => route.query.withUserId,
  () => {
    applyRouteConversationQuery();
  },
);

watch(selectedRecipientId, () => {
  if (!auth.isAuthenticated.value || !isSellerView.value) {
    return;
  }
  void fetchMessages().then(() => {
    void fetchPresence();
    void markCurrentConversationAsRead();
  });
});

onBeforeUnmount(() => {
  teardownSocket();
});
</script>

<template>
  <div v-if="loading" class="app-shell p-10 text-center">
    Chargement du produit...
  </div>
  <div v-else-if="product" class="app-shell container mx-auto p-6">
    <router-link :to="{ name: 'home' }" class="text-blue-600 font-bold"
      >← Retour</router-link
    >
    <div
      class="glass-card flex flex-col md:flex-row gap-10 mt-6 p-8 rounded-2xl shadow-sm border border-white/70"
    >
      <img
        :src="product.imageUrl || 'https://via.placeholder.com/500'"
        class="w-full md:w-1/2 rounded-xl"
      />
      <div class="w-full">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-4xl font-black">{{ product.name }}</h1>
          <button
            v-if="auth.isAuthenticated"
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-lg font-black shadow-sm transition"
            :class="
              isFavorite
                ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            "
            :disabled="favoriteLoading"
            @click="toggleFavorite"
            :title="isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
          >
            {{ isFavorite ? '♥' : '♡' }}
          </button>
          <span
            class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
            :class="getCategoryBadgeClass(product.category)"
          >
            {{ product.category }}
          </span>
        </div>
        <div class="mt-1 mb-2 flex items-center gap-2 text-sm text-gray-500">
          <img
            v-if="product.seller?.profileImageUrl"
            :src="product.seller.profileImageUrl"
            :alt="product.seller?.displayName || 'Vendeur'"
            class="h-7 w-7 rounded-full border border-gray-200 object-cover"
          />
          <span
            v-else
            class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-[11px] font-black uppercase text-gray-600"
          >
            {{ (product.seller?.displayName || "V").slice(0, 1) }}
          </span>
          <p>
            Vendeur: {{ product.seller?.displayName || "Compte non renseigne" }}
          </p>
        </div>
        <p
          class="text-xs mb-2 flex items-center gap-2"
          :class="sellerOnline ? 'text-green-600' : 'text-gray-400'"
        >
          <span
            class="inline-block h-2 w-2 rounded-full"
            :class="sellerOnline ? 'bg-green-500' : 'bg-gray-300'"
          />
          {{ sellerOnline ? "Vendeur en ligne" : "Vendeur hors ligne" }}
        </p>
        <p class="text-gray-500 my-4">{{ product.description }}</p>
        <p class="text-xs uppercase tracking-wide text-gray-500">
          Stock disponible: {{ product.stock }}
        </p>
        <span class="text-3xl font-bold">{{ product.price }}€</span>

        <p
          v-if="actionMessage"
          class="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700"
        >
          {{ actionMessage }}
        </p>
        <p
          v-if="error"
          class="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {{ error }}
        </p>

        <div
          class="mt-6 grid gap-4 rounded-xl border border-gray-200 bg-white/80 p-4"
        >
          <h2 class="text-lg font-black text-gray-900">
            Acheter cette annonce
          </h2>

          <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label class="text-sm font-semibold text-gray-700">Quantite</label>
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              :max="Math.max(product.stock, 1)"
              class="w-24 rounded-lg border p-2 bg-gray-50"
            />
            <button
              type="button"
              :disabled="buying || !canBuyNow"
              @click="handlePayment(quantity)"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {{ buying ? "Traitement..." : "Acheter maintenant (Stripe)" }}
            </button>
          </div>
        </div>

        <div
          class="mt-4 grid gap-4 rounded-xl border border-gray-200 bg-white/80 p-4"
        >
          <h2 class="text-lg font-black text-gray-900">Faire une offre</h2>
          <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
            <input
              v-model.number="offerQuantity"
              type="number"
              min="1"
              :max="Math.max(product.stock, 1)"
              class="rounded-lg border p-2 bg-gray-50"
              placeholder="Quantite"
            />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
            <input
              v-model.number="offerPrice"
              type="number"
              min="1"
              class="rounded-lg border p-2 bg-gray-50"
              placeholder="Montant"
            />
            <input
              v-model="offerMessage"
              type="text"
              class="rounded-lg border p-2 bg-gray-50"
              placeholder="Message au vendeur (optionnel)"
            />
          </div>
          <button
            type="button"
            :disabled="sendingOffer || !canSendOffer"
            @click="sendOffer"
            class="w-fit rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:bg-amber-300"
          >
            {{ sendingOffer ? "Envoi..." : "Envoyer mon offre" }}
          </button>

          <div v-if="auth.isAuthenticated" class="space-y-2">
            <h3 class="text-sm font-black text-gray-800">
              {{ isSellerView ? "Offres recues" : "Mes offres" }}
            </h3>
            <p v-if="offers.length === 0" class="text-sm text-gray-500">
              Aucune offre pour l instant.
            </p>
            <ul v-else class="space-y-2 max-h-44 overflow-auto pr-1">
              <li
                v-for="offer in offers"
                :key="offer.id"
                class="rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-semibold text-gray-800">
                    {{ Number(offer.amount).toFixed(2) }} EUR x
                    {{ offer.quantity }} · {{ offer.status }}
                  </p>
                  <p class="text-xs text-gray-400">
                    {{ new Date(offer.createdAt).toLocaleString() }}
                  </p>
                </div>
                <p class="mt-1 text-sm text-gray-600">
                  {{ offer.message || "Sans message" }}
                </p>
                <p v-if="offer.buyer" class="mt-1 text-xs text-gray-500">
                  Acheteur: {{ offer.buyer.displayName }}
                </p>

                <div
                  v-if="
                    offer.status === 'accepted' &&
                    offer.buyerId === currentUser?.id
                  "
                  class="mt-3"
                >
                  <button
                    type="button"
                    :disabled="buying || product.stock < offer.quantity"
                    @click="handlePayment(offer.quantity, { isOffer: true, offerId: offer.id })"
                    class="w-full rounded-lg bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-700 transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <span v-if="buying">Redirection...</span>
                    <span v-else
                      >💳 Payer mon offre ({{
                        (offer.amount * offer.quantity).toFixed(2)
                      }}€)</span
                    >
                  </button>
                </div>
                <div
                  v-if="isSellerView && offer.status === 'pending'"
                  class="mt-2 flex gap-2"
                >
                  <button
                    type="button"
                    :disabled="updatingOfferId === offer.id"
                    @click="updateOfferStatus(offer.id, 'accepted')"
                    class="rounded-lg bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-700"
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    :disabled="updatingOfferId === offer.id"
                    @click="updateOfferStatus(offer.id, 'rejected')"
                    class="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-white/80 p-4"
        >
          <h2 class="text-lg font-black text-gray-900">Messagerie interne</h2>
          <p class="text-xs text-gray-500">
            Temps reel instantane via WebSocket.
          </p>

          <div
            v-if="isSellerView && recipientOptions.length > 0"
            class="space-y-1"
          >
            <label class="text-xs font-bold uppercase text-gray-500"
              >Conversation avec</label
            >
            <select
              v-model.number="selectedRecipientId"
              class="w-full rounded-lg border p-2 bg-gray-50 text-sm"
            >
              <option
                v-for="recipient in recipientOptions"
                :key="recipient.id"
                :value="recipient.id"
              >
                {{ recipient.displayName }} ({{ recipient.role }})
              </option>
            </select>
          </div>

          <div class="flex gap-2">
            <input
              v-model="chatInput"
              type="text"
              class="flex-1 rounded-lg border p-2 bg-gray-50"
              :placeholder="
                isSellerView
                  ? 'Ecrire un message a cet acheteur...'
                  : 'Ecrire un message au vendeur...'
              "
            />
            <button
              type="button"
              @click="sendChatMessage"
              class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black"
            >
              Envoyer
            </button>
          </div>

          <div v-if="loadingInteractions" class="text-sm text-gray-500">
            Chargement des interactions...
          </div>

          <div
            v-else-if="sortedMessages.length === 0"
            class="text-sm text-gray-500"
          >
            Aucun message pour l'instant.
          </div>

          <ul v-else class="space-y-2 max-h-44 overflow-auto pr-1">
            <li
              v-for="msg in sortedMessages"
              :key="msg.id"
              class="rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <p class="text-xs font-semibold text-gray-500">
                {{ msg.sender?.displayName || `User ${msg.senderId}` }}
              </p>
              <p class="text-sm text-gray-800">{{ msg.content }}</p>
              <p class="mt-1 text-xs text-gray-400 flex items-center gap-2">
                <span>{{ new Date(msg.createdAt).toLocaleString() }}</span>
                <span
                  v-if="currentUser && msg.senderId === currentUser.id"
                  class="font-semibold"
                  :class="msg.readAt ? 'text-green-600' : 'text-gray-400'"
                >
                  {{ msg.readAt ? "Vu" : "Envoye" }}
                </span>
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="app-shell p-10 text-center text-red-600">
    {{ error || "Annonce indisponible." }}
  </div>
</template>
