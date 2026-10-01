import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth as useVaultAuth } from '../../contexts/AuthContext';
import { requestApi } from '../../lib/api';
import { setHubProfile } from '../integrations/supabase/client';
export interface AuthUser {id:string;name:string;email:string;role:'gestor'|'vendedor'|'pre-vendedor'|'financeiro'|'marketing';active:boolean;individual_goal:number;is_editor:boolean;avatar_url?:string;created_at:string;}
const Context=createContext<any>(null);
export function HubProvider({children}:{children:React.ReactNode}){
 const vault=useVaultAuth();const qc=useQueryClient();const [user,setUser]=useState<AuthUser|null>(null);const [error,setError]=useState('');const [version,setVersion]=useState(0);
 const accessKey=JSON.stringify(vault.userRoles);
 useEffect(()=>{
  let active=true;setUser(null);setError('');setHubProfile(null);
  requestApi('/hub/session').then(({user:profile}:any)=>{if(active){setUser(profile);setHubProfile(profile);}}).catch((e:Error)=>{if(active)setError(e.message);});
  return()=>{active=false;setHubProfile(null);};
 },[vault.currentUser?.uid,accessKey,version]);
 useEffect(()=>{if(!user)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')qc.refetchQueries({type:'active',stale:true});},60000);return()=>clearInterval(timer);},[user,qc]);
 const isManager=!!vault.userRoles?.isAdmin;
 if(error)return <div className="surface-panel empty-state" role="alert"><h2>Não foi possível abrir a operação</h2><p>{error}</p><button className="button mt-5" onClick={()=>setVersion(v=>v+1)}>Tentar novamente</button></div>;
 if(!user)return <div className="hub-page" role="status"><div className="skeleton skeleton-title"/><div className="skeleton skeleton-chart"/><span className="sr-only">Carregando operação</span></div>;
 return <Context.Provider value={{user,loading:false,isManager,isEditor:isManager,isFinancial:!!vault.userRoles?.financial,isPreSales:user.role==='pre-vendedor',isMarketing:!!vault.userRoles?.marketing,canSwitchView:false,viewMode:null,setViewMode:()=>{},logout:vault.logout,refreshUser:async()=>setVersion(v=>v+1)}}><div className="hub-module"><HubDataStatus/>{children}</div></Context.Provider>;
}
function HubDataStatus(){
 const qc=useQueryClient();const [failed,setFailed]=useState(false); const [unknownCash,setUnknownCash]=useState(0);
 useEffect(()=>{
  const update=()=>{const active=qc.getQueryCache().getAll().filter(q=>q.getObserversCount()>0);setFailed(active.some(q=>q.state.status==='error'));const sales=active.filter(q=>q.queryKey[0]==='sales').flatMap(q=>Array.isArray(q.state.data)?q.state.data:[]);setUnknownCash(sales.filter((sale:any)=>sale.dashboard_cash_known===false).length);};
  update();return qc.getQueryCache().subscribe(update);
 },[qc]);
 if(!failed&&unknownCash)return <div className="notice mb-5">{unknownCash} venda(s) atribuída(s) ainda não informam caixa recebido. Esses valores não geram comissão até haver confirmação de recebimento.</div>;
 return failed?<div className="notice notice-error mb-5" role="alert">Alguns dados não puderam ser carregados. Os números desta tela podem estar incompletos. <button className="underline" onClick={()=>qc.invalidateQueries({refetchType:'active'})}>Tentar novamente</button></div>:null;
}
export function useAuth(){const ctx=useContext(Context);if(!ctx)throw new Error('Módulo comercial fora do contexto Vault.');return ctx;}
