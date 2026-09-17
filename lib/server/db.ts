import { Pool, type PoolClient, type QueryResultRow } from 'pg'

declare global { var tuitionPool: Pool | undefined }

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  return globalThis.tuitionPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
}

export async function rows<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return (await db().query<T>(sql, values)).rows
}

export async function one<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return (await rows<T>(sql, values))[0] ?? null
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    const value = await work(client)
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
