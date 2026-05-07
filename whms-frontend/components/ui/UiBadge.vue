<template>
  <Badge :value="label" :severity="colorSeverity" class="font-bold tracking-wider px-2 py-0.5" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: string | number
}>()

const label = computed(() => {
  return String(props.value).replace(/_/g, ' ')
})

const colorSeverity = computed(() => {
  const v = String(props.value).toUpperCase()
  if (['APPROVED', 'COMPLETED', 'SYNCED', 'SUCCESS'].includes(v)) return 'success'
  if (['PENDING', 'PROCESSING', 'DRAFT'].includes(v)) return 'warning'
  if (['REJECTED', 'CANCELLED', 'FAILED', 'CONFLICT'].includes(v)) return 'danger'
  return 'info'
})
</script>
