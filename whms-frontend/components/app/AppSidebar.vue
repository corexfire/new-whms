<template>
  <div :class="[
    'flex flex-col bg-slate-900 shadow-xl transition-all duration-300 z-10 flex-shrink-0',
    uiStore.sidebarCollapsed ? 'w-20' : 'w-64'
  ]">
    <div class="h-16 flex items-center justify-center border-b border-slate-800 shrink-0">
       <div class="flex items-center gap-3 text-white overflow-hidden whitespace-nowrap px-4">
         <i class="pi pi-box text-2xl text-blue-400 shrink-0"></i>
         <span v-if="!uiStore.sidebarCollapsed" class="text-xl font-bold tracking-wider transition-opacity duration-300">WHMS</span>
       </div>
    </div>

    <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 hover:pr-1">
      <nav class="space-y-1.5 px-3">
        <template v-for="menu in menus" :key="menu.title">
          
          <!-- Section title -->
          <div v-if="!uiStore.sidebarCollapsed && menu.section" class="pt-4 pb-1">
            <p class="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-2">{{ menu.section }}</p>
          </div>

          <!-- Menu Item -->
          <NuxtLink v-if="!menu.children" :to="menu.path" custom v-slot="{ href, navigate, isActive, isExactActive }">
            <a :href="href" @click="navigate" 
              :class="[
                'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors relative',
                isActive || isExactActive ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                uiStore.sidebarCollapsed ? 'justify-center' : 'gap-3'
              ]"
              :title="uiStore.sidebarCollapsed ? menu.title : ''">
              <i :class="[menu.icon, isActive || isExactActive ? 'text-white' : 'text-slate-400 group-hover:text-white', 'text-lg shrink-0 transition-colors']"></i>
              <span v-if="!uiStore.sidebarCollapsed" class="truncate">{{ menu.title }}</span>
            </a>
          </NuxtLink>

          <!-- Dropdown Item (using PrimeVue PanelMenu logic manual wrapper for tailwind styling or native HTML details) -->
          <div v-else class="space-y-1">
            <Button
              text
              class="w-full !justify-between !px-3 !py-2.5 !text-sm !font-medium !rounded-lg !text-slate-300 hover:!bg-slate-800 hover:!text-white transition-colors"
              :class="[uiStore.sidebarCollapsed ? '!justify-center' : '']"
              @click="toggleExpanded(menu.title)"
            >
              <div class="flex items-center gap-3">
                <i :class="[menu.icon, 'text-slate-400 group-hover:text-white text-lg shrink-0']"></i>
                <span v-if="!uiStore.sidebarCollapsed" class="truncate">{{ menu.title }}</span>
              </div>
              <i v-if="!uiStore.sidebarCollapsed" :class="['pi text-xs transition-transform', isExpanded(menu.title) ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
            </Button>
            <div v-if="isExpanded(menu.title) && !uiStore.sidebarCollapsed" class="pl-10 space-y-1 mt-1">
              <NuxtLink v-for="child in menu.children" :key="child.path" :to="child.path" custom v-slot="{ href, navigate, isActive, isExactActive }">
                <a :href="href" @click="navigate" 
                  :class="[
                    'block px-3 py-2 text-sm font-normal rounded-lg transition-colors truncate',
                    isActive || isExactActive ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  ]">
                  {{ child.title }}
                </a>
              </NuxtLink>
            </div>
          </div>
        </template>
      </nav>
    </div>
    
    <!-- User Profile Collapse Toggle -->
    <div class="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
      <Button
        text
        class="w-full !flex !items-center !justify-center !p-2 !rounded-lg !text-slate-400 hover:!text-white hover:!bg-slate-800 transition-colors"
        @click="uiStore.toggleSidebar"
      >
        <i :class="['pi', uiStore.sidebarCollapsed ? 'pi-angle-double-right' : 'pi-angle-double-left']"></i>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '~/stores/ui'
const uiStore = useUIStore()

// State for expanding nested menus
const expandedMenus = ref<Record<string, boolean>>({
  'Master Data': true,
  'Inbound': false,
  'Outbound': false,
  'Inventory': false,
  'Promotions': false,
  'Integrations': false
})

