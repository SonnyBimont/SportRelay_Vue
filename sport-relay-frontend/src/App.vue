<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient } from './services/api';
import ProductCard from './components/ProductCard.vue';

const products = ref([]);
const loading = ref(true);
const error = ref<string | null>(null);

const fetchProducts = async () => {
  try {
    const response = await apiClient.get('/products');
    products.value = response.data;
  } catch (err) {
    error.value = "Impossible de charger les produits de sport.";
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchProducts();
});
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-blue-700 text-white p-6 shadow-lg">
      <div class="container mx-auto">
        <h1 class="text-3xl font-bold">SportRelay</h1>
        <p class="text-blue-100 text-sm mt-1">Le sport de seconde main, en toute confiance.</p>
      </div>
    </header>

    <main class="container mx-auto p-6">
      <div v-if="loading" class="text-center py-10">Chargement du matériel...</div>
      
      <div v-else-if="error" class="bg-red-100 text-red-700 p-4 rounded-lg">
        {{ error }}
      </div>

      <div v-else>
        <div v-if="products.length === 0" class="text-center py-10 text-gray-500">
          Aucun article en vente pour le moment. Soyez le premier !
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ProductCard 
            v-for="product in products" 
            :key="product.id" 
            :product="product" 
          />
        </div>
      </div>
    </main>
  </div>
</template>