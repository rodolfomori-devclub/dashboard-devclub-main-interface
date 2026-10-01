import { CommercialGoalsCard } from '../hub/components/settings/CommercialGoalsCard'
import { TeamGoalsCard } from '../hub/components/settings/TeamGoalsCard'
import { SellerGoalsCard } from '../hub/components/settings/SellerGoalsCard'
import { HubProvider } from '../hub/contexts/AuthContext'
import { useAuth } from '../contexts/AuthContext'
export default function HubGoals(){const {userRoles}=useAuth();return <HubProvider><div className="space-y-5"><div className="notice">Metas comerciais do Hub: mensal, semanal, diária, caixa e objetivos por time e vendedor. Cada seção indica o período configurado.</div><fieldset disabled={!userRoles?.isAdmin} className="space-y-5"><CommercialGoalsCard/><TeamGoalsCard/><SellerGoalsCard/></fieldset></div></HubProvider>}
