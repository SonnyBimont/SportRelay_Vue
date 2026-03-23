<script setup lang="ts">
import axios from 'axios';
import { ref } from 'vue';
import { apiClient } from '../services/api';
import { PRODUCT_CATEGORIES } from '../constants/categories';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'product-added', payload: { name: string }): void;
}>();

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const form = ref({
  name: '',
  description: '',
  price: 0,
  stock: 1,
  category: 'Cyclisme',
  condition: 'occasion',
});

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null); // Stocke l'URL temporaire de l'image
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

const clearSelectedFile = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = null;
  selectedFile.value = null;
};

const extractApiMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const responseData = error.response?.data as
    | { message?: string | string[] }
    | undefined;

  if (Array.isArray(responseData?.message) && responseData.message.length > 0) {
    return responseData.message.join(' | ');
  }

  if (typeof responseData?.message === 'string' && responseData.message.length > 0) {
    return responseData.message;
  }

  if (error.response?.status === 401) {
    return 'Session expiree. Reconnecte-toi puis recommence.';
  }
  if (error.response?.status === 403) {
    return 'Action reservee aux comptes vendeur/admin.';
  }

  return fallback;
};

// Gère la sélection du fichier et génère la preview
const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];

  if (!file) {
    clearSelectedFile();
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    submitError.value =
      'Type de fichier invalide. Formats acceptes: JPEG, PNG, WEBP.';
    clearSelectedFile();
    if (input) {
      input.value = '';
    }
    return;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    submitError.value = 'Image trop lourde (max 5 Mo).';
    clearSelectedFile();
    if (input) {
      input.value = '';
    }
    return;
  }

  submitError.value = null;
  clearSelectedFile();
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
};

const handleSubmit = async () => {
  submitError.value = null;

  if (!selectedFile.value) {
    submitError.value = 'Veuillez selectionner une image.';
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.has(selectedFile.value.type)) {
    submitError.value =
      'Type de fichier invalide. Formats acceptes: JPEG, PNG, WEBP.';
    return;
  }

  if (selectedFile.value.size > MAX_IMAGE_SIZE_BYTES) {
    submitError.value = 'Image trop lourde (max 5 Mo).';
    return;
  }

  if (form.value.price <= 0) {
    submitError.value = 'Le prix doit etre superieur a 0.';
    return;
  }

  if (form.value.stock <= 0) {
    submitError.value = 'Le stock doit etre superieur a 0.';
    return;
  }

  isSubmitting.value = true;
  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);

    // 1. Upload de l'image
    let imageUrl = '';
    try {
      const uploadResponse = await apiClient.post<{ url: string }>(
        '/products/upload',
        formData,
      );
      imageUrl = uploadResponse.data.url;
    } catch (error) {
      submitError.value = extractApiMessage(
        error,
        'Erreur pendant l upload de limage.',
      );
      return;
    }

    // 2. Création du produit
    try {
      await apiClient.post('/products', {
        ...form.value,
        imageUrl,
      });
    } catch (error) {
      submitError.value = extractApiMessage(
        error,
        'Erreur pendant la creation de l annonce.',
      );
      return;
    }

    emit('product-added', { name: form.value.name.trim() });
    emit('close');
  } catch {
    submitError.value = 'Publication impossible pour le moment.';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-gray-800">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
        <h2 class="text-xl font-black">Vendre un article</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div v-if="previewUrl" class="relative w-full h-48 bg-gray-100 rounded-xl overflow-hidden mb-4 border-2 border-dashed border-gray-200">
          <img :src="previewUrl" class="w-full h-full object-contain" />
          <button 
            type="button"
            @click="clearSelectedFile" 
            class="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full text-xs"
          >
            Changer
          </button>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Nom</label>
          <input v-model="form.name" type="text" required class="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Prix (€)</label>
            <input v-model.number="form.price" type="number" required class="w-full border rounded-lg p-2 bg-gray-50" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Stock</label>
            <input v-model.number="form.stock" type="number" min="1" required class="w-full border rounded-lg p-2 bg-gray-50" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Catégorie</label>
            <select v-model="form.category" class="w-full border rounded-lg p-2 bg-gray-50">
              <option
                v-for="category in PRODUCT_CATEGORIES"
                :key="category"
                :value="category"
              >
                {{ category }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Etat</label>
            <select v-model="form.condition" class="w-full border rounded-lg p-2 bg-gray-50">
              <option value="occasion">Occasion</option>
              <option value="neuf">Neuf</option>
              <option value="reconditionne">Reconditionne</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Photo</label>
          <input type="file" @change="onFileChange" accept="image/*" class="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>

        <div>
          <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
          <textarea v-model="form.description" rows="3" required class="w-full border rounded-lg p-2 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
        </div>

        <p v-if="submitError" class="text-sm font-medium text-red-600">{{ submitError }}</p>

        <button 
          type="submit" 
          :disabled="isSubmitting"
          class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {{ isSubmitting ? 'Traitement...' : 'Publier l\'annonce' }}
        </button>
      </form>
    </div>
  </div>
</template>