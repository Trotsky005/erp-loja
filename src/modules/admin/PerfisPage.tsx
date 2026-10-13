import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import type { Perfil, PerfilPermissao, Recurso } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao } from '../../core/ui/componentes'

const ACOES = [
  { campo: 'pode_ver', nome: 'Ver' },
  { campo: 'pode_criar', nome: 'Criar' },
  { campo: 'pode_editar', nome: 'Editar' },
  { campo: 'pode_cancelar', nome: 'Cancelar' },
] as const
type CampoAcao = typeof ACOES[number]['campo']

export function PerfisPage() {
  const { pode, recarregar } = useAuth()
  const [perfis, setPerfis] = useState<Perfil[] | null>(null)
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [permissoes, setPermissoes] = useState<PerfilPermissao[]>([])
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [alterado, setAlterado] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novo, setNovo] = useState<{ nome: string; descricao: string } | null>(null)

  const carregar = useCallback(async () => {
    const [p, r, pp] = await Promise.all([
      supabase.from('perfis').select('*').order('nome'),
      supabase.from('recursos').select('*').order('ordem'),
      supabase.from('perfil_permissoes').select('*'),
    ])
    const falha = p.error ?? r.error ?? pp.error
    if (falha) setErro(mensagemErro(falha))
    const ps = (p.data as Perfil[]) ?? []
    setPerfis(ps)
    setRecursos((r.data as Recurso[]) ?? [])
    setPermissoes((pp.data as PerfilPermissao[]) ?? [])
    setSelecionado(s => s ?? ps.find(x => !x.admin)?.id ?? ps[0]?.id ?? null)
    setAlterado(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const modulos = useMemo(() => {
    const m = new Map<string, Recurso[]>()
    recursos.forEach(r => m.set(r.modulo, [...(m.get(r.modulo) ?? []), r]))
    return [...m.entries()]
  }, [recursos])

  if (!pode('admin.perfis')) return <SemPermissao />

  const perfil = perfis?.find(p => p.id === selecionado) ?? null
  const podeEditar = pode('admin.perfis', 'editar') && !!perfil && !perfil.admin

  function valor(recurso: string, campo: CampoAcao) {
    return permissoes.find(p => p.perfil_id === selecionado && p.recurso === recurso)?.[campo] ?? false
  }

  function alternar(recurso: string, campo: CampoAcao, marcado: boolean) {
    if (!selecionado) return
    setAlterado(true); setOk('')
    setPermissoes(lista => {
      const atual = lista.find(p => p.perfil_id === selecionado && p.recurso === recurso)
      const base: PerfilPermissao = atual ?? { perfil_id: selecionado, recurso, pode_ver: false, pode_criar: false, pode_editar: false, pode_cancelar: false }
      const nova = { ...base, [campo]: marcado }
      // criar/editar/cancelar exigem "ver"; tirar "ver" tira tudo
      if (campo !== 'pode_ver' && marcado) nova.pode_ver = true
      if (campo === 'pode_ver' && !marcado) { nova.pode_criar = false; nova.pode_editar = false; nova.pode_cancelar = false }
      return atual ? lista.map(p => (p === atual ? nova : p)) : [...lista, nova]
    })
  }

  async function salvar() {
    if (!selecionado) return
    setSalvando(true); setErro(''); setOk('')
    const linhas = permissoes.filter(p => p.perfil_id === selecionado)
    const { error } = await supabase.from('perfil_permissoes').upsert(linhas, { onConflict: 'perfil_id,recurso' })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setOk('Permissões salvas.')
    setAlterado(false)
    await recarregar()
  }

  async function criarPerfil(e: FormEvent) {
    e.preventDefault()
    if (!novo) return
    const { data, error } = await supabase.from('perfis').insert({ nome: novo.nome.trim(), descricao: novo.descricao.trim() || null }).select().single()
    if (error) { setErro(mensagemErro(error)); return }
    setNovo(null)
    setSelecionado((data as Perfil).id)
    await carregar()
  }

  async function alternarAtivo() {
    if (!perfil) return
    const { error } = await supabase.from('perfis').update({ ativo: !perfil.ativo }).eq('id', perfil.id)
    if (error) setErro(mensagemErro(error)); else await carregar()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Perfis e permissões" descricao="Defina o que cada perfil pode ver e fazer em cada tela."
        acoes={pode('admin.perfis', 'criar') && <button className="btn-primario" onClick={() => setNovo({ nome: '', descricao: '' })}>Novo perfil</button>} />
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="ok">{ok}</Aviso></div>}

      {!perfis ? <Carregando /> : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <div className="cartao h-fit p-2">
            {perfis.map(p => (
              <button key={p.id} onClick={() => { if (!alterado || confirm('Descartar alterações não salvas?')) { setSelecionado(p.id); setAlterado(false); void carregar() } }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${p.id === selecionado ? 'bg-marca-50 font-medium text-marca-800' : 'hover:bg-stone-50'}`}>
                <span className={p.ativo ? '' : 'text-stone-400 line-through'}>{p.nome}</span>
                {p.admin && <Selo cor="vermelho">total</Selo>}
              </button>
            ))}
          </div>

          {perfil && (
            <div className="cartao overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
                <div>
                  <h2 className="font-semibold text-stone-900">{perfil.nome}</h2>
                  {perfil.descricao && <p className="text-xs text-stone-500">{perfil.descricao}</p>}
                </div>
                {podeEditar && (
                  <div className="flex gap-2">
                    <button className="btn-secundario" onClick={() => void alternarAtivo()}>{perfil.ativo ? 'Desativar perfil' : 'Reativar perfil'}</button>
                    <button className="btn-primario" disabled={!alterado || salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar permissões'}</button>
                  </div>
                )}
              </div>
              {perfil.admin ? (
                <p className="p-4 text-sm text-stone-600">O perfil Administrador tem acesso total a todas as telas e não usa a tabela de permissões.</p>
              ) : (
                <table className="tabela">
                  <thead><tr><th>Tela</th>{ACOES.map(a => <th key={a.campo} className="text-center">{a.nome}</th>)}</tr></thead>
                  <tbody>
                    {modulos.map(([modulo, rs]) => [
                      <tr key={modulo}><td colSpan={5} className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">{modulo}</td></tr>,
                      ...rs.map(r => (
                        <tr key={r.codigo}>
                          <td>{r.nome}</td>
                          {ACOES.map(a => (
                            <td key={a.campo} className="text-center">
                              <input type="checkbox" aria-label={`${a.nome} ${r.nome}`} className="h-4 w-4 accent-marca-600"
                                disabled={!podeEditar} checked={valor(r.codigo, a.campo)}
                                onChange={e => alternar(r.codigo, a.campo, e.target.checked)} />
                            </td>
                          ))}
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      <Modal titulo="Novo perfil" aberto={!!novo} aoFechar={() => setNovo(null)}
        rodape={<>
          <button className="btn-secundario" onClick={() => setNovo(null)}>Cancelar</button>
          <button type="submit" form="form-perfil" className="btn-primario">Criar</button>
        </>}>
        {novo && (
          <form id="form-perfil" onSubmit={criarPerfil} className="space-y-3">
            <div>
              <label className="rotulo" htmlFor="perfil-nome">Nome</label>
              <input id="perfil-nome" className="campo" required value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} />
            </div>
            <div>
              <label className="rotulo" htmlFor="perfil-desc">Descrição</label>
              <input id="perfil-desc" className="campo" value={novo.descricao} onChange={e => setNovo({ ...novo, descricao: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
