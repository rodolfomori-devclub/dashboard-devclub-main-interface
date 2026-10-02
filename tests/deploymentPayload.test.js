import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPayload, deploymentArgs, target } from '../scripts/deploy-railway.mjs'

test('Railway payload excludes env, tests, fixtures and built artifacts and fixes production target', async () => {
 const source=await mkdtemp(join(tmpdir(),'dashboard-payload-test-'))
 let payload
 try {
  for(const name of ['Caddyfile','package.json','package-lock.json','vite.config.js','index.html','sessao.html','tailwind.config.js','postcss.config.js'])await writeFile(join(source,name),'fixture')
  for(const name of ['src','src/tests','src/fixtures','public','public/tv-light','public/artifacts','dist'])await mkdir(join(source,name),{recursive:true})
  for(const name of ['src/App.jsx','public/logo.svg','public/tv-light/index.html','public/tv-light/app.js','public/tv-light/style.css','src/App.test.js','src/tests/data.js','src/fixtures/sales.json','src/.env','public/artifacts/screenshot.png','dist/index.html','.env'])await writeFile(join(source,name),'fixture')
  payload=await createPayload(source)
  const files=(await readdir(payload,{recursive:true})).sort()
  assert(files.includes('Caddyfile'));assert(files.includes('sessao.html'));assert(files.includes('src/App.jsx'));assert(files.includes('public/logo.svg'))
  assert(files.includes('public/tv-light/index.html'));assert(files.includes('public/tv-light/app.js'));assert(files.includes('public/tv-light/style.css'))
  assert(!files.some(name=>name.includes('.env')||name.includes('.test.')||name.includes('fixtures')||name.includes('tests')||name.includes('artifacts')||name.includes('dist')))
  assert.deepEqual(deploymentArgs(payload),['up',payload,'--path-as-root','--project',target.project,'--environment',target.environment,'--service',target.service,'--ci'])
  assert.equal(target.project,'9c3066f8-120f-4a25-9756-10d0e934703a')
  assert.equal(target.service,'cd61f257-4826-4cb8-a105-51d40aa6ba7c')
 } finally {await rm(source,{recursive:true,force:true});if(payload)await rm(payload,{recursive:true,force:true})}
})
