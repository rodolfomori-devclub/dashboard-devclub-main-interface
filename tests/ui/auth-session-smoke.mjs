// Isolated browser regression: synthetic tokens, intercepted APIs, no production access.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const base = `http://127.0.0.1:${port}`
const env = { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_HUB_URL: `${base}/vault-fixture`, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }
const server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
let output = '', browser
server.stdout.on('data', chunk => { output = (output + chunk).slice(-2000) })
server.stderr.on('data', chunk => { output = (output + chunk).slice(-2000) })
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = generation => `${encode({alg:'RS256',kid:'ui-fixture-only'})}.${encode({sub:'fixture-user',iss:'fixture-vault',aud:'local-fixture-client',token_use:'access',exp:4102444800,generation})}.fixture-signature-not-valid`
const originalToken = token('original'), refreshedToken = token('refreshed')
const user = { sub:'fixture-user', name:'Fixture', email:'fixture@example.test', permissions:['today'], isAdmin:false }
const financialPaths = new Set(['/api/transactions','/api/refunds','/api/hotmart/vendas','/api/hotmart/reembolsos','/api/boleto/vendas/data','/api/boleto/asaas/vendas','/api/boleto/boletex/vendas','/api/sales-ops/ledger'])
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const results = []

async function scenario(name, seed, check) {
  const context = await browser.newContext({ locale:'pt-BR', timezoneId:'America/Sao_Paulo' })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.addInitScript(({access,refresh}) => {
    if(access) localStorage.setItem('vault_access_token',access)
    if(refresh) localStorage.setItem('vault_refresh_token',refresh)
  }, seed)
  const state = { access:'ready', refresh:'valid', ...seed.state }
  const calls = [], errors = [], externalRequests = []
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if(url.origin !== base) { externalRequests.push(url.origin); return route.abort() }
    if(url.pathname === '/oauth/token') {
      calls.push({path:url.pathname})
      const body = req.postDataJSON()
      assert.equal(body.grant_type,'refresh_token')
      assert.equal(body.client_id,'local-fixture-client')
      assert.equal(body.refresh_token,'fixture-refresh-token')
      await pause(40) // Exercise shared refresh while StrictMode requests overlap.
      return route.fulfill({status:state.refresh === 'valid' ? 200 : 400,contentType:'application/json',body:JSON.stringify(state.refresh === 'valid' ? {access_token:refreshedToken,refresh_token:'fixture-refresh-rotated'} : {error:'invalid_grant'})})
    }
    if(!url.pathname.startsWith('/api/')) return route.continue()
    const bearer = req.headers().authorization
    assert.ok([`Bearer ${originalToken}`,`Bearer ${refreshedToken}`].includes(bearer), 'API request must carry a fixture access token')
    const call = {path:url.pathname,refreshed:bearer === `Bearer ${refreshedToken}`}
    calls.push(call)
    if(url.pathname === '/api/access') {
      if(state.access === 'offline') { call.status = 0; return route.abort('internetdisconnected') }
      const failed = state.access === 'denied' ? [403,'DASHBOARD_ACCESS_REQUIRED'] : state.access === 'unavailable' ? [503,'VAULT_UNAVAILABLE'] : state.access === 'unauthorized' || (state.access === 'refresh-needed' && !call.refreshed) ? [401,'VAULT_TOKEN_INVALID'] : null
      call.status = failed?.[0] || 200
      return route.fulfill({status:call.status,contentType:'application/json',body:JSON.stringify(failed ? {error:'Fixture access error',code:failed[1]} : {user})})
    }
    let body = {data:[],plans:[]}
    if(url.pathname === '/api/sales-ops/ledger') body = {data:{attributions:[],manualSales:[]}}
    else if(url.pathname === '/api/hotmart/vendas' || url.pathname === '/api/hotmart/reembolsos') body = {success:true,data:{count:0,totalGross:0,totalNet:0,totalFees:0,totalRefundAmount:0,transactions:[]}}
    else if(url.pathname === '/api/boleto/asaas/vendas') body = {success:true,data:{totalGross:0,totalNet:0,totalFees:0,count:0,sales:null,totalPurchaseValue:null,cashReceipts:[],availability:{cash:'ready',sales:'unavailable',reason:'checkout_disabled'}}}
    else if(url.pathname === '/api/boleto/boletex/vendas') body = {success:true,data:{sales:{count:0,totalValue:0,entries:[]}}}
    else if(url.pathname.startsWith('/api/goals/')) body = {success:true,data:{meta:0,superMeta:0,ultraMeta:0}}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.on('pageerror',error => errors.push(error.message))
  try {
    await page.goto(`${base}/diario`,{waitUntil:'networkidle'})
    const providerCalls = () => calls.filter(call => financialPaths.has(call.path))
    const accessCalls = () => calls.filter(call => call.path === '/api/access')
    const refreshCalls = () => calls.filter(call => call.path === '/oauth/token')
    const unchanged = async () => { const count = calls.length; await pause(550); assert.equal(calls.length,count,'Authentication must not retry continuously') }
    const recovered = async () => {
      await page.getByRole('heading',{name:'Diário de vendas',exact:true}).waitFor()
      await page.waitForLoadState('networkidle')
      assert.ok(providerCalls().length >= 7, 'Authorized screen should load its financial sources')
    }
    await check({page,state,calls,providerCalls,accessCalls,refreshCalls,unchanged,recovered})
    assert.deepEqual(errors,[])
    assert.deepEqual(externalRequests,[])
    results.push({name,passed:true,accessRequests:accessCalls().length,refreshRequests:refreshCalls().length,providerRequests:providerCalls().length})
    console.log(`PASS ${name}`)
  } finally { await context.close() }
}

