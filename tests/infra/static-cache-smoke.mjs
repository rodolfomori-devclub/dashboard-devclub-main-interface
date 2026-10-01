// Runs the production Caddyfile against synthetic files in an isolated local container.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm, chmod, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixture = await mkdtemp(join(tmpdir(), 'devclub-static-cache-'))
const config = join(root, 'Caddyfile')
const image = process.env.CADDY_TEST_IMAGE || 'caddy:2.11.4-alpine'
const docker = args => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim()
let container
try {
  await chmod(fixture, 0o755)
  await mkdir(join(fixture, 'assets'))
  await writeFile(join(fixture, 'index.html'), '<!doctype html><html><body>release-one</body></html>')
  await writeFile(join(fixture, 'assets', 'app-fixture1234.js'), 'export const release = 1;')
  await writeFile(join(fixture, 'assets', 'plain.js'), 'export const plain = true;')
  // The official Caddy binary carries NET_BIND_SERVICE as a file capability.
  const common = ['--rm', '--read-only', '--cap-drop', 'ALL', '--cap-add', 'NET_BIND_SERVICE', '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp', '--tmpfs', '/config', '--tmpfs', '/data', '-e', 'PORT=8080', '-v', `${config}:/etc/caddy/Caddyfile:ro`, '-v', `${fixture}:/app/dist:ro`]
  docker(['run', ...common, image, 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
  container = docker(['run', '-d', ...common, '-p', '127.0.0.1::8080', image, 'caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
  const address = docker(['port', container, '8080/tcp']).split('\n')[0]
  const base = `http://${address}`
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch(`${base}/health`)).ok } catch { /* Local container is starting. */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, 'Caddy did not become ready')
  let etag
  for (const path of ['/', '/metas', '/pace?year=2026&month=10', '/callback?code=fixture&state=fixture']) {
    const response = await fetch(base + path)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /text\/html/)
    assert.equal(response.headers.get('cache-control'), 'no-cache, max-age=0, must-revalidate')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.match(await response.text(), /release-one/)
    etag = response.headers.get('etag'); assert(etag)
  }
  const unchanged = await fetch(base + '/metas', { headers: { 'If-None-Match': etag } })
  assert.equal(unchanged.status, 304)
  assert.equal(unchanged.headers.get('cache-control'), 'no-cache, max-age=0, must-revalidate')
  await writeFile(join(fixture, 'index-next.html'), '<!doctype html><html><body>release-two-current</body></html>')
  await rename(join(fixture, 'index-next.html'), join(fixture, 'index.html'))
  // Docker Desktop may propagate host bind-mount updates asynchronously.
  let visible = false
  for (let attempt = 0; attempt < 40; attempt++) {
    visible = (await (await fetch(base + '/')).text()).includes('release-two-current')
    if (visible) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert(visible, 'Updated HTML did not become visible in the local container')
  const updated = await fetch(base + '/metas', { headers: { 'If-None-Match': etag } })
  assert.equal(updated.status, 200); assert.match(await updated.text(), /release-two-current/)
  for (const method of ['GET', 'HEAD']) {
    const asset = await fetch(base + '/assets/app-fixture1234.js', { method })
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('content-type'), /javascript/)
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable')
    const missing = await fetch(base + '/assets/old-removed123.js', { method })
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('cache-control'), 'no-store')
    assert.doesNotMatch(missing.headers.get('content-type') || '', /html/)
    assert.doesNotMatch(await missing.text(), /release-two-current/)
  }
  const plain = await fetch(base + '/assets/plain.js')
  assert.equal(plain.headers.get('cache-control'), 'no-cache, max-age=0, must-revalidate')
  console.log(JSON.stringify({ passed: true, image, checks: ['HTML direct routes and OAuth callback revalidate', 'ETag 304 and changed HTML 200', 'Existing hashed JS GET/HEAD immutable', 'Missing hashed JS GET/HEAD 404 without HTML', 'Unversioned assets revalidate'] }))
} finally {
  if (container) docker(['stop', '--time', '2', container])
  await rm(fixture, { recursive: true, force: true })
}
