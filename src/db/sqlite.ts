import schema from './schema.sql?raw'
export const SQLITE_SCHEMA_V1 = schema
export type SqlValue = string | number | null
/** Platform-neutral port. Native SQLite driver and permissions are Phase 2 work. */
export interface SqliteConnection {
  execute(sql: string): Promise<void>
  run(sql: string, values: SqlValue[]): Promise<{ changes: number }>
}
export class SqliteMetadataStore {
  constructor(private connection: SqliteConnection) {}
  initialize() {
    return this.connection.execute(SQLITE_SCHEMA_V1)
  }
  async setFavorite(id: string, favorite: boolean) {
    const { changes } = await this.connection.run(
      'UPDATE photos SET is_favorite = ? WHERE id = ?',
      [favorite ? 1 : 0, id],
    )
    if (changes === 0) throw new Error('未找到照片')
  }
}
