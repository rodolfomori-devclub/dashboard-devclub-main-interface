import { useState } from 'react'
import IndividualGoalPace from '../hub/components/IndividualGoalPace'
import { brazilDate } from '../utils/goalPace.js'

// Outside admin, Metas and Ritmo das metas open this page. The API finds the
// person from the verified login; nothing here can select someone else. No Hub
// session: opening it must never create a commercial profile.
export default function OwnGoalPage() {
  const current = Number(brazilDate().slice(0, 4))
  const [year, setYear] = useState(current)
  return <div className="hub-page">
    <header className="page-heading">
      <div><h1>Minha meta</h1><p>A meta definida para você e quanto você já vendeu no mês.</p></div>
      <label className="text-sm space-y-1"><span className="block text-muted-foreground">Ano</span><select className="ds-input" aria-label="Ano da minha meta" value={year} onChange={event => setYear(Number(event.target.value))}>{[current - 1, current, current + 1].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </header>
    <IndividualGoalPace year={year} />
  </div>
}
