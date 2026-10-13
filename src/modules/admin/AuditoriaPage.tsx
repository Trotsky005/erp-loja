import { useCallback, useEffect, useMemo, useState } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import type { RegistroAuditoria, Usuario } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

const NOMES_TABELA: Record<string, string> = {
  lojas: 'Lojas', perfis: 'Perfis', perfil_permissoes: 'Permissões', usuarios: 'Usuários',
  usuario_lojas: 'Usuário × loja', parametros: 'Parâmetros',
  produtos: 'Produtos', config_tributarias: 'Config. tributárias', pessoas: 'Clientes/fornecedores', veiculos: 'Veículos', motoristas: 'Motoristas',
}
const NOMES_ACAO = { INSERT: 'Criou', UPDATE: 'Alterou', DELETE: 'Removeu' } as const
const CORES_ACAO = { INSERT: 'verde', UPDATE: 'ambar', DELETE: 'vermelho' } as const
const IGNORAR = new Set(['updated_at', 'updated_by', 'created_at', 'created_by'])
const POR_PAGINA = 50

/** Lista só os campos que mudaram numa alteração. */
function diferencas(r: RegistroAuditoria) {
  const antes = r.dados_antes ?? {}
  const depois = r.dados_depois ?? {}
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)])
  return [...chaves]
    .filter(k => !IGNORAR.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
    .map(k => ({ campo: k, antes: antes[k], depois: depois[k] }))
}
const mostrar = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

export function AuditoriaPage() {
  const { pode } = useAuth()
  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [tabela, setTabela] = useState('')
  const [pagina, setPagina] = useState(0)
  const [temMais, setTemMais] = useState(false)
  const [detalhe, setDetalhe] = useState<RegistroAuditoria | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setRegistros(null)
    let q = supabase.from('auditoria').select('*').order('data', { ascending: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA)
    if (tabela) q = q.eq('tabela', tabela)
    const [r, u] = await Promise.all([q, supabase.from('usuarios').select('id,nome')])
    if (r.error) setErro(mensagemErro(r.error))
    const dados = (r.data as RegistroAuditoria[]) ?? []
    setTemMais(dados.length > POR_PAGINA)
    setRegistros(dados.slice(0, POR_PAGINA))
    setUsuarios((u.data as Usuario[]) ?? [])
  }, [tabela, pagina])
  useEffect(() => { void carregar() }, [carregar])

  const nomeUsuario = useMemo(() => Object.fromEntries(usuarios.map(u => [u.id, u.nome])), [usuarios])

  if (!pode('admin.auditoria')) return <SemPermissao />

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Auditoria" descricao="Quem criou ou alterou o quê, e quando."
        acoes={
          <select className="campo w-48" value={tabela} aria-label="Filtrar por cadastro"
            onChange={e => { setTabela(e.target.value); setPagina(0) }}>
            <option value="">Todos os cadastros</option>
            {Object.entries(NOMES_TABELA).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        } />
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}

      <div className="cartao overflow-x-auto">
        {!registros ? <Carregando /> : registros.length === 0 ? <Vazio>Nenhum registro.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Cadastro</th><th>O que mudou</th></tr></thead>
            <tbody>
              {registros.map(r => {
                const dif = r.acao === 'UPDATE' ? diferencas(r) : []
                return (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setDetalhe(r)}>
                    <td className="whitespace-nowrap text-stone-600">{new Date(r.data).toLocaleString('pt-BR')}</td>
                    <td>{r.usuario_id ? nomeUsuario[r.usuario_id] ?? '—' : 'Sistema'}</td>
                    <td><Selo cor={CORES_ACAO[r.acao]}>{NOMES_ACAO[r.acao]}</Selo></td>
                    <td>{NOMES_TABELA[r.tabela] ?? r.tabela}</td>
                    <td className="max-w-md truncate text-stone-600">
                      {r.acao === 'UPDATE' ? (dif.length ? dif.map(d => d.campo).join(', ') : '—') : mostrar((r.dados_depois ?? r.dados_antes)?.nome ?? r.registro_id)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button className="btn-secundario" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anteriores</button>
        <button className="btn-secundario" disabled={!temMais} onClick={() => setPagina(p => p + 1)}>Mais antigos</button>
      </div>

      <Modal titulo="Detalhe da alteração" aberto={!!detalhe} aoFechar={() => setDetalhe(null)} largura="max-w-2xl">
        {detalhe && (
          <div className="space-y-3 text-sm">
            <p className="text-stone-600">
              {NOMES_ACAO[detalhe.acao]} em <strong>{NOMES_TABELA[detalhe.tabela] ?? detalhe.tabela}</strong> por{' '}
              <strong>{detalhe.usuario_id ? nomeUsuario[detalhe.usuario_id] ?? '—' : 'Sistema'}</strong>{' '}
              em {new Date(detalhe.data).toLocaleString('pt-BR')}
            </p>
            <table className="tabela">
              <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
              <tbody>
                {(detalhe.acao === 'UPDATE' ? diferencas(detalhe)
                  : Object.entries(detalhe.dados_depois ?? detalhe.dados_antes ?? {})
                      .filter(([k]) => !IGNORAR.has(k))
                      .map(([campo, v]) => ({ campo, antes: detalhe.acao === 'INSERT' ? undefined : v, depois: detalhe.acao === 'INSERT' ? v : undefined }))
                ).map(d => (
                  <tr key={d.campo}>
                    <td className="font-mono text-xs">{d.campo}</td>
                    <td className="break-all text-stone-500">{mostrar(d.antes)}</td>
                    <td className="break-all">{mostrar(d.depois)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
