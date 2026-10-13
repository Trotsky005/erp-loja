import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import { limparBusca, lerNumero, moeda, numero } from '../../lib/formato'
import type { ConfigTributaria, Produto } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'
import { ImportarProdutos } from './ImportarProdutos'

const POR_PAGINA = 50
type FiltroPeso = 'todos' | 'sem_peso' | 'sugerido' | 'com_peso'
type FiltroSituacao = 'ativos' | 'inativos' | 'todos'

type Formulario = Omit<Produto, 'id' | 'preco_venda' | 'preco_custo' | 'estoque_minimo' | 'peso_kg' | 'peso_sugerido_kg'> & {
  id?: string
  preco_venda: string; preco_custo: string; estoque_minimo: string; peso_kg: string
  peso_sugerido_kg: number | null
}

const VAZIO: Formulario = {
  codigo: '', codigo_barras: '', referencia: '', descricao: '', unidade: 'UN', ncm: '', cest: '', grupo: '', marca: '',
  preco_venda: '', preco_custo: '', estoque_minimo: '', peso_kg: '', peso_insignificante: false, peso_sugerido_kg: null,
  vem_em_saco: false, config_tributaria_id: null, ativo: true,
}

const paraTexto = (n: number | null) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

export function ProdutosPage() {
  const { pode } = useAuth()
  const [lista, setLista] = useState<Produto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [filtroPeso, setFiltroPeso] = useState<FiltroPeso>('todos')
  const [situacao, setSituacao] = useState<FiltroSituacao>('ativos')
  const [configs, setConfigs] = useState<ConfigTributaria[]>([])
  const [form, setForm] = useState<Formulario | null>(null)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [totalSugeridos, setTotalSugeridos] = useState(0)

  const carregar = useCallback(async () => {
    setLista(null)
    let q = supabase.from('produtos').select('*', { count: 'exact' })
    if (situacao !== 'todos') q = q.eq('ativo', situacao === 'ativos')
    if (filtroPeso === 'sem_peso') q = q.is('peso_kg', null).eq('peso_insignificante', false)
    if (filtroPeso === 'sugerido') q = q.is('peso_kg', null).not('peso_sugerido_kg', 'is', null)
    if (filtroPeso === 'com_peso') q = q.not('peso_kg', 'is', null)
    const termo = limparBusca(buscaAplicada)
    if (termo) {
      if (/^\d+$/.test(termo)) q = q.or(`codigo.eq.${termo},codigo_barras.eq.${termo},descricao.ilike.%${termo}%`)
      else termo.split(/\s+/).forEach(p => { q = q.ilike('descricao', `%${p}%`) })
    }
    const { data, count, error } = await q.order('descricao').range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
    if (error) setErro(mensagemErro(error))
    setLista((data as Produto[]) ?? [])
    setTotal(count ?? 0)
    const s = await supabase.from('produtos').select('id', { count: 'exact', head: true }).is('peso_kg', null).not('peso_sugerido_kg', 'is', null)
    setTotalSugeridos(s.count ?? 0)
  }, [buscaAplicada, filtroPeso, situacao, pagina])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    void supabase.from('config_tributarias').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setConfigs((data as ConfigTributaria[]) ?? []))
  }, [importando])

  const configPorId = useMemo(() => new Map<string, ConfigTributaria>(configs.map(c => [c.id, c] as [string, ConfigTributaria])), [configs])

  if (!pode('cadastros.produtos')) return <SemPermissao />
  const podeEditar = pode('cadastros.produtos', 'editar')
  const podeEditarPeso = podeEditar || pode('entregas.romaneios', 'criar')

  function pesquisar(e: FormEvent) { e.preventDefault(); setPagina(0); setBuscaAplicada(busca) }

  function abrir(p?: Produto) {
    setErro(''); setOk('')
    setForm(p ? {
      ...p,
      preco_venda: paraTexto(p.preco_venda), preco_custo: paraTexto(p.preco_custo),
      estoque_minimo: paraTexto(p.estoque_minimo), peso_kg: paraTexto(p.peso_kg),
    } : { ...VAZIO })
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setSalvando(true); setErro('')
    const { id, ...f } = form
    const vazioNulo = (s: string | null) => (s === null || s.trim() === '' ? null : s.trim())
    const dados = {
      codigo: f.codigo.trim(), codigo_barras: vazioNulo(f.codigo_barras), referencia: vazioNulo(f.referencia),
      descricao: f.descricao.trim().replace(/\s+/g, ' '), unidade: f.unidade.trim().toUpperCase() || 'UN',
      ncm: vazioNulo(f.ncm)?.replace(/\D/g, '') ?? null, cest: vazioNulo(f.cest)?.replace(/\D/g, '') ?? null,
      grupo: vazioNulo(f.grupo), marca: vazioNulo(f.marca),
      preco_venda: lerNumero(f.preco_venda) ?? 0, preco_custo: lerNumero(f.preco_custo),
      estoque_minimo: lerNumero(f.estoque_minimo),
      peso_kg: f.peso_insignificante ? null : lerNumero(f.peso_kg),
      peso_insignificante: f.peso_insignificante,
      peso_sugerido_kg: lerNumero(f.peso_kg) !== null || f.peso_insignificante ? null : f.peso_sugerido_kg,
      vem_em_saco: f.vem_em_saco, config_tributaria_id: f.config_tributaria_id || null, ativo: f.ativo,
    }
    // perfis que só podem mexer no peso mandam só os campos de peso
    const enviar = podeEditar ? dados : { peso_kg: dados.peso_kg, peso_insignificante: dados.peso_insignificante, peso_sugerido_kg: dados.peso_sugerido_kg }
    const { error } = id
      ? await supabase.from('produtos').update(enviar).eq('id', id)
      : await supabase.from('produtos').insert(dados)
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setForm(null)
    setOk(id ? 'Produto atualizado.' : 'Produto cadastrado.')
    await carregar()
  }

  async function aceitarSugestao(p: Produto, aceitar: boolean) {
    const { error } = await supabase.from('produtos')
      .update(aceitar ? { peso_kg: p.peso_sugerido_kg, peso_sugerido_kg: null } : { peso_sugerido_kg: null })
      .eq('id', p.id)
    if (error) setErro(mensagemErro(error)); else await carregar()
  }

  async function aceitarTodas() {
    if (!confirm(`Aceitar o peso sugerido de ${totalSugeridos} produtos? Confira a lista antes: alguns nomes trazem a capacidade e não o peso (ex.: "guia retrátil 15kg").`)) return
    const { data, error } = await supabase.rpc('aceitar_pesos_sugeridos')
    if (error) setErro(mensagemErro(error))
    else { setOk(`${data} pesos aceitos.`); await carregar() }
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const campoTexto = (k: keyof Formulario, rotulo: string, classe = '', extra: Record<string, unknown> = {}) => (
    <div className={classe}>
      <label className="rotulo" htmlFor={`prod-${k}`}>{rotulo}</label>
      <input id={`prod-${k}`} className="campo" disabled={!podeEditar} value={(form?.[k] as string | null) ?? ''}
        onChange={e => setForm(f => f && ({ ...f, [k]: e.target.value }))} {...extra} />
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina titulo="Produtos" descricao={`${total.toLocaleString('pt-BR')} produto(s) encontrado(s)`}
        acoes={<>
          {podeEditar && <button className="btn-secundario" onClick={() => setImportando(true)}>Importar do Microvix</button>}
          {pode('cadastros.produtos', 'criar') && <button className="btn-primario" onClick={() => abrir()}>Novo produto</button>}
        </>} />

      {erro && !form && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mb-3"><Aviso tipo="ok">{ok}</Aviso></div>}

      <form onSubmit={pesquisar} className="cartao mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-56 flex-1">
          <label className="rotulo" htmlFor="busca-prod">Buscar</label>
          <input id="busca-prod" className="campo" placeholder="Código, código de barras ou parte do nome (ex.: racao 15kg)"
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="filtro-peso">Peso</label>
          <select id="filtro-peso" className="campo" value={filtroPeso} onChange={e => { setPagina(0); setFiltroPeso(e.target.value as FiltroPeso) }}>
            <option value="todos">Todos</option>
            <option value="com_peso">Com peso</option>
            <option value="sem_peso">Sem peso</option>
            <option value="sugerido">Peso sugerido ({totalSugeridos})</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="filtro-sit">Situação</label>
          <select id="filtro-sit" className="campo" value={situacao} onChange={e => { setPagina(0); setSituacao(e.target.value as FiltroSituacao) }}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <button type="submit" className="btn-primario">Buscar</button>
      </form>

      {filtroPeso === 'sugerido' && totalSugeridos > 0 && podeEditarPeso && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>Pesos tirados do nome do produto. Confira e aceite um a um, ou todos de uma vez.</span>
          <button className="btn-secundario" onClick={() => void aceitarTodas()}>Aceitar todos ({totalSugeridos})</button>
        </div>
      )}

      <div className="cartao overflow-x-auto">
        {!lista ? <Carregando /> : lista.length === 0 ? (
          <Vazio>{total === 0 && !buscaAplicada && filtroPeso === 'todos' ? 'Nenhum produto cadastrado. Use "Importar do Microvix".' : 'Nada encontrado.'}</Vazio>
        ) : (
          <table className="tabela">
            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="text-right">Preço</th><th className="text-right">Peso (kg)</th><th>NCM</th><th>CST venda</th><th /></tr></thead>
            <tbody>
              {lista.map(p => {
                const c = p.config_tributaria_id ? configPorId.get(p.config_tributaria_id) : null
                return (
                  <tr key={p.id} className={p.ativo ? '' : 'opacity-50'}>
                    <td className="whitespace-nowrap font-mono text-xs text-stone-500">{p.codigo}</td>
                    <td className="font-medium">
                      {p.descricao}
                      {p.grupo && p.grupo !== 'GERAL' && <span className="ml-2 text-xs font-normal text-stone-400">{p.grupo}</span>}
                      {!p.ativo && <span className="ml-2"><Selo>Inativo</Selo></span>}
                    </td>
                    <td>{p.unidade}</td>
                    <td className="whitespace-nowrap text-right">{moeda(Number(p.preco_venda))}</td>
                    <td className="whitespace-nowrap text-right">
                      {p.peso_insignificante ? <span className="text-xs text-stone-400">insignif.</span>
                        : p.peso_kg !== null ? numero(Number(p.peso_kg))
                        : p.peso_sugerido_kg !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <Selo cor="ambar">≈ {numero(Number(p.peso_sugerido_kg))}?</Selo>
                            {podeEditarPeso && <>
                              <button title="Aceitar" aria-label="Aceitar peso sugerido" className="rounded px-1 text-emerald-700 hover:bg-emerald-50" onClick={() => void aceitarSugestao(p, true)}>✓</button>
                              <button title="Descartar" aria-label="Descartar peso sugerido" className="rounded px-1 text-stone-400 hover:bg-stone-100" onClick={() => void aceitarSugestao(p, false)}>✕</button>
                            </>}
                          </span>
                        ) : <span className="text-stone-300">—</span>}
                    </td>
                    <td className="font-mono text-xs">{p.ncm ?? '—'}</td>
                    <td className="whitespace-nowrap font-mono text-xs" title={c?.nome}>
                      {c ? (c.cst_venda_interna === c.cst_venda_interestadual ? c.cst_venda_interna : `${c.cst_venda_interna}/${c.cst_venda_interestadual}`) : '—'}
                    </td>
                    <td className="text-right">
                      <button className="text-sm text-marca-700 hover:underline" onClick={() => abrir(p)}>{podeEditar ? 'Editar' : podeEditarPeso ? 'Peso' : 'Ver'}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-sm text-stone-600">
        <span>Página {pagina + 1} de {paginas.toLocaleString('pt-BR')}</span>
        <button className="btn-secundario" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
        <button className="btn-secundario" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)}>Próxima</button>
      </div>

      <Modal titulo={form?.id ? `Produto ${form.codigo}` : 'Novo produto'} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-3xl"
        rodape={<>
          <button className="btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
          {(podeEditar || podeEditarPeso) && <button type="submit" form="form-produto" className="btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>}
        </>}>
        {form && (
          <form id="form-produto" onSubmit={salvar} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            {erro && <div className="sm:col-span-6"><Aviso>{erro}</Aviso></div>}
            {campoTexto('codigo', 'Código', 'sm:col-span-2', { required: true, disabled: !!form.id || !podeEditar })}
            {campoTexto('codigo_barras', 'Código de barras', 'sm:col-span-2', { inputMode: 'numeric' })}
            {campoTexto('referencia', 'Referência', 'sm:col-span-2')}
            {campoTexto('descricao', 'Descrição', 'sm:col-span-6', { required: true })}
            {campoTexto('unidade', 'Unidade', 'sm:col-span-1', { required: true, maxLength: 6 })}
            {campoTexto('grupo', 'Grupo', 'sm:col-span-2')}
            {campoTexto('marca', 'Marca', 'sm:col-span-3')}
            {campoTexto('preco_venda', 'Preço de venda (R$)', 'sm:col-span-2', { inputMode: 'decimal', required: true })}
            {campoTexto('preco_custo', 'Preço de custo (R$)', 'sm:col-span-2', { inputMode: 'decimal' })}
            {campoTexto('estoque_minimo', 'Estoque mínimo', 'sm:col-span-2', { inputMode: 'decimal' })}

            <fieldset className="rounded-md border border-stone-200 p-3 sm:col-span-6">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Peso (romaneio)</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="rotulo" htmlFor="prod-peso">Peso por {form.unidade || 'unidade'} (kg)</label>
                  <input id="prod-peso" className="campo" inputMode="decimal" disabled={!podeEditarPeso || form.peso_insignificante}
                    value={form.peso_kg} onChange={e => setForm(f => f && ({ ...f, peso_kg: e.target.value }))} />
                  {form.peso_sugerido_kg !== null && !form.peso_kg && (
                    <button type="button" className="mt-1 text-xs text-sky-700 hover:underline"
                      onClick={() => setForm(f => f && ({ ...f, peso_kg: paraTexto(f.peso_sugerido_kg) }))}>
                      Usar sugestão: {numero(form.peso_sugerido_kg)} kg
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm sm:pt-5">
                  <input type="checkbox" className="h-4 w-4 accent-marca-600" disabled={!podeEditarPeso} checked={form.peso_insignificante}
                    onChange={e => setForm(f => f && ({ ...f, peso_insignificante: e.target.checked }))} />
                  Peso insignificante (não soma no romaneio)
                </label>
                <label className="flex items-center gap-2 text-sm sm:pt-5">
                  <input type="checkbox" className="h-4 w-4 accent-marca-600" disabled={!podeEditar} checked={form.vem_em_saco}
                    onChange={e => setForm(f => f && ({ ...f, vem_em_saco: e.target.checked }))} />
                  Vem em saco (conta nos "Sacos")
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-md border border-stone-200 p-3 sm:col-span-6">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Fiscal</legend>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-1">
                  <label className="rotulo" htmlFor="prod-ncm">NCM</label>
                  <input id="prod-ncm" className="campo font-mono" disabled={!podeEditar} value={form.ncm ?? ''} onChange={e => setForm(f => f && ({ ...f, ncm: e.target.value }))} />
                </div>
                <div className="sm:col-span-1">
                  <label className="rotulo" htmlFor="prod-cest">CEST</label>
                  <input id="prod-cest" className="campo font-mono" disabled={!podeEditar} value={form.cest ?? ''} onChange={e => setForm(f => f && ({ ...f, cest: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="rotulo" htmlFor="prod-config">Configuração tributária</label>
                  <select id="prod-config" className="campo" disabled={!podeEditar} value={form.config_tributaria_id ?? ''}
                    onChange={e => setForm(f => f && ({ ...f, config_tributaria_id: e.target.value || null }))}>
                    <option value="">— sem configuração —</option>
                    {configs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              {form.config_tributaria_id && configPorId.get(form.config_tributaria_id) && (() => {
                const c = configPorId.get(form.config_tributaria_id)!
                return (
                  <p className="mt-2 text-xs text-stone-500">
                    CST compra <strong>{c.cst_compra}</strong> · venda em SP <strong>{c.cst_venda_interna}</strong> · venda fora <strong>{c.cst_venda_interestadual}</strong> · PIS/COFINS <strong>{c.pis_cofins_cst}</strong>
                    {c.observacao && <span className="block text-amber-700">{c.observacao}</span>}
                  </p>
                )
              })()}
            </fieldset>

            <label className="flex items-center gap-2 text-sm sm:col-span-6">
              <input type="checkbox" className="h-4 w-4 accent-marca-600" disabled={!podeEditar} checked={form.ativo}
                onChange={e => setForm(f => f && ({ ...f, ativo: e.target.checked }))} />
              Produto ativo
            </label>
          </form>
        )}
      </Modal>

      <ImportarProdutos aberto={importando} aoFechar={() => setImportando(false)} aoConcluir={() => void carregar()} />
    </div>
  )
}
