<template>
  <div v-if="!active" class="contents">
    <slot />
  </div>
  <div v-else class="space-y-4">
    <template v-for="i in count" :key="i">
      <Skeleton :width="width" :height="height" :shape="shape" class="bg-slate-200" />
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  active: {
    type: Boolean,
    default: true
  },
  count: {
    type: Number,
    default: 1
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '2rem'
  },
  shape: {
    type: String as () => 'rectangle' | 'circle' | 'square',
    default: 'rectangle'
  }
})
</script>
