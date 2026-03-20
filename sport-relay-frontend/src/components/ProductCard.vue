<script setup lang="ts">
import type { Product } from '../types/product';
import { getCategoryBadgeClass } from '../utils/categoryBadge';

const props = withDefaults(
  defineProps<{
    product: Product;
    isFavorite?: boolean;
    favoriteLoading?: boolean;
    canFavorite?: boolean;
  }>(),
  {
    isFavorite: false,
    favoriteLoading: false,
    canFavorite: false,
  },
);

const emit = defineEmits<{
  (event: 'toggle-favorite', productId: number): void;
}>();

const onToggleFavorite = () => {
  if (!props.canFavorite || props.favoriteLoading) {
    return;
  }
  emit('toggle-favorite', props.product.id);
};
</script>

<template>
  <div class="relative bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition">
    <img :src="product.imageUrl || 'https://via.placeholder.com/300'" class="w-full h-48 object-cover" />
    <span
      v-if="product.stock <= 0"
      class="absolute left-3 top-3 rounded-md bg-red-600 px-2 py-1 text-xs font-black uppercase tracking-wide text-white"
    >
      Vendu
    </span>
    <button
      v-if="canFavorite"
      type="button"
      class="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 text-sm font-black shadow-sm transition"
      :class="
        isFavorite
          ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
      "
      :disabled="favoriteLoading"
      @click.stop.prevent="onToggleFavorite"
      :title="isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    >
      {{ isFavorite ? '♥' : '♡' }}
    </button>
    <div class="p-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-bold text-lg truncate">{{ product.name }}</h3>
        <span
          class="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          :class="getCategoryBadgeClass(product.category)"
        >
          {{ product.category }}
        </span>
      </div>
      <div class="mt-1 flex items-center gap-2 text-sm text-gray-500">
        <img
          v-if="product.seller?.profileImageUrl"
          :src="product.seller.profileImageUrl"
          :alt="product.seller?.displayName || 'Vendeur'"
          class="h-6 w-6 rounded-full border border-gray-200 object-cover"
        />
        <span
          v-else
          class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-[10px] font-black uppercase text-gray-600"
        >
          {{ (product.seller?.displayName || 'V').slice(0, 1) }}
        </span>
        <p>Vendeur: {{ product.seller?.displayName || 'Compte non renseigne' }}</p>
      </div>
      <div class="flex justify-between items-center mt-4 gap-2">
        <span class="text-xl font-black">{{ product.price }}€</span>
        <span
          class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
          :class="
            product.condition === 'neuf'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : product.condition === 'reconditionne'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
          "
        >
          {{
            product.condition === 'neuf'
              ? 'Neuf'
              : product.condition === 'reconditionne'
                ? 'Reconditionne'
                : 'Occasion'
          }}
        </span>
        <router-link 
          :to="{ name: 'product-detail', params: { id: product.id } }"
          class="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600 transition"
        >
          Voir
        </router-link>
      </div>
    </div>
  </div>
</template>