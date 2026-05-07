<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-900">Barcodes</h1>
      <div class="flex gap-2">
        <Button label="Back" severity="secondary" outlined @click="router.back()" />
      </div>
    </div>
    <div class="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-slate-500">SKU</p>
          <p class="font-semibold text-slate-800">{{ item?.sku }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Name</p>
          <p class="font-semibold text-slate-800">{{ item?.name }}</p>
        </div>
      </div>
      <div class="space-y-2">
        <div v-for="u in uoms" :key="u.id" class="p-3 border border-slate-200 rounded-lg">
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-slate-800 w-20">{{ u.uom.code }}</span>
            <span class="text-xs text-slate-500 w-24">Conv {{ u.conversionRate }}x</span>
            <UiSelect
              v-model="u.barcodeTypeLocal"
              :options="barcodeTypeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-40"
            />
            <InputText v-model="u.barcodeLocal" placeholder="Barcode" class="flex-1" @input="renderBarcode(u)" />
            <Button text rounded class="!w-9 !h-9 !p-0" aria-label="Scan" @click="openScanner(u)">
              <svg class="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h2l1-2h4l1 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"/>
              </svg>
            </Button>
            <Button label="Save" :loading="savingId === u.id" @click="saveBarcode(u)" />
          </div>
          <div class="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div class="flex items-center justify-between gap-3 mb-2">
              <div class="text-[10px] text-slate-500">Preview ({{ u.barcodeTypeLocal }})</div>
              <div class="flex items-center gap-2">
                <Button
                  text
                  rounded
                  size="small"
                  icon="pi pi-copy"
                  :disabled="!u.barcodeLocal"
                  @click="copyBarcode(u)"
                />
                <Button
                  text
                  rounded
                  size="small"
                  icon="pi pi-download"
                  :disabled="!u.barcodeLocal"
                  @click="downloadBarcodePng(u)"
                />
                <Button
                  text
                  rounded
                  size="small"
                  icon="pi pi-print"
                  :disabled="!u.barcodeLocal"
                  @click="printBarcode(u)"
                />
              </div>
            </div>
            <div v-if="!u.barcodeLocal" class="text-xs text-slate-500">
              Belum ada barcode. Scan atau isi manual untuk melihat preview.
            </div>
            <div v-else-if="u.barcodeTypeLocal === 'QR_CODE'" class="w-full flex justify-center" v-html="generateQrSvg(String(u.barcodeLocal || '').trim())"></div>
            <svg v-else :ref="(el) => setSvgRef(u, el)" class="w-full"></svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <UiModal v-model="scannerOpen" title="Scan Barcode" width="600px">
    <div class="space-y-3">
      <div class="text-xs text-slate-500">Arahkan kamera ke barcode, hasil akan terisi otomatis.</div>
      <div v-if="scannerError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
        {{ scannerError }}
      </div>
      <video id="barcodeScannerVideo" class="w-full rounded-lg border border-slate-200 bg-black" autoplay playsinline></video>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useToast } from 'vue-toastification'
import JsBarcode from 'jsbarcode'
import { useScanner } from '~/composables/useScanner'
import { generateQrSvg } from '~/composables/useQrSvg'
const route = useRoute()
const router = useRouter()
const { api } = useApi()
const toast = useToast()
const id = route.params.id as string
const item = ref<any>(null)
const uoms = ref<any[]>([])
const savingId = ref<string | null>(null)
const scannerOpen = ref(false)
const scannerError = ref<string>('')
const scanningTarget = ref<any>(null)
const { startScan, stopScan } = useScanner('barcodeScannerVideo')
const barcodeTypeOptions = [
  { label: 'CODE128', value: 'CODE128' },
  { label: 'EAN13', value: 'EAN13' },
  { label: 'QR Code', value: 'QR_CODE' }
]

function setSvgRef(u: any, el: any) {
  u._svgEl = el
  if (el) renderBarcode(u)
}

function renderBarcode(u: any) {
  if (!u._svgEl) return
  const v = String(u.barcodeLocal || '').trim()
  u._svgEl.innerHTML = ''
  if (!v) return
  if (u.barcodeTypeLocal === 'QR_CODE') return
  try {
    JsBarcode(u._svgEl, v, {
      format: u.barcodeTypeLocal || 'CODE128',
      displayValue: true,
      fontSize: 12,
      height: 40,
      margin: 0
    })
  } catch (e: any) {
    u._svgEl.innerHTML = ''
  }
}

