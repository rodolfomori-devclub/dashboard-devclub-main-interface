// Deterministic visual/data regression. All API traffic is intercepted; no production data.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
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
 else if(url.pathname==='/api/transactions'){
  const range=request.postDataJSON();body={data:transactions.filter(row=>{const date=new Date(row.dates.created_at*1000).toISOString().slice(0,10);return date>=range.ordered_at_ini&&date<=range.ordered_at_end})}
 }
 else if(url.pathname==='/api/refunds')body={data:[]}
 else if(url.pathname.startsWith('/api/hotmart/'))body={success:true,data:{count:0,totalGross:0,totalNet:0,totalFees:0,totalRefundAmount:0,transactions:[]}}
 else if(url.pathname.startsWith('/api/boleto/vendas/'))body={success:true,data:[]}
 else if(url.pathname==='/api/boleto/asaas/vendas')body={success:true,data:{count:0,totalGross:0,totalNet:0,totalFees:0,cashReceipts:[],sales:null,availability:{cash:'ready',sales:'unavailable',reason:'checkout_disabled'}}}
 else if(url.pathname==='/api/boleto/boletex/vendas')body={success:true,data:{sales:{count:0,totalValue:0,confirmedValue:0,pendingValue:0,entries:[]}}}
 else if(url.pathname==='/api/sales-ops/ledger')body={data:{attributions:[],manualSales:[]}}
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
  checks.push({path,theme,width,timeSeries:chartCount,keyboard:true,overflow:false})
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 await fs.writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,apiCalls:calls.length,errors,external},null,2))
 console.log(JSON.stringify({passed:true,screenshots:checks.length,checks:checks.length,apiCalls:calls.length,errors,external,out}))
}finally{await browser.close()}
