import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PhotoLibraryBridge } from './contracts'
export const isNative = Capacitor.isNativePlatform()
export const photoBridge = registerPlugin<PhotoLibraryBridge>('NobiPhotoLibrary')
