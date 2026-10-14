import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { mensagemErro, supabase } from '../../lib/supabase'
import { dataBR, dataHoraBR, moeda, numRomaneio, numero, qtd } from '../../lib/formato'
import type {
  FormaPagamento, Loja, Motorista, Pessoa, Produto, Romaneio, RomaneioEntrega, RomaneioItem,
  Veiculo, Venda, VendaItemSaldo, VendaPagamento,
} from '../../lib/tipos'

function Pagina({ titulo, children, opcoes }: { titulo: string; children: ReactNode; opcoes?: ReactNode }) {
  useEffect(() => { document.title = titulo }, [titulo])
  return (
    <div className="min-h-full bg-stone-200 print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-stone-900 px-4 py-2 text-sm text-white print:hidden">
        <span className="font-medium">{titulo}</span>
        <div className="flex flex-wrap items-center gap-4">{opcoes}</div>
        <button className="btn-primario ml-auto" onClick={() => window.print()}>Imprimir</button>
      </div>
      <div className="mx-auto max-w-[210mm] space-y-4 p-4 print:max-w-none print:space-y-0 print:p-0">{children}</div>
    </div>
  )
}

function Folha({ children, quebra }: { children: ReactNode; quebra?: boolean }) {
  return (
    <section className={`bg-white p-8 text-[12px] leading-snug text-black shadow print:p-0 print:shadow-none ${quebra ? 'break-before-page' : ''}`}>
      {children}
    </section>
  )
}

function CabecalhoLoja({ loja, titulo, numero: num, data }: { loja: Loja | null; titulo: string; numero: string; data: string }) {
  const end = loja ? [[loja.logradouro, loja.numero].filter(Boolean).join(', '), loja.bairro, loja.cidade && `${loja.cidade}/${loja.uf ?? ''}`].filter(Boolean).join(' - ') : ''
  return (
    <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-2">
      <div>
        <div className="text-base font-bold">{loja?.razao_social || loja?.nome}</div>
        {loja?.cnpj && <div>CNPJ {loja.cnpj}</div>}
        {end && <div>{end}</div>}
        {loja?.telefone && <div>Tel. {loja.telefone}</div>}
      </div>
      <div className="text-right">
        <div className="text-base font-bold uppercase">{titulo}</div>
        <div className="text-lg font-bold">Nº {num}</div>
        <div>{data}</div>
      </div>
    </div>
  )
}

const Erro = ({ texto }: { texto: string }) => <div className="p-8 text-center text-marca-700">{texto}</div>

