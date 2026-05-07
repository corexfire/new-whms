<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-900">Item Detail</h1>
      <div class="flex gap-2">
        <Button label="Back" severity="secondary" outlined @click="router.back()" />
        <Button label="Edit" @click="router.push('/master/items')" />
        <Button label="Barcode" @click="router.push(`/master/items/${id}/barcodes`)"/>
      </div>
    </div>
    <div v-if="item" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white p-6 rounded-xl border border-slate-200">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-slate-500">SKU</p>
              <p class="font-semibold text-slate-800">{{ item.sku }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Name</p>
              <p class="font-semibold text-slate-800">{{ item.name }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Product</p>
              <p class="font-semibold text-slate-800">{{ item.product ? item.product.code + ' — ' + item.product.name : '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Category</p>
              <p class="font-semibold text-slate-800">{{ item.category?.name || '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Warna</p>
              <p class="font-semibold text-slate-800">{{ item.color || '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Size</p>
              <p class="font-semibold text-slate-800">{{ item.size || '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Bahan</p>
              <p class="font-semibold text-slate-800">{{ item.material || '-' }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-slate-500">Deskripsi</p>
              <p class="font-medium text-slate-700">{{ item.description || '-' }}</p>
            </div>
          </div>
        </div>
        <div class="bg-white p-6 rounded-xl border border-slate-200">
          <h2 class="text-sm font-semibold text-slate-800 mb-3">Unit of Measure</h2>
          <div class="space-y-2">
            <div v-for="u in item.uoms" :key="u.id" class="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
              <div class="flex items-center gap-4">
                <span class="text-sm font-semibold text-slate-800">{{ u.uom.code }}</span>
                <span class="text-xs text-slate-500">Conversion {{ u.conversionRate }}x</span>
                <span class="text-xs text-slate-500">Barcode: {{ u.barcode || '-' }}</span>
              </div>
              <div class="text-sm font-bold text-primary-700">{{ formatIdr(u.price) }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="space-y-6">
        <div class="bg-white p-6 rounded-xl border border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-slate-800">Images</h2>
            <Button icon="pi pi-refresh" severity="secondary" text @click="fetchDetail" />
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="img in images"
              :key="img.id"
              class="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-50"
            >
              <img :src="img.url" class="w-full h-24 object-cover" />
              <button
                class="absolute top-1 right-1 bg-white/90 border border-slate-200 rounded-md px-2 py-1 text-xs text-red-600 opacity-0 group-hover:opacity-100"
                @click="deleteImage(img.id)"
              >
                Delete
              </button>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <UiFileUpload v-model="imageFiles" accept="image/*" multiple />
            <Button label="Upload WebP" :loading="uploading" :disabled="!imageFiles?.length" @click="uploadImages" />
            <p class="text-[10px] text-slate-500">Upload akan dikonversi ke WebP di browser untuk ukuran lebih kecil.</p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl border border-slate-200">
          <h2 class="text-sm font-semibold text-slate-800 mb-3">Traceability</h2>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm">Track Lot</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full" :class="item.trackLot ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'">{{ item.trackLot ? 'YES' : 'NO' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Track Expiry</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full" :class="item.trackExpiry ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100'">{{ item.trackExpiry ? 'YES' : 'NO' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-if="!item" class="p-6">
    <i class="pi pi-spin pi-spinner text-2xl text-slate-400"></i>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useToast } from 'vue-toastification'
const route = useRoute()
const router = useRouter()
const { api } = useApi()
const toast = useToast()
const id = route.params.id as string
const item = ref<any>(null)
const imageFiles = ref<File[]>([])
const uploading = ref(false)
const apiBase = useRuntimeConfig().public.apiBase as string

const images = computed(() => {
  const list = item.value?.images || []
  return list.map((img: any) => ({
    ...img,
    url: `${apiBase}/uploads/items/${id}/${img.filename}`
  }))
})

function formatIdr(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(v)
}
async function fetchDetail() {
  const res = await api<{ success: true; item: any }>(`/api/items/${id}`)
  item.value = res.item
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fileToWebp(file: File): Promise<Blob> {
  if (file.type === 'image/webp') return file
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0)
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
  if (!blob) throw new Error('Gagal convert WebP')
  return blob
}

async function uploadImages() {
  if (!imageFiles.value.length) return
  uploading.value = true
  try {
    for (const f of imageFiles.value) {
      const webp = await fileToWebp(f)
      await api(`/api/items/${id}/images`, {
        method: 'POST',
        body: webp,
        headers: { 'Content-Type': 'image/webp' }
      })
    }
    imageFiles.value = []
    toast.success('Upload berhasil')
    await fetchDetail()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    uploading.value = false
  }
}

async function deleteImage(imageId: string) {
  const ok = window.confirm('Hapus image ini?')
  if (!ok) return
  try {
    await api(`/api/items/images/${imageId}`, { method: 'DELETE' })
    toast.success('Image dihapus')
    await fetchDetail()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}
onMounted(fetchDetail)
</script>
