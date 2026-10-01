import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const base = `http://127.0.0.1:${port}`
const env = { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback`, DASHBOARD_SMOKE_URL: base }
const server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
server.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-5000) })
server.stderr.on('data', chunk => { output = (output + chunk.toString()).slice(-5000) })
const run = file => new Promise((resolve, reject) => {
 const child = spawn(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], { cwd: root, env, stdio: 'inherit' })
 child.on('error', reject)
 child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${file}: exit ${code}`)))
})
try {
 let ready = false
 for (let attempt=0;attempt<100;attempt++) {
  if(server.exitCode !== null) throw new Error(`Vite exited: ${output}`)
  try { ready = (await fetch(base)).ok } catch { /* Server is starting. */ }
  if(ready)break
  await new Promise(resolve=>setTimeout(resolve,100))
 }
 if(!ready)throw new Error(`Vite did not start: ${output}`)
 await run('./daily-pace-smoke.mjs')
 await run('./goal-pace-hero-smoke.mjs')
 await run('./integration-smoke.mjs')
 await run('./analytics-smoke.mjs')
 await run('./chart-primitives-smoke.mjs')
} finally { server.kill('SIGTERM') }
