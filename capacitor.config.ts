import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'app.nobi.photos',
  appName: 'NOBI Photos',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  // Phase 1: no camera, filesystem, media-library or network plugins.
}
export default config
