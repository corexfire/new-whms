<template>
  <div class="flex flex-col gap-1 w-full">
    <label v-if="label" :for="id" class="text-sm font-medium text-slate-700">
      {{ label }} <span v-if="required" class="text-red-500">*</span>
    </label>
    
    <Select
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :options="options"
      :class="['w-full', { 'p-invalid': error }]"
      :loading="loading"
    >
      <!-- Forwarding scoped slots implicitly via setup -->
      <template v-for="(_, name) in $slots" #[name]="slotData">
        <slot :name="name" v-bind="slotData" />
      </template>
    </Select>
    
    <small v-if="error || helperText" :class="error ? 'text-red-500' : 'text-slate-500'">
      {{ error || helperText }}
    </small>
  </div>
</template>

<script setup lang="ts">
import { useId } from '#imports'

const props = defineProps({
  label: String,
  error: String,
  helperText: String,
  required: Boolean,
  options: {
    type: Array,
    default: () => []
  },
  loading: Boolean
})

const id = useId()
const model = defineModel<any>()
</script>
