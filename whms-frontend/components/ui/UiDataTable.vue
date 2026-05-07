<template>
  <div class="h-full w-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
    <div v-if="title || $slots.toolbar" class="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <h3 v-if="title" class="text-base font-semibold text-slate-800 truncate">{{ title }}</h3>
        <div v-else></div>
        <div class="flex flex-wrap lg:flex-nowrap items-center justify-start sm:justify-end gap-2 min-w-0">
          <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
            <slot name="toolbar" />
          </div>
          <Button v-if="exportable" class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-download" label="Export" text size="small" @click="exportCsv" />
          <Button v-if="exportable" class="lg:hidden shrink-0" icon="pi pi-download" text size="small" aria-label="Export" @click="exportCsv" />
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-[400px]">
      <ClientOnly>
        <DataTable
          ref="tableRef"
          :value="filteredRows"
          :paginator="pagination"
          :rows="paginationPageSize"
          dataKey="id"
          rowHover
          :stripedRows="true"
          responsiveLayout="scroll"
          v-bind="$attrs"
        >
          <Column
            v-for="col in normalizedColumns"
            :key="col.field"
            :field="col.field"
            :header="col.header"
          >
            <template v-if="col.slotName" #body="slotProps">
              <slot :name="col.slotName" v-bind="slotProps" />
            </template>
          </Column>
        </DataTable>
        <template #fallback>
          <div class="flex items-center justify-center h-full w-full bg-slate-50/50">
            <i class="pi pi-spin pi-spinner text-3xl text-slate-300"></i>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const props = defineProps({
  title: String,
  rowData: {
    type: Array,
    default: () => []
  },
  columnDefs: {
    type: Array,
    required: true
  },
  exportable: Boolean,
  pagination: {
    type: Boolean,
    default: true
  },
  paginationPageSize: {
    type: Number,
    default: 50
  },
  quickFilterText: {
    type: String,
    default: ''
  }
})

const normalizedColumns = computed(() => {
  return (props.columnDefs as any[]).map((c) => ({
    field: c.field,
    header: Object.prototype.hasOwnProperty.call(c, 'headerName')
      ? c.headerName
      : (Object.prototype.hasOwnProperty.call(c, 'header') ? c.header : c.field),
    slotName: c.slotName
  }))
})

const globalFields = computed(() => normalizedColumns.value.map(c => c.field))

const filteredRows = computed(() => {
  const q = (props.quickFilterText || '').trim().toLowerCase()
  if (!q) return props.rowData as any[]
  return (props.rowData as any[]).filter((r) => {
    return globalFields.value.some((f) => String(r[f] ?? '').toLowerCase().includes(q))
  })
})

const tableRef = ref<any | null>(null)

function exportCsv() {
  if (tableRef.value) {
    tableRef.value.exportCSV()
  }
}
</script>
