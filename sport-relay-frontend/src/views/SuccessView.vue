<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const countdown = ref(5);

onMounted(() => {
  // Petit compte à rebours avant redirection automatique vers l'accueil
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
      router.push({ name: 'home' });
    }
  }, 1000);
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <div class="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
      <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 class="text-3xl font-black text-gray-900 mb-2">Paiement Réussi !</h1>
      <p class="text-gray-500 mb-8">
        Merci pour votre achat sur <strong>SportRelay</strong>. Votre équipement vous attend !
      </p>

      <div class="bg-blue-50 rounded-2xl p-4 mb-8">
        <p class="text-blue-700 text-sm font-medium">
          Redirection vers l'accueil dans {{ countdown }} secondes...
        </p>
      </div>

      <router-link 
        :to="{ name: 'home' }" 
        class="block w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all shadow-lg"
      >
        Retourner à la boutique
      </router-link>
    </div>
  </div>
</template>