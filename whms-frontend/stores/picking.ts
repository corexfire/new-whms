import { defineStore } from 'pinia'

export const usePickingStore = defineStore('picking', () => {
  const activePickListId = ref<string | null>(null)
  const pickedItems = ref<any[]>([])

  function setActive(id: string) {
    activePickListId.value = id
    // In production, sync to offline queue maybe
  }

  function confirmPick(item: any) {
    pickedItems.value.push(item)
  }

  function clearPick() {
    activePickListId.value = null
    pickedItems.value = []
  }

  return {
    activePickListId,
    pickedItems,
    setActive,
    confirmPick,
    clearPick
  }
}, {
  persist: true
})
