import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import ProductDetailView from '../views/ProductDetailView.vue';
import AuthView from '../views/AuthView.vue';
import AccountView from '../views/AccountView.vue';
import ForbiddenView from '../views/ForbiddenView.vue';
import SellerHubView from '../views/SellerHubView.vue';
import SuccessView from '../views/SuccessView.vue';
import { useAuthStore } from '../stores/auth';
import type { UserRole } from '../types/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'auth',
      component: AuthView
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView
    },
    {
      path: '/product/:id',
      name: 'product-detail',
      component: ProductDetailView,
      props: true // Permet de recevoir l'ID directement comme une variable
    },
    {
      path: '/auth',
      redirect: { name: 'auth' }
    },
    {
      path: '/login',
      redirect: { name: 'auth' }
    },
    {
      path: '/account',
      name: 'account',
      component: AccountView,
      meta: {
        requiresAuth: true,
      }
    },
    {
      path: '/seller',
      name: 'seller-hub',
      component: SellerHubView,
      meta: {
        requiresAuth: true,
        roles: ['seller', 'admin'] as UserRole[]
      }
    },
    {
    path: '/success',
    name: 'success',
    component: SuccessView
  },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: ForbiddenView
    }
  ]
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  const requiresAuth = to.meta.requiresAuth === true;
  const allowedRoles = (to.meta.roles as UserRole[] | undefined) ?? [];

  if (requiresAuth && !auth.isAuthenticated.value) {
    return {
      name: 'auth',
      query: { redirect: to.fullPath }
    };
  }

  if (allowedRoles.length > 0) {
    if (!auth.role.value || !allowedRoles.includes(auth.role.value)) {
      return { name: 'forbidden' };
    }
  }

  return true;
});

export default router;