<template>
  <Button
    v-bind="$attrs"
    :class="[
      'font-medium transition-all shadow-sm flex items-center justify-center gap-2',
      { 'w-full': fullWidth }
    ]"
  >
    <slot></slot>
  </Button>
</template>

<script setup lang="ts">
// PrimeVue Button Wrapper
defineProps({
  fullWidth: {
    type: Boolean,
    default: false
  }
})
</script>
