import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mensagemErro, supabase } from '../../lib/supabase'
import { dataBR, numRomaneio, numero, qtd } from '../../lib/formato'
import type { Motorista, Romaneio } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Selo, SemPermissao } from '../../core/ui/componentes'
import { DetalheVenda } from '../vendas/VendasPage'
import { carregarEntregas, type EntregaCompleta } from './dados'
import { MontarRomaneio } from './MontarRomaneio'

const DIA = 86400000

function Cartao({ e, selecionado, aoSelecionar, aoAbrir }: {
  e: EntregaCompleta; selecionado?: boolean; aoSelecionar?: () => void; aoAbrir: () => void
}) {
  const atrasada = e.data_prevista && e.status === 'a_separar' && e.data_prevista < new Date().toISOString().slice(0, 10)
  return (
    <div className={`rounded-md border bg-white p-3 text-sm shadow-sm ${selecionado ? 'border-marca-500 ring-2 ring-marca-100' : 'border-stone-200'}`}>
      <div className="flex items-start gap-2">
        {aoSelecionar && <input type="checkbox" className="mt-1 h-4 w-4 accent-marca-600" checked={!!selecionado} onChange={aoSelecionar} aria-label={`Selecionar pedido ${e.venda.numero}`} />}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={aoAbrir}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Pedido {e.venda.numero}</span>
            <span className="text-xs text-stone-500">{numero(e.peso, 0)} kg{e.semPeso > 0 && <span className="text-amber-700"> +{e.semPeso} s/ peso</span>}</span>
          </div>
          <div className="truncate">{e.cliente?.nome ?? e.venda.cliente_nome ?? 'Consumidor'}</div>
          <div className="truncate text-xs text-stone-500">{e.endereco ?? e.cliente?.cidade ?? 'sem endereço'}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {e.data_prevista && <Selo cor={atrasada ? 'vermelho' : 'cinza'}>{atrasada ? 'atrasada · ' : ''}{dataBR(e.data_prevista)}</Selo>}
            {e.cliente?.dia_entrega && <Selo cor="ambar">{e.cliente.dia_entrega}</Selo>}
            {e.cliente?.nome_mistura && <Selo>mistura</Selo>}
          </div>
          <ul className="mt-1 text-xs text-stone-600">
            {e.itens.slice(0, 3).map(i => <li key={i.id} className="truncate">{qtd(e.status === 'a_separar' ? i.saldo : i.quantidade)} {i.unidade} · {i.descricao}</li>)}
            {e.itens.length > 3 && <li className="text-stone-400">+ {e.itens.length - 3} itens</li>}
          </ul>
        </button>
      </div>
    </div>
  )
}

