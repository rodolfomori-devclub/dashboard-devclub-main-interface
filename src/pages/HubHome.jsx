import { Link } from 'react-router-dom'
import { ArrowUpRight, Library, Target, ClipboardCheck, Wallet, Trophy, ChartColumnIncreasing } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OWN_GOAL, OWN_GOAL_LABEL } from '../lib/navigation'
const shortcuts=[['materials','/materials','Materiais','Playbooks e documentos da operação.',Library],['goals','/metas','Metas','Objetivos do negócio, produtos e equipe.',Target],['daily-checklist','/daily-checklist','Meu checklist','Organize e acompanhe a rotina.',ClipboardCheck],['commissions','/commissions','Minhas comissões','Vendas, parcelas e valores a receber.',Wallet],['ranking','/ranking','Ranking','Acompanhe os resultados da equipe.',Trophy],['goal-pace','/pace','Ritmo das metas','Veja o realizado frente ao planejado.',ChartColumnIncreasing]]
// Outside admin, Metas and Ritmo das metas open the person's own goal: one shortcut.
function visibleShortcuts(isAdmin,hasPermission){
 const granted=shortcuts.filter(([permission])=>hasPermission(permission))
 if(isAdmin||!hasPermission(OWN_GOAL))return granted
 return [...granted.filter(([permission])=>!OWN_GOAL.includes(permission)),['own-goal',hasPermission('goal-pace')?'/pace':'/metas',OWN_GOAL_LABEL,'Sua meta do mês e quanto você já vendeu.',Target]]
}
export default function HubHome(){const {currentUser,userRoles,hasPermission}=useAuth();const visible=visibleShortcuts(Boolean(userRoles?.isAdmin),hasPermission);return <div className="hub-page"><header className="page-heading"><div><h1>Seu espaço de trabalho</h1><p>Olá, {currentUser?.displayName?.split(' ')[0]}. Acompanhe sua rotina e encontre os recursos da operação.</p></div></header><div className="surface-panel"><h2 className="text-lg mb-5">Seus atalhos</h2><div className="divide-y divide-border">{visible.map(([permission,path,title,description,Icon])=><Link className="flex items-center gap-4 py-5" key={permission} to={path}><span className="avatar rounded-lg"><Icon size={19}/></span><div className="flex-1"><h3 className="text-base">{title}</h3><p className="text-sm text-muted-foreground mt-1">{description}</p></div><ArrowUpRight size={19} className="text-muted-foreground"/></Link>)}</div>{!visible.length&&<p className="text-muted-foreground">As telas liberadas para sua conta aparecem no menu lateral. O administrador define esses acessos no Vault.</p>}</div></div>}
