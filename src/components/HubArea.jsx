import { HubProvider } from '../hub/contexts/AuthContext'
export default function HubArea({children}) { return <HubProvider>{children}</HubProvider> }
