import { usePermission } from '~/composables/usePermission'

export default defineNuxtRouteMiddleware((to) => {
  const { hasRole } = usePermission()
  
  // Ambil metadata dari halaman yg mendefinisikan roles (jika ada)
  const requiredRoles = to.meta.roles as string[] | undefined

  if (requiredRoles && requiredRoles.length > 0) {
    // Kalau salah satu role ada, ijinkan
    if (!requiredRoles.some(r => hasRole(r))) {
      return navigateTo('/403')
    }
  }
})
