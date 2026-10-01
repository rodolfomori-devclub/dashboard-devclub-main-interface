// Deterministic visual/data regression. All API traffic is intercepted; no production data.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'
const base = process.env.DASHBOARD_SMOKE_URL || 'http://127.0.0.1:4317'
const out = fileURLToPath(new URL('./artifacts/analytics', import.meta.url))
await fs.mkdir(out, { recursive: true })
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({headless:true,executablePath:existsSync(localChrome)?localChrome:undefined})
const context = await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo'})
await context.addInitScript(() => {
 const encode = value => btoa(JSON.stringify(value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
 localStorage.setItem('vault_access_token',`${encode({alg:'RS256',kid:'fixture'})}.${encode({sub:'fixture',exp:4102444800})}.fixture-not-valid`)
})
if(context.routeWebSocket) await context.routeWebSocket('**/*',()=>{})
const errors=[], calls=[], external=[]
const cacheCalls=[]
let cacheScenario='ready', releaseCache=false
const ledger={attributions:[],manualSales:[]}
const products=['DevClub Full Stack','MBA em Inteligência Artificial','IAClub','Seu segundo salário com IA']
const transactions=[]
for(let month=1;month<=9;month++) for(let day=1;day<=(month===9?21:28);day++) for(let index=0;index<4;index++) {
 const date=`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
 const value= Math.round((420+index*295+day*28+Math.sin(day/3)*340)*(1+month/18))
 transactions.push({hash:`fixture-${month}-${day}-${index}`,product:{name:products[index]},payment:{method:['credit_card','pix','boleto','pix'][index],total:value+45},calculation_details:{net_amount:value,total_amount:value+45,discounts:{processing_fee:45},net_affiliate_value:0},dates:{created_at:Math.floor(Date.parse(`${date}T${String(9+index*3).padStart(2,'0')}:10:00-03:00`)/1000)},contact:{name:'Cliente de demonstração',email:'fixture@example.test'},trackings:{utm_source:['meta','comercial','youtube',''][index],utm_campaign:'Campanha de demonstração'}})
}
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url())
 if(url.origin!==base){external.push(url.origin);await route.abort();return}
 if(!url.pathname.startsWith('/api/')){await route.continue();return}
 calls.push(url.pathname)
 let body
 if(url.pathname==='/api/access')body={user:{sub:'fixture',email:'qa@example.test',name:'QA visual',permissions:['today','daily','monthly','yearly','goal-pace','goals'],isAdmin:true}}
 else if(url.pathname==='/api/period-cache'){
  cacheCalls.push(Object.fromEntries(url.searchParams))
  body=periodCacheFixture(url,{today:'2026-09-21',statusForSource:(_id,range)=>cacheScenario==='cold'||cacheScenario==='partialToday'&&range.kind==='today'?'loading':'ready',payloadForSource:(id,range)=>id==='guru'?{data:transactions.filter(row=>{const date=new Date(row.dates.created_at*1000).toISOString().slice(0,10);return date>=range.startDate&&date<=range.endDate})}:emptyProviderPayload(id)})
  if(cacheScenario==='refresh'&&!releaseCache){
   for(const segment of body.segments)for(const source of segment.sources){source.status='stale';source.refreshing=true;source.fetchedAt='2026-09-20T07:00:00.000Z'}
   body.complete=false;body.pending=body.total;body.completed=0
  }
 }
 else if(url.pathname==='/api/transactions'){
  const range=request.postDataJSON();body={data:transactions.filter(row=>{const date=new Date(row.dates.created_at*1000).toISOString().slice(0,10);return date>=range.ordered_at_ini&&date<=range.ordered_at_end})}
 }
 else if(url.pathname==='/api/refunds')body={data:[]}
 else if(url.pathname.startsWith('/api/hotmart/'))body={success:true,data:{count:0,totalGross:0,totalNet:0,totalFees:0,totalRefundAmount:0,transactions:[]}}
 else if(url.pathname.startsWith('/api/boleto/vendas/'))body={success:true,data:[]}
 else if(url.pathname==='/api/boleto/asaas/vendas')body={success:true,data:{count:0,totalGross:0,totalNet:0,totalFees:0,cashReceipts:[],sales:null,availability:{cash:'ready',sales:'unavailable',reason:'checkout_disabled'}}}
 else if(url.pathname==='/api/boleto/boletex/vendas')body={success:true,data:{sales:{count:0,totalValue:0,confirmedValue:0,pendingValue:0,entries:[]}}}
 else if(url.pathname==='/api/sales-ops/ledger')body={data:ledger}
 else if(url.pathname==='/api/goal-plans/options')body={teams:[],individuals:[]}
 else if(url.pathname.startsWith('/api/goal-plans/'))body={plans:[{id:1,scope:'overall',scopeId:'all',product:'all',metric:'gross',target:175000,superTarget:210000,ultraTarget:240000,paceBasis:'calendar'},...products.map((_,index)=>({id:index+2,scope:'product',scopeId:['DevClub','MBA','IAClub','Seu segundo salário com IA'][index],product:['DevClub','MBA','IAClub','Seu segundo salário com IA'][index],metric:'gross',target:50000,paceBasis:'calendar'}))]}
 else if(url.pathname.startsWith('/api/goals/'))body={success:true,data:{meta:175000,superMeta:210000,ultraMeta:240000}}
 else body={data:[]}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
})
const page=await context.newPage()
await page.clock.setFixedTime(new Date('2026-09-21T20:00:00-03:00'))
page.on('pageerror',error=>errors.push(error.message))
const checks=[]
try{
 for(const width of [1440,390]) for(const theme of ['light','dark']) for(const [path,title] of [['diario','Diário de vendas'],['global','Visão global'],['mensal','Visão mensal'],['anual','Visão anual'],['pace','Metas e ritmo de vendas']]){
  await page.setViewportSize({width,height:1000})
  await page.goto(`${base}/${path}`,{waitUntil:'networkidle'})
  await page.getByRole('heading',{name:title,exact:true}).waitFor()
  await page.waitForFunction(()=>document.querySelectorAll('.rr-chart-plot svg path[stroke="currentColor"]').length>0)
  if(await page.evaluate(()=>document.documentElement.classList.contains('dark'))!==(theme==='dark'))await page.getByRole('button',{name:theme==='dark'?'Usar tema escuro':'Usar tema claro',exact:true}).click()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${path}/${theme}/${width} page overflow`)
  assert.equal(await page.locator('svg').evaluateAll(elements=>elements.some(svg=>[...svg.querySelectorAll('[d],[x],[y],[width],[height]')].some(node=>[...node.attributes].some(a=>/NaN|Infinity/.test(a.value))))),false,'Nonfinite chart geometry')
  const chartCount=await page.locator('.rr-chart-plot').count()
  assert.ok(chartCount>=(path==='diario'?2:3),`${path} must have the expected time-series charts`)
  const first=page.locator('.rr-chart-plot').first()
  const before=calls.length
  await first.focus();await page.keyboard.press('Home')
  await page.locator('.rr-chart-tooltip').first().waitFor()
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape')
  assert.equal(calls.length,before,'Chart interaction must not fetch APIs')
  const donut=page.locator('.analytics-mix-legend button').first()
  if(await donut.count()) {await donut.click();assert.equal(await donut.getAttribute('aria-pressed'),'true')}
  await page.getByRole('heading',{name:title,exact:true}).click()
  await page.screenshot({path:`${out}/${path}-${theme}-${width}.png`,fullPage:true,animations:'disabled'})
  const hero=page.locator('.period-revenue,.pace-hero,.daily-hourly').first()
  if(await hero.count())await hero.screenshot({path:`${out}/${path}-${theme}-${width}-hero.png`,animations:'disabled'})
  if(['global','mensal','anual'].includes(path)){
   assert.equal(await page.evaluate(()=>Boolean(document.querySelector('.revenue-highlights').compareDocumentPosition(document.querySelector('form.filter-bar'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'period highlights must precede the filters')
   const beforeDetails=calls.length
   const card=page.locator('.revenue-card').filter({has:page.getByRole('heading',{name:'Cartão',exact:true})})
   await card.locator('summary').focus();await page.keyboard.press('Enter')
   assert.equal(await card.locator('.revenue-provider-list').isVisible(),true)
   await page.keyboard.press('Enter')
   const notifications=page.getByRole('region',{name:'Notificações dos dados'})
   assert.equal(await notifications.isVisible(),false)
   await page.locator('.revenue-notifications > summary').click()
   const bounds=await notifications.boundingBox()
   assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,`${path} notifications overflow`)
   await page.screenshot({path:`${out}/${path}-${theme}-${width}-notifications.png`,animations:'disabled'})
   await page.keyboard.press('Escape');assert.equal(await notifications.isVisible(),false)
   assert.equal(calls.length,beforeDetails,'payment details/notifications must stay local')
  }
  checks.push({path,theme,width,timeSeries:chartCount,keyboard:true,overflow:false})
 }
 // Cache protocol and reload regression: real browser state, synthetic APIs.
 cacheScenario='partialToday'
 await page.goto(`${base}/mensal`,{waitUntil:'networkidle'})
 const partialChart=page.locator('.period-revenue-plot .rr-chart-plot')
 await partialChart.waitFor();await partialChart.focus();await page.keyboard.press('Home')
 for(let index=0;index<20;index++)await page.keyboard.press('ArrowRight')
 assert.match(await page.locator('.rr-chart-tooltip').first().innerText(),/Não informado/,'today loading must be a chart gap even when history is ready')
 cacheScenario='ready'
 await page.goto(`${base}/mensal`,{waitUntil:'networkidle'})
 await page.locator('.period-revenue-plot .rr-chart-plot').waitFor()
 const cacheRegion=page.getByRole('region',{name:'Atualização do histórico'})
 assert.match(await cacheRegion.innerText(),/21\/09\/2026,? 04:00/)
 const beforeFilters=calls.length
 await page.locator('#period-family').selectOption('DevClub')
 await page.locator('#period-family').selectOption('')
 assert.equal(calls.length,beforeFilters,'local filters must not reread cache or providers')
 ledger.manualSales=[{id:'fresh-ledger',date:'2026-09-21',product:'Cache manual QA',family:'DevClub',platform:'Pix direto',gross:400,net:321,cashCollected:200,status:'pending'}]
 cacheScenario='refresh'
 const beforeRefresh=cacheCalls.length
 const beforeLedger=calls.filter(path=>path==='/api/sales-ops/ledger').length
 await page.getByRole('button',{name:'Atualizar',exact:true}).click()
 await page.locator('.revenue-notifications > summary').click()
 await page.getByRole('region',{name:'Notificações dos dados'}).getByText('Histórico em atualização',{exact:true}).waitFor()
 await page.locator('.revenue-notifications > summary').click()
 assert.equal(await page.locator('.period-revenue-plot .rr-chart-plot').count(),1,'refresh must preserve the chart')
 await page.waitForFunction(()=>document.querySelector('#period-product option[value="Cache manual QA"]'))
 assert.equal(calls.filter(path=>path==='/api/sales-ops/ledger').length,beforeLedger+1,'new load reads the current ledger once')
 await page.waitForTimeout(2200)
 assert.ok(cacheCalls.length>beforeRefresh+1,'pending snapshots must be polled')
 assert.equal(cacheCalls[beforeRefresh].force,'1')
 assert.ok(cacheCalls.slice(beforeRefresh+1).every(request=>request.force===undefined),'polls must never enqueue another forced update')
 releaseCache=true
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Atualizar')?.disabled)
 assert.equal(calls.filter(path=>path==='/api/sales-ops/ledger').length,beforeLedger+1)
 cacheScenario='ready'
 await page.getByLabel('Mês',{exact:true}).fill('2026-08')
 await page.getByRole('button',{name:/Aplicar período/}).click()
 await page.waitForFunction(()=>document.querySelector('.period-observed-range')?.textContent.includes('01/08/2026'))
 assert.equal(cacheCalls.at(-1).force,undefined,'switching month after refresh must reuse the server cache')
 cacheScenario='cold'
 await page.getByLabel('Mês',{exact:true}).fill('2026-07')
 await page.getByRole('button',{name:/Aplicar período/}).click()
 await page.getByText(/0 de 7 consultas concluídas/).waitFor()
 const beforeLeaving=cacheCalls.length
 await page.goto(`${base}/global`,{waitUntil:'networkidle'})
 await page.waitForTimeout(2200)
 assert.equal(cacheCalls.length,beforeLeaving,'leaving the page must cancel all later polls')
 cacheScenario='ready'
 checks.push({periodCache:true,refreshOnce:true,freshLedger:true,localFilters:true,cancel:true})
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 await fs.writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,apiCalls:calls.length,errors,external},null,2))
 console.log(JSON.stringify({passed:true,screenshots:checks.length,checks:checks.length,apiCalls:calls.length,errors,external,out}))
}finally{await browser.close()}
