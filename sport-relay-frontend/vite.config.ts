import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

//PROXY CONFIGURATION pour eviter les problèmes de CORS lors du développement local
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})