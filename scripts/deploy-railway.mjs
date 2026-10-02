import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

export const target = Object.freeze({
 project: '9c3066f8-120f-4a25-9756-10d0e934703a',
 environment: '3bb4746f-e0ae-4972-a9d1-7ff947d99792',
 service: 'cd61f257-4826-4cb8-a105-51d40aa6ba7c',
})
const root = fileURLToPath(new URL('../', import.meta.url))
// sessao.html is the second Vite entry: the lead's shared window (Apoio Vendas).
const rootFiles = ['Caddyfile', 'package.json', 'package-lock.json', 'vite.config.js', 'index.html', 'sessao.html', 'tailwind.config.js', 'postcss.config.js']
const excluded = new Set(['node_modules', 'dist', 'artifacts', 'fixtures', 'tests', '__tests__', 'test-results', 'playwright-report', '.git'])
export async function createPayload(source = root) {
 const destination = await mkdtemp(join(tmpdir(), 'devclub-dashboard-front-'))
 try {
  for (const name of rootFiles) await cp(join(source, name), join(destination, name))
  for (const name of ['src', 'public']) await cp(join(source, name), join(destination, name), {
   recursive: true,
   filter: path => !path.slice(source.length + 1).split(/[\\/]/).some(part => excluded.has(part) || part.startsWith('.env') || /\.(test|spec)\./.test(part)),
  })
  return destination
 } catch (error) { await rm(destination, { recursive: true, force: true }); throw error }
}
export const deploymentArgs = payload => ['up', payload, '--path-as-root', '--project', target.project, '--environment', target.environment, '--service', target.service, '--ci']
async function main() {
 const check = process.argv.includes('--check')
 const payload = await createPayload()
 try {
  console.log(`Railway frontend: ${target.service}; environment: production`)
  console.log(`Payload roots: ${(await readdir(payload)).sort().join(', ')}`)
  if (check) { console.log('Payload validated. No upload or deployment executed.'); return }
  await new Promise((done, fail) => {
   const child = spawn('railway', deploymentArgs(payload), { cwd: root, stdio: 'inherit' })
   child.on('error', fail)
   child.on('exit', code => code === 0 ? done() : fail(new Error(`Railway exited with code ${code}`)))
  })
 } finally { await rm(payload, { recursive: true, force: true }) }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
