import { createClient } from '@supabase/supabase-js';
import { API_URL, apiFetch } from '../../../lib/api';
import type { Database } from './types';
import { normalizeHubSaleValue } from '../../lib/saleValuePolicy';
let currentProfile: any = null;
export const setHubProfile = (profile: any) => { currentProfile = profile; };
// The browser holds only the Vault session. The API mints a short lived,
// user-scoped database token and preserves RLS. No service key reaches this bundle.
export const supabase = createClient<Database>(new URL(`${API_URL}/hub`, window.location.origin).href, 'vault-proxy', {
  auth: { persistSession:false,autoRefreshToken:false,detectSessionInUrl:false },
  global:{fetch:async(input,init)=>{
    const headers=new Headers(init?.headers);
    headers.delete('apikey');headers.delete('authorization');
    const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
    const response=await apiFetch(url,{...init,headers});
    if ((init?.method || 'GET').toUpperCase()==='GET' && response.ok
      && new URL(url,window.location.origin).pathname.endsWith('/rest/v1/sales')
      && /\bjson\b/i.test(response.headers.get('content-type') || '')) {
      const body=await response.json();
      const normalized=Array.isArray(body)?body.map(normalizeHubSaleValue):normalizeHubSaleValue(body);
      const responseHeaders=new Headers(response.headers);
      responseHeaders.delete('content-length');
      return new Response(JSON.stringify(normalized),{status:response.status,statusText:response.statusText,headers:responseHeaders});
    }
    return response;
  }},
});
supabase.auth.getUser = async () => ({data:{user:currentProfile},error:null}) as any;
