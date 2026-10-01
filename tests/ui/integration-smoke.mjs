import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {checkComparison} from './comparison-checks.mjs'
import { checkGoalConfiguration, checkGoalConfigurationReader } from './goal-config-checks.mjs'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/integration', import.meta.url))
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
let admin=true
let goalReader=false
let comparisonFixture=false
const writes=[]
const materials=[{id:'material-1',title:'Playbook comercial',description:'Documento de treinamento',category:'Treinamentos',url:'storage://materials/playbook.pdf',created_at:'2026-09-10T12:00:00Z'}]
const profile={id:'seller-1',name:'Consultor QA',email:'qa@example.test',role:'gestor',active:true,individual_goal:10000,is_editor:true,created_at:'2026-01-01T12:00:00Z'}
const ledger={attributions:[],manualSales:[]}
const goalTeamId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', goalIndividualId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const goalOptions={teams:[{id:goalTeamId,name:'Time comercial QA',active:true,archived:false},{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Time anterior',active:false,archived:true}],individuals:[{id:goalIndividualId,name:'Pessoa QA',teamId:goalTeamId,active:true},{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Pessoa anterior',teamId:goalTeamId,active:false}]}
const goalPlans=[{id:1,updatedAt:date+'T12:00:00Z',notes:'',product:'all',metric:'operational',target:30000,superTarget:35000,ultraTarget:40000,paceBasis:'calendar'},{id:2,updatedAt:date+'T12:00:00Z',notes:'',product:'DevClub',metric:'operational',target:10000,superTarget:12000,ultraTarget:15000,paceBasis:'business'}]
const checks=[]
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
 const method=route.request().method(); const request=route.request();
 if(!['GET','HEAD'].includes(method))writes.push({path:url.pathname,method,body:request.headers()['content-type']?.includes('json')?request.postDataJSON():request.postData()})
 let body
 if(url.pathname==='/api/access')body={user:{sub:'fixture-user',email:'qa@example.test',name:'QA local',permissions:admin?['admin']:goalReader?['goals']:['materials'],isAdmin:admin}}
 else if(url.pathname==='/api/period-cache')body=periodCacheFixture(url,{today:date,payloadForSource:(id,range)=>id==='guru'?{data:guruRows.filter(row=>{const day=new Date(row.dates.created_at*1000).toISOString().slice(0,10);return day>=range.startDate&&day<=range.endDate})}:emptyProviderPayload(id)})

 else if(url.pathname==='/api/hub/session')body={user:{...profile,role:admin?'gestor':'vendedor'}}
 else if(url.pathname==='/api/hub/materials/upload')body={url:'storage://materials/fixture-upload.pdf'}
 else if(url.pathname.startsWith('/api/hub/rest/v1/')){
  const table=url.pathname.split('/').pop()
  if(table==='materials'){
   if(method==='POST')materials.push({...request.postDataJSON(),id:'material-2',created_at:'2026-09-15T18:00:00Z'})
   if(method==='PATCH')Object.assign(materials.find(m=>m.id===url.searchParams.get('id')?.replace('eq.','')),request.postDataJSON())
   body=materials
  }else if(table==='profiles')body=[profile]
  else if(table==='products')body=[{id:'product-1',name:'DevClub',price:1000,active:true,commission_percent:10}]
  else if(table==='team_settings')body=[{id:'settings-1',team_goal:50000,origins:['Comercial']}]
  else body=[]
 }
 else if(url.pathname==='/api/sales-ops/sellers')body={data:[profile]}
 else if(url.pathname==='/api/sales-ops/attributions'){
  const input=request.postDataJSON();const saved={...input,id:'assignment-1',sellerName:profile.name,syncPending:false};ledger.attributions.push(saved);body={data:saved}
 }
 else if(url.pathname==='/api/sales-ops/manual-sales'){
  const input=request.postDataJSON();const saved={...input,gross:Number(input.gross),net:Number(input.net),cashCollected:Number(input.cashCollected),sellerName:profile.name,status:'pending',syncPending:false};ledger.manualSales.push(saved);body={data:saved}
 }
 else if(url.pathname.match(/^\/api\/sales-ops\/manual-sales\/.+\/reconcile$/)){
  const input=request.postDataJSON();const saved=ledger.manualSales.find(s=>s.id===url.pathname.split('/')[4]);Object.assign(saved,{linkedSource:input.source,linkedExternalId:input.externalId,status:'reconciled'});body={data:saved}
 }
 else if(url.pathname.startsWith('/api/sales-ops/audit/'))body={data:[]}
 else if(url.pathname==='/api/refunds/overview')body={data:[{id:'refund-1',name:'Cliente Reembolso QA',email:'refund@example.test',product:'DevClub',sources:['guru'],platform:'guru',kind:'confirmed',status:'refunded',referenceDate:date,dateBasis:'refund',saleAmount:1000,refundAmount:1000,currency:'BRL',transactionId:'refund-source-1',refundedAt:date,purchasedAt:date,note:'Fixture local'}],sources:[{id:'guru',status:'available',recordCount:1,message:'Consulta concluída'}],incomplete:false,deduplication:{removed:0},excludedUndated:0,generatedAt:date+'T12:00:00Z'}
 else if(url.pathname.startsWith('/api/goals/revenue/'))body={data:{faturamentoCartao:{base:1000,super:2000,ultra:3000},faturamentoBoleto:{base:1000,super:2000,ultra:3000},investimentoTrafego:{base:100,super:200,ultra:300}}}
 else if(url.pathname.startsWith('/api/goals/'))body={success:true,data:{meta:30000,superMeta:35000,ultraMeta:40000}}
 else if(url.pathname==='/api/goal-plans/options')body=goalOptions
 else if(url.pathname.startsWith('/api/goal-plans/')&&method==='PUT'){
  const input=request.postDataJSON()
  const previous=goalPlans.findIndex(plan=>(plan.scope||(plan.product==='all'?'overall':'product'))===input.scope&&(plan.scopeId||(plan.product==='all'?'':plan.product))===input.scopeId&&plan.metric===input.metric)
  const plan={...input,id:previous>=0?goalPlans[previous].id:`plan-${goalPlans.length+1}`,updatedAt:date+'T18:00:00Z',scopeName:input.scope==='overall'?'Meta geral':input.scope==='product'?input.scopeId:input.scope==='team'?'Time comercial QA':'Pessoa QA'}
  if(previous>=0)goalPlans[previous]=plan;else goalPlans.push(plan)
  body={plan}
 }
 else if(url.pathname==='/api/transactions')body={data:guruRows}
 else if(url.pathname==='/api/refunds')body={data:[]}
 else if(url.pathname==='/api/hotmart/vendas')body={success:true,data:{count:1,totalGross:300,totalNet:250,totalFees:50,transactions:[{transaction:'h1',product:'Seu segundo salário com IA',grossValue:300,netValue:250,fee:50,paymentMethod:'PIX',orderDate:`${date}T16:10:00-03:00`}]}}
 else if(url.pathname==='/api/hotmart/reembolsos')body={success:true,data:{count:0,totalRefundAmount:0,transactions:[]}}
 else if(url.pathname.startsWith('/api/boleto/vendas/'))body={success:true,data:[{id:'tmb-1-0',raw:{pedido_id:1},product:'DevClub Vitalício',value:800,timestamp:`${date}T10:00:00-03:00`,utm_source:'comercial'}]}
 else if(url.pathname==='/api/boleto/asaas/vendas')body={success:true,data:{sales:{count:1,totalValue:1000,entryValue:200,entries:[{id:'a1',productDescription:'MBA em IA',totalValue:1000,entryValue:200,createdAt:`${date}T09:20:00-03:00`}]}}}
 else if(url.pathname==='/api/boleto/boletex/vendas'){
  if(failedBoletex){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false})});return}
  body={success:true,data:{sales:{count:1,totalValue:2000,confirmedValue:400,pendingValue:1600,listPriceValue:1800,entries:[{id:'b1',productDescription:'IAClub',totalValue:2000,listPrice:1800,entryValue:400,pendingValue:1600,createdAt:`${date}T14:10:00-03:00`}]},emitted:{count:3,expectedEntryValue:600}}}
 }
 else if(url.pathname==='/api/sales-ops/ledger')body={data:comparisonFixture?{...ledger,manualSales:ledger.manualSales.filter(sale=>sale.date>=url.searchParams.get('from')&&sale.date<=url.searchParams.get('to'))}:ledger}
 else if(url.pathname.startsWith('/api/goal-plans/'))body={plans:goalPlans}
 else body={data:[],plans:[]}
 if(comparisonFixture&&!url.pathname.includes('/sales-ops/')){
  const requested=method==='POST'?request.postDataJSON()?.ordered_at_ini:url.searchParams.get('date')||url.searchParams.get('data_inicio')
  if(requested){
   const offset=(Date.parse(requested)-Date.parse(date))/1000
   const moveDates=(value,key)=>typeof value==='string'&&value.startsWith(date)?value.replace(date,requested):key==='created_at'&&typeof value==='number'?value+offset:Array.isArray(value)?value.map(v=>moveDates(v)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,moveDates(v,k)])):value
   body=moveDates(body)
  }
 }
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
})
const page=await context.newPage()
await page.clock.setFixedTime(new Date('2026-09-15T15:00:00-03:00'))
page.on('pageerror',error=>errors.push(error.message))
page.setDefaultTimeout(12000)
async function visit(path,heading){
 await page.goto(base+path,{waitUntil:'networkidle'})
 if(heading)await page.getByRole('heading',{name:heading,exact:true}).first().waitFor()
 assert.equal(await page.getByRole('heading',{name:'Esta tela não pôde ser aberta'}).count(),0,`${path} crashed`)
 assert.deepEqual(errors,[],`${path} page errors`)
}
async function shot(name){
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
 await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'})
 const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)
 if(!fits) console.log('OVERFLOW',name,JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>window.innerWidth+1).map(n=>({tag:n.tagName,class:n.className,right:n.getBoundingClientRect().right,position:getComputedStyle(n).position,overflow:getComputedStyle(n).overflow})).slice(0,18))))
 assert.equal(fits,true,`${name} horizontal overflow`)
}
function checked(name){checks.push(name);console.log(`PASS ${name}`)}
if(process.env.DASHBOARD_SMOKE_SCOPE!=='comparison'){
await page.setViewportSize({width:1440,height:1000})
await visit('/materials','Biblioteca de materiais')
assert.equal(await page.getByRole('link',{name:'Visão global',exact:true}).count(),1)
await page.getByRole('button',{name:'Adicionar material',exact:true}).click()
let dialog=page.getByRole('dialog',{name:'Adicionar material'})
await dialog.getByLabel('Título',{exact:true}).fill('Guia QA local')
await dialog.getByLabel('Descrição',{exact:true}).fill('Arquivo de demonstração sem dados reais')
await dialog.getByLabel(/^Categoria/).fill('Integração QA')
await dialog.locator('input[type=file]').setInputFiles({name:'guia-qa.txt',mimeType:'text/plain',buffer:Buffer.from('Material sintético de teste')})
await dialog.getByRole('button',{name:'Salvar material'}).click()
await dialog.waitFor({state:'hidden'})
await page.getByText('Guia QA local',{exact:true}).waitFor()
assert.equal(writes.find(w=>w.path==='/api/hub/materials/upload').body,'Material sintético de teste')
assert.deepEqual(writes.find(w=>w.path==='/api/hub/rest/v1/materials'&&w.method==='POST').body,{title:'Guia QA local',description:'Arquivo de demonstração sem dados reais',category:'Integração QA',url:'storage://materials/fixture-upload.pdf',type:'document'})
await page.getByRole('button',{name:'Editar Guia QA local'}).click()
dialog=page.getByRole('dialog',{name:'Editar material'})
await dialog.getByLabel(/^Categoria/).fill('Operação')
await dialog.getByRole('button',{name:'Salvar material'}).click()
await dialog.waitFor({state:'hidden'})
assert.equal(writes.find(w=>w.path==='/api/hub/rest/v1/materials'&&w.method==='PATCH').body.category,'Operação')
checked('Materials upload and category update exact REST bodies')
await shot('materials-desktop')
await visit('/metas','Metas da operação')
await checkGoalConfiguration({page,writes,checked,shot,teamId:goalTeamId,individualId:goalIndividualId})
await page.getByRole('tab',{name:'Receita por pagamento'}).click()
await page.getByRole('button',{name:'Salvar metas financeiras'}).click()
await page.getByText('Metas financeiras salvas.').waitFor()
checked('Financial goals POST action')
await page.getByRole('tab',{name:'Metas comerciais anteriores'}).click()
await page.getByText(/Metas comerciais do Hub/).waitFor()
assert.deepEqual(errors,[])
checked('Commercial goals Hub provider mounts')
await visit('/admin','Administração')
await page.getByRole('button',{name:'Atualizar minhas permissões'}).click()
await shot('admin-desktop')
checked('Admin page and permissions reload')
await visit('/atribuicao','Atribuição e conciliação')
await page.getByRole('button',{name:'Atribuir',exact:true}).first().click()
dialog=page.getByRole('dialog',{name:'Atribuir venda'})
await dialog.getByLabel('Vendedor responsável').selectOption('seller-1')
await dialog.getByLabel('Observação interna').fill('Conferência QA')
await dialog.getByRole('button',{name:'Salvar venda'}).click()
await dialog.waitFor({state:'hidden'})
const assigned=writes.find(w=>w.path==='/api/sales-ops/attributions').body
assert.equal(assigned.sellerId,'seller-1');assert.equal(assigned.note,'Conferência QA');assert.equal(assigned.source,'guru');assert.equal(assigned.snapshot.cashCollected,assigned.snapshot.net)
checked('Attribution retains platform identifier and full native platform net cash')
await page.getByRole('button',{name:'Venda manual',exact:true}).click()
dialog=page.getByRole('dialog',{name:'Registrar venda manual'})
await dialog.getByLabel('Vendedor responsável').selectOption('seller-1')
await dialog.getByLabel('Produto / oferta').fill('DevClub QA manual')
await dialog.getByLabel('Nome do cliente').fill('Cliente manual QA')
await dialog.getByLabel('Valor bruto (R$)').fill('1200')
await dialog.getByLabel('Valor líquido (R$)').fill('1100')
await dialog.getByLabel('Caixa recebido (R$)').fill('300')
await dialog.getByRole('button',{name:'Salvar venda'}).click()
await dialog.waitFor({state:'hidden'})
await page.getByText('DevClub QA manual',{exact:true}).waitFor()
const manual=writes.find(w=>w.path==='/api/sales-ops/manual-sales').body
assert.equal(manual.gross,'1200');assert.equal(manual.net,'1100');assert.equal(manual.cashCollected,'300')
checked('Manual creation preserves separate gross/net/cash')
await page.getByRole('button',{name:'Conciliar',exact:true}).click()
dialog=page.getByRole('dialog',{name:'Conciliar venda manual'})
await dialog.getByLabel('Transação da plataforma').selectOption({index:1})
await dialog.getByRole('button',{name:'Confirmar conciliação'}).click()
await dialog.waitFor({state:'hidden'})
await page.getByText('Fora dos totais manuais',{exact:true}).waitFor()
assert.equal(writes.filter(w=>w.path.endsWith('/reconcile')).length,1)
checked('Manual reconciliation removes duplicate from totals')
for(const width of [1440,360]){
 await page.setViewportSize({width,height:1000})
 for(const [path,title,key] of [['/atribuicao','Atribuição e conciliação','attribution'],['/reembolsos','Reembolsos','refunds'],['/global','Visão global','global'],['/mensal','Visão mensal','monthly']]){
  await visit(path,title)
  if(path==='/reembolsos'){
   await page.getByRole('button',{name:'Detalhes de Cliente Reembolso QA'}).filter({visible:true}).click()
   await page.getByText('Valor efetivamente devolvido',{exact:true}).filter({visible:true}).waitFor()
  }
  await shot(`${key}-${width}`)
  checked(`${key} runtime and layout ${width}`)
 }
}
await page.setViewportSize({width:360,height:1000})
await visit('/atribuicao','Atribuição e conciliação')
await page.getByRole('button',{name:'Venda manual',exact:true}).click()
await shot('manual-dialog-360')
await page.getByRole('button',{name:'Cancelar',exact:true}).click()
await visit('/materials','Biblioteca de materiais')
await page.getByRole('button',{name:'Adicionar material',exact:true}).click()
await shot('materials-dialog-360')
await page.getByRole('button',{name:'Cancelar',exact:true}).click()
await visit('/metas','Metas da operação')
await shot('goals-360')
await page.setViewportSize({width:1440,height:1000})
for(const path of ['/hub','/daily-kpis','/kpi-report','/daily-checklist','/results','/ranking','/sales-links','/manager-notes','/commissions','/financial','/dre-global','/marketing','/activity-log','/settings']){
 await visit(path)
 assert.equal(await page.locator('.hub-module').count(),path==='/hub'?0:1)
 checked(`Hub module ${path} no runtime failure`)
}
}
comparisonFixture=true
ledger.manualSales=[
 {id:'manual-comparison',date,product:'DevClub QA comparação',family:'DevClub',gross:800,net:700,cashCollected:200,buyerName:'Fixture comparação',sellerId:profile.id,sellerName:profile.name,platform:'Pix direto',status:'pending',utm:{}},
 {id:'manual-linked-comparison',date,product:'DevClub vinculada QA',family:'DevClub',gross:10000,net:10000,cashCollected:10000,buyerName:'Fixture já vinculada',sellerId:profile.id,sellerName:profile.name,platform:'Guru',status:'reconciled',linkedSource:'guru',linkedExternalId:'g1',utm:{}}
]
await checkComparison({page,visit,shot,checked,apiCalls})
await page.setViewportSize({width:1440,height:1000})
admin=false
goalReader=true
await visit('/metas','Metas da operação')
await checkGoalConfigurationReader({page,checked})
goalReader=false
await visit('/materials','Biblioteca de materiais')
assert.equal(await page.getByRole('button',{name:'Adicionar material'}).count(),0)
assert.equal(await page.getByRole('link',{name:'Visão global',exact:true}).count(),0)
assert.equal(await page.getByRole('link',{name:'Administração',exact:true}).count(),0)
const before=apiCalls.length
await visit('/global','Acesso não liberado')
assert(apiCalls.slice(before).length>0);assert(apiCalls.slice(before).every(path=>path==='/api/access'))
checked('Materials-only user has no admin controls/global menu and direct route denied before data fetch')
assert.deepEqual(errors,[])
await fs.writeFile(`${out}/${process.env.DASHBOARD_SMOKE_SCOPE==='comparison'?'comparison-results':'smoke-results'}.json`,JSON.stringify({checks,errors,writes,requests:apiCalls.length},null,2))
console.log(JSON.stringify({out,checks:checks.length,errors,requests:apiCalls.length}))
await browser.close()
