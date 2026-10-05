import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'

let runtime, directory, dom, root
const progress = new Set()
let failure = false
let requests = []
const catalog = {
 id:'mba',title:'Time MBA',description:'Aprenda a operação comercial.',sourceAuthor:'Equipe Comercial',completedStepIds:[],
 modules:[{id:'start',title:'Comece por aqui',description:'Conheça os primeiros passos.',steps:[{id:'culture',title:'Conheça a cultura',description:'Leia os princípios.',resourceId:'guide'},{id:'badge',title:'Solicite o crachá',description:'Preencha o formulário.'}]},{id:'product',title:'Conheça o produto',description:'Estude a ementa.',steps:[{id:'syllabus',title:'Leia a ementa',description:'Confira o programa.',resourceId:'pdf'}]}],
 resources:[{id:'guide',title:'Guia interno',description:'Pessoas e cultura.',format:'markdown',category:'Boas-vindas',audience:'internal',markdown:'# Cultura'},{id:'pdf',title:'Ementa comercial',description:'Conteúdo para o lead.',format:'pdf',category:'Produto',audience:'lead',file:{id:'pdf',name:'ementa.pdf',mimeType:'application/pdf'}}],
 notices:[{id:'pending',title:'Confirmar condições',description:'Confirme com a liderança.'}],files:[],
}
const auth = { currentUser:{uid:'seller-1'},userRoles:{isAdmin:false},hasPermission:permission=>permission==='onboarding-mba' }
before(async()=>{
 dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://workspace.test/onboarding/mba'})
 for(const name of ['window','document','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver'])globalThis[name]=dom.window[name]
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 Element.prototype.scrollIntoView=function(){}
 globalThis.__onboardingAuth=auth
 globalThis.__onboardingRequest=async(path,options={})=>{
  requests.push({path,options})
  if(options.signal?.aborted)throw Object.assign(new Error('aborted'),{name:'AbortError'})
  if(options.method==='PUT'){
   if(failure)throw new Error('Sem conexão')
   const id=path.split('/').at(-1),{completed}=JSON.parse(options.body)
   if(completed)progress.add(id);else progress.delete(id)
   return {completedStepIds:[...progress]}
  }
  return structuredClone({...catalog,completedStepIds:[...progress]})
 }
 directory=await mkdtemp(fileURLToPath(new URL('../.onboarding-test-',import.meta.url)))
 const source=`import React,{act} from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import Page from '../src/pages/OnboardingPage.jsx';export {React,act,createRoot,MemoryRouter,QueryClient,QueryClientProvider,Page};`
 const result=await build({stdin:{contents:source,resolveDir:directory,sourcefile:'entry.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'fixtures',setup(build){
  build.onResolve({filter:/contexts\/AuthContext$/},()=>({path:'auth',namespace:'fixture'}))
  build.onResolve({filter:/lib\/api$/},()=>({path:'api',namespace:'fixture'}))
  build.onResolve({filter:/onboarding\/ResourceViewer\.jsx$/},()=>({path:'viewer',namespace:'fixture'}))
  build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='auth'?'export const useAuth=()=>globalThis.__onboardingAuth':args.path==='api'?'export const requestApi=(...args)=>globalThis.__onboardingRequest(...args)':'import React from "react";export default function Viewer({resource,onClose}){return <div role="dialog"><h2>{resource.title}</h2><button onClick={onClose}>Fechar material</button></div>}',loader:'jsx',resolveDir:directory}))
 }}]})
 const path=directory+'/entry.mjs';await writeFile(path,result.outputFiles[0].text);runtime=await import(path)
})
after(async()=>{await unmount();dom?.window.close();if(directory)await rm(directory,{recursive:true,force:true})})
async function settle(){await runtime.act(async()=>{await new Promise(resolve=>setTimeout(resolve,30))})}
async function mount(path='/onboarding/mba'){
 const{React,act,createRoot,MemoryRouter,QueryClient,QueryClientProvider,Page}=runtime
 const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}})
 root=createRoot(document.getElementById('root'))
 await act(async()=>root.render(React.createElement(QueryClientProvider,{client:queryClient},React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(Page)))))
 await settle()
}
async function unmount(){if(root){await runtime.act(async()=>root.unmount());root=null}}
async function click(element){assert.ok(element,'Expected clickable element');await runtime.act(async()=>element.click());await settle()}
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text))