function barcodeOptions(u: any) {
  return {
    format: u.barcodeTypeLocal || 'CODE128',
    displayValue: true,
    fontSize: 12,
    height: 40,
    margin: 0
  }
}

async function copyBarcode(u: any) {
  const v = String(u.barcodeLocal || '').trim()
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
    toast.success('Barcode copied')
  } catch {
    toast.error('Gagal copy barcode')
  }
}

function downloadBarcodePng(u: any) {
  const v = String(u.barcodeLocal || '').trim()
  if (!v) return
  if (u.barcodeTypeLocal === 'QR_CODE') {
    const svgStr = generateQrSvg(v)
    if (!svgStr) return toast.error('Gagal generate QR')
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const sku = String(item.value?.sku || 'item')
    const unit = String(u?.uom?.code || 'UOM')
    a.download = `${sku}-${unit}-${v}.svg`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return
  }
  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, v, barcodeOptions(u))
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    const sku = String(item.value?.sku || 'item')
    const unit = String(u?.uom?.code || 'UOM')
    a.download = `${sku}-${unit}-${v}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    toast.error('Gagal generate PNG')
  }
}

function printBarcode(u: any) {
  const v = String(u.barcodeLocal || '').trim()
  if (!v) return
  const win = window.open('', '_blank')
  if (!win) return toast.error('Popup diblokir browser')

  const sku = String(item.value?.sku || '')
  const name = String(item.value?.name || '')
  const unit = String(u?.uom?.code || '')
  const svg = u.barcodeTypeLocal === 'QR_CODE' ? generateQrSvg(v) : u._svgEl?.outerHTML

  if (!svg) return
  win.document.open()
  win.document.write(`
    <html>
      <head>
        <title>Barcode</title>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
          .label { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; max-width: 420px; }
          .meta { font-size: 12px; color: #334155; margin-bottom: 8px; }
          .sku { font-weight: 700; }
          .name { color: #64748b; }
          .unit { font-weight: 700; margin-left: 8px; }
          svg { width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="meta"><span class="sku">${sku}</span><span class="unit">${unit}</span></div>
          <div class="meta name">${name}</div>
          ${svg}
        </div>
      </body>
    </html>
  `)
  win.document.close()
  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
    }
  }, 50)
}

async function openScanner(u: any) {
  scanningTarget.value = u
  scannerOpen.value = true
  scannerError.value = ''
  await nextTick()
  try {
    await startScan((text) => {
      if (scanningTarget.value) {
        scanningTarget.value.barcodeLocal = text
        renderBarcode(scanningTarget.value)
      }
      closeScanner()
    })
  } catch (e: any) {
    scannerError.value = e?.message || 'Gagal membuka kamera. Pastikan izin kamera di browser dan gunakan https atau localhost.'
    toast.error(scannerError.value)
  }
}

function closeScanner() {
  stopScan()
  scannerOpen.value = false
  scanningTarget.value = null
}

async function fetchDetail() {
  const res = await api<{ success: true; item: any }>(`/api/items/${id}`)
  item.value = res.item
  uoms.value = (item.value?.uoms || []).map((u: any) => ({
    ...u,
    barcodeLocal: u.barcode || item.value?.sku || '',
    barcodeTypeLocal: u.barcodeType || (u.barcode ? 'CODE128' : 'QR_CODE'),
    _svgEl: null
  }))
}
async function saveBarcode(u: any) {
  savingId.value = u.id
  try {
    await api(`/api/items/uoms/${u.id}`, { method: 'PATCH', body: { barcode: u.barcodeLocal || null, barcodeType: u.barcodeTypeLocal } })
    toast.success('Barcode saved')
  } catch (e: any) {
    toast.error(e?.message || 'Error')
  } finally {
    savingId.value = null
  }
}
watch(uoms, () => {
  uoms.value.forEach((u) => renderBarcode(u))
}, { deep: true })

watch(scannerOpen, (v) => {
  if (!v) stopScan()
})
onMounted(fetchDetail)
</script>
