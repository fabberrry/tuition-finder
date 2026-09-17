import { readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  console.log('Schema applied')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await client.end()
}
