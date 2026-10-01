import { Link } from 'react-router-dom'
import { TeamsManagerCard } from '../hub/components/settings/TeamsManagerCard'
import { useAuth } from '../contexts/AuthContext'
export default function HubSettings(){const {userRoles}=useAuth();return <div className="hub-page"><header className="page-heading"><div><h1>Configurações da operação</h1><p>Times, composição da equipe e organização comercial.</p></div><Link className="button" to="/metas">Abrir metas</Link></header>{userRoles?.isAdmin?<TeamsManagerCard/>:<div className="notice">A configuração de times é feita pelo administrador.</div>}<div className="notice">Contas, senhas e permissões são gerenciadas no Vault. Os vínculos com times e as metas permanecem na operação.</div></div>}
