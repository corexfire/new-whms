<template>
  <div class="flex flex-col gap-1 w-full">
    <label v-if="label" :for="id" class="text-sm font-medium text-slate-700">
      {{ label }} <span v-if="required" class="text-red-500">*</span>
    </label>
    
    <IconField v-if="icon" :iconPosition="iconPosition">
      <InputIcon :class="['pi', icon, 'text-slate-400']" />
      <InputText 
        :id="id" 
        v-model="model" 
        v-bind="$attrs" 
        :class="['w-full', { 'p-invalid': error }]" 
      />
    </IconField>
    
    <InputText 
      v-else 
      :id="id" 
      v-model="model" 
      v-bind="$attrs" 
      :class="['w-full', { 'p-invalid': error }]" 
    />
    
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
  icon: String,
  iconPosition: {
    type: String,
    default: 'left'
  }
})

const id = useId()
const model = defineModel<string | number>()
</script>