function toggleExpanded(title: string) {
  if (uiStore.sidebarCollapsed) {
    uiStore.toggleSidebar()
    expandedMenus.value[title] = true
  } else {
    expandedMenus.value[title] = !expandedMenus.value[title]
  }
}

function isExpanded(title: string) {
  return !!expandedMenus.value[title]
}

const menus = computed(() => {
  return [
    { title: 'Dashboard', path: '/dashboard', icon: 'pi pi-home', section: 'Main' },
    
    { 
      title: 'Master Data', 
      icon: 'pi pi-database', 
      section: 'Modules',
      children: [
        { title: 'Items', path: '/master/items' },
        { title: 'Categories', path: '/master/categories' },
        { title: 'Products', path: '/master/products' },
        { title: 'Suppliers', path: '/master/suppliers' },
        { title: 'Customers', path: '/master/customers' },
        { title: 'Warehouses', path: '/master/warehouses' },
        { title: 'Storage Locations', path: '/master/locations' },
        { title: 'Users & Roles', path: '/master/users' }
      ]
    },

    {
      title: 'Inbound',
      icon: 'pi pi-sign-in',
      children: [
        { title: 'Purchase Orders', path: '/inbound/purchase-orders' },
        { title: 'Goods Receipt Note', path: '/inbound/grn' },
        { title: 'Putaway Task', path: '/inbound/putaway' },
        { title: 'Supplier Returns', path: '/inbound/returns' }
      ]
    },

    {
      title: 'Outbound',
      icon: 'pi pi-sign-out',
      children: [
        { title: 'Sales Orders', path: '/outbound/sales-orders' },
        { title: 'Pick Lists', path: '/outbound/pick-list' },
        { title: 'Packing Station', path: '/outbound/packing' },
        { title: 'Shipping & Delivery', path: '/outbound/shipping' },
        { title: 'Customer Returns', path: '/outbound/returns' }
      ]
    },

    {
      title: 'Inventory',
      icon: 'pi pi-box',
      children: [
        { title: 'Stock Summary', path: '/inventory/summary' },
        { title: 'Stock Movements', path: '/inventory/movements' },
        { title: 'Stock Take (Opname)', path: '/inventory/stocktake' },
        { title: 'Adjustments', path: '/inventory/adjustments' },
        { title: 'Warehouse Transfer', path: '/inventory/transfers' },
        { title: 'Lots & Expiry', path: '/inventory/lots' },
        { title: 'COGS & Overhead', path: '/inventory/cogs' }
      ]
    },

    { title: 'Kasir POS', path: '/pos', icon: 'pi pi-desktop', section: 'Retail' },

    {
      title: 'Promotions',
      icon: 'pi pi-tag',
      children: [
        { title: 'Discount Rules', path: '/retail/discounts' },
        { title: 'Bundle Items', path: '/retail/bundles' },
      ]
    },

    {
      title: 'Accounting',
      icon: 'pi pi-chart-bar',
      section: 'Finance',
      children: [
        { title: 'Chart of Accounts', path: '/accounting/coa' },
        { title: 'Journal Entries', path: '/accounting/journal' },
        { title: 'General Ledger', path: '/accounting/ledger' },
        { title: 'Accounts Payable', path: '/accounting/payables' },
        { title: 'Accounts Receivable', path: '/accounting/receivables' }
      ]
    },

    {
      title: 'Integrations',
      icon: 'pi pi-share-alt',
      section: 'System',
      children: [
        { title: 'Shopify - Connection', path: '/integrations/shopify/connection' },
        { title: 'Shopify - Sync', path: '/integrations/shopify/sync' },
        { title: 'Shopify - Settings', path: '/integrations/shopify/settings' },
        { title: 'Shopify - Logs', path: '/integrations/shopify/logs' },
      ]
    },
    
    { title: 'Settings', path: '/settings/general', icon: 'pi pi-cog', section: 'System' }
  ]
})
</script>

<style scoped>
/* Custom scrollbar for sidebar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155; 
  border-radius: 4px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: #475569; 
}
</style>
