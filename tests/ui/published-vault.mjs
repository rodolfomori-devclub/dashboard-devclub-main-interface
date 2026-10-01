import assert from 'node:assert/strict'

const configuration = /vaultUrl:"([^"]+)",clientId:"([^"]+)",redirectUri:"([^"]+)"/
const privateChunk = /\/(?:PrivateWorkspace|AuthContext|api|vault|vault-sdk)-[A-Za-z0-9_-]+\.js$/

/** Read only public JS assets to seed synthetic auth in production UI fixtures.
 * The anonymous entry no longer contains the Vault SDK: follow its named private
 * workspace/auth chunks, never a real API, external URL or runtime script.
 */
export async function readPublishedVault({ base, main, fetcher = fetch }) {
  const origin = new URL(base).origin
  const entry = new URL(main, `${origin}/`)
  assert.equal(entry.origin, origin, 'The published entry must be a same-origin public asset')
  assert.match(entry.pathname, /^\/assets\/[A-Za-z0-9_-]+\.js$/, 'The published entry must be a JavaScript asset')
  const queue = [entry.href], visited = new Set()
  while (queue.length && visited.size < 16) {
    const address = queue.shift()
    if (visited.has(address)) continue
    visited.add(address)
    const response = await fetcher(address, { credentials: 'omit', redirect: 'error', cache: 'no-store' })
    assert.equal(response.status, 200, 'Published application JavaScript must load successfully')
    const bundle = await response.text()
    const match = bundle.match(configuration)
    if (match) {
      const [, vaultUrl, clientId, redirectUri] = match
      assert.equal(new URL(redirectUri).origin, origin, 'Published Vault redirect must return to this Dashboard')
      return { vaultUrl, clientId, redirectUri, assetPaths: [...visited].map(address => new URL(address).pathname) }
    }
    for (const reference of bundle.matchAll(/["']((?:\.\/|\/assets\/|assets\/)[^"']+\.js)["']/g)) {
      const next = new URL(reference[1], reference[1].startsWith('assets/') ? `${origin}/` : address)
      if (next.origin === origin && next.pathname.startsWith('/assets/') && privateChunk.test(next.pathname) && !next.search && !next.hash && !visited.has(next.href)) queue.push(next.href)
    }
  }
  assert.fail('Published Vault public configuration was not found in the entry or its private workspace/auth chunks')
}
