<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { apiClient } from '../services/api';
import type { Product } from '../types/product';

const route = useRoute();
const product = ref<Product | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const response = await apiClient.get<Product>(`/products/${route.params.id}`);
    product.value = response.data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-if="loading" class="app-shell p-10 text-center">Chargement du produit...</div>
  <div v-else-if="product" class="app-shell container mx-auto p-6">
    <router-link :to="{ name: 'home' }" class="text-blue-600 font-bold">← Retour</router-link>
    <div class="glass-card flex flex-col md:flex-row gap-10 mt-6 p-8 rounded-2xl shadow-sm border border-white/70">
      <img :src="product.imageUrl || 'https://via.placeholder.com/500'" class="w-full md:w-1/2 rounded-xl" />
      <div>
        <h1 class="text-4xl font-black">{{ product.name }}</h1>
        <p class="text-sm text-gray-500 mt-1 mb-2">
          Vendeur: {{ product.seller?.displayName || 'Compte non renseigne' }}
        </p>
        <p class="text-gray-500 my-4">{{ product.description }}</p>
        <span class="text-3xl font-bold">{{ product.price }}€</span>
      </div>
    </div>
  </div>
</template>