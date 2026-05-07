<template>
  <div class="flex flex-col gap-1 w-full">
    <label v-if="label" class="text-sm font-medium text-slate-700">
      {{ label }} <span v-if="required" class="text-red-500">*</span>
    </label>
    
    <div 
      class="border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer"
      :class="[
        error ? 'border-red-300 bg-red-50 hover:bg-red-100' : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50 relative',
        { 'bg-slate-100 opacity-60 pointer-events-none': disabled }
      ]"
      @click="triggerFile"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <input 
        ref="fileInput" 
        type="file" 
        class="hidden" 
        :accept="accept" 
        :multiple="multiple" 
        @change="handleFileChange" 
        :disabled="disabled"
      />
      
      <div v-if="!modelValue || (Array.isArray(modelValue) && modelValue.length === 0)" class="flex flex-col items-center justify-center gap-2">
        <i class="pi pi-cloud-upload text-3xl text-slate-400"></i>
        <p class="text-sm font-medium text-slate-700">Tarik dokumen ke sini atau Klik untuk unggah</p>
        <p class="text-xs text-slate-500">{{ acceptLabel }}</p>
      </div>

      <div v-else class="flex flex-col gap-2 relative z-10 w-full">
        <!-- Preview list -->
        <div v-for="(file, idx) in (Array.isArray(modelValue) ? modelValue : [modelValue])" :key="idx" 
          class="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
          @click.stop>
          <div class="flex items-center gap-3 overflow-hidden">
            <i class="pi pi-file text-primary-500 text-xl"></i>
            <div class="flex flex-col items-start truncate">
              <span class="text-sm font-medium text-slate-700 truncate w-40 sm:w-64 text-left">{{ file.name }}</span>
              <span class="text-xs text-slate-400">{{ formatSize(file.size) }}</span>
            </div>
          </div>
          <Button icon="pi pi-times" text rounded severity="danger" size="small" @click="removeFile(idx)" />
        </div>
        
        <div class="mt-2 text-primary-600 text-sm font-medium hover:underline inline-flex items-center justify-center gap-1">
          <i class="pi pi-plus text-xs"></i> Add More
        </div>
      </div>
    </div>
    
    <small v-if="error || helperText" :class="error ? 'text-red-500' : 'text-slate-500'">
      {{ error || helperText }}
    </small>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps({
  label: String,
  error: String,
  helperText: String,
  required: Boolean,
  disabled: Boolean,
  multiple: Boolean,
  accept: {
    type: String,
    default: '*'
  },
  modelValue: {
    type: [Object as () => File, Array as () => File[], null],
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const acceptLabel = computed(() => {
  if (props.accept === 'image/*') return 'Maks. JPG/PNG (5MB)'
  if (props.accept === '.csv,.xlsx') return 'Maks. CSV/Excel (10MB)'
  return 'Maks. 10MB per file'
})

function triggerFile() {
  if (!props.disabled) fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(Array.from(target.files))
  }
  // Reset input value so same file can be chosen again if removed
  if (fileInput.value) fileInput.value.value = ''
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  if (props.disabled) return
  
  if (event.dataTransfer?.files) {
    processFiles(Array.from(event.dataTransfer.files))
  }
}

function processFiles(files: File[]) {
  if (files.length === 0) return

  if (!props.multiple) {
    emit('update:modelValue', files[0])
  } else {
    // Append to existing
    const existing = Array.isArray(props.modelValue) ? props.modelValue : (props.modelValue ? [props.modelValue] : [])
    emit('update:modelValue', [...existing, ...files])
  }
}

function removeFile(index: number) {
  if (!props.multiple) {
    emit('update:modelValue', null)
  } else {
    const arr = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    arr.splice(index, 1)
    emit('update:modelValue', arr.length > 0 ? arr : null)
  }
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>
