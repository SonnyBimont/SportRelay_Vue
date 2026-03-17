import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router' // Importez le router
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const auth = useAuthStore()
void auth.restoreSession()
app.use(router) // Activez-le
app.mount('#app')
