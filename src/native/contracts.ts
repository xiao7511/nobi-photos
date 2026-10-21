export type LibraryAccess = 'unavailable' | 'prompt' | 'granted' | 'limited' | 'denied'
export interface DevicePhoto {
  assetId: string
  title: string
  takenAt: string
  modifiedAt: string
  width: number
  height: number
  bytes: number
  bytesKnown: boolean
}
export interface PhotoLibraryBridge {
  getAccess(): Promise<{ status: LibraryAccess }>
  requestAccess(): Promise<{ status: LibraryAccess }>
  openSettings(): Promise<void>
  beginSnapshot(): Promise<{ sessionId: string; total: number }>
  readPage(options: {
    sessionId: string
    offset: number
    limit: number
  }): Promise<{ photos: DevicePhoto[]; nextOffset: number; done: boolean }>
  endSnapshot(options: { sessionId: string }): Promise<void>
  filterAccessible(options: { assetIds: string[] }): Promise<{ assetIds: string[] }>
  thumbnail(options: { assetId: string }): Promise<{ dataUrl: string }>
}
export interface ScanRepository {
  beginScan(id: string): Promise<void>
  stagePage(id: string, photos: DevicePhoto[]): Promise<void>
  commitScan(id: string): Promise<void>
  discardScan(id: string): Promise<void>
}
export interface ScanState {
  status: 'idle' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'error'
  processed: number
  total: number
  error: string
}
export const hasAccess = (access: LibraryAccess) => access === 'granted' || access === 'limited'
