import { createClient } from '@supabase/supabase-js';
import { API_URL, apiFetch } from '../../../lib/api';
import type { Database } from './types';
let currentProfile: any = null;
export const setHubProfile = (profile: any) => { currentProfile = profile; };
// The browser holds only the Vault session. The API mints a short lived,
// user-scoped database token and preserves RLS. No service key reaches this bundle.
export const supabase = createClient<Database>(new URL(`${API_URL}/hub`, window.location.origin).href, 'vault-proxy', {
  auth: { persistSession:false,autoRefreshToken:false,detectSessionInUrl:false },
  global:{fetch:async(input,init)=>{
    const headers=new Headers(init?.headers);
    headers.delete('apikey');headers.delete('authorization');
    return apiFetch(typeof input==='string'?input:input instanceof URL?input.toString():input.url,{...init,headers});
  }},
});
supabase.auth.getUser = async () => ({data:{user:currentProfile},error:null}) as any;
