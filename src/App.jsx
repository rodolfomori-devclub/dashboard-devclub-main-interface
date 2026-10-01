import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const PrivateWorkspace = lazy(() => import('./PrivateWorkspace.jsx'))
const PublicTVPage = lazy(() => import('./pages/PublicTVPage.jsx'))

// Public televisions never mount the Vault session or the private workspace.
export default function App() {
  return <BrowserRouter><Suspense fallback={<div className="session-screen" role="status">Carregando…</div>}><Routes>
    <Route path="/tv" element={<PublicTVPage/>}/>
    <Route path="/tv/:token" element={<PublicTVPage/>}/>
    <Route path="/tv/*" element={<PublicTVPage/>}/>
    <Route path="*" element={<PrivateWorkspace/>}/>
  </Routes></Suspense></BrowserRouter>
}
