<template>
  <Dialog
    v-model:visible="visible"
    :header="title"
    :modal="true"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    :style="{ width: width }"
    :draggable="false"
    :dismissableMask="true"
  >
    <div class="py-4">
      <slot />
    </div>
    
    <template #footer>
      <div class="flex justify-end gap-2 w-full mt-4">
        <slot name="footer">
          <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="visible = false" />
          <Button v-if="confirmLabel" :label="confirmLabel" icon="pi pi-check" :loading="loading" @click="$emit('confirm')" />
        </slot>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const props = defineProps({
  title: String,
  width: {
    type: String,
    default: '50vw'
  },
  confirmLabel: String,
  loading: Boolean
})

const visible = defineModel<boolean>()
defineEmits(['confirm'])
</script>
