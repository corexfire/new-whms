import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  const publicRoutes = ['/login', '/forgot-password', '/reset-password']

  // If going to a public route, allow it
  if (publicRoutes.some(route => to.path.startsWith(route))) {
    // If logged in and going to login page, send to dashboard
    if (auth.isAuthenticated && to.path === '/login') {
      return navigateTo({ path: '/dashboard' })
    }
    return
  }

  // If not authenticated and going to private route
  if (!auth.isAuthenticated) {
    return navigateTo({ 
      path: '/login', 
      query: { returnUrl: to.fullPath } 
    })
  }
})
