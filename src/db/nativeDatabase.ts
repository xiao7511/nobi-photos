import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import { DevicePhotoRepository, migrations } from './deviceRepository'
let opening: Promise<DevicePhotoRepository> | undefined
export function openDeviceRepository() {
  if (!opening)
    opening = open().catch((error) => {
      opening = undefined
      throw error
    })
  return opening
}
async function open() {
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  await sqlite.addUpgradeStatement('nobi_photos', migrations)
  const consistent = (await sqlite.checkConnectionsConsistency()).result
  const exists = (await sqlite.isConnection('nobi_photos', false)).result
  const database =
    consistent && exists
      ? await sqlite.retrieveConnection('nobi_photos', false)
      : await sqlite.createConnection('nobi_photos', false, 'no-encryption', 2, false)
  await database.open()
  const repository = new DevicePhotoRepository({
    query: async (sql, values = []) => (await database.query(sql, values)).values ?? [],
    batch: async (commands) => {
      if (commands.length) await database.executeSet(commands, true)
    },
  })
  await repository.initialize()
  return repository
}
