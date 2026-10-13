import { useCallback, useEffect, useMemo, useState } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import type { Loja, Perfil, Usuario } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

interface Edicao {
  usuario: Usuario
  perfil_id: string
  todas_lojas: boolean
  ativo: boolean
  lojas: Set<string>
}

export function UsuariosPage() {
  const { pode, usuario: eu, recarregar } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [lojas, setLojas] = useState<Loja[]>([])
  const [vinculos, setVinculos] = useState<{ usuario_id: string; loja_id: string }[]>([])
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'pendentes'>('todos')

  const carregar = useCallback(async () => {
    const [u, p, l, v] = await Promise.all([
      supabase.from('usuarios').select('*').order('nome'),
      supabase.from('perfis').select('*').eq('ativo', true).order('nome'),
      supabase.from('lojas').select('*').order('codigo'),
      supabase.from('usuario_lojas').select('*'),
    ])
    const falha = u.error ?? p.error ?? l.error ?? v.error
    if (falha) setErro(mensagemErro(falha))
    setUsuarios((u.data as Usuario[]) ?? [])
    setPerfis((p.data as Perfil[]) ?? [])
    setLojas((l.data as Loja[]) ?? [])
    setVinculos(v.data ?? [])
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const nomePerfil = useMemo(() => Object.fromEntries(perfis.map(p => [p.id, p.nome])), [perfis])
  const nomeLoja = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l.nome])), [lojas])

  if (!pode('admin.usuarios')) return <SemPermissao />

  const pendentes = (usuarios ?? []).filter(u => !u.ativo && !u.perfil_id)
  const lista = filtro === 'pendentes' ? pendentes : usuarios ?? []

  function abrir(u: Usuario) {
    setErro('')
    setEdicao({
      usuario: u,
      perfil_id: u.perfil_id ?? '',
      todas_lojas: u.todas_lojas,
      ativo: u.ativo || (!u.perfil_id), // ao liberar um pedido novo, já sugere ativar
      lojas: new Set(vinculos.filter(v => v.usuario_id === u.id).map(v => v.loja_id)),
    })
  }

  async function salvar() {
    if (!edicao) return
    if (edicao.ativo && !edicao.perfil_id) { setErro('Escolha um perfil para ativar o usuário.'); return }
    if (edicao.ativo && !edicao.todas_lojas && edicao.lojas.size === 0) { setErro('Marque pelo menos uma loja (ou "todas as lojas").'); return }
    if (edicao.usuario.id === eu?.id && !edicao.ativo) { setErro('Você não pode desativar o seu próprio acesso.'); return }
    setSalvando(true); setErro('')
    try {
      const id = edicao.usuario.id
      const { error } = await supabase.from('usuarios').update({
        perfil_id: edicao.perfil_id || null,
        todas_lojas: edicao.todas_lojas,
        ativo: edicao.ativo,
      }).eq('id', id)
      if (error) throw error

      const atuais = new Set(vinculos.filter(v => v.usuario_id === id).map(v => v.loja_id))
      const remover = [...atuais].filter(l => !edicao.lojas.has(l))
      const incluir = [...edicao.lojas].filter(l => !atuais.has(l))
      if (remover.length) {
        const r = await supabase.from('usuario_lojas').delete().eq('usuario_id', id).in('loja_id', remover)
        if (r.error) throw r.error
      }
      if (incluir.length) {
        const r = await supabase.from('usuario_lojas').insert(incluir.map(loja_id => ({ usuario_id: id, loja_id })))
        if (r.error) throw r.error
      }
      setEdicao(null)
      await carregar()
      if (id === eu?.id) await recarregar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const podeEditar = pode('admin.usuarios', 'editar')

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Usuários"
        descricao="Novos usuários pedem acesso na tela de login (Solicitar acesso) e aparecem aqui para liberação." />

      {pendentes.length > 0 && (
        <div className="mb-4">
          <Aviso tipo="info">
            {pendentes.length === 1 ? '1 pedido de acesso aguardando liberação.' : `${pendentes.length} pedidos de acesso aguardando liberação.`}
            {filtro === 'todos' && <button className="ml-2 font-medium underline" onClick={() => setFiltro('pendentes')}>Ver pedidos</button>}
          </Aviso>
        </div>
      )}
      {erro && !edicao && <div className="mb-4"><Aviso>{erro}</Aviso></div>}

      <div className="mb-3 flex gap-2 text-sm">
        {(['todos', 'pendentes'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1 ${filtro === f ? 'bg-marca-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}>
            {f === 'todos' ? 'Todos' : `Pedidos de acesso (${pendentes.length})`}
          </button>
        ))}
      </div>

      <div className="cartao overflow-x-auto">
        {!usuarios ? <Carregando /> : lista.length === 0 ? <Vazio>Nenhum usuário aqui.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Lojas</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lista.map(u => {
                const ls = vinculos.filter(v => v.usuario_id === u.id).map(v => nomeLoja[v.loja_id]).filter(Boolean)
                return (
                  <tr key={u.id}>
                    <td className="font-medium">{u.nome}{u.id === eu?.id && <span className="ml-1 text-xs text-stone-400">(você)</span>}</td>
                    <td className="text-stone-600">{u.email}</td>
                    <td>{u.perfil_id ? nomePerfil[u.perfil_id] ?? '—' : '—'}</td>
                    <td className="text-stone-600">{u.todas_lojas ? 'Todas' : ls.length ? ls.join(', ') : '—'}</td>
                    <td>
                      {u.ativo ? <Selo cor="verde">Ativo</Selo> : !u.perfil_id ? <Selo cor="ambar">Aguardando</Selo> : <Selo>Inativo</Selo>}
                    </td>
                    <td className="text-right">
                      {podeEditar && (
                        <button className="text-sm text-marca-700 hover:underline" onClick={() => abrir(u)}>
                          {!u.ativo && !u.perfil_id ? 'Liberar' : 'Editar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal titulo={edicao ? `Acesso de ${edicao.usuario.nome}` : ''} aberto={!!edicao} aoFechar={() => setEdicao(null)}
        rodape={<>
          <button className="btn-secundario" onClick={() => setEdicao(null)}>Cancelar</button>
          <button className="btn-primario" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>}>
        {edicao && (
          <div className="space-y-4">
            {erro && <Aviso>{erro}</Aviso>}
            <p className="text-sm text-stone-500">{edicao.usuario.email}</p>
            <div>
              <label className="rotulo" htmlFor="usr-perfil">Perfil</label>
              <select id="usr-perfil" className="campo" value={edicao.perfil_id}
                onChange={e => setEdicao({ ...edicao, perfil_id: e.target.value })}>
                <option value="">— escolha —</option>
                {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="rotulo">Lojas que pode acessar</legend>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-marca-600" checked={edicao.todas_lojas}
                  onChange={e => setEdicao({ ...edicao, todas_lojas: e.target.checked })} />
                Todas as lojas
              </label>
              {!edicao.todas_lojas && (
                <div className="grid gap-1 rounded-md border border-stone-200 p-2 sm:grid-cols-2">
                  {lojas.map(l => (
                    <label key={l.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-marca-600" checked={edicao.lojas.has(l.id)}
                        onChange={e => {
                          const s = new Set(edicao.lojas)
                          if (e.target.checked) s.add(l.id); else s.delete(l.id)
                          setEdicao({ ...edicao, lojas: s })
                        }} />
                      {l.codigo} - {l.nome}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-marca-600" checked={edicao.ativo}
                onChange={e => setEdicao({ ...edicao, ativo: e.target.checked })} />
              Acesso ativo
            </label>
          </div>
        )}
      </Modal>
    </div>
  )
}
