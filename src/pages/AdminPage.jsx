import { ShieldCheck, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { SCREENS } from '../lib/navigation'
export default function AdminPage(){
 const {reload}=useAuth()
 const vaultUrl=import.meta.env.VITE_VAULT_HUB_URL||'http://localhost:5173'
 return <div className="hub-page"><header className="page-heading"><div><h1>Administração</h1><p>Um único cadastro de usuários e permissões, gerenciado pelo Vault.</p></div><a className="button button-primary" href={vaultUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>Abrir Vault</a></header><section className="surface-panel"><div className="flex items-start gap-4"><ShieldCheck className="text-primary" size={27}/><div><h2 className="text-lg">Acessos do Dashboard</h2><p className="text-muted-foreground text-sm mt-2 max-w-3xl">No Vault, selecione o sistema Dashboard ao criar ou editar o usuário. Escolha Administrador para gestão completa ou Usuário para liberar somente as telas necessárias. Os mesmos acessos controlam o menu e os dados.</p><button className="button mt-5" onClick={reload}>Atualizar minhas permissões</button></div></div></section><section className="surface-panel"><h2 className="text-lg mb-4">Telas disponíveis para liberação</h2><div className="table-responsive"><table className="data-table"><thead><tr><th>Tela</th><th>Acesso</th></tr></thead><tbody>{SCREENS.map(screen=><tr key={screen.path}><td>{screen.label}</td><td>{screen.permission==='admin'?'Administrador':'Selecionável no Vault'}</td></tr>)}</tbody></table></div></section></div>
}
