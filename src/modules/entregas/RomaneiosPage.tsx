import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { mensagemErro, supabase } from '../../lib/supabase'
import { dataBR, dataHoraBR, lerNumero, numRomaneio, numero, qtd } from '../../lib/formato'
import type { Motorista, Pessoa, Romaneio, RomaneioEntrega, RomaneioItem, Veiculo, Venda } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

const NOMES = { em_rota: 'Em rota', finalizado: 'Finalizado', cancelado: 'Cancelado' } as const
const CORES = { em_rota: 'vermelho', finalizado: 'verde', cancelado: 'cinza' } as const
const RESULTADOS = { entregue: 'Entregue', parcial: 'Parcial', nao_entregue: 'Não entregue' } as const
const POR_PAGINA = 30

type RomaneioLista = Romaneio & { romaneio_entregas: { count: number }[] }

export function RomaneiosPage() {
  const { pode } = useAuth()
  const local = useLocation()
  const [lista, setLista] = useState<RomaneioLista[] | null>(null)
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [status, setStatus] = useState<'' | Romaneio['status']>('')
  const [pagina, setPagina] = useState(0)
  const [total, setTotal] = useState(0)
  const [retorno, setRetorno] = useState<string | null>(new URLSearchParams(local.search).get('retorno'))
  const [cancelar, setCancelar] = useState<Romaneio | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  const carregar = useCallback(async () => {
    setLista(null)
    let q = supabase.from('romaneios').select('*, romaneio_entregas(count)', { count: 'exact' })
    if (status) q = q.eq('status', status)
    const [r, m, v] = await Promise.all([
      q.order('numero', { ascending: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1),
      supabase.from('motoristas').select('*'),
      supabase.from('veiculos').select('*'),
    ])
    if (r.error) setErro(mensagemErro(r.error))
    setLista((r.data as RomaneioLista[]) ?? []); setTotal(r.count ?? 0)
    setMotoristas((m.data as Motorista[]) ?? []); setVeiculos((v.data as Veiculo[]) ?? [])
  }, [status, pagina])
  useEffect(() => { void carregar() }, [carregar])

  if (!pode('entregas.romaneios') && !pode('entregas.quadro')) return <SemPermissao />
  const nomeMot = (id: string | null) => motoristas.find(m => m.id === id)?.nome ?? '—'
  const podeRetorno = pode('entregas.quadro', 'editar') || pode('entregas.romaneios', 'criar')

  async function confirmarCancelamento() {
    if (!cancelar) return
    setErro('')
    const { error } = await supabase.rpc('cancelar_romaneio', { p_romaneio: cancelar.id, p_motivo: motivo })
    if (error) { setErro(mensagemErro(error)); return }
    setCancelar(null); setMotivo(''); setOk('Romaneio cancelado; as entregas voltaram para "A separar".')
    await carregar()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Romaneios" descricao={`${total} romaneio(s)`}
        acoes={<>
          <select className="campo w-40" aria-label="Situação" value={status} onChange={e => { setPagina(0); setStatus(e.target.value as typeof status) }}>
            <option value="">Todos</option>{Object.entries(NOMES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <Link to="/entregas" className="btn-secundario">Quadro de entregas</Link>
        </>} />
      {erro && !cancelar && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mb-3"><Aviso tipo="ok">{ok}</Aviso></div>}

      <div className="cartao overflow-x-auto">
        {!lista ? <Carregando /> : !lista.length ? <Vazio>Nenhum romaneio. Monte o primeiro no quadro de entregas.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Nº</th><th>Data</th><th>Motorista</th><th>Veículo</th><th className="text-right">Entregas</th><th className="text-right">Peso (kg)</th><th className="text-right">Sacos</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lista.map(r => (
                <tr key={r.id}>
                  <td className="font-mono font-medium">{numRomaneio(r.numero)}</td>
                  <td>{dataBR(r.data)}</td>
                  <td>{nomeMot(r.motorista_id)}{r.ajudante_id && <span className="text-stone-500"> + {nomeMot(r.ajudante_id)}</span>}</td>
                  <td>{veiculos.find(v => v.id === r.veiculo_id)?.descricao ?? '—'}</td>
                  <td className="text-right">{r.romaneio_entregas?.[0]?.count ?? 0}</td>
                  <td className="text-right">{numero(Number(r.peso_total), 0)}</td>
                  <td className="text-right">{qtd(Number(r.sacos))}</td>
                  <td><Selo cor={CORES[r.status]}>{NOMES[r.status]}</Selo></td>
                  <td className="whitespace-nowrap text-right text-sm">
                    <a className="text-marca-700 hover:underline" href={`/imprimir/romaneio/${r.id}`} target="_blank" rel="noreferrer">Imprimir</a>
                    {r.status === 'em_rota' && podeRetorno && <button className="ml-3 font-medium text-marca-700 hover:underline" onClick={() => { setOk(''); setRetorno(r.id) }}>Retorno</button>}
                    {r.status === 'finalizado' && <button className="ml-3 text-marca-700 hover:underline" onClick={() => setRetorno(r.id)}>Ver</button>}
                    {r.status === 'em_rota' && pode('entregas.romaneios', 'cancelar') && <button className="ml-3 text-stone-500 hover:underline" onClick={() => { setErro(''); setCancelar(r) }}>Cancelar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-3 text-sm text-stone-600">
        <button className="btn-secundario" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
        <button className="btn-secundario" disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setPagina(p => p + 1)}>Próxima</button>
      </div>

      {retorno && <Retorno id={retorno} aoFechar={() => setRetorno(null)} aoConcluir={() => { setRetorno(null); setOk('Retorno registrado.'); void carregar() }} />}

      <Modal titulo={cancelar ? `Cancelar romaneio ${numRomaneio(cancelar.numero)}` : ''} aberto={!!cancelar} aoFechar={() => setCancelar(null)}
        rodape={<><button className="btn-secundario" onClick={() => setCancelar(null)}>Voltar</button>
          <button className="btn bg-marca-700 text-white hover:bg-marca-800" disabled={!motivo.trim()} onClick={() => void confirmarCancelamento()}>Cancelar romaneio</button></>}>
        <div className="space-y-2 text-sm">
          {erro && <Aviso>{erro}</Aviso>}
          <p>Use quando a carga não saiu. As entregas voltam para "A separar" e o número não é reaproveitado.</p>
          <label className="rotulo" htmlFor="mot-rom">Motivo</label>
          <input id="mot-rom" className="campo" autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}

interface LinhaRetorno {
  entrega: RomaneioEntrega & { entregas: { venda_id: string } }
  venda: Venda | undefined
  cliente: Pessoa | undefined
  itens: (RomaneioItem & { descricao: string; unidade: string })[]
}

function Retorno({ id, aoFechar, aoConcluir }: { id: string; aoFechar: () => void; aoConcluir: () => void }) {
  const [rom, setRom] = useState<Romaneio | null>(null)
  const [linhas, setLinhas] = useState<LinhaRetorno[]>([])
  const [resultado, setResultado] = useState<Record<string, keyof typeof RESULTADOS>>({})
  const [entregue, setEntregue] = useState<Record<string, string>>({})   // romaneio_item.venda_item_id → qtd
  const [obs, setObs] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    void (async () => {
      const [r, re, ri] = await Promise.all([
        supabase.from('romaneios').select('*').eq('id', id).maybeSingle(),
        supabase.from('romaneio_entregas').select('*, entregas(venda_id)').eq('romaneio_id', id).order('ordem'),
        supabase.from('romaneio_itens').select('*').eq('romaneio_id', id),
      ])
      if (r.error || re.error || ri.error) { setErro(mensagemErro(r.error ?? re.error ?? ri.error)); return }
      const ents = (re.data ?? []) as LinhaRetorno['entrega'][]
      const itens = (ri.data ?? []) as RomaneioItem[]
      const [vs, vi] = await Promise.all([
        supabase.from('vendas').select('*').in('id', ents.map(e => e.entregas.venda_id)),
        supabase.from('venda_itens').select('id, descricao, unidade').in('id', itens.map(i => i.venda_item_id)),
      ])
      const vendas = (vs.data ?? []) as Venda[]
      const { data: cl } = await supabase.from('pessoas').select('*').in('id', vendas.map(v => v.cliente_id).filter(Boolean) as string[])
      const desc = new Map(((vi.data ?? []) as { id: string; descricao: string; unidade: string }[]).map(x => [x.id, x] as [string, { id: string; descricao: string; unidade: string }]))
      setRom(r.data as Romaneio)
      setLinhas(ents.map(e => {
        const venda = vendas.find(v => v.id === e.entregas.venda_id)
        return {
          entrega: e, venda, cliente: ((cl ?? []) as Pessoa[]).find(c => c.id === venda?.cliente_id),
          itens: itens.filter(i => i.entrega_id === e.entrega_id).map(i => ({ ...i, descricao: desc.get(i.venda_item_id)?.descricao ?? '', unidade: desc.get(i.venda_item_id)?.unidade ?? '' })),
        }
      }))
      setResultado(Object.fromEntries(ents.map(e => [e.entrega_id, e.resultado ?? 'entregue'])))
      setEntregue(Object.fromEntries(itens.map(i => [i.venda_item_id, String(i.quantidade_entregue ?? i.quantidade).replace('.', ',')])))
    })()
  }, [id])

  const finalizado = rom?.status !== 'em_rota'

  async function salvar() {
    setErro('')
    const corpo = linhas.map(l => ({
      entrega_id: l.entrega.entrega_id,
      resultado: resultado[l.entrega.entrega_id],
      obs: obs[l.entrega.entrega_id] ?? null,
      itens: l.itens.map(i => ({ venda_item_id: i.venda_item_id, quantidade: lerNumero(entregue[i.venda_item_id]) ?? 0 })),
    }))
    setSalvando(true)
    const { error } = await supabase.rpc('retorno_romaneio', { p_romaneio: id, p: corpo })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    aoConcluir()
  }

  return (
    <Modal titulo={rom ? `Retorno do romaneio ${numRomaneio(rom.numero)}` : 'Retorno'} aberto aoFechar={aoFechar} largura="max-w-4xl"
      rodape={finalizado ? <button className="btn-primario" onClick={aoFechar}>Fechar</button> : <>
        <button className="btn-secundario" onClick={aoFechar}>Cancelar</button>
        <button className="btn-primario" disabled={salvando || !linhas.length} onClick={() => void salvar()}>{salvando ? 'Gravando…' : 'Confirmar retorno'}</button>
      </>}>
      {!rom ? <Carregando /> : (
        <div className="space-y-3 text-sm">
          {erro && <Aviso>{erro}</Aviso>}
          {finalizado && <Aviso tipo="info">Romaneio {rom.status === 'cancelado' ? `cancelado: ${rom.motivo_cancelamento}` : `finalizado em ${dataHoraBR(rom.finalizado_em)}`}.</Aviso>}
          {!finalizado && <p className="text-stone-600">Marque o que aconteceu em cada entrega. O que não foi entregue volta para o quadro como "A separar".</p>}
          {linhas.map(l => {
            const res = resultado[l.entrega.entrega_id]
            return (
              <div key={l.entrega.entrega_id} className="rounded-md border border-stone-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2">
                  <span><b>Pedido {l.venda?.numero}</b> · {l.cliente?.nome ?? l.venda?.cliente_nome ?? 'Consumidor'}{l.entrega.mistura && <span className="text-stone-500"> · {l.entrega.mistura_nome} ({qtd(Number(l.entrega.mistura_sacos))} sc)</span>}</span>
                  <div className="flex gap-1">
                    {(Object.keys(RESULTADOS) as (keyof typeof RESULTADOS)[]).map(k => (
                      <button key={k} type="button" disabled={finalizado}
                        className={`rounded-full px-3 py-1 text-xs ${res === k ? (k === 'entregue' ? 'bg-emerald-600 text-white' : k === 'parcial' ? 'bg-amber-500 text-white' : 'bg-marca-600 text-white') : 'bg-white ring-1 ring-stone-300'}`}
                        onClick={() => setResultado(r => ({ ...r, [l.entrega.entrega_id]: k }))}>{RESULTADOS[k]}</button>
                    ))}
                  </div>
                </div>
                <table className="tabela">
                  <thead><tr><th>Item</th><th className="text-right">Carregado</th><th className="w-36">{res === 'parcial' ? 'Entregue' : ''}</th></tr></thead>
                  <tbody>
                    {l.itens.map(i => (
                      <tr key={i.id}>
                        <td>{i.descricao} <span className="text-xs text-stone-400">{i.unidade}</span></td>
                        <td className="text-right">{qtd(Number(i.quantidade))}</td>
                        <td>
                          {res === 'parcial' && !finalizado && (
                            <input className="campo px-2 py-1" inputMode="decimal" aria-label={`Entregue de ${i.descricao}`} value={entregue[i.venda_item_id] ?? ''}
                              onChange={e => setEntregue(x => ({ ...x, [i.venda_item_id]: e.target.value }))} />
                          )}
                          {finalizado && i.quantidade_entregue !== null && <span className="text-stone-600">entregue {qtd(Number(i.quantidade_entregue))}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!finalizado && res !== 'entregue' && (
                  <div className="border-t border-stone-200 px-3 py-2">
                    <input className="campo" placeholder="Observação (ex.: cliente não estava, faltou espaço no caminhão)" value={obs[l.entrega.entrega_id] ?? ''}
                      onChange={e => setObs(x => ({ ...x, [l.entrega.entrega_id]: e.target.value }))} />
                  </div>
                )}
                {finalizado && l.entrega.obs_retorno && <p className="border-t border-stone-200 px-3 py-2 text-stone-600">{l.entrega.obs_retorno}</p>}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
