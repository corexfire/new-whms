import { ref, onMounted, onUnmounted } from 'vue'
import { BrowserMultiFormatReader, DecodeHintType, Result } from '@zxing/library'

export function useScanner(videoElementId: string) {
  const isScanning = ref(false)
  const scannedResult = ref<string>('')
  const error = ref<string | null>(null)
  
  let codeReader: BrowserMultiFormatReader | null = null
  let selectedDeviceId: string | undefined = undefined

  // Audio for successful scan (base64 simple beep or reference to public asset)
  const audioContext = typeof window !== 'undefined' ? new window.AudioContext() : null
  
  function playBeep() {
    if (!audioContext) return
    const osc = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    osc.connect(gainNode)
    gainNode.connect(audioContext.destination)
    osc.start()
    osc.stop(audioContext.currentTime + 0.1)
  }

  onMounted(async () => {
    // Enable multiple formats like EAN-13, CODE_128, QR_CODE
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      // Assuming warehouse usually uses Code 128, EAN 13, EAN 8, QR Code
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
    ])
    
    codeReader = new BrowserMultiFormatReader(hints)
    
    try {
      const videoInputDevices = await codeReader.listVideoInputDevices()
      if (videoInputDevices.length > 0) {
        // Find back camera if on mobile, otherwise take first
        const backCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back'))
        selectedDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId
      } else {
        error.value = 'No camera found on this device.'
      }
    } catch (err: any) {
      error.value = err.message || 'Error accessing camera'
    }
  })

  onUnmounted(() => {
    stopScan()
  })

  async function startScan(onResult?: (text: string) => void) {
    if (!codeReader || !selectedDeviceId) return
    
    error.value = null
    scannedResult.value = ''
    isScanning.value = true
    
    try {
      await codeReader.decodeFromVideoDevice(selectedDeviceId, videoElementId, (result: Result | null, err: any) => {
        if (result) {
          scannedResult.value = result.getText()
          playBeep()
          if (onResult) onResult(scannedResult.value)
          
          // Optional: we can stop scanning immediately upon success or keep it going
          // stopScan() 
        }
        if (err && !(err.name === 'NotFoundException' || err.name === 'ChecksumException' || err.name === 'FormatException')) {
           // We ignore these common soft exceptions during video stream searching
           console.error('Scan Error:', err)
        }
      })
    } catch (err: any) {
      error.value = 'Failed to start camera: ' + err.message
      isScanning.value = false
    }
  }

  function stopScan() {
    if (codeReader) {
      codeReader.reset()
    }
    isScanning.value = false
  }

  return {
    isScanning,
    scannedResult,
    error,
    startScan,
    stopScan
  }
}
