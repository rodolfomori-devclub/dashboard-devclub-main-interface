/* eslint-disable react/prop-types -- Internal React 19 components with explicit props. */
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Sun, ChartNoAxesCombined, CalendarDays, CalendarRange, Columns3, Undo2, Target, Gauge, GitCompareArrows, House, ListChecks, ClipboardList, CheckCheck, ChartColumnIncreasing, Trophy, Library, Link, NotebookPen, Wallet, Landmark, Table2, Megaphone, Settings2, History, Database, ShieldCheck, Square, PanelsTopLeft, LogOut, Menu, ChevronRight, Moon, Presentation, GraduationCap, BookOpen } from 'lucide-react'
const Icons = { Sun, ChartNoAxesCombined, CalendarDays, CalendarRange, Columns3, Undo2, Target, Gauge, GitCompareArrows, House, ListChecks, ClipboardList, CheckCheck, ChartColumnIncreasing, Trophy, Library, Link, NotebookPen, Wallet, Landmark, Table2, Megaphone, Settings2, History, Database, ShieldCheck, Square, PanelsTopLeft, LogOut, Menu, ChevronRight, Moon, Presentation, GraduationCap, BookOpen }
import { NAVIGATION, SCREENS } from '../lib/navigation'
import { useAuth } from '../contexts/AuthContext'

export function PageSkeleton() {
  return <div className="hub-page skeleton-page" role="status" aria-label="Carregando tela"><div className="skeleton skeleton-title" /><div className="stat-grid">{[0,1,2,3].map(i => <div className="skeleton skeleton-stat" key={i} />)}</div><div className="skeleton skeleton-chart" /><span className="sr-only">Carregando</span></div>
}
export default function WorkspaceLayout({ children }) {
  const { currentUser, hasPermission, logout, userRoles } = useAuth()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 850px)').matches)
  const sidebarRef = useRef(null)
  useEffect(() => { const media = window.matchMedia('(max-width: 850px)'); const change = () => setMobile(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change) }, [])
  const [dark, setDark] = useState(() => (localStorage.getItem('workspace-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark')
  const location = useLocation()
  const menuRef = useRef(null)
  useEffect(() => { setOpen(false); document.getElementById('workspace-main')?.scrollTo(0,0) }, [location.pathname])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('workspace-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => {
    if (!open || !mobile) return
    const previousOverflow = document.body.style.overflow
    const menuButton = menuRef.current
    document.body.style.overflow = 'hidden'
    const focusable = () => [...(sidebarRef.current?.querySelectorAll('a[href],button:not([disabled])') || [])]
    focusable()[0]?.focus()
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
      if (event.key === 'Tab') {
        const nodes = focusable(), first = nodes[0], last = nodes.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = previousOverflow; menuButton?.focus() }
  }, [open, mobile])
  const title = SCREENS.find(screen => location.pathname === screen.path || location.pathname.startsWith(`${screen.path}/`))?.label || 'Operação'
  const initials = (currentUser?.displayName || 'U').split(' ').slice(0,2).map(word => word[0]).join('')
  return <div className="workspace">
    <a href="#workspace-main" className="skip-link">Ir para o conteúdo</a>
    {open && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
    <aside ref={sidebarRef} inert={mobile && !open ? true : undefined} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} className={`workspace-sidebar ${open ? 'is-open' : ''}`} aria-label="Menu principal" id="workspace-navigation">
      <NavLink to="/" className="workspace-brand"><span className="brand-mark"><Icons.PanelsTopLeft size={23} /></span><span><strong>DevClub</strong><small>Workspace</small></span></NavLink>
      <nav>{NAVIGATION.map(group => {
        const items = group.items.filter(item => hasPermission(item.permission))
        if (!items.length) return null
        return <div className="nav-group" key={group.group}><p>{group.group}</p>{items.map(item => {
          const Icon = Icons[item.icon] || Icons.Square
          return <NavLink key={item.path} to={item.path} end={item.path === '/hub'} className={({ isActive }) => `workspace-navlink ${isActive ? 'active' : ''}`}><Icon size={18} strokeWidth={1.7} /><span>{item.label}</span></NavLink>
        })}</div>
      })}</nav>
      <div className="sidebar-account"><span className="avatar">{initials}</span><div><strong>{currentUser?.displayName}</strong><small>{userRoles?.isAdmin ? 'Administrador' : 'Usuário'}</small></div><button className="icon-button" onClick={logout} aria-label="Sair do sistema" title="Sair"><Icons.LogOut size={17} /></button></div>
    </aside>
    <div className="workspace-content">
      <header className="workspace-topbar"><div className="flex items-center gap-3"><button ref={menuRef} className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="workspace-navigation" aria-label="Abrir menu"><Icons.Menu size={21} /></button><span className="workspace-breadcrumb">Workspace <Icons.ChevronRight size={14} /><strong>{title}</strong></span></div><div className="flex items-center gap-3"><span className="vault-status"><Icons.ShieldCheck size={14} /> Acesso pelo Vault</span><button className="icon-button" onClick={() => setDark(!dark)} aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}>{dark ? <Icons.Sun size={19} /> : <Icons.Moon size={19} />}</button></div></header>
      <main id="workspace-main" className="workspace-main" tabIndex={-1}>{children}</main>
    </div>
  </div>
}
