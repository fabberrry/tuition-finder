import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import net from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'

async function freePort() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

export async function startIsolatedApiTest() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const schema = `tuition_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  let app
  let connected = false
  let created = false

  async function stop() {
    if (app && app.exitCode === null) app.kill()
    await delay(250)
    if (connected) {
      await client.query('SET search_path TO public')
      if (created) await client.query(`DROP SCHEMA ${schema} CASCADE`)
      await client.end()
      connected = false
    }
  }

  try {
    await client.connect()
    connected = true
    await client.query(`CREATE SCHEMA ${schema}`)
    created = true
    await client.query(`SET search_path TO ${schema}, public`)
    await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))

    const testUrl = new URL(process.env.DATABASE_URL)
    testUrl.searchParams.set('options', `-csearch_path=${schema},public`)
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
      env: { ...process.env, DATABASE_URL: testUrl.toString() }, stdio: 'ignore',
    })
    let ready = false
    for (let attempt = 0; attempt < 80; attempt++) {
      if (app.exitCode !== null) throw new Error('Next server exited before becoming ready')
      try { ready = (await fetch(`${base}/api/health`)).ok; if (ready) break } catch { /* startup */ }
      await delay(250)
    }
    if (!ready) throw new Error('Next server did not become ready')

    async function request(method, path, payload, token) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { ...(payload ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: payload ? JSON.stringify(payload) : undefined,
      })
      return { status: response.status, body: await response.json() }
    }

    async function expectStatus(method, path, payload, token, expected) {
      const result = await request(method,path,payload,token)
      assert.equal(result.status,expected,`${method} ${path}: ${JSON.stringify(result.body)}`)
      return result.body.data
    }

    return { client, request, expectStatus, stop }
  } catch (error) {
    await stop()
    throw error
  }
}
