import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'app.nobi.photos',
  appName: 'NOBI Photos',
  webDir: 'dist',
  loggingBehavior: 'none',
  server: { androidScheme: 'https' },
  plugins: {
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/NoCloud',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
}
export default config
