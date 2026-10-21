import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'app.nobi.photos',
  appName: 'NOBI Photos',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/NoCloud',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
}
export default config
