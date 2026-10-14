import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { mensagemErro, supabase } from '../../lib/supabase'
import { dataBR, dataHoraBR, hojeISO, lerNumero, limparBusca, moeda, qtd } from '../../lib/formato'
import type { FormaPagamento, Saida, SaidaItem, VendaItemSaldo, VendaPagamento, VendaResumo } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

const POR_PAGINA = 30
type Filtro = 'todas' | 'retirar' | 'entregar' | 'canceladas'

export const NOMES_STATUS_ENTREGA = { a_separar: 'A separar', em_rota: 'Em rota', entregue: 'Entregue', cancelada: 'Cancelada' } as const
export const CORES_STATUS_ENTREGA = { a_separar: 'ambar', em_rota: 'vermelho', entregue: 'verde', cancelada: 'cinza' } as const

export function VendasPage() {
  const { pode, lojaAtual } = useAuth()
  const local = useLocation()
  const [lista, setLista] = useState<VendaResumo[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [de, setDe] = useState(hojeISO(-30))
  const [ate, setAte] = useState(hojeISO())
  const [aberta, setAberta] = useState<string | null>(new URLSearchParams(local.search).get('abrir'))
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!lojaAtual) return
    setLista(null)
    let q = supabase.from('vendas_resumo').select('*', { count: 'exact' }).eq('loja_id', lojaAtual.id)
    const termo = limparBusca(buscaAplicada)
    if (/^\d+$/.test(termo)) q = q.eq('numero', Number(termo))
    else {
      q = q.gte('created_at', `${de}T00:00:00-03:00`).lte('created_at', `${ate}T23:59:59-03:00`)
      if (termo) termo.split(/\s+/).forEach(p => { q = q.ilike('cliente', `%${p}%`) })
    }
    if (filtro === 'retirar') q = q.eq('status', 'finalizada').gt('itens_retirar', 0)
    if (filtro === 'entregar') q = q.eq('status', 'finalizada').in('entrega_status', ['a_separar', 'em_rota'])
    if (filtro === 'canceladas') q = q.eq('status', 'cancelada')
    const { data, count, error } = await q.order('numero', { ascending: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
    if (error) setErro(mensagemErro(error))
    setLista((data as VendaResumo[]) ?? []); setTotal(count ?? 0)
  }, [lojaAtual, buscaAplicada, filtro, de, ate, pagina])
  useEffect(() => { void carregar() }, [carregar])

  if (!pode('vendas.pdv')) return <SemPermissao />
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina titulo="Vendas" descricao={`${lojaAtual?.nome ?? ''} · ${total} venda(s)`}
        acoes={pode('vendas.pdv', 'criar') && <Link to="/vendas/nova" className="btn-primario">Nova venda</Link>} />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}

      <form onSubmit={e => { e.preventDefault(); setPagina(0); setBuscaAplicada(busca) }} className="cartao mb-3 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-48 flex-1">
          <label className="rotulo" htmlFor="b-venda">Buscar</label>
          <input id="b-venda" className="campo" placeholder="Nº do pedido ou nome do cliente" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div><label className="rotulo" htmlFor="v-de">De</label><input id="v-de" type="date" className="campo" value={de} onChange={e => { setPagina(0); setDe(e.target.value) }} /></div>
        <div><label className="rotulo" htmlFor="v-ate">Até</label><input id="v-ate" type="date" className="campo" value={ate} onChange={e => { setPagina(0); setAte(e.target.value) }} /></div>
        <button type="submit" className="btn-primario">Buscar</button>
      </form>

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {([['todas', 'Todas'], ['retirar', 'Com retirada pendente'], ['entregar', 'Com entrega pendente'], ['canceladas', 'Canceladas']] as const).map(([f, n]) => (
          <button key={f} onClick={() => { setPagina(0); setFiltro(f) }}
            className={`rounded-full px-3 py-1 ${filtro === f ? 'bg-marca-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}>{n}</button>
        ))}
      </div>

      <div className="cartao overflow-x-auto">
        {!lista ? <Carregando /> : !lista.length ? <Vazio>Nenhuma venda encontrada.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th className="text-right">Total</th><th>Saída da mercadoria</th><th /></tr></thead>
            <tbody>
              {lista.map(v => (
                <tr key={v.id} className={`cursor-pointer ${v.status === 'cancelada' ? 'opacity-50' : ''}`} onClick={() => setAberta(v.id)}>
                  <td className="font-mono font-medium">{v.numero}</td>
                  <td className="whitespace-nowrap text-stone-600">{dataHoraBR(v.created_at)}</td>
                  <td>{v.cliente ?? <span className="text-stone-400">Consumidor</span>}</td>
                  <td className="whitespace-nowrap text-right font-medium">{moeda(Number(v.total))}</td>
                  <td className="space-x-1">
                    {v.status === 'cancelada' ? <Selo>Cancelada</Selo> : <>
                      {v.itens_retirar > 0 && <Selo cor="ambar">Retirar depois</Selo>}
                      {v.entrega_status && <Selo cor={CORES_STATUS_ENTREGA[v.entrega_status]}>Entrega: {NOMES_STATUS_ENTREGA[v.entrega_status]}</Selo>}
                      {!v.itens_retirar && (!v.entrega_status || v.entrega_status === 'entregue') && <Selo cor="verde">Concluída</Selo>}
                    </>}
                  </td>
                  <td className="text-right text-sm text-marca-700">Abrir</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-3 text-sm text-stone-600">
        <span>Página {pagina + 1} de {paginas}</span>
        <button className="btn-secundario" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
        <button className="btn-secundario" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)}>Próxima</button>
      </div>

      {aberta && <DetalheVenda id={aberta} aoFechar={() => setAberta(null)} aoMudar={() => void carregar()} />}
    </div>
  )
}

export function DetalheVenda({ id, aoFechar, aoMudar }: { id: string; aoFechar: () => void; aoMudar: () => void }) {
  const { pode } = useAuth()
  const [venda, setVenda] = useState<VendaResumo | null>(null)
  const [itens, setItens] = useState<VendaItemSaldo[]>([])
  const [pagamentos, setPagamentos] = useState<VendaPagamento[]>([])
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [saidas, setSaidas] = useState<(Saida & { saida_itens: SaidaItem[] })[]>([])
  const [modo, setModo] = useState<'ver' | 'retirar' | 'cancelar'>('ver')
  const [retirar, setRetirar] = useState<Record<string, string>>({})
  const [obs, setObs] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const [v, i, p, f, s] = await Promise.all([
      supabase.from('vendas_resumo').select('*').eq('id', id).maybeSingle(),
      supabase.from('venda_itens_saldo').select('*').eq('venda_id', id).order('ordem'),
      supabase.from('venda_pagamentos').select('*').eq('venda_id', id),
      supabase.from('formas_pagamento').select('*'),
      supabase.from('saidas').select('*, saida_itens(*)').eq('venda_id', id).eq('cancelada', false).order('data'),
    ])
    const falha = v.error ?? i.error ?? p.error ?? s.error
    if (falha) setErro(mensagemErro(falha))
    setVenda(v.data as VendaResumo | null)
    setItens(((i.data ?? []) as VendaItemSaldo[]).map(x => ({ ...x, quantidade: Number(x.quantidade), saiu: Number(x.saiu), saldo: Number(x.saldo) })))
    setPagamentos((p.data as VendaPagamento[]) ?? [])
    setFormas((f.data as FormaPagamento[]) ?? [])
    setSaidas((s.data as (Saida & { saida_itens: SaidaItem[] })[]) ?? [])
  }, [id])
  useEffect(() => { void carregar() }, [carregar])

  const emRota = venda?.entrega_status === 'em_rota'
  const comSaldo = itens.filter(i => i.saldo > 0)
  const nomeForma = (c: string) => formas.find(f => f.codigo === c)?.nome ?? c
  const nomeItem = (vid: string) => itens.find(i => i.id === vid)?.descricao ?? ''

  async function confirmarRetirada() {
    const lista = Object.entries(retirar).map(([venda_item_id, v]) => ({ venda_item_id, quantidade: lerNumero(v) ?? 0 })).filter(x => x.quantidade > 0)
    if (!lista.length) { setErro('Informe a quantidade retirada de pelo menos um item.'); return }
    setSalvando(true); setErro('')
    const { error } = await supabase.rpc('registrar_retirada', { p_venda: id, p_itens: lista, p_obs: obs || null })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setModo('ver'); setRetirar({}); setObs(''); setOk('Retirada registrada.')
    await carregar(); aoMudar()
  }

  async function confirmarCancelamento() {
    setSalvando(true); setErro('')
    const { error } = await supabase.rpc('cancelar_venda', { p_venda: id, p_motivo: motivo })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setModo('ver'); setOk('Venda cancelada.')
    await carregar(); aoMudar()
  }

  const podeRetirar = venda?.status === 'finalizada' && comSaldo.length > 0 && (pode('vendas.pdv', 'criar') || pode('entregas.quadro', 'editar'))
  const podeCancelar = venda?.status === 'finalizada' && pode('vendas.pdv', 'cancelar')

  return (
    <Modal titulo={venda ? `Pedido nº ${venda.numero}` : 'Pedido'} aberto aoFechar={aoFechar} largura="max-w-4xl"
      rodape={modo === 'retirar' ? <>
        <button className="btn-secundario" onClick={() => setModo('ver')}>Voltar</button>
        <button className="btn-primario" disabled={salvando} onClick={() => void confirmarRetirada()}>{salvando ? 'Gravando…' : 'Confirmar retirada'}</button>
      </> : modo === 'cancelar' ? <>
        <button className="btn-secundario" onClick={() => setModo('ver')}>Voltar</button>
        <button className="btn bg-marca-700 text-white hover:bg-marca-800" disabled={salvando || !motivo.trim()} onClick={() => void confirmarCancelamento()}>Cancelar venda</button>
      </> : <>
        {podeCancelar && <button className="btn-secundario mr-auto text-marca-700" disabled={emRota} title={emRota ? 'Em rota de entrega' : ''} onClick={() => { setErro(''); setModo('cancelar') }}>Cancelar venda</button>}
        <a className="btn-secundario" href={`/imprimir/venda/${id}`} target="_blank" rel="noreferrer">Imprimir</a>
        {podeRetirar && <button className="btn-primario" onClick={() => { setErro(''); setOk(''); setModo('retirar') }}>Registrar retirada</button>}
      </>}>
      {!venda ? <Carregando /> : (
        <div className="space-y-4 text-sm">
          {erro && <Aviso>{erro}</Aviso>}
          {ok && <Aviso tipo="ok">{ok}</Aviso>}
          <div className="grid gap-2 sm:grid-cols-3">
            <div><span className="rotulo">Cliente</span>{venda.cliente ?? 'Consumidor'}</div>
            <div><span className="rotulo">Data</span>{dataHoraBR(venda.created_at)}</div>
            <div><span className="rotulo">Situação</span>
              {venda.status === 'cancelada' ? <Selo>Cancelada</Selo> : <Selo cor="verde">Finalizada</Selo>}
              {venda.teste && <span className="ml-1"><Selo cor="ambar">teste · sem NF</Selo></span>}
            </div>
          </div>
          {venda.status === 'cancelada' && <Aviso>Cancelada em {dataHoraBR(venda.cancelada_em)}: {venda.motivo_cancelamento}</Aviso>}

          {modo === 'cancelar' ? (
            <div>
              <label className="rotulo" htmlFor="mot-canc">Motivo do cancelamento</label>
              <input id="mot-canc" className="campo" autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} />
              <p className="mt-1 text-xs text-stone-500">As entregas pendentes desta venda também são canceladas. O que já saiu fica registrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-stone-200">
              <table className="tabela">
                <thead><tr><th>Produto</th><th className="text-right">Vendido</th><th className="text-right">Já saiu</th><th className="text-right">Falta</th><th>Como sai</th>
                  {modo === 'retirar' ? <th className="w-36">Retirando agora</th> : <th className="text-right">Total</th>}</tr></thead>
                <tbody>
                  {itens.map(i => (
                    <tr key={i.id}>
                      <td>{i.descricao}<span className="block text-xs text-stone-400">{i.codigo} · {i.unidade}</span></td>
                      <td className="text-right">{qtd(i.quantidade)}</td>
                      <td className="text-right">{qtd(i.saiu)}</td>
                      <td className={`text-right font-medium ${i.saldo > 0 ? 'text-amber-700' : 'text-stone-400'}`}>{qtd(i.saldo)}</td>
                      <td>{i.saldo > 0 ? (i.destino === 'entrega' ? 'Entrega' : 'Retira no balcão') : '—'}</td>
                      {modo === 'retirar' ? (
                        <td>{i.saldo > 0 && (
                          <div className="flex items-center gap-1">
                            <input className="campo w-20 px-2 py-1" inputMode="decimal" aria-label={`Retirar ${i.descricao}`} value={retirar[i.id] ?? ''}
                              onChange={e => setRetirar(r => ({ ...r, [i.id]: e.target.value }))} />
                            <button type="button" className="text-xs text-marca-700 hover:underline" onClick={() => setRetirar(r => ({ ...r, [i.id]: String(i.saldo).replace('.', ',') }))}>tudo</button>
                          </div>
                        )}</td>
                      ) : <td className="text-right">{moeda(Number(i.total))}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {modo === 'retirar' && (
            <div>
              <label className="rotulo" htmlFor="obs-ret">Observação (quem retirou, placa…)</label>
              <input id="obs-ret" className="campo" value={obs} onChange={e => setObs(e.target.value)} />
              {emRota && <p className="mt-1 text-xs text-amber-700">Itens que estão em rota de entrega não podem ser retirados até o retorno do romaneio.</p>}
            </div>
          )}

          {modo === 'ver' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-1 font-semibold text-stone-800">Pagamento</h3>
                {pagamentos.map(p => <div key={p.id} className="flex justify-between"><span>{nomeForma(p.forma)}{p.parcelas > 1 && ` (${p.parcelas}x)`}</span><span>{moeda(Number(p.valor))}</span></div>)}
                {Number(venda.desconto) > 0 && <div className="flex justify-between text-stone-500"><span>Desconto</span><span>− {moeda(Number(venda.desconto))}</span></div>}
                <div className="mt-1 flex justify-between border-t border-stone-200 pt-1 font-semibold"><span>Total</span><span>{moeda(Number(venda.total))}</span></div>
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-stone-800">Saídas da mercadoria</h3>
                {!saidas.length ? <p className="text-stone-400">Nada saiu ainda.</p> : saidas.map(s => (
                  <div key={s.id} className="mb-1">
                    <span className="text-stone-500">{dataHoraBR(s.data)} · {s.tipo === 'balcao' ? 'Balcão' : 'Entrega'}{s.observacao && ` · ${s.observacao}`}</span>
                    <ul className="ml-4 list-disc">{s.saida_itens.map(si => <li key={si.venda_item_id}>{qtd(Number(si.quantidade))} × {nomeItem(si.venda_item_id)}</li>)}</ul>
                  </div>
                ))}
                {venda.entrega_status && (
                  <p className="mt-2">Entrega: <Selo cor={CORES_STATUS_ENTREGA[venda.entrega_status]}>{NOMES_STATUS_ENTREGA[venda.entrega_status]}</Selo>
                    {venda.entrega_data && <span className="text-stone-500"> · prevista {dataBR(venda.entrega_data)}</span>}</p>
                )}
                {venda.entrega_endereco && <p className="text-stone-500">{venda.entrega_endereco}</p>}
              </div>
            </div>
          )}
          {venda.observacoes && modo === 'ver' && <p className="text-stone-600"><span className="font-medium">Obs.:</span> {venda.observacoes}</p>}
        </div>
      )}
    </Modal>
  )
}