// ---------------------------------------------------------------------
// Pedido de venda
// ---------------------------------------------------------------------
export function ImprimirVenda() {
  const { id } = useParams()
  const [dados, setDados] = useState<{ venda: Venda; loja: Loja | null; cliente: Pessoa | null; itens: VendaItemSaldo[]; pagamentos: VendaPagamento[]; formas: FormaPagamento[] } | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    void (async () => {
      const { data: venda, error } = await supabase.from('vendas').select('*').eq('id', id).maybeSingle()
      if (error || !venda) { setErro(error ? mensagemErro(error) : 'Venda não encontrada.'); return }
      const v = venda as Venda
      const [l, c, i, p, f] = await Promise.all([
        supabase.from('lojas').select('*').eq('id', v.loja_id).maybeSingle(),
        v.cliente_id ? supabase.from('pessoas').select('*').eq('id', v.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('venda_itens_saldo').select('*').eq('venda_id', v.id).order('ordem'),
        supabase.from('venda_pagamentos').select('*').eq('venda_id', v.id),
        supabase.from('formas_pagamento').select('*'),
      ])
      setDados({ venda: v, loja: l.data as Loja | null, cliente: c.data as Pessoa | null, itens: (i.data as VendaItemSaldo[]) ?? [], pagamentos: (p.data as VendaPagamento[]) ?? [], formas: (f.data as FormaPagamento[]) ?? [] })
    })()
  }, [id])

  if (erro) return <Erro texto={erro} />
  if (!dados) return <div className="p-8 text-center text-stone-500">Carregando…</div>
  const { venda, loja, cliente, itens, pagamentos, formas } = dados
  const saida = (i: VendaItemSaldo) => Number(i.saldo) <= 0 ? 'Levou' : i.destino === 'entrega' ? `Entregar ${qtd(Number(i.saldo))}` : `Retirar ${qtd(Number(i.saldo))}`

  return (
    <Pagina titulo={`Pedido ${venda.numero}`}>
      <Folha>
        <CabecalhoLoja loja={loja} titulo="Pedido de venda" numero={String(venda.numero)} data={dataHoraBR(venda.created_at)} />
        {venda.status === 'cancelada' && <div className="mb-2 border-2 border-black p-1 text-center font-bold">PEDIDO CANCELADO — {venda.motivo_cancelamento}</div>}
        <div className="mb-3 grid grid-cols-2 gap-x-6">
          <div><b>Cliente:</b> {cliente?.nome ?? venda.cliente_nome ?? 'Consumidor'}</div>
          <div><b>CPF/CNPJ:</b> {cliente?.cpf_cnpj ?? '—'}</div>
          <div><b>Telefone:</b> {cliente?.celular ?? cliente?.telefone ?? '—'}</div>
          {venda.entrega_endereco && <div className="col-span-2"><b>Entrega:</b> {venda.entrega_endereco}{venda.entrega_data && ` · previsão ${dataBR(venda.entrega_data)}`}</div>}
        </div>
        <table className="w-full border-collapse">
          <thead><tr className="border-y border-black text-left">
            <th className="py-1">Código</th><th>Produto</th><th className="text-right">Qtd.</th><th>Un.</th><th className="text-right">Preço</th><th className="text-right">Total</th><th className="pl-3">Saída</th>
          </tr></thead>
          <tbody>
            {itens.map(i => (
              <tr key={i.id} className="border-b border-stone-300">
                <td className="py-1 font-mono">{i.codigo}</td><td>{i.descricao}</td><td className="text-right">{qtd(Number(i.quantidade))}</td><td>{i.unidade}</td>
                <td className="text-right">{moeda(Number(i.preco_unitario))}</td><td className="text-right">{moeda(Number(i.total))}</td><td className="pl-3">{saida(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex justify-between gap-6">
          <div>
            <b>Pagamento:</b>
            {pagamentos.map(p => <div key={p.id}>{formas.find(f => f.codigo === p.forma)?.nome ?? p.forma}{p.parcelas > 1 && ` ${p.parcelas}x`}: {moeda(Number(p.valor))}</div>)}
          </div>
          <div className="min-w-48 text-right">
            <div>Subtotal: {moeda(Number(venda.subtotal))}</div>
            {Number(venda.desconto) > 0 && <div>Desconto: − {moeda(Number(venda.desconto))}</div>}
            <div className="text-base font-bold">Total: {moeda(Number(venda.total))}</div>
          </div>
        </div>
        {venda.observacoes && <p className="mt-2"><b>Obs.:</b> {venda.observacoes}</p>}
        <p className="mt-6 text-center text-[10px]">Documento sem valor fiscal{venda.teste ? ' · pedido de teste' : ''}</p>
      </Folha>
    </Pagina>
  )
}

// ---------------------------------------------------------------------
// Romaneio + pedidos de entrega (2 vias)
// ---------------------------------------------------------------------
interface DadosRomaneio {
  romaneio: Romaneio
  motorista: Motorista | null
  ajudante: Motorista | null
  veiculo: Veiculo | null
  entregas: (RomaneioEntrega & { venda: Venda; cliente: Pessoa | null; loja: Loja | null })[]
  itens: (RomaneioItem & { item: VendaItemSaldo; produto: Produto | null })[]
}

export function ImprimirRomaneio() {
  const { id } = useParams()
  const [d, setD] = useState<DadosRomaneio | null>(null)
  const [erro, setErro] = useState('')
  const [comRomaneio, setComRomaneio] = useState(true)
  const [comPedidos, setComPedidos] = useState(true)
  const [vias, setVias] = useState(2)

  useEffect(() => {
    void (async () => {
      const { data: rom, error } = await supabase.from('romaneios').select('*').eq('id', id).maybeSingle()
      if (error || !rom) { setErro(error ? mensagemErro(error) : 'Romaneio não encontrado.'); return }
      const r = rom as Romaneio
      const [mot, vei, re, ri] = await Promise.all([
        supabase.from('motoristas').select('*').in('id', [r.motorista_id, r.ajudante_id].filter(Boolean) as string[]),
        r.veiculo_id ? supabase.from('veiculos').select('*').eq('id', r.veiculo_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('romaneio_entregas').select('*, entregas(venda_id)').eq('romaneio_id', r.id).order('ordem'),
        supabase.from('romaneio_itens').select('*').eq('romaneio_id', r.id),
      ])
      const rEnt = (re.data ?? []) as (RomaneioEntrega & { entregas: { venda_id: string } })[]
      const vendaIds = rEnt.map(x => x.entregas.venda_id)
      const rItens = (ri.data ?? []) as RomaneioItem[]
      const [vs, vi] = await Promise.all([
        supabase.from('vendas').select('*').in('id', vendaIds),
        supabase.from('venda_itens_saldo').select('*').in('id', rItens.map(x => x.venda_item_id)),
      ])
      const vendas = (vs.data ?? []) as Venda[]
      const vItens = (vi.data ?? []) as VendaItemSaldo[]
      const [cl, lj, pr] = await Promise.all([
        supabase.from('pessoas').select('*').in('id', vendas.map(v => v.cliente_id).filter(Boolean) as string[]),
        supabase.from('lojas').select('*').in('id', [...new Set(vendas.map(v => v.loja_id))]),
        supabase.from('produtos').select('*').in('id', [...new Set(vItens.map(i => i.produto_id))]),
      ])
      const motoristas = (mot.data ?? []) as Motorista[]
      setD({
        romaneio: r,
        motorista: motoristas.find(m => m.id === r.motorista_id) ?? null,
        ajudante: motoristas.find(m => m.id === r.ajudante_id) ?? null,
        veiculo: vei.data as Veiculo | null,
        entregas: rEnt.map(x => {
          const venda = vendas.find(v => v.id === x.entregas.venda_id)!
          return { ...x, venda, cliente: ((cl.data ?? []) as Pessoa[]).find(c => c.id === venda?.cliente_id) ?? null, loja: ((lj.data ?? []) as Loja[]).find(l => l.id === venda?.loja_id) ?? null }
        }).filter(x => x.venda),
        itens: rItens.map(x => {
          const item = vItens.find(i => i.id === x.venda_item_id)!
          return { ...x, item, produto: ((pr.data ?? []) as Produto[]).find(p => p.id === item?.produto_id) ?? null }
        }).filter(x => x.item),
      })
    })()
  }, [id])

  if (erro) return <Erro texto={erro} />
  if (!d) return <div className="p-8 text-center text-stone-500">Carregando…</div>
  const { romaneio: r } = d

  // linhas do romaneio: itens iguais somados; mistura vira uma linha só
  const mistura = new Set(d.entregas.filter(e => e.mistura).map(e => e.entrega_id))
  const somados = new Map<string, { quantidade: number; descricao: string; unidade: string; peso: number | null }>()
  for (const i of d.itens.filter(x => !mistura.has(x.entrega_id))) {
    const atual = somados.get(i.item.produto_id)
    const peso = i.peso_unit === null ? null : Number(i.peso_unit) * Number(i.quantidade)
    if (atual) { atual.quantidade += Number(i.quantidade); if (atual.peso !== null && peso !== null) atual.peso += peso }
    else somados.set(i.item.produto_id, { quantidade: Number(i.quantidade), descricao: i.item.descricao, unidade: i.item.unidade, peso })
  }
  const linhas = [
    ...[...somados.values()].sort((a, b) => a.descricao.localeCompare(b.descricao)),
    ...d.entregas.filter(e => e.mistura).map(e => ({
      quantidade: Number(e.mistura_sacos), descricao: e.mistura_nome ?? 'Mistura', unidade: 'SC',
      peso: Number(e.mistura_sacos) * Number(e.mistura_peso_saco ?? 50),
    })),
  ]
  const pedidos = d.entregas.map(e => e.venda.numero).join(', ')

  return (
    <Pagina titulo={`Romaneio ${numRomaneio(r.numero)}`} opcoes={<>
      <label className="flex items-center gap-1"><input type="checkbox" checked={comRomaneio} onChange={e => setComRomaneio(e.target.checked)} /> Romaneio</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={comPedidos} onChange={e => setComPedidos(e.target.checked)} /> Pedidos de entrega</label>
      {comPedidos && <label className="flex items-center gap-1">vias <select className="rounded bg-stone-800 px-1" value={vias} onChange={e => setVias(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option></select></label>}
    </>}>
      {comRomaneio && (
        <Folha>
          {r.status === 'cancelado' && <div className="mb-2 border-2 border-black p-1 text-center font-bold">ROMANEIO CANCELADO — {r.motivo_cancelamento}</div>}
          <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-start gap-x-6 border-b-2 border-black pb-2">
            <div className="text-xl font-bold">Romaneio Nº {numRomaneio(r.numero)}</div>
            <div className="space-y-0.5">
              <div><b>Motorista:</b> {d.motorista?.nome ?? '______________________'}{d.ajudante && <> · <b>Ajudante:</b> {d.ajudante.nome}</>}</div>
              {d.veiculo && <div><b>Veículo:</b> {d.veiculo.descricao}{d.veiculo.placa && ` (${d.veiculo.placa})`}</div>}
              <div><b>Pedidos:</b> {pedidos}</div>
            </div>
            <div className="space-y-0.5 text-right">
              <div><b>Data:</b> {dataBR(r.data)}</div>
              <div><b>Peso total:</b> {numero(Number(r.peso_total), 1)} kg</div>
              <div><b>Sacos:</b> {qtd(Number(r.sacos))}</div>
            </div>
          </div>
          <table className="w-full border-collapse">
            <thead><tr className="border-y border-black text-left">
              <th className="w-24 py-1 text-right">Quantidade</th><th className="pl-3">Item</th><th>Unidade</th><th className="text-right">Peso (kg)</th><th className="w-20 text-center">Visto</th>
            </tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-b border-stone-300">
                  <td className="py-1.5 text-right font-semibold">{qtd(l.quantidade)}</td>
                  <td className="pl-3">{l.descricao}</td><td>{l.unidade}</td>
                  <td className="text-right">{l.peso === null ? '' : numero(l.peso, 1)}</td>
                  <td className="text-center">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.observacao && <p className="mt-3"><b>Obs.:</b> {r.observacao}</p>}
        </Folha>
      )}

      {comPedidos && d.entregas.flatMap((e, idx) => Array.from({ length: vias }, (_, via) => (
        <Folha key={`${e.entrega_id}-${via}`} quebra={comRomaneio || idx > 0 || via > 0}>
          <CabecalhoLoja loja={e.loja} titulo="Pedido de entrega" numero={String(e.venda.numero)} data={`Romaneio ${numRomaneio(r.numero)} · ${dataBR(r.data)}`} />
          <div className="mb-3 grid grid-cols-2 gap-x-6">
            <div><b>Cliente:</b> {e.cliente?.nome ?? e.venda.cliente_nome ?? 'Consumidor'}</div>
            <div><b>Telefone:</b> {e.cliente?.celular ?? e.cliente?.telefone ?? '—'}</div>
            <div className="col-span-2"><b>Endereço:</b> {e.venda.entrega_endereco ?? '—'}</div>
            {e.venda.entrega_obs && <div className="col-span-2"><b>Obs.:</b> {e.venda.entrega_obs}</div>}
          </div>
          <table className="w-full border-collapse">
            <thead><tr className="border-y border-black text-left"><th className="w-24 py-1 text-right">Qtd.</th><th className="pl-3">Produto</th><th>Un.</th></tr></thead>
            <tbody>
              {d.itens.filter(i => i.entrega_id === e.entrega_id).map(i => (
                <tr key={i.id} className="border-b border-stone-300">
                  <td className="py-1.5 text-right font-semibold">{qtd(Number(i.quantidade))}</td><td className="pl-3">{i.item.descricao}</td><td>{i.item.unidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {e.mistura && <p className="mt-2"><b>{e.mistura_nome}:</b> {qtd(Number(e.mistura_sacos))} sacos</p>}
          <div className="mt-12 grid grid-cols-2 gap-10">
            <div className="border-t border-black pt-1 text-center">Recebido por (nome e assinatura)</div>
            <div className="border-t border-black pt-1 text-center">Data</div>
          </div>
          <p className="mt-4 text-center text-[10px]">{via === 0 ? '1ª via — loja' : '2ª via — cliente'} · documento sem valor fiscal</p>
        </Folha>
      )))}
    </Pagina>
  )
}