test('seller sees only authorized track, saves progress and resumes after remount',async()=>{
 progress.clear();requests=[];await mount()
 assert.equal(document.querySelectorAll('.onboarding-team-switch a').length,1)
 assert.equal(document.querySelector('.onboarding-progress strong').textContent,'0 / 3')
 assert.ok(!document.body.textContent.includes('Gerenciar acessos'))
 await click(document.querySelector('input[aria-label="Concluir: Conheça a cultura"]'))
 assert.equal(document.querySelector('input[aria-label="Concluir: Conheça a cultura"]').checked,true)
 assert.equal(document.querySelector('.onboarding-progress strong').textContent,'1 / 3')
 assert.deepEqual(requests.find(r=>r.options.method==='PUT').path,'/onboarding/mba/progress/culture')
 await unmount();await mount()
 assert.equal(document.querySelector('input[aria-label="Concluir: Conheça a cultura"]').checked,true)
 await unmount()
})
test('failed progress save remains incomplete and displays an actionable failure',async()=>{
 progress.clear();failure=true;await mount()
 await click(document.querySelector('input[aria-label="Concluir: Conheça a cultura"]'))
 assert.equal(document.querySelector('input[aria-label="Concluir: Conheça a cultura"]').checked,false)
 assert.match(document.querySelector('[role="alert"]').textContent,/Não foi possível salvar.*Sem conexão/)
 assert.equal(progress.size,0);failure=false;await unmount()
})
test('library stays available without completion, filters lead material and opens resource',async()=>{
 progress.clear();await mount('/onboarding/mba?aba=biblioteca')
 assert.equal(document.querySelectorAll('.onboarding-resources li').length,2)
 const select=[...document.querySelectorAll('select')].find(el=>el.parentElement.textContent.includes('Uso do material'))
 await runtime.act(async()=>{select.value='lead';select.dispatchEvent(new Event('change',{bubbles:true}))})
 assert.equal(document.querySelectorAll('.onboarding-resources li').length,1)
 assert.match(document.querySelector('.onboarding-resources').textContent,/Ementa comercial/)
 await click(button('Ementa comercial'))
 assert.match(document.querySelector('[role="dialog"]').textContent,/Ementa comercial/)
 await click(button('Fechar material'));assert.equal(document.querySelector('[role="dialog"]'),null)
 assert.equal(progress.size,0);await unmount()
})
test('admin sees both tracks, access management and editorial review',async()=>{
 const original=auth.hasPermission;auth.userRoles={isAdmin:true};auth.hasPermission=()=>true
 await mount('/onboarding/mba?aba=revisao')
 assert.equal(document.querySelectorAll('.onboarding-team-switch a').length,2)
 assert.ok([...document.querySelectorAll('a')].some(a=>a.textContent.includes('Gerenciar acessos')&&a.getAttribute('href')==='/admin'))
 assert.match(document.querySelector('.onboarding-review').textContent,/Confirmar condições/)
 await unmount();auth.userRoles={isAdmin:false};auth.hasPermission=original
})
test('completion does not certify commercial release and materials remain accessible',async()=>{
 progress.add('culture');progress.add('badge');progress.add('syllabus');await mount()
 assert.match(document.querySelector('.onboarding-finished').textContent,/Confirme com a liderança/)
 await click(button('Biblioteca do vendedor'))
 assert.equal(document.querySelectorAll('.onboarding-resources li').length,2)
 await unmount()
})
