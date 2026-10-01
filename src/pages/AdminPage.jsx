import { useState } from 'react'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import RankingParticipation from '../components/admin/RankingParticipation'
import UserManagement from '../components/admin/UserManagement'

export default function AdminPage() {
  const { reload } = useAuth()
  const [directoryVersion, setDirectoryVersion] = useState(0)
  const vaultUrl = import.meta.env.VITE_VAULT_HUB_URL || 'http://localhost:5173'
  return <div className="hub-page">
    <header className="page-heading"><div><h1>Administração</h1><p>Cadastre sua equipe, defina os acessos e organize a participação nos indicadores.</p></div><a className="button" href={vaultUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>Abrir Vault</a></header>
    <UserManagement onDirectoryChange={() => setDirectoryVersion(value => value + 1)}/>
    <RankingParticipation refreshKey={directoryVersion}/>
    <section className="surface-panel"><div className="flex items-start gap-4"><ShieldCheck className="text-primary" size={27}/><div><h2 className="text-lg">Uma conta, acessos organizados</h2><p className="text-muted-foreground text-sm mt-2 max-w-3xl">Os cadastros feitos aqui são registrados no Vault. O perfil e as telas escolhidas valem para o Dashboard; a gestão dos demais sistemas continua no Vault. As permissões controlam os menus e os dados disponíveis.</p><button className="button mt-5" onClick={reload}>Atualizar minhas permissões</button></div></div></section>
  </div>
}
