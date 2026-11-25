import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdirSync, openSync, closeSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

process.umask(0o077)
const frontend = fileURLToPath(new URL('../', import.meta.url))
const repo = path.dirname(frontend.replace(/\/$/, ''))
const backend = path.join(repo, 'backend/property-core')
const notifications = path.join(repo, 'backend/property-notifications')
const id = randomBytes(6).toString('hex')
const container = `property-saas-f7-${id}`
const logs = path.join(frontend, '.qa', id)
mkdirSync(logs, { recursive: true })
const children = []
let created = false
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
function sync(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}); ${result.stderr ?? ''}`)
  return result.stdout.trim()
}
async function run(command, args, options = {}) {
  const child = spawn(command, args, { cwd: frontend, stdio: 'inherit', ...options })
  const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
  if (status !== 0) throw new Error(`${command} failed (${status})`)
}
function server(command, args, name, options) {
  const fd = openSync(path.join(logs, name), 'a', 0o600)
  const child = spawn(command, args, { detached: true, stdio: ['ignore', fd, fd], ...options })
  closeSync(fd)
  children.push(child)
  child.on('error', () => {})
  return child
}
async function port() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  await new Promise(resolve => server.close(resolve))
  return address.port
}
async function waitFor(url, child) {
  for (let i = 0; i < 180; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited; inspect ${logs}`)
    try { if ((await fetch(url)).status < 500) return } catch {}
    await pause(500)
  }
  throw new Error(`Server did not start; inspect ${logs}`)
}
async function cleanup() {
  for (const child of children.reverse()) {
    try { process.kill(-child.pid, 'SIGTERM') } catch {}
    for (let i = 0; i < 30 && child.exitCode === null && child.signalCode === null; i++) await pause(100)
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
  }
  if (created) sync('docker', ['rm', '-f', container])
}
process.once('SIGINT', () => { void cleanup().finally(() => process.exit(130)) })
process.once('SIGTERM', () => { void cleanup().finally(() => process.exit(143)) })
try {
  const contract = readFileSync(path.join(repo, 'api-contracts/graphql/notifications.graphqls'))
  const runtimeSchema = readFileSync(path.join(notifications, 'src/main/resources/graphql/notifications.graphqls'))
  if (!contract.equals(runtimeSchema)) throw new Error('The published notification GraphQL contract differs from the runtime schema')
  const appPort = await port(), apiPort = await port(), graphqlPort = await port()
  const env = { ...process.env, POSTGRES_PASSWORD: randomBytes(24).toString('hex') }
  sync('docker', ['run', '--rm', '-d', '--name', container, '--label', 'property-saas.qa=f7', '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=qa_admin', '-e', 'POSTGRES_DB=qa_e2e', '-p', '127.0.0.1::5432', 'postgres:15-alpine'], { env })
  created = true
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'qa_admin', '-d', 'qa_e2e'], { stdio: 'ignore' }).status === 0) { ready = true; break }
    await pause(500)
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
  const dbPort = sync('docker', ['port', container, '5432/tcp']).split(':').at(-1)
  Object.assign(env, {
    SPRING_DATASOURCE_URL: `jdbc:postgresql://localhost:${dbPort}/qa_e2e`, SPRING_DATASOURCE_USERNAME: 'qa_admin',
    JWT_SECRET: randomBytes(32).toString('base64'), BROWSER_CSRF_SECRET: randomBytes(32).toString('base64'),
    BROWSER_ALLOWED_ORIGINS: 'https://app.example.test', QA_DB_CONTAINER: container,
    QA_API_URL: `http://localhost:${apiPort}`, QA_APP_URL: `http://localhost:${appPort}`,
    QA_GRAPHQL_URL: `http://localhost:${graphqlPort}`,
  })
  if (process.argv.includes('--checks')) {
    await run('npm', ['test', '--', '--maxWorkers=2'])
    await run('npm', ['run', 'typecheck'])
    await run('npm', ['run', 'lint'])
    await run('npm', ['run', 'build'])
    const fd = openSync(path.join(logs, 'backend-tests.log'), 'a', 0o600)
    try { await run('./mvnw', ['-o', 'test'], { cwd: backend, env, stdio: ['ignore', fd, fd] }) } finally { closeSync(fd) }
  }
  const api = server('./mvnw', ['-o', 'spring-boot:run'], 'backend.log', { cwd: backend, env: { ...env, SPRING_PROFILES_ACTIVE: 'development', BROWSER_DEV_ALLOWED_ORIGINS: env.QA_APP_URL, SERVER_PORT: String(apiPort), APP_JWT_ACCESS_TOKEN_EXPIRATION: process.env.QA_ACCESS_TOKEN_EXPIRATION ?? '35' } })
  await waitFor(`${env.QA_API_URL}/api/v1/browser-auth/session`, api)
  const graphql = server('./mvnw', ['-o', 'spring-boot:run'], 'notifications.log', {
    cwd: notifications, env: { ...env, CORE_URL: env.QA_API_URL, SERVER_PORT: String(graphqlPort) },
  })
  await waitFor(`${env.QA_GRAPHQL_URL}/actuator/health`, graphql)
  const web = server('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', String(appPort), '--strictPort'], 'frontend.log', { cwd: frontend, env: { ...env, VITE_API_BASE_URL: env.QA_API_URL } })
  await waitFor(env.QA_APP_URL, web)
  console.log(`QA uses disposable PostgreSQL and local servers. Logs: ${path.relative(frontend, logs)}`)
  await run('npx', ['playwright', 'test', ...(process.env.QA_SPEC ? [process.env.QA_SPEC] : [])], { env })
  if (process.argv.includes('--cdp')) {
    await run('node', ['scripts/auth-browser-integration.mjs'], { env: { ...env, AUTH_API_URL: env.QA_API_URL, AUTH_APP_URL: env.QA_APP_URL } })
    await run('node', ['scripts/dashboard-browser-integration.mjs'], { env: { ...env, F6_API_URL: env.QA_API_URL, F6_APP_URL: env.QA_APP_URL } })
  }
} catch (error) {
  console.error(error.message)
  console.error(`Validation logs: ${logs}`)
  process.exitCode = 1
} finally { await cleanup() }
