import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Icone } from '../ui/componentes'
import { MENU } from './menu'

export function AppLayout() {
  const { usuario, perfil, lojas, lojaAtual, trocarLoja, pode, sair } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const campoBusca = useRef<HTMLInputElement>(null)
  const local = useLocation()

  // fecha o menu no celular ao trocar de página
  useEffect(() => { setMenuAberto(false) }, [local.pathname])

  // Ctrl+G: atalho para a busca no menu (mesmo atalho do Microvix)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        setMenuAberto(true)
        campoBusca.current?.focus()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return MENU
      .map(g => ({
        ...g,
        itens: g.itens.filter(i => pode(i.recurso) &&
          (!termo || i.nome.toLowerCase().includes(termo) || g.modulo.toLowerCase().includes(termo))),
      }))
      .filter(g => g.itens.length > 0)
  }, [busca, pode])

  return (
    <div className="flex h-full">
      {/* Fundo escuro do menu no celular */}
      {menuAberto && <div className="fixed inset-0 z-30 bg-stone-900/40 lg:hidden" onClick={() => setMenuAberto(false)} />}

      {/* Menu lateral */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-stone-900 text-stone-300 transition-transform lg:static lg:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <Link to="/" className="flex h-14 shrink-0 items-center gap-2 bg-marca-700 px-4 text-white">
          <img src="/icone.svg" alt="" className="h-7 w-7" />
          <span className="font-semibold tracking-tight">ERP Loja</span>
        </Link>
        <div className="p-3">
          <input ref={campoBusca} value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar no menu (Ctrl+G)" aria-label="Buscar no menu"
            className="w-full rounded-md border border-stone-700 bg-stone-800 px-3 py-1.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-marca-500 focus:outline-none" />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <NavLink to="/" end className={({ isActive }) => `mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-marca-600 text-white' : 'hover:bg-stone-800 hover:text-white'}`}>
            <Icone d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" className="h-4 w-4" />
            Início
          </NavLink>
          {grupos.map(g => (
            <div key={g.modulo} className="mb-3">
              <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <Icone d={g.icone} className="h-3.5 w-3.5" />
                {g.modulo}
              </div>
              {g.itens.map(i => (
                <NavLink key={i.rota} to={i.rota} end
                  className={({ isActive }) => `flex items-center justify-between rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-marca-600 text-white' : 'hover:bg-stone-800 hover:text-white'}`}>
                  <span>{i.nome}</span>
                  {!i.pronto && <span className="text-[10px] uppercase tracking-wide text-stone-500">em breve</span>}
                </NavLink>
              ))}
            </div>
          ))}
          {grupos.length === 0 && <p className="px-3 text-sm text-stone-500">Nada encontrado.</p>}
        </nav>
      </aside>

      {/* Área principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 bg-marca-600 px-3 text-white shadow sm:px-4">
          <button type="button" className="rounded p-1.5 hover:bg-marca-700 lg:hidden" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <Icone d="M4 6h16M4 12h16M4 18h16" />
          </button>

          {lojas.length > 0 && (
            <label className="flex min-w-0 items-center gap-2">
              <span className="hidden text-xs text-marca-100 sm:inline">Loja</span>
              <select value={lojaAtual?.id ?? ''} onChange={e => trocarLoja(e.target.value)}
                className="max-w-[55vw] truncate rounded-md border border-marca-500 bg-marca-700 px-2 py-1 text-sm text-white focus:outline-none sm:max-w-xs">
                {lojas.map(l => <option key={l.id} value={l.id}>{l.codigo} - {l.nome}</option>)}
              </select>
            </label>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{usuario?.nome}</div>
              <div className="text-xs text-marca-100">{perfil?.nome ?? 'Sem perfil'}</div>
            </div>
            <button type="button" onClick={() => void sair()} title="Sair" aria-label="Sair"
              className="rounded p-1.5 hover:bg-marca-700">
              <Icone d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
