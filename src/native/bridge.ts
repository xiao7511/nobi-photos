import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PhotoLibraryBridge, PhotoIntelligenceBridge } from './contracts'
export const isNative = Capacitor.isNativePlatform()
export const photoBridge = registerPlugin<PhotoLibraryBridge & PhotoIntelligenceBridge>(
  'NobiPhotoLibrary',
)
