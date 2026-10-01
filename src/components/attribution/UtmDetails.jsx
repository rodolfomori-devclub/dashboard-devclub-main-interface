/* eslint-disable react/prop-types -- Values come from normalized sale records. */
import { UTM_FIELDS } from '../../utils/salesData'
export default function UtmDetails({ utm = {}, expanded = false }) {
  const values = UTM_FIELDS.filter(field => typeof utm?.[field] === 'string' && utm[field].trim())
  if (!values.length) return <span className="attribution-no-utm">UTMs não informadas</span>
  return <details className="attribution-utm-details" open={expanded || undefined}>
    <summary><span>UTM Source</span><strong>{utm.source || 'Origem não informada'}</strong></summary>
    <dl>{UTM_FIELDS.map(field => <div key={field}><dt>UTM {field}</dt><dd>{utm[field] || 'Não informado'}</dd></div>)}</dl>
  </details>
}
