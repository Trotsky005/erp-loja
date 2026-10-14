import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mensagemErro, supabase } from '../../lib/supabase'
import { lerNumero, moeda, numero, hojeISO } from '../../lib/formato'
import type { FormaPagamento, Pessoa, Produto } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Modal, SemPermissao } from '../../core/ui/componentes'
import { BuscaCliente, BuscaProduto } from './Buscas'

/** Como sai a mercadoria de cada item */
export type ModoSaida = 'agora' | 'entregar' | 'depois' | 'parte_entrega' | 'parte_depois'
export const MODOS: Record<ModoSaida, string> = {
  agora: 'Leva agora',
  entregar: 'Entregar',
  depois: 'Retira depois',
  parte_entrega: 'Parte agora, resto entrega',
  parte_depois: 'Parte agora, resto retira depois',
}

interface Linha {
  chave: number
  produto: Produto
  quantidade: string
  preco: string
  desconto: string
  modo: ModoSaida
  agora: string
}
interface Pagamento { chave: number; forma: string; valor: string; parcelas: string }

const r2 = (n: number) => Math.round(n * 100) / 100
const txt = (n: number) => String(r2(n)).replace('.', ',')
let contador = 0

export function NovaVendaPage() {
  const { pode, lojaAtual } = useAuth()
  const [cliente, setCliente] = useState<Pessoa | null>(null)
  const [consumidor, setConsumidor] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [modoPadrao, setModoPadrao] = useState<ModoSaida>('agora')
  const [descontoGeral, setDescontoGeral] = useState('')
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [endereco, setEndereco] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [obsEntrega, setObsEntrega] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [concluida, setConcluida] = useState<{ id: string; numero: number } | null>(null)

  useEffect(() => {
    void supabase.from('formas_pagamento').select('*').eq('ativo', true).order('ordem')
      .then(({ data }) => setFormas((data as FormaPagamento[]) ?? []))
  }, [])

  // ao escolher o cliente, sugere o endereço de entrega
  useEffect(() => {
    if (!cliente) return
    const partes = [
      [cliente.logradouro, cliente.numero].filter(Boolean).join(', '),
      cliente.complemento, cliente.bairro, cliente.cidade && `${cliente.cidade}${cliente.uf ? '/' + cliente.uf : ''}`,
    ].filter(Boolean)
    setEndereco(partes.join(' - '))
  }, [cliente])

  const gerencia = pode('vendas.pdv', 'cancelar')

  const calc = useMemo(() => {
    const itens = linhas.map(l => {
      const q = lerNumero(l.quantidade) ?? 0
      const preco = lerNumero(l.preco) ?? 0
      const desc = lerNumero(l.desconto) ?? 0
      return { ...l, q, preco, desc, total: r2(q * preco - desc) }
    })
    const subtotal = r2(itens.reduce((s, i) => s + i.total, 0))
    const total = r2(subtotal - (lerNumero(descontoGeral) ?? 0))
    let pago = 0, troco = 0
    const pagos = pagamentos.map(p => {
      const forma = formas.find(f => f.codigo === p.forma)
      const valor = lerNumero(p.valor) ?? 0
      return { ...p, valorNum: valor, permiteTroco: !!forma?.permite_troco }
    })
    // o que não é dinheiro conta primeiro; o dinheiro cobre o resto e gera troco
    for (const p of pagos.filter(x => !x.permiteTroco)) pago += p.valorNum
    const restanteAntesDinheiro = r2(total - pago)
    const dinheiro = pagos.filter(x => x.permiteTroco).reduce((s, p) => s + p.valorNum, 0)
    if (dinheiro > 0) {
      const usado = Math.min(dinheiro, Math.max(restanteAntesDinheiro, 0))
      troco = r2(dinheiro - usado)
      pago += usado
    }
    const peso = itens.reduce((s, i) => s + i.q * (i.produto.peso_kg !== null ? Number(i.produto.peso_kg) : 0), 0)
    const temEntrega = itens.some(i => i.modo === 'entregar' || i.modo === 'parte_entrega')
    return { itens, subtotal, total, pago: r2(pago), falta: r2(total - pago), troco, peso, temEntrega, pagos, restanteAntesDinheiro }
  }, [linhas, descontoGeral, pagamentos, formas])

  if (!pode('vendas.pdv', 'criar')) return <SemPermissao />

  function adicionar(p: Produto) {
    setErro('')
    setLinhas(ls => {
      const existente = ls.find(l => l.produto.id === p.id && l.modo === modoPadrao)
      if (existente) {
        return ls.map(l => l === existente ? { ...l, quantidade: txt((lerNumero(l.quantidade) ?? 0) + 1) } : l)
      }
      return [...ls, { chave: ++contador, produto: p, quantidade: '1', preco: txt(Number(p.preco_venda)), desconto: '', modo: modoPadrao, agora: '' }]
    })
  }

  const alterar = (chave: number, mudanca: Partial<Linha>) => setLinhas(ls => ls.map(l => l.chave === chave ? { ...l, ...mudanca } : l))

  function adicionarPagamento(forma: string) {
    const falta = Math.max(calc.falta, 0)
    setPagamentos(ps => [...ps, { chave: ++contador, forma, valor: falta > 0 ? txt(falta) : '', parcelas: '1' }])
  }

  function limpar() {
    setCliente(null); setConsumidor(''); setLinhas([]); setDescontoGeral(''); setPagamentos([])
    setEndereco(''); setDataEntrega(''); setObsEntrega(''); setObservacoes(''); setErro(''); setConcluida(null)
  }

  async function finalizar() {
    setErro('')
    if (!lojaAtual) { setErro('Escolha a loja no topo da tela.'); return }
    if (!linhas.length) { setErro('Adicione pelo menos um produto.'); return }
    for (const i of calc.itens) {
      if (i.q <= 0) { setErro(`Quantidade inválida em ${i.produto.descricao}.`); return }
      if (i.modo.startsWith('parte_')) {
        const a = lerNumero(i.agora) ?? 0
        if (a <= 0 || a >= i.q) { setErro(`Em ${i.produto.descricao}, informe quanto leva agora (menos que ${numero(i.q)}).`); return }
      }
    }
    if (calc.falta !== 0) { setErro(calc.falta > 0 ? `Faltam ${moeda(calc.falta)} nos pagamentos.` : `Os pagamentos passam do total em ${moeda(-calc.falta)}.`); return }
    if (calc.temEntrega && !cliente && !endereco.trim()) { setErro('Para entregar, escolha o cliente ou informe o endereço de entrega.'); return }

    // dinheiro: envia só o valor usado (o resto é troco)
    let restante = calc.restanteAntesDinheiro
    const pagamentosEnviar = calc.pagos.map(p => {
      if (!p.permiteTroco) return { forma: p.forma, valor: p.valorNum, parcelas: lerNumero(p.parcelas) ?? 1 }
      const usado = r2(Math.min(p.valorNum, Math.max(restante, 0)))
      restante = r2(restante - usado)
      return { forma: p.forma, valor: usado, parcelas: 1 }
    }).filter(p => p.valor > 0)

    const corpo = {
      loja_id: lojaAtual.id,
      cliente_id: cliente?.id ?? null,
      cliente_nome: cliente ? null : consumidor.trim() || null,
      desconto: lerNumero(descontoGeral) ?? 0,
      observacoes,
      entrega: calc.temEntrega ? { endereco, data: dataEntrega || null, obs: obsEntrega } : null,
      itens: calc.itens.map(i => ({
        produto_id: i.produto.id,
        quantidade: i.q,
        preco_unitario: i.preco,
        desconto: i.desc,
        agora: i.modo === 'agora' ? i.q : i.modo.startsWith('parte_') ? (lerNumero(i.agora) ?? 0) : 0,
        destino: i.modo === 'entregar' || i.modo === 'parte_entrega' ? 'entrega' : 'balcao',
      })),
      pagamentos: pagamentosEnviar,
    }
    setSalvando(true)
    const { data, error } = await supabase.rpc('finalizar_venda', { p: corpo })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setConcluida(data as { id: string; numero: number })
  }

  return (
    <div className="mx-auto max-w-7xl">
      <CabecalhoPagina titulo="Nova venda"
        descricao={`Loja ${lojaAtual?.nome ?? '—'} · pedido de teste, sem nota fiscal`}
        acoes={<Link to="/vendas" className="btn-secundario">Ver vendas</Link>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Itens */}
        <div className="space-y-4">
          <div className="cartao space-y-3 p-4">
            <BuscaCliente valor={cliente} aoEscolher={setCliente} />
            {!cliente && (
              <input className="campo" placeholder="ou nome do consumidor (opcional)" value={consumidor} onChange={e => setConsumidor(e.target.value)} />
            )}
          </div>

          <div className="cartao p-4">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1"><BuscaProduto aoEscolher={adicionar} autoFocus /></div>
              <label className="text-xs text-stone-500">
                Saída padrão
                <select className="campo mt-1" value={modoPadrao} onChange={e => setModoPadrao(e.target.value as ModoSaida)}>
                  {Object.entries(MODOS).filter(([k]) => !k.startsWith('parte_')).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </label>
            </div>

            {!linhas.length ? (
              <p className="py-10 text-center text-sm text-stone-400">Busque um produto acima ou passe o leitor de código de barras.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela min-w-[52rem]">
                  <thead><tr><th className="min-w-56">Produto</th><th className="w-20">Qtd.</th><th className="w-24">Preço</th><th className="w-20">Desc. R$</th><th className="text-right">Total</th><th className="min-w-60">Saída</th><th /></tr></thead>
                  <tbody>
                    {calc.itens.map(i => (
                      <tr key={i.chave}>
                        <td>
                          <div className="font-medium">{i.produto.descricao}</div>
                          <div className="text-xs text-stone-500">{i.produto.codigo} · {i.produto.unidade}</div>
                        </td>
                        <td><input className="campo px-2 py-1" inputMode="decimal" aria-label="Quantidade" value={i.quantidade} onChange={e => alterar(i.chave, { quantidade: e.target.value })} /></td>
                        <td><input className="campo px-2 py-1" inputMode="decimal" aria-label="Preço" disabled={!gerencia} title={gerencia ? '' : 'Só a gerência altera preço'} value={i.preco} onChange={e => alterar(i.chave, { preco: e.target.value })} /></td>
                        <td><input className="campo px-2 py-1" inputMode="decimal" aria-label="Desconto" value={i.desconto} onChange={e => alterar(i.chave, { desconto: e.target.value })} /></td>
                        <td className="whitespace-nowrap text-right font-medium">{moeda(i.total)}</td>
                        <td>
                          <select className="campo px-2 py-1" aria-label="Saída" value={i.modo} onChange={e => alterar(i.chave, { modo: e.target.value as ModoSaida })}>
                            {Object.entries(MODOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                          </select>
                          {i.modo.startsWith('parte_') && (
                            <label className="mt-1 flex items-center gap-2 text-xs text-stone-600">
                              leva agora
                              <input className="campo w-20 px-2 py-1" inputMode="decimal" value={i.agora} onChange={e => alterar(i.chave, { agora: e.target.value })} />
                              de {numero(i.q)}
                            </label>
                          )}
                        </td>
                        <td>
                          <button type="button" aria-label="Remover item" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-marca-700"
                            onClick={() => setLinhas(ls => ls.filter(l => l.chave !== i.chave))}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {calc.temEntrega && (
            <div className="cartao grid gap-3 p-4 sm:grid-cols-4">
              <h2 className="text-sm font-semibold text-stone-800 sm:col-span-4">Entrega</h2>
              <div className="sm:col-span-4">
                <label className="rotulo" htmlFor="v-end">Endereço</label>
                <input id="v-end" className="campo" value={endereco} onChange={e => setEndereco(e.target.value)} />
              </div>
              <div>
                <label className="rotulo" htmlFor="v-data">Data prevista</label>
                <input id="v-data" type="date" min={hojeISO()} className="campo" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} />
              </div>
              <div className="sm:col-span-3">
                <label className="rotulo" htmlFor="v-obs-ent">Observação para o motorista</label>
                <input id="v-obs-ent" className="campo" value={obsEntrega} onChange={e => setObsEntrega(e.target.value)} />
              </div>
              {cliente?.dia_entrega && <p className="text-xs text-amber-700 sm:col-span-4">Este cliente recebe às {cliente.dia_entrega}s.</p>}
            </div>
          )}
        </div>

        {/* Totais e pagamento */}
        <div className="space-y-4">
          <div className="cartao space-y-2 p-4 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Itens</span><span>{linhas.length}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Peso aproximado</span><span>{numero(calc.peso, 1)} kg</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span>{moeda(calc.subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-stone-500" htmlFor="v-desc">Desconto (R$)</label>
              <input id="v-desc" className="campo w-28 px-2 py-1 text-right" inputMode="decimal" value={descontoGeral} onChange={e => setDescontoGeral(e.target.value)} />
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-semibold"><span>Total</span><span>{moeda(calc.total)}</span></div>
          </div>

          <div className="cartao space-y-3 p-4">
            <h2 className="text-sm font-semibold text-stone-800">Pagamento</h2>
            {pagamentos.map(p => {
              const forma = formas.find(f => f.codigo === p.forma)
              return (
                <div key={p.chave} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{forma?.nome ?? p.forma}</span>
                  {p.forma === 'cartao_credito' && (
                    <input className="campo w-14 px-2 py-1" inputMode="numeric" title="Parcelas" aria-label="Parcelas" value={p.parcelas}
                      onChange={e => setPagamentos(ps => ps.map(x => x.chave === p.chave ? { ...x, parcelas: e.target.value } : x))} />
                  )}
                  <input className="campo w-28 px-2 py-1 text-right" inputMode="decimal" aria-label={`Valor ${forma?.nome ?? ''}`} value={p.valor}
                    onChange={e => setPagamentos(ps => ps.map(x => x.chave === p.chave ? { ...x, valor: e.target.value } : x))} />
                  <button type="button" aria-label="Remover pagamento" className="text-stone-400 hover:text-marca-700" onClick={() => setPagamentos(ps => ps.filter(x => x.chave !== p.chave))}>✕</button>
                </div>
              )
            })}
            <div className="flex flex-wrap gap-1">
              {formas.map(f => (
                <button key={f.codigo} type="button" className="rounded-full border border-stone-300 px-2.5 py-1 text-xs hover:border-marca-500 hover:text-marca-700"
                  onClick={() => adicionarPagamento(f.codigo)}>+ {f.nome}</button>
              ))}
            </div>
            <div className="space-y-1 border-t border-stone-200 pt-2 text-sm">
              <div className="flex justify-between"><span className="text-stone-500">Pago</span><span>{moeda(calc.pago)}</span></div>
              {calc.falta > 0 && <div className="flex justify-between font-medium text-marca-700"><span>Falta</span><span>{moeda(calc.falta)}</span></div>}
              {calc.troco > 0 && <div className="flex justify-between font-medium text-emerald-700"><span>Troco</span><span>{moeda(calc.troco)}</span></div>}
            </div>
          </div>

          <div className="cartao p-4">
            <label className="rotulo" htmlFor="v-obs">Observações da venda</label>
            <textarea id="v-obs" rows={2} className="campo" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          {erro && <Aviso>{erro}</Aviso>}
          <div className="flex gap-2">
            <button type="button" className="btn-secundario" onClick={limpar} disabled={salvando}>Limpar</button>
            <button type="button" className="btn-primario flex-1 py-3 text-base" disabled={salvando || !linhas.length} onClick={() => void finalizar()}>
              {salvando ? 'Gravando…' : `Finalizar venda · ${moeda(calc.total)}`}
            </button>
          </div>
        </div>
      </div>

      <Modal titulo="Venda registrada" aberto={!!concluida} aoFechar={limpar}
        rodape={<>
          {concluida && <Link className="btn-secundario" to={`/vendas?abrir=${concluida.id}`}>Ver venda</Link>}
          {concluida && <a className="btn-secundario" href={`/imprimir/venda/${concluida.id}`} target="_blank" rel="noreferrer">Imprimir pedido</a>}
          <button className="btn-primario" onClick={limpar} autoFocus>Nova venda</button>
        </>}>
        {concluida && (
          <div className="space-y-2 text-sm">
            <p className="text-lg font-semibold text-stone-900">Pedido nº {concluida.numero}</p>
            {calc.troco > 0 && <p className="text-emerald-700">Troco: <strong>{moeda(calc.troco)}</strong></p>}
            {calc.temEntrega && <p className="text-stone-600">Os itens para entregar já estão no quadro de entregas.</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
