import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import { lerNumero } from '../../lib/formato'
import type { ConfigTributaria } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

const CSTS: Record<string, string> = {
  '000': 'Tributada integralmente', '010': 'Tributada e com cobrança de ICMS por ST', '020': 'Com redução de base de cálculo',
  '030': 'Isenta ou não tributada e com cobrança de ICMS por ST', '040': 'Isenta', '041': 'Não tributada', '050': 'Suspensão',
  '051': 'Diferimento', '060': 'ICMS cobrado anteriormente por ST', '070': 'Com redução de base e cobrança de ICMS por ST', '090': 'Outras',
}
const PIS: Record<string, string> = { '01': 'Tributável', '04': 'Monofásico', '06': 'Alíquota zero', '07': 'Isenta', '49': 'Outras' }

type Form = Omit<ConfigTributaria, 'reducao_base_interestadual'> & { reducao_base_interestadual: string }

export function ConfigTributariasPage() {
  const { pode } = useAuth()
  const [lista, setLista] = useState<(ConfigTributaria & { produtos: number })[] | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('config_tributarias').select('*, produtos(count)').order('nome')
    if (error) setErro(mensagemErro(error))
    setLista(((data ?? []) as (ConfigTributaria & { produtos: { count: number }[] })[])
      .map(c => ({ ...c, produtos: c.produtos?.[0]?.count ?? 0 }))
      .sort((a, b) => b.produtos - a.produtos))
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  if (!pode('cadastros.produtos')) return <SemPermissao />
  const podeEditar = pode('cadastros.produtos', 'editar')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const { id, ...f } = form
    const dados = {
      nome: f.nome, cst_compra: f.cst_compra, cst_venda_interna: f.cst_venda_interna, cst_venda_interestadual: f.cst_venda_interestadual,
      pis_cofins_cst: f.pis_cofins_cst, beneficio_interno: f.beneficio_interno || null, beneficio_interestadual: f.beneficio_interestadual || null,
      reducao_base_interestadual: lerNumero(f.reducao_base_interestadual) ?? 0, observacao: f.observacao || null, ativo: f.ativo,
    }
    const { error } = id ? await supabase.from('config_tributarias').update(dados).eq('id', id) : await supabase.from('config_tributarias').insert(dados)
    if (error) { setErro(mensagemErro(error)); return }
    setForm(null); await carregar()
  }

  const novo = (): Form => ({
    id: '', nome: '', descricao_microvix: null, cst_compra: '000', cst_venda_interna: '000', cst_venda_interestadual: '000',
    pis_cofins_cst: '01', beneficio_interno: null, beneficio_interestadual: null, reducao_base_interestadual: '0', observacao: null, ativo: true,
  })

  const selCst = (k: 'cst_compra' | 'cst_venda_interna' | 'cst_venda_interestadual', rotulo: string) => (
    <div>
      <label className="rotulo" htmlFor={`cfg-${k}`}>{rotulo}</label>
      <select id={`cfg-${k}`} className="campo" disabled={!podeEditar} value={form?.[k]} onChange={e => setForm(f => f && ({ ...f, [k]: e.target.value }))}>
        {Object.entries(CSTS).map(([c, n]) => <option key={c} value={c}>{c} - {n}</option>)}
      </select>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Configurações tributárias"
        descricao="CST de compra, de venda dentro do estado e de venda para fora. Usadas na emissão da nota fiscal."
        acoes={podeEditar && <button className="btn-primario" onClick={() => { setErro(''); setForm(novo()) }}>Nova configuração</button>} />
      {erro && !form && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      <div className="cartao overflow-x-auto">
        {!lista ? <Carregando /> : lista.length === 0 ? <Vazio>Nenhuma configuração. Elas são criadas ao importar os produtos do Microvix.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Nome</th><th>Compra</th><th>Venda SP</th><th>Venda fora</th><th>PIS/COFINS</th><th>Benefício</th><th className="text-right">Produtos</th><th /></tr></thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} className={c.ativo ? '' : 'opacity-50'}>
                  <td className="font-medium">{c.nome}{c.observacao && <span className="ml-2"><Selo cor="ambar">conferir</Selo></span>}</td>
                  <td className="font-mono" title={CSTS[c.cst_compra]}>{c.cst_compra}</td>
                  <td className="font-mono" title={CSTS[c.cst_venda_interna]}>{c.cst_venda_interna}</td>
                  <td className="font-mono" title={CSTS[c.cst_venda_interestadual]}>{c.cst_venda_interestadual}{Number(c.reducao_base_interestadual) > 0 && <span className="text-xs text-stone-500"> (−{Number(c.reducao_base_interestadual)}%)</span>}</td>
                  <td className="font-mono" title={PIS[c.pis_cofins_cst]}>{c.pis_cofins_cst}</td>
                  <td className="font-mono text-xs">{[c.beneficio_interno, c.beneficio_interestadual].filter(Boolean).join(' | ') || '—'}</td>
                  <td className="text-right">{c.produtos.toLocaleString('pt-BR')}</td>
                  <td className="text-right"><button className="text-sm text-marca-700 hover:underline"
                    onClick={() => { setErro(''); setForm({ ...c, reducao_base_interestadual: String(c.reducao_base_interestadual).replace('.', ',') }) }}>{podeEditar ? 'Editar' : 'Ver'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal titulo={form?.id ? 'Configuração tributária' : 'Nova configuração tributária'} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-2xl"
        rodape={<>
          <button className="btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
          {podeEditar && <button type="submit" form="form-cfg" className="btn-primario">Salvar</button>}
        </>}>
        {form && (
          <form id="form-cfg" onSubmit={salvar} className="grid gap-3 sm:grid-cols-3">
            {erro && <div className="sm:col-span-3"><Aviso>{erro}</Aviso></div>}
            <div className="sm:col-span-3">
              <label className="rotulo" htmlFor="cfg-nome">Nome</label>
              <input id="cfg-nome" className="campo" required disabled={!podeEditar} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            {selCst('cst_compra', 'CST na compra')}
            {selCst('cst_venda_interna', 'CST venda dentro do estado')}
            {selCst('cst_venda_interestadual', 'CST venda fora do estado')}
            <div>
              <label className="rotulo" htmlFor="cfg-pis">PIS/COFINS</label>
              <select id="cfg-pis" className="campo" disabled={!podeEditar} value={form.pis_cofins_cst} onChange={e => setForm({ ...form, pis_cofins_cst: e.target.value })}>
                {Object.entries(PIS).map(([c, n]) => <option key={c} value={c}>{c} - {n}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="cfg-bi">Benefício (SP)</label>
              <input id="cfg-bi" className="campo font-mono" disabled={!podeEditar} value={form.beneficio_interno ?? ''} onChange={e => setForm({ ...form, beneficio_interno: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="rotulo" htmlFor="cfg-be">Benefício (fora)</label>
              <input id="cfg-be" className="campo font-mono" disabled={!podeEditar} value={form.beneficio_interestadual ?? ''} onChange={e => setForm({ ...form, beneficio_interestadual: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="rotulo" htmlFor="cfg-red">Redução da base fora (%)</label>
              <input id="cfg-red" className="campo" inputMode="decimal" disabled={!podeEditar} value={form.reducao_base_interestadual} onChange={e => setForm({ ...form, reducao_base_interestadual: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="cfg-obs">Observação</label>
              <input id="cfg-obs" className="campo" disabled={!podeEditar} value={form.observacao ?? ''} onChange={e => setForm({ ...form, observacao: e.target.value })} />
            </div>
            {form.descricao_microvix && <p className="text-xs text-stone-500 sm:col-span-3">No Microvix: <span className="font-mono">{form.descricao_microvix}</span></p>}
            <label className="flex items-center gap-2 text-sm sm:col-span-3">
              <input type="checkbox" className="h-4 w-4 accent-marca-600" disabled={!podeEditar} checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
              Ativa
            </label>
          </form>
        )}
      </Modal>
    </div>
  )
}
