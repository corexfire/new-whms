import { defineStore } from 'pinia'

export interface PosCartItem {
  id: string
  name: string
  sku: string
  qty: number
  price: number
  discount: number
}

export const usePOSStore = defineStore('pos', () => {
  const cart = ref<PosCartItem[]>([])
  const shift = ref<any | null>(null) // Contains shiftId, openingCash, etc.

  const cartTotal = computed(() => {
    return cart.value.reduce((total, item) => total + (item.qty * (item.price - item.discount)), 0)
  })

  function addItem(product: any, qty: number = 1) {
    const existing = cart.value.find(c => c.id === product.id)
    if (existing) {
      existing.qty += qty
    } else {
      cart.value.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        qty,
        price: product.price || 0,
        discount: 0
      })
    }
  }

  function checkout() {
    // Call the server or sink to offline queue
    // For now, simply clear the cart
    cart.value = []
  }

  return {
    cart,
    shift,
    cartTotal,
    addItem,
    checkout
  }
}, {
  persist: {
    storage: persistedState.localStorage,
    pick: ['cart', 'shift']
  }
})
