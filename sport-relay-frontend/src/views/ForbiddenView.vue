<template>
  <section class="app-shell min-h-screen flex items-center justify-center p-6">
    <div class="glass-card max-w-lg w-full rounded-2xl border p-8 text-center">
      <h1 class="text-2xl font-black text-gray-900">Acces refuse</h1>
      <p class="text-gray-500 mt-3">Ton role ne permet pas d'ouvrir cette page.</p>
      <router-link :to="{ name: 'home' }" class="inline-block mt-6 bg-blue-600 text-white px-5 py-3 rounded-lg font-bold">
        Retour a l'accueil
      </router-link>
    </div>
  </section>
</template>