export function QuadroEntregasPage() {
  const { pode } = useAuth()
  const [aSeparar, setASeparar] = useState<EntregaCompleta[] | null>(null)
  const [emRota, setEmRota] = useState<EntregaCompleta[]>([])
  const [entregues, setEntregues] = useState<EntregaCompleta[]>([])
  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [montando, setMontando] = useState(false)
  const [vendaAberta, setVendaAberta] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const desde = new Date(Date.now() - 3 * DIA).toISOString()
      const [a, r, ent, rom, mot] = await Promise.all([
        carregarEntregas(['a_separar']),
        carregarEntregas(['em_rota']),
        carregarEntregas(['entregue'], desde),
        supabase.from('romaneios').select('*').eq('status', 'em_rota').order('numero'),
        supabase.from('motoristas').select('*'),
      ])
      setASeparar(a); setEmRota(r); setEntregues(ent.reverse())
      setRomaneios((rom.data as Romaneio[]) ?? []); setMotoristas((mot.data as Motorista[]) ?? [])
      setSelecao(s => new Set([...s].filter(id => a.some(e => e.id === id))))
    } catch (e) { setErro(mensagemErro(e)) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const filtrar = useCallback((l: EntregaCompleta[]) => {
    const t = busca.trim().toLowerCase()
    if (!t) return l
    return l.filter(e => String(e.venda.numero) === t || [e.cliente?.nome, e.venda.cliente_nome, e.endereco, e.cliente?.cidade, e.cliente?.bairro]
      .some(x => x?.toLowerCase().includes(t)))
  }, [busca])

  const selecionadas = useMemo(() => (aSeparar ?? []).filter(e => selecao.has(e.id)), [aSeparar, selecao])
  const pesoSel = selecionadas.reduce((s, e) => s + e.peso, 0)

  if (!pode('entregas.quadro')) return <SemPermissao />
  const podeMontar = pode('entregas.romaneios', 'criar')
  const nomeMot = (id: string | null) => motoristas.find(m => m.id === id)?.nome ?? 'sem motorista'
  const alternar = (id: string) => setSelecao(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="mx-auto max-w-[110rem]">
      <CabecalhoPagina titulo="Quadro de entregas" descricao="Vendas com itens para entregar. Selecione as entregas e monte o romaneio."
        acoes={<>
          <input className="campo w-64" placeholder="Filtrar: pedido, cliente, cidade" value={busca} onChange={e => setBusca(e.target.value)} />
          <Link to="/entregas/romaneios" className="btn-secundario">Romaneios</Link>
        </>} />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}

      {!aSeparar ? <Carregando /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* A separar */}
          <section className="rounded-lg bg-stone-200/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-stone-800">A separar <span className="text-stone-500">({aSeparar.length})</span></h2>
              {podeMontar && aSeparar.length > 0 && (
                <button className="text-xs text-marca-700 hover:underline" onClick={() => setSelecao(s => s.size ? new Set() : new Set(filtrar(aSeparar).map(e => e.id)))}>
                  {selecao.size ? 'limpar seleção' : 'selecionar todas'}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {filtrar(aSeparar).map(e => (
                <Cartao key={e.id} e={e} selecionado={selecao.has(e.id)} aoSelecionar={podeMontar ? () => alternar(e.id) : undefined} aoAbrir={() => setVendaAberta(e.venda_id)} />
              ))}
              {!aSeparar.length && <p className="py-6 text-center text-sm text-stone-500">Nenhuma entrega pendente.</p>}
            </div>
          </section>

          {/* Em rota */}
          <section className="rounded-lg bg-stone-200/60 p-3">
            <h2 className="mb-2 font-semibold text-stone-800">Em rota <span className="text-stone-500">({emRota.length})</span></h2>
            <div className="space-y-3">
              {romaneios.map(r => (
                <div key={r.id} className="rounded-md border border-marca-200 bg-marca-50/50 p-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">Romaneio {numRomaneio(r.numero)} · {nomeMot(r.motorista_id)}</span>
                    <span className="flex gap-2 text-xs">
                      <a className="text-marca-700 hover:underline" href={`/imprimir/romaneio/${r.id}`} target="_blank" rel="noreferrer">imprimir</a>
                      <Link className="text-marca-700 hover:underline" to={`/entregas/romaneios?retorno=${r.id}`}>retorno</Link>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filtrar(emRota.filter(e => e.romaneio_id === r.id)).map(e => <Cartao key={e.id} e={e} aoAbrir={() => setVendaAberta(e.venda_id)} />)}
                  </div>
                </div>
              ))}
              {!romaneios.length && <p className="py-6 text-center text-sm text-stone-500">Nenhum romaneio em rota.</p>}
            </div>
          </section>

          {/* Entregues */}
          <section className="rounded-lg bg-stone-200/60 p-3">
            <h2 className="mb-2 font-semibold text-stone-800">Entregues <span className="text-xs font-normal text-stone-500">(últimos 3 dias)</span></h2>
            <div className="space-y-2">
              {filtrar(entregues).map(e => <Cartao key={e.id} e={e} aoAbrir={() => setVendaAberta(e.venda_id)} />)}
              {!entregues.length && <p className="py-6 text-center text-sm text-stone-500">Nada entregue recentemente.</p>}
            </div>
          </section>
        </div>
      )}

      {selecionadas.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto mt-4 flex max-w-xl items-center justify-between gap-3 rounded-full bg-stone-900 px-5 py-3 text-sm text-white shadow-lg">
          <span>{selecionadas.length} entrega(s) · ≈ {numero(pesoSel, 0)} kg</span>
          <button className="btn-primario rounded-full" onClick={() => setMontando(true)}>Montar romaneio</button>
        </div>
      )}

      {montando && (
        <MontarRomaneio entregas={selecionadas} aoFechar={() => setMontando(false)}
          aoConcluir={id => { setMontando(false); setSelecao(new Set()); void carregar(); window.open(`/imprimir/romaneio/${id}`, '_blank') }} />
      )}
      {vendaAberta && <DetalheVenda id={vendaAberta} aoFechar={() => setVendaAberta(null)} aoMudar={() => void carregar()} />}
    </div>
  )
}
