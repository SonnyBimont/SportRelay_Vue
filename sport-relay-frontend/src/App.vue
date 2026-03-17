<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const THEME_STORAGE_KEY = 'sportrelay-theme';
const isDarkMode = ref(false);

const toggleLabel = computed(() => (isDarkMode.value ? 'Mode clair' : 'Mode sombre'));

const applyTheme = (isDark: boolean) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', isDark);
};

const setTheme = (isDark: boolean) => {
  isDarkMode.value = isDark;
  applyTheme(isDark);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  }
};

const toggleTheme = () => {
  setTheme(!isDarkMode.value);
};

onMounted(() => {
  let preferredTheme: 'dark' | 'light' = 'light';

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      preferredTheme = stored;
    } else {
      preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
  }

  setTheme(preferredTheme === 'dark');
});
</script>

<template>
  <router-view />
  <button
    type="button"
    class="theme-toggle"
    @click="toggleTheme"
  >
    {{ toggleLabel }}
  </button>
</template>
