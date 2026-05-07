import { useAuthStore } from '~/stores/auth'

export function usePermission() {
  const auth = useAuthStore()

  // Define modules and what permissions look like based on RBAC logic
  // Typically might compare: user has ['purchase_orders.approve'] etc.
  
  function can(action: string, moduleName: string): boolean {
    const permissionNeed = `${moduleName}.${action}`
    if (auth.permissions.includes('*')) return true // Super Admin generally
    return auth.permissions.includes(permissionNeed)
  }

  function hasRole(role: string): boolean {
    const user: any = auth.user as any
    if (!user) return false
    if (Array.isArray(user.roles)) return user.roles.includes(role)
    return user.role === role
  }

  return { can, hasRole }
}
