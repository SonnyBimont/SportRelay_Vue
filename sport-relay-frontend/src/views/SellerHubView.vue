<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const userName = computed(() => auth.user.value?.displayName ?? 'Vendeur');
</script>

<template>
  <section class="app-shell min-h-screen p-6">
    <div class="glass-card max-w-3xl mx-auto border rounded-2xl p-8">
      <h1 class="text-3xl font-black text-gray-900">Espace Vendeur</h1>
      <p class="text-gray-600 mt-2">Bonjour {{ userName }}, cette page est protegee par role seller/admin.</p>

      <div class="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p class="text-sm text-blue-900 font-medium">
          Concept: un guard de route frontend bloque l'acces si l'utilisateur n'a pas le role requis.
        </p>
      </div>

      <router-link :to="{ name: 'home' }" class="inline-block mt-6 text-blue-600 font-bold">
        ← Retour catalogue
      </router-link>
    </div>
  </section>
</template>
