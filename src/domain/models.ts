export type Category = '自然' | '旅行' | '生活' | '建筑' | '未分类'
export type Theme = 'system' | 'light' | 'dark'
export interface Photo {
  id: string
  title: string
  thumbnail: string
  takenAt: string
  location: string
  category: Category
  tags: string[]
  favorite: boolean
  width: number
  height: number
  bytes: number
  source: 'demo' | 'device'
  assetId?: string
  modifiedAt?: string
  bytesKnown?: boolean
  duplicateGroup?: string
}
export interface PhotoQuery {
  text?: string
  category?: Category
  favoritesOnly?: boolean
}
export interface PhotoRepository {
  list(): Promise<Photo[]>
  setFavorite(id: string, favorite: boolean): Promise<void>
  clearMetadata(): Promise<void>
  restoreDemo(): Promise<void>
}
export interface PhotoManagementService {
  list(query?: PhotoQuery): Promise<Photo[]>
  setFavorite(id: string, favorite: boolean): Promise<void>
  cleanupCandidates(): Promise<Photo[]>
  requestLibraryAccess(): Promise<never>
  deleteOriginals(ids: string[]): Promise<never>
}
export const PRIVACY_POLICY = Object.freeze({
  photoUpload: false,
  cloudAI: false,
  automaticDeletion: false,
  analytics: false,
  automaticLibraryAccess: false,
  registrationRequired: false,
})
