import PropTypes from 'prop-types'
import { HubProvider } from '../hub/contexts/AuthContext'
export default function HubArea({children}) { return <HubProvider>{children}</HubProvider> }

HubArea.propTypes = { children: PropTypes.node }
