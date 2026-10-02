import test from 'node:test'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { VaultAuth } from '../src/lib/vault-sdk.js'
const storage = () => { const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)} }
function setup(){globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window={location:{href:'https://workspace.example/callback',pathname:'/diario',search:'?date=2026-09-15'}};return new VaultAuth({vaultUrl:'https://vault.example',clientId:'dashboard',redirectUri:'https://workspace.example/callback'})}
test('expired access retains refresh credential for coordinated renewal',()=>{
 setup();localStorage.setItem('vault_refresh_token','refresh-example')
 localStorage.setItem('vault_access_token',`header.${Buffer.from(JSON.stringify({sub:'u1',exp:1})).toString('base64url')}.signature`)
 const sdk=new VaultAuth({vaultUrl:'https://vault.example',clientId:'dashboard',redirectUri:'https://workspace.example/callback'})
 assert.equal(sdk.getUser(),null);assert.equal(sdk.getAccessToken(),null);assert.equal(localStorage.getItem('vault_refresh_token'),'refresh-example')
})
test('OAuth callback rejects absent or mismatched state before exchanging credentials',async()=>{
 const sdk=setup();sessionStorage.setItem('vault_code_verifier','verifier');sessionStorage.setItem('vault_oauth_state','expected')
 window.location.href='https://workspace.example/callback?code=sample&state=wrong'
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('unexpected network')}
 try{assert.equal(await sdk.handleCallback(),false);assert.equal(calls,0)}finally{globalThis.fetch=original}
})
test('matching callback is exchanged once under concurrent StrictMode initialization',async()=>{
 const sdk=setup();sessionStorage.setItem('vault_code_verifier','verifier');sessionStorage.setItem('vault_oauth_state','expected');window.location.href='https://workspace.example/callback?code=sample&state=expected'
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({access_token:`header.${Buffer.from(JSON.stringify({sub:'u1',exp:Math.floor(Date.now()/1000)+900})).toString('base64url')}.signature`,refresh_token:'refresh-example'})}}
 try{assert.deepEqual(await Promise.all([sdk.handleCallback(),sdk.handleCallback()]),[true,true]);assert.equal(calls,1);assert.equal(sessionStorage.getItem('vault_oauth_state'),null)}finally{globalThis.fetch=original}
})
test('alias redirects to configured callback origin before creating PKCE state',async()=>{
 const sdk=setup();let destination
 window.location={href:'https://alias.example//untrusted.example/diario?redirect_uri=https://untrusted.example#vendas',replace:value=>{destination=value}}
 await sdk.login()
 assert.equal(destination,'https://workspace.example//untrusted.example/diario?redirect_uri=https://untrusted.example#vendas')
 assert.equal(new URL(destination).origin,'https://workspace.example')
 assert.equal(sessionStorage.getItem('vault_code_verifier'),null)
 assert.equal(sessionStorage.getItem('vault_oauth_state'),null)
 assert.equal(localStorage.getItem('vault_redirect_after'),null)
})
test('canonical development origin starts PKCE locally without an origin redirect',async()=>{
 setup();let replaced=false
 window.location={href:'http://localhost:3001/diario?date=2026-09-15',pathname:'/diario',search:'?date=2026-09-15',replace:()=>{replaced=true}}
 const sdk=new VaultAuth({vaultUrl:'http://localhost:4000',clientId:'dashboard-dev',redirectUri:'http://localhost:3001/callback'})
 assert.equal(sdk.redirectToCanonicalOrigin(),false)
 await sdk.login()
 const authorize=new URL(window.location.href)
 assert.equal(replaced,false)
 assert.equal(authorize.origin,'http://localhost:4000')
 assert.equal(authorize.searchParams.get('redirect_uri'),'http://localhost:3001/callback')
 assert.equal(authorize.searchParams.get('code_challenge_method'),'S256')
 assert.equal(authorize.searchParams.get('state'),sessionStorage.getItem('vault_oauth_state'))
 assert(sessionStorage.getItem('vault_code_verifier'))
})
test('refresh keeps the credentials through outages and clears them only when Vault refuses them',async()=>{
 const original=globalThis.fetch
 const attempt=async response=>{
  setup();localStorage.setItem('vault_refresh_token','refresh-example')
  const sdk=new VaultAuth({vaultUrl:'https://vault.example',clientId:'dashboard',redirectUri:'https://workspace.example/callback'})
  globalThis.fetch=async()=>{if(response instanceof Error)throw response;return response}
  try{return {refreshed:await sdk.refresh(),stored:localStorage.getItem('vault_refresh_token')}}finally{globalThis.fetch=original}
 }
 assert.deepEqual(await attempt(new TypeError('Failed to fetch')),{refreshed:false,stored:'refresh-example'})
 for(const status of [500,502,503,408,429])assert.deepEqual(await attempt({ok:false,status}),{refreshed:false,stored:'refresh-example'},`status ${status}`)
 for(const status of [400,401,403])assert.deepEqual(await attempt({ok:false,status}),{refreshed:false,stored:null},`status ${status}`)
})
