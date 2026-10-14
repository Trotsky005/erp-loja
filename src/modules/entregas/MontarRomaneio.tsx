import { useEffect, useMemo, useState } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import { lerNumero, numRomaneio, numero, qtd } from '../../lib/formato'
import type { Motorista, Veiculo } from '../../lib/tipos'
import { Aviso, Modal } from '../../core/ui/componentes'
import type { EntregaCompleta } from './dados'

interface ConfigEntrega { mistura: boolean; nome: string; sacos: string; pesoSaco: string }
type Peso = { valor: string; insignificante: boolean }

const txt = (n: number) => String(n).replace('.', ',')

export function MontarRomaneio({ entregas, aoFechar, aoConcluir }: {
  entregas: EntregaCompleta[]; aoFechar: () => void; aoConcluir: (id: string) => void
}) {
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [motorista, setMotorista] = useState('')
  const [ajudante, setAjudante] = useState('')
  const [veiculo, setVeiculo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [proximo, setProximo] = useState<number | null>(null)
  const [pesoSacoPadrao, setPesoSacoPadrao] = useState(50)
  // quanto carregar de cada item (chave = venda_item_id); começa com o saldo
  const [carga, setCarga] = useState<Record<string, string>>(() =>
    Object.fromEntries(entregas.flatMap(e => e.itens.map(i => [i.id, txt(i.saldo)]))))
  const [config, setConfig] = useState<Record<string, ConfigEntrega>>(() =>
    Object.fromEntries(entregas.map(e => [e.id, { mistura: false, nome: e.cliente?.nome_mistura ?? `Mistura ${e.cliente?.fantasia ?? e.cliente?.nome ?? ''}`.trim(), sacos: '', pesoSaco: '' }])))
  const [pesos, setPesos] = useState<Record<string, Peso>>({})   // produto_id → peso informado agora
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    void Promise.all([
      supabase.from('motoristas').select('*').eq('ativo', true).order('nome'),
      supabase.from('veiculos').select('*').eq('ativo', true).order('descricao'),
      supabase.from('parametros').select('chave, valor').in('chave', ['proximo_romaneio', 'saco_mistura_kg']),
    ]).then(([m, v, p]) => {
      setMotoristas((m.data as Motorista[]) ?? []); setVeiculos((v.data as Veiculo[]) ?? [])
      for (const x of (p.data ?? []) as { chave: string; valor: unknown }[]) {
        if (x.chave === 'proximo_romaneio' && typeof x.valor === 'number') setProximo(x.valor)
        if (x.chave === 'saco_mistura_kg' && typeof x.valor === 'number') setPesoSacoPadrao(x.valor)
      }
    })
  }, [])

  // ao escolher o motorista, sugere o veículo dele
  useEffect(() => {
    const m = motoristas.find(x => x.id === motorista)
    if (m?.veiculo_id) setVeiculo(m.veiculo_id)
  }, [motorista, motoristas])

  /** peso por unidade do produto: o informado agora, ou o do cadastro */
  function pesoDe(produtoId: string): number | null | 'falta' {
    const inf = pesos[produtoId]
    if (inf?.insignificante) return null
    if (inf && lerNumero(inf.valor) !== null) return lerNumero(inf.valor)
    const p = entregas.flatMap(e => e.itens).find(i => i.produto_id === produtoId)?.produto
    if (!p) return 'falta'
    if (p.peso_insignificante) return null
    return p.peso_kg === null ? 'falta' : Number(p.peso_kg)
  }

  const resumo = useMemo(() => {
    const linhas = new Map<string, { quantidade: number; descricao: string; unidade: string; peso: number | null; falta: boolean; saco: boolean }>()
    const misturas: { nome: string; sacos: number; peso: number }[] = []
    for (const e of entregas) {
      const c = config[e.id]
      if (c.mistura) {
        const sacos = lerNumero(c.sacos) ?? 0
        misturas.push({ nome: c.nome || 'Mistura', sacos, peso: sacos * (lerNumero(c.pesoSaco) ?? pesoSacoPadrao) })
        continue
      }
      for (const i of e.itens) {
        const q = lerNumero(carga[i.id]) ?? 0
        if (q <= 0) continue
        const pu = pesoDe(i.produto_id)
        const atual = linhas.get(i.produto_id) ?? {
          quantidade: 0, descricao: i.descricao, unidade: i.unidade, peso: pu === null ? null : 0, falta: pu === 'falta',
          saco: !!i.produto?.vem_em_saco || i.unidade.toUpperCase() === 'SC',
        }
        atual.quantidade += q
        if (typeof pu === 'number' && atual.peso !== null) atual.peso += q * pu
        linhas.set(i.produto_id, atual)
      }
    }
    const lista = [...linhas.entries()].map(([id, l]) => ({ id, ...l })).sort((a, b) => a.descricao.localeCompare(b.descricao))
    const peso = lista.reduce((s, l) => s + (l.peso ?? 0), 0) + misturas.reduce((s, m) => s + m.peso, 0)
    const sacos = lista.filter(l => l.saco).reduce((s, l) => s + l.quantidade, 0) + misturas.reduce((s, m) => s + m.sacos, 0)
    return { lista, misturas, peso, sacos, faltaPeso: lista.filter(l => l.falta) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregas, config, carga, pesos, pesoSacoPadrao])

  const capacidade = veiculos.find(v => v.id === veiculo)?.capacidade_kg
  const passou = capacidade !== null && capacidade !== undefined && resumo.peso > Number(capacidade)

  async function fechar() {
    setErro('')
    if (!motorista) { setErro('Escolha o motorista.'); return }
    if (resumo.faltaPeso.length) { setErro(`Informe o peso de: ${resumo.faltaPeso.map(l => l.descricao).join(', ')}.`); return }
    for (const e of entregas) {
      const c = config[e.id]
      if (c.mistura && !(lerNumero(c.sacos) ?? 0)) { setErro(`Informe os sacos da mistura do pedido ${e.venda.numero}.`); return }
      if (!e.itens.some(i => (lerNumero(carga[i.id]) ?? 0) > 0)) { setErro(`O pedido ${e.venda.numero} está sem nenhum item na carga. Tire ele da seleção ou informe as quantidades.`); return }
      for (const i of e.itens) {
        const q = lerNumero(carga[i.id]) ?? 0
        if (q < 0 || q > i.saldo) { setErro(`Pedido ${e.venda.numero}: ${i.descricao} — máximo ${qtd(i.saldo)}.`); return }
      }
    }
    const corpo = {
      motorista_id: motorista, ajudante_id: ajudante || null, veiculo_id: veiculo || null, observacao,
      entregas: entregas.map(e => {
        const c = config[e.id]
        return { entrega_id: e.id, mistura: c.mistura, mistura_nome: c.nome, mistura_sacos: lerNumero(c.sacos), mistura_peso_saco: lerNumero(c.pesoSaco) ?? pesoSacoPadrao }
      }),
      itens: entregas.flatMap(e => e.itens.map(i => ({ entrega_id: e.id, venda_item_id: i.id, quantidade: lerNumero(carga[i.id]) ?? 0 }))).filter(x => x.quantidade > 0),
      pesos: Object.entries(pesos).map(([produto_id, p]) => ({ produto_id, peso_kg: lerNumero(p.valor), insignificante: p.insignificante }))
        .filter(p => p.insignificante || (p.peso_kg ?? 0) > 0),
    }
    setSalvando(true)
    const { data, error } = await supabase.rpc('criar_romaneio', { p: corpo })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    aoConcluir((data as { id: string }).id)
  }

  const motoristasLista = motoristas.filter(m => m.funcao !== 'ajudante')
  const ajudantesLista = motoristas.filter(m => m.funcao !== 'motorista' || m.id !== motorista)

  return (
    <Modal titulo={`Montar romaneio ${proximo ? numRomaneio(proximo) : ''}`} aberto aoFechar={aoFechar} largura="max-w-6xl"
      rodape={<>
        <button className="btn-secundario" onClick={aoFechar}>Cancelar</button>
        <button className="btn-primario" disabled={salvando} onClick={() => void fechar()}>{salvando ? 'Gravando…' : 'Fechar romaneio e imprimir'}</button>
      </>}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="rotulo" htmlFor="r-mot">Motorista</label>
            <select id="r-mot" className="campo" value={motorista} onChange={e => setMotorista(e.target.value)}>
              <option value="">— escolha —</option>{motoristasLista.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="r-aju">Ajudante</label>
            <select id="r-aju" className="campo" value={ajudante} onChange={e => setAjudante(e.target.value)}>
              <option value="">sem ajudante</option>{ajudantesLista.filter(m => m.id !== motorista).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="r-vei">Veículo</label>
            <select id="r-vei" className="campo" value={veiculo} onChange={e => setVeiculo(e.target.value)}>
              <option value="">—</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.descricao}{v.capacidade_kg ? ` (${numero(Number(v.capacidade_kg), 0)} kg)` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="r-obs">Observação</label>
            <input id="r-obs" className="campo" value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          {/* entregas e itens */}
          <div className="space-y-3">
            {entregas.map(e => {
              const c = config[e.id]
              const setC = (m: Partial<ConfigEntrega>) => setConfig(x => ({ ...x, [e.id]: { ...x[e.id], ...m } }))
              return (
                <div key={e.id} className="rounded-md border border-stone-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2">
                    <span><b>Pedido {e.venda.numero}</b> · {e.cliente?.nome ?? e.venda.cliente_nome ?? 'Consumidor'}</span>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="h-4 w-4 accent-marca-600" checked={c.mistura} onChange={ev => setC({ mistura: ev.target.checked })} />
                      É mistura (vai como um item em sacos)
                    </label>
                  </div>
                  {c.mistura && (
                    <div className="grid gap-2 border-b border-stone-200 bg-amber-50/50 px-3 py-2 sm:grid-cols-3">
                      <input className="campo" aria-label="Nome da mistura" value={c.nome} onChange={ev => setC({ nome: ev.target.value })} />
                      <input className="campo" inputMode="decimal" aria-label="Quantidade de sacos" placeholder="Qtd. de sacos" value={c.sacos} onChange={ev => setC({ sacos: ev.target.value })} />
                      <input className="campo" inputMode="decimal" aria-label="Peso do saco" placeholder={`kg por saco (${pesoSacoPadrao})`} value={c.pesoSaco} onChange={ev => setC({ pesoSaco: ev.target.value })} />
                    </div>
                  )}
                  <table className="tabela">
                    <thead><tr><th>Item</th><th className="text-right">Falta entregar</th><th className="w-28">Carregar</th><th className="w-44">Peso por un. (kg)</th></tr></thead>
                    <tbody>
                      {e.itens.map(i => {
                        const pu = pesoDe(i.produto_id)
                        const inf = pesos[i.produto_id]
                        return (
                          <tr key={i.id}>
                            <td>{i.descricao}<span className="block text-xs text-stone-400">{i.codigo} · {i.unidade}</span></td>
                            <td className="text-right">{qtd(i.saldo)}</td>
                            <td><input className="campo px-2 py-1" inputMode="decimal" aria-label={`Carregar ${i.descricao}`} value={carga[i.id] ?? ''} onChange={ev => setCarga(x => ({ ...x, [i.id]: ev.target.value }))} /></td>
                            <td>
                              {c.mistura ? <span className="text-xs text-stone-400">na mistura</span>
                                : (pu === 'falta' || inf) ? (
                                  <div className="flex items-center gap-1">
                                    <input className={`campo px-2 py-1 ${pu === 'falta' ? 'border-amber-400' : ''}`} inputMode="decimal" placeholder="peso" disabled={inf?.insignificante}
                                      aria-label={`Peso de ${i.descricao}`} value={inf?.valor ?? ''}
                                      onChange={ev => setPesos(x => ({ ...x, [i.produto_id]: { valor: ev.target.value, insignificante: false } }))} />
                                    <label className="flex items-center gap-1 text-[11px] text-stone-500" title="Peso insignificante: fica em branco e não soma">
                                      <input type="checkbox" checked={!!inf?.insignificante} onChange={ev => setPesos(x => ({ ...x, [i.produto_id]: { valor: '', insignificante: ev.target.checked } }))} />insig.
                                    </label>
                                  </div>
                                ) : pu === null ? <span className="text-xs text-stone-400">insignificante</span> : numero(pu)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>

          {/* prévia do romaneio */}
          <div className="h-fit rounded-md border border-stone-300 bg-white p-3 lg:sticky lg:top-0">
            <h3 className="mb-2 font-semibold">Prévia do romaneio</h3>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-stone-300 text-left"><th className="py-1 text-right">Qtd.</th><th className="pl-2">Item</th><th>Un.</th><th className="text-right">Peso</th></tr></thead>
              <tbody>
                {resumo.lista.map(l => (
                  <tr key={l.id} className="border-b border-stone-100">
                    <td className="py-1 text-right font-medium">{qtd(l.quantidade)}</td><td className="pl-2">{l.descricao}</td><td>{l.unidade}</td>
                    <td className={`text-right ${l.falta ? 'text-amber-700' : ''}`}>{l.falta ? 'falta' : l.peso === null ? '' : numero(l.peso, 1)}</td>
                  </tr>
                ))}
                {resumo.misturas.map((m, i) => (
                  <tr key={`m${i}`} className="border-b border-stone-100">
                    <td className="py-1 text-right font-medium">{qtd(m.sacos)}</td><td className="pl-2">{m.nome}</td><td>SC</td><td className="text-right">{numero(m.peso, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 space-y-0.5 border-t border-stone-300 pt-2">
              <div className="flex justify-between"><span>Peso total</span><b>{numero(resumo.peso, 1)} kg</b></div>
              <div className="flex justify-between"><span>Sacos</span><b>{qtd(resumo.sacos)}</b></div>
              {capacidade ? <div className="flex justify-between text-xs text-stone-500"><span>Capacidade do veículo</span><span>{numero(Number(capacidade), 0)} kg</span></div> : null}
            </div>
            {passou && <div className="mt-2"><Aviso>A carga passa da capacidade do veículo.</Aviso></div>}
            {resumo.faltaPeso.length > 0 && <p className="mt-2 text-xs text-amber-700">Informe o peso dos itens marcados (fica salvo no cadastro do produto).</p>}
          </div>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </Modal>
  )
}
