<script setup lang="ts">
// On définit ce que le composant doit recevoir
defineProps<{
  product: {
    name: string;
    price: number;
    condition: string;
    category: string;
    imageUrl?: string;
  }
}>();
</script>

<template>
  <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
    <img 
      :src="product.imageUrl || 'https://via.placeholder.com/300x200?text=Sport+Gear'" 
      alt="product image" 
      class="w-full h-48 object-cover"
    />
    <div class="p-4">
      <div class="flex justify-between items-start">
        <h3 class="text-lg font-bold text-gray-800">{{ product.name }}</h3>
        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{{ product.condition }}</span>
      </div>
      <p class="text-gray-500 text-sm mt-1">{{ product.category }}</p>
      <div class="mt-4 flex justify-between items-center">
        <span class="text-xl font-bold text-green-600">{{ product.price }} €</span>
        <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
          Voir l'article
        </button>
      </div>
    </div>
  </div>
</template>