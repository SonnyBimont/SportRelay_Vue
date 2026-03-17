<script setup lang="ts">
import type { Product } from '../types/product';

defineProps<{ product: Product }>();
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition">
    <img :src="product.imageUrl || 'https://via.placeholder.com/300'" class="w-full h-48 object-cover" />
    <div class="p-4">
      <h3 class="font-bold text-lg">{{ product.name }}</h3>
      <p class="text-sm text-gray-500 mt-1">
        Vendeur: {{ product.seller?.displayName || 'Compte non renseigne' }}
      </p>
      <div class="flex justify-between items-center mt-4">
        <span class="text-xl font-black">{{ product.price }}€</span>
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