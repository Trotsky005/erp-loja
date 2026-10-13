import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Acao, Loja, Perfil, PerfilPermissao, Usuario } from '../../lib/tipos'

interface AuthContexto {
  carregando: boolean
  sessao: Session | null
  usuario: Usuario | null
  perfil: Perfil | null
  lojas: Loja[]
  lojaAtual: Loja | null
  trocarLoja: (id: string) => void
  pode: (recurso: string, acao?: Acao) => boolean
  recarregar: () => Promise<void>
  sair: () => Promise<void>
}

const Contexto = createContext<AuthContexto | null>(null)
const CHAVE_LOJA = 'erp.lojaAtual'

function lerLojaSalva(): string | null {
  try { return localStorage.getItem(CHAVE_LOJA) } catch { return null }
}
function salvarLoja(id: string) {
  try { localStorage.setItem(CHAVE_LOJA, id) } catch { /* navegador sem armazenamento */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [sessao, setSessao] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [permissoes, setPermissoes] = useState<PerfilPermissao[]>([])
  const [lojas, setLojas] = useState<Loja[]>([])
  const [lojaAtualId, setLojaAtualId] = useState<string | null>(lerLojaSalva())

  const carregarDados = useCallback(async (s: Session | null) => {
    if (!s) {
      setUsuario(null); setPerfil(null); setPermissoes([]); setLojas([])
      return
    }
    const { data: u } = await supabase.from('usuarios').select('*').eq('id', s.user.id).maybeSingle<Usuario>()
    setUsuario(u ?? null)
    if (!u || !u.ativo) {
      setPerfil(null); setPermissoes([]); setLojas([])
      return
    }
    const [rPerfil, rPerm, rLojas] = await Promise.all([
      u.perfil_id
        ? supabase.from('perfis').select('*').eq('id', u.perfil_id).maybeSingle<Perfil>()
        : Promise.resolve({ data: null }),
      u.perfil_id
        ? supabase.from('perfil_permissoes').select('*').eq('perfil_id', u.perfil_id)
        : Promise.resolve({ data: [] }),
      supabase.from('lojas').select('*').eq('ativo', true).order('codigo'),
    ])
    setPerfil((rPerfil.data as Perfil | null) ?? null)
    setPermissoes((rPerm.data as PerfilPermissao[] | null) ?? [])
    const ls = (rLojas.data as Loja[] | null) ?? []
    setLojas(ls)
    setLojaAtualId(atual => (atual && ls.some(l => l.id === atual) ? atual : ls[0]?.id ?? null))
  }, [])

  useEffect(() => {
    let ativo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      setSessao(data.session)
      await carregarDados(data.session)
      if (ativo) setCarregando(false)
    })
    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s)
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        // fora do callback para não travar o cliente do Supabase
        setTimeout(() => { void carregarDados(s) }, 0)
      }
    })
    return () => { ativo = false; assinatura.subscription.unsubscribe() }
  }, [carregarDados])

  const pode = useCallback((recurso: string, acao: Acao = 'ver') => {
    if (!usuario?.ativo) return false
    if (perfil?.admin) return true
    const p = permissoes.find(x => x.recurso === recurso)
    if (!p) return false
    return { ver: p.pode_ver, criar: p.pode_criar, editar: p.pode_editar, cancelar: p.pode_cancelar }[acao]
  }, [usuario, perfil, permissoes])

  const valor = useMemo<AuthContexto>(() => ({
    carregando,
    sessao,
    usuario,
    perfil,
    lojas,
    lojaAtual: lojas.find(l => l.id === lojaAtualId) ?? null,
    trocarLoja: (id: string) => { setLojaAtualId(id); salvarLoja(id) },
    pode,
    recarregar: () => carregarDados(sessao),
    sair: async () => { await supabase.auth.signOut() },
  }), [carregando, sessao, usuario, perfil, lojas, lojaAtualId, pode, carregarDados])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth() {
  const c = useContext(Contexto)
  if (!c) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return c
}