try {
  let ready = false
  for(let i=0;i<100;i++) {
    if(server.exitCode !== null) throw new Error(output)
    try { ready = (await fetch(base)).ok } catch { /* startup */ }
    if(ready) break
    await pause(100)
  }
  assert.equal(ready,true,output)
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined)})

  await scenario('anonymous does not query any API, including retry and focus',{},async ({page,calls,unchanged}) => {
    await page.getByRole('button',{name:'Entrar pelo Vault',exact:true}).waitFor()
    assert.equal(calls.length,0)
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click()
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await unchanged()
    assert.equal(calls.length,0)
  })
  await scenario('403 explains missing Dashboard access, blocks providers, and manual retry recovers',{access:originalToken,state:{access:'denied'}},async ({page,state,providerCalls,accessCalls,refreshCalls,unchanged,recovered}) => {
    await page.getByRole('heading',{name:'Acesso ao Dashboard não configurado',exact:true}).waitFor()
    const vault = page.getByRole('link',{name:'Abrir Vault',exact:true})
    assert.equal(await vault.getAttribute('href'),`${base}/vault-fixture`)
    assert.equal(await vault.getAttribute('target'),'_blank')
    assert.equal(providerCalls().length,0); assert.equal(refreshCalls().length,0)
    await unchanged()
    const before = accessCalls().length
    state.access='ready'
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click()
    await recovered()
    assert.equal(accessCalls().length,before+1)
  })
  await scenario('401 refreshes once and retries with the new token before loading providers',{access:originalToken,refresh:'fixture-refresh-token',state:{access:'refresh-needed'}},async ({accessCalls,refreshCalls,providerCalls,recovered,unchanged}) => {
    await recovered();await unchanged()
    assert.equal(refreshCalls().length,1)
    assert.ok(accessCalls().some(call=>call.status===401))
    assert.ok(accessCalls().some(call=>call.status===200&&call.refreshed))
    assert.ok(providerCalls().every(call=>call.refreshed))
  })
  await scenario('refresh-only startup renews before access validation',{refresh:'fixture-refresh-token'},async ({calls,accessCalls,refreshCalls,recovered}) => {
    await recovered()
    assert.equal(calls[0].path,'/oauth/token')
    assert.equal(refreshCalls().length,1)
    assert.ok(accessCalls().every(call=>call.refreshed))
  })
  await scenario('invalid startup refresh shows expired session without access or provider requests',{refresh:'fixture-refresh-token',state:{refresh:'invalid'}},async ({page,accessCalls,refreshCalls,providerCalls,unchanged}) => {
    await page.getByRole('heading',{name:'Sua sessão expirou',exact:true}).waitFor()
    await page.getByRole('button',{name:'Entrar pelo Vault',exact:true}).waitFor()
    assert.equal(refreshCalls().length,1);assert.equal(accessCalls().length,0);assert.equal(providerCalls().length,0)
    assert.equal(await page.evaluate(()=>localStorage.getItem('vault_refresh_token')),null)
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click()
    await unchanged()
    assert.equal(accessCalls().length,0);assert.equal(refreshCalls().length,1)
  })
  await scenario('401 with invalid refresh ends at login without a provider burst',{access:originalToken,refresh:'fixture-refresh-token',state:{access:'unauthorized',refresh:'invalid'}},async ({page,refreshCalls,providerCalls,unchanged}) => {
    await page.getByRole('heading',{name:'Sua sessão expirou',exact:true}).waitFor()
    await page.getByRole('button',{name:'Entrar pelo Vault',exact:true}).waitFor()
    assert.equal(refreshCalls().length,1);assert.equal(providerCalls().length,0)
    await unchanged()
  })
  await scenario('503 preserves unavailable state without login or loop and retry recovers',{access:originalToken,state:{access:'unavailable'}},async ({page,state,accessCalls,providerCalls,refreshCalls,unchanged,recovered}) => {
    await page.getByRole('heading',{name:'Não foi possível verificar seu acesso',exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Entrar pelo Vault',exact:true}).count(),0)
    assert.equal(providerCalls().length,0);assert.equal(refreshCalls().length,0)
    await unchanged()
    const before=accessCalls().length;state.access='ready'
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click()
    await recovered();assert.equal(accessCalls().length,before+1)
  })
  await scenario('an open session survives a background outage or network failure; an authorization answer still ends it',{access:originalToken},async ({page,state,accessCalls,recovered}) => {
    await recovered()
    const heading = page.getByRole('heading',{name:'Diário de vendas',exact:true})
    for(const outage of ['unavailable','offline']) {
      const before = accessCalls().length
      state.access = outage
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await pause(400)
      assert.ok(accessCalls().length > before, `${outage}: the background check ran`)
      assert.ok(await heading.isVisible(), `${outage}: the screen stays open`)
      assert.equal(await page.getByRole('button',{name:'Entrar pelo Vault',exact:true}).count(),0)
    }
    state.access = 'denied'
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.getByRole('heading',{name:'Acesso ao Dashboard não configurado',exact:true}).waitFor()
  })
  console.log(JSON.stringify({passed:true,externalRequests:0,scenarios:results}))
} finally {
  if(browser) await browser.close()
  server.kill('SIGTERM')
}
