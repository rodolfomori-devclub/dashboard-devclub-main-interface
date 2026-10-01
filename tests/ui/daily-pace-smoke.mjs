import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/daily-pace', import.meta.url))
await fs.mkdir(out, { recursive: true })
const base = process.env.DASHBOARD_SMOKE_URL || 'http://localhost:4317'
const date = '2026-09-15'
const timestamp = Math.floor(new Date(`${date}T11:30:00-03:00`).getTime()/1000)
const guruRows = [
  ['g1','DevClub Full Stack',1000,'credit_card','meta','campanha-devclub'],
  ['g2','MBA em Inteligência Artificial',2000,'pix','comercial','turma-mba'],
  ['g3','Formação Gestor de IA',500,'pix','youtube','ia-club']
].map(([hash, product, net, method, source, campaign],index) => ({hash,product:{name:product},payment:{method,total:net+50},calculation_details:{net_amount:net,total_amount:net+50,discounts:{processing_fee:50},net_affiliate_value:0},dates:{created_at:timestamp+index*3600},contact:{name:'Cliente de demonstração',email:`cliente${index}@example.test`},trackings:{utm_source:source,utm_medium:'campanha',utm_campaign:campaign,utm_content:`criativo-${index+1}`,utm_term:'desenvolvimento'}}))
const apiCalls=[]
let failedBoletex=false
const errors=[]
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath = process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined)
const browser=await chromium.launch({headless:true,executablePath})
const context=await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo'})
// Unexpired synthetic JWT for UI fixtures only; all API calls below are intercepted.
await context.addInitScript(() => {
  const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const token = `${encode({alg:'RS256',kid:'ui-fixture-only'})}.${encode({sub:'fixture-user',iss:'fixture-vault',aud:'local-fixture-client',token_use:'access',exp:4102444800})}.fixture-signature-not-valid`
  localStorage.setItem('vault_access_token', token)
})
// Isolate Vite HMR and every external websocket during deterministic fixture checks.
if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
await context.route('**/*',async route=>{
 const url=new URL(route.request().url())
 if(url.origin!==base){ await route.abort(); return }
 if(!url.pathname.startsWith('/api/')){await route.continue();return}
 apiCalls.push(url.pathname)
 let body
 if(url.pathname==='/api/access')body={user:{sub:'fixture-user',email:'qa@example.test',name:'QA local',permissions:['today','daily','monthly','yearly','goal-pace','goals'],isAdmin:true}}
 else if(url.pathname==='/api/transactions')body={data:guruRows}
 else if(url.pathname==='/api/refunds')body={data:[]}
 else if(url.pathname==='/api/hotmart/vendas')body={success:true,data:{count:1,totalGross:300,totalNet:250,totalFees:50,transactions:[{transaction:'h1',product:'Seu segundo salário com IA',grossValue:300,netValue:250,fee:50,paymentMethod:'PIX',orderDate:`${date}T16:10:00-03:00`}]}}
 else if(url.pathname==='/api/hotmart/reembolsos')body={success:true,data:{count:0,totalRefundAmount:0,transactions:[]}}
 else if(url.pathname.startsWith('/api/boleto/vendas/'))body={success:true,data:[{id:'tmb-1-0',raw:{pedido_id:1},product:'DevClub Vitalício',value:800,timestamp:`${date}T10:00:00-03:00`,utm_source:'comercial'}]}
 else if(url.pathname==='/api/boleto/asaas/vendas')body={success:true,data:{cashReceipts:[{date,received:900,count:1}],sales:{count:1,totalValue:1000,entryValue:200,entries:[{id:'a1',productDescription:'MBA em IA',totalValue:1000,entryValue:200,createdAt:`${date}T09:20:00-03:00`}]}}}
 else if(url.pathname==='/api/boleto/boletex/vendas'){
  if(failedBoletex){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false})});return}
  body={success:true,data:{sales:{count:1,totalValue:2000,confirmedValue:400,pendingValue:1600,listPriceValue:1800,entries:[{id:'b1',productDescription:'IAClub',totalValue:2000,listPrice:1800,entryValue:400,pendingValue:1600,createdAt:`${date}T14:10:00-03:00`}]},emitted:{count:3,expectedEntryValue:600}}}
 }
 else if(url.pathname==='/api/sales-ops/ledger')body={data:{attributions:[{source:'guru',externalId:'g1',sellerId:'ana',sellerName:'Ana'}],manualSales:[{id:1,date,product:'DevClub - renovação',family:'DevClub',gross:650,net:600,cashCollected:600,buyerName:'QA manual',buyerEmail:'qa-manual@example.test',sellerId:'ana',sellerName:'Ana',platform:'Guru',status:'pending',utm:{source:'comercial'},syncPending:false}]}}
 else if(url.pathname==='/api/goal-plans/options')body={teams:[{id:'commercial',name:'Comercial',active:true}],individuals:[{id:'ana',name:'Ana',teamId:'commercial',active:true}]}
 else if(url.pathname.startsWith('/api/goal-plans/'))body={plans:[{id:1,product:'all',metric:'operational',target:30000,superTarget:35000,ultraTarget:40000,paceBasis:'calendar'},{id:2,updatedAt:date+'T12:00:00Z',notes:'',product:'DevClub',metric:'operational',target:10000,superTarget:12000,ultraTarget:15000,paceBasis:'business'}]}
 else body={data:[],plans:[]}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
})
const page=await context.newPage()
const revenueCard=()=>page.locator('article').filter({has:page.getByRole('heading',{name:'Valor das vendas',exact:true})})
await page.clock.setFixedTime(new Date('2026-09-15T15:00:00-03:00'))
page.on('pageerror',error=>errors.push(error.message))
for(const width of [1440,360]){
 await page.setViewportSize({width,height:1000})
 for(const theme of ['light','dark']){
  for(const [path,key] of [['/diario','daily'],['/pace','pace']]){
   await page.goto(`${base}${path}`,{waitUntil:'networkidle'})
   await page.getByRole('heading',{name:key==='daily'?'Diário de vendas':'Metas e ritmo de vendas',exact:true}).waitFor()
   await page.waitForFunction(()=>!document.querySelector('button.button-primary:disabled'))
   if(await page.evaluate(()=>document.documentElement.classList.contains('dark')) !== (theme === 'dark')) await page.getByRole('button',{name:theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',exact:true}).click()
   assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),theme === 'dark')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`${key} ${theme} width ${width} overflow`)
   await page.screenshot({path:`${out}/${key}-${theme}-${width}.png`,fullPage:true,animations:'disabled'})
   if(key==='daily'){
    assert.match(await revenueCard().innerText(),/8.150,00/)
    assert.equal(await page.evaluate(()=>Boolean(document.querySelector('.revenue-highlights').compareDocumentPosition(document.querySelector('.daily-filters'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'financial highlights must precede extensive filters')
    const paymentCard=label=>page.locator('.revenue-card').filter({has:page.getByRole('heading',{name:label,exact:true})})
    assert.match(await paymentCard('Cartão').locator('.revenue-card-value').innerText(),/1.000,00/,'Pix must never be classified as card revenue')
    assert.match(await paymentCard('Boleto').locator('.revenue-card-value').innerText(),/3.800,00/)
    assert.match(await page.locator('.revenue-other-payments').innerText(),/2.750,00/)
    const beforeInteraction=apiCalls.length
    for(const label of ['Cartão','Boleto']){
     const card=paymentCard(label), detail=card.locator('details')
     assert.equal(await detail.getAttribute('open'),null)
     await card.locator('summary').focus();await page.keyboard.press('Enter')
     assert.notEqual(await detail.getAttribute('open'),null)
     for(const source of ['Guru','Hotmart','TMB','Asaas'])assert.match(await card.locator('.revenue-provider-list').innerText(),new RegExp(source))
     await page.keyboard.press('Enter')
    }
    const notifications=page.getByRole('region',{name:'Notificações dos dados'})
    assert.equal(await notifications.isVisible(),false)
    await page.locator('.revenue-notifications > summary').click()
    await notifications.waitFor()
    const bounds=await notifications.boundingBox()
    assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,'notifications must fit the viewport')
    await page.screenshot({path:`${out}/notifications-${theme}-${width}.png`,animations:'disabled'})
    await page.keyboard.press('Escape')
    assert.equal(await notifications.isVisible(),false)
    assert.equal(apiCalls.length,beforeInteraction,'expansion and notifications must not request data')
    const before=apiCalls.length
    await page.getByLabel('Família de produto',{exact:true}).selectOption('Seu segundo salário com IA')
    assert.match(await revenueCard().innerText(),/250,00/)
    assert.equal(apiCalls.length,before,'Local filter unexpectedly refetched APIs')
    await page.getByRole('button',{name:/Limpar filtros/}).click()
   } else {
    await page.getByLabel('Base financeira',{exact:true}).selectOption('operational')
    assert.match(await page.locator('.pace-stat').first().innerText(),/8.150,00/)
    await page.getByLabel('Base financeira',{exact:true}).selectOption('net')
    assert.match(await page.locator('.pace-target').innerText(),/Sem meta/)
   }
  }
 }
}
await page.goto(`${base}/pace`,{waitUntil:'networkidle'})
await page.getByRole('heading',{name:'Metas e ritmo de vendas',exact:true}).waitFor()
await page.waitForFunction(()=>!document.querySelector('button.button-primary:disabled'))
assert.match(await page.locator('.pace-stat').first().innerText(),/8.400,00/)
await page.getByLabel('Base financeira',{exact:true}).selectOption('cash')
assert.match(await page.locator('.pace-stat').first().innerText(),/1.820,00/)
await page.getByRole('group',{name:'Escopo da meta'}).getByRole('button',{name:'Time',exact:true}).click()
assert.match(await page.locator('.pace-stat').first().innerText(),/600,00/)
assert.match(await page.locator('.daily-feedback').innerText(),/1.220,00.*sem time/)
await page.getByLabel('Base financeira',{exact:true}).selectOption('gross')
assert.match(await page.locator('.pace-stat').first().innerText(),/1.700,00/)
await page.getByRole('group',{name:'Escopo da meta'}).getByRole('button',{name:'Indivíduo',exact:true}).click()
assert.match(await page.locator('.pace-stat').first().innerText(),/1.700,00/)
await page.getByRole('group',{name:'Escopo da meta'}).getByRole('button',{name:'Produto',exact:true}).click()
await page.getByLabel('Família de produto',{exact:true}).selectOption('MBA')
assert.match(await page.locator('.pace-stat').first().innerText(),/3.050,00/)
failedBoletex=true
await page.goto(`${base}/diario`,{waitUntil:'networkidle'})
await page.getByRole('heading',{name:'Diário de vendas',exact:true}).waitFor()
await page.waitForFunction(()=>!document.querySelector('button.button-primary:disabled'))
await page.getByRole('button',{name:'Atualizar dados',exact:true}).click()
await page.waitForFunction(()=>!document.querySelector('button.button-primary:disabled'))
await page.locator('.revenue-notifications > summary').click()
const notifications=page.getByRole('region',{name:'Notificações dos dados'})
assert.match(await notifications.innerText(),/Fontes indisponíveis/)
assert.match(await notifications.innerText(),/Boletex/)
await page.locator('.revenue-notifications > summary').click()
await page.getByLabel('Plataforma',{exact:true}).selectOption('Boletex')
assert.match(await revenueCard().innerText(),/Indisponível|Parcial/)
assert.deepEqual(errors,[])
await fs.writeFile(`${out}/smoke-results.json`,JSON.stringify({screenshots:8,horizontalOverflow:false,errors,apiCalls:apiCalls.length,assertions:'totals, local filters without requests, metric selection, failed source'},null,2))
console.log(JSON.stringify({out,errors,apiCalls:apiCalls.length}))
await browser.close()
