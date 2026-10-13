import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import type { Loja } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

const REGIMES: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

type Formulario = Omit<Loja, 'id' | 'ativo'> & { id?: string; ativo: boolean }

const VAZIO: Formulario = {
  codigo: 0, nome: '', razao_social: '', cnpj: '', inscricao_estadual: '', regime_tributario: null,
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'SP',
  telefone: '', email: '', ativo: true,
}

function formatarCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

export function LojasPage() {
  const { pode, recarregar } = useAuth()
  const [lojas, setLojas] = useState<Loja[] | null>(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState<Formulario | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('lojas').select('*').order('codigo')
    if (error) setErro(mensagemErro(error))
    setLojas((data as Loja[]) ?? [])
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  if (!pode('admin.lojas')) return <SemPermissao />

  function novo() {
    const proximo = Math.max(0, ...(lojas ?? []).map(l => l.codigo)) + 1
    setForm({ ...VAZIO, codigo: proximo })
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setSalvando(true); setErro('')
    const { id, ...dados } = form
    // campos vazios viram null no banco
    const limpo = Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v === '' ? null : v]))
    limpo.codigo = Number(form.codigo)
    if (typeof limpo.uf === 'string') limpo.uf = limpo.uf.toUpperCase()
    const { error } = id
      ? await supabase.from('lojas').update(limpo).eq('id', id)
      : await supabase.from('lojas').insert(limpo)
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setForm(null)
    await carregar()
    await recarregar()
  }

  const campo = (k: keyof Formulario, rotulo: string, extra: InputHTMLAttributes<HTMLInputElement> = {}, classe = '') => (
    <div className={classe}>
      <label className="rotulo" htmlFor={`loja-${k}`}>{rotulo}</label>
      <input id={`loja-${k}`} className="campo" value={(form?.[k] as string | number | null) ?? ''}
        onChange={e => setForm(f => f && ({ ...f, [k]: e.target.value }))} {...extra} />
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Lojas" descricao="Empresas/lojas do grupo. Lojas não são apagadas, apenas desativadas."
        acoes={pode('admin.lojas', 'criar') && <button className="btn-primario" onClick={novo}>Nova loja</button>} />
      {erro && !form && <div className="mb-4"><Aviso>{erro}</Aviso></div>}

      <div className="cartao overflow-x-auto">
        {!lojas ? <Carregando /> : lojas.length === 0 ? <Vazio>Nenhuma loja cadastrada.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Cód.</th><th>Nome</th><th>CNPJ</th><th>Regime</th><th>Cidade</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lojas.map(l => (
                <tr key={l.id}>
                  <td className="font-mono text-stone-500">{l.codigo}</td>
                  <td className="font-medium">{l.nome}</td>
                  <td className="whitespace-nowrap">{l.cnpj ?? '—'}</td>
                  <td>{l.regime_tributario ? REGIMES[l.regime_tributario] : '—'}</td>
                  <td>{l.cidade ? `${l.cidade}/${l.uf ?? ''}` : '—'}</td>
                  <td>{l.ativo ? <Selo cor="verde">Ativa</Selo> : <Selo>Inativa</Selo>}</td>
                  <td className="text-right">
                    {pode('admin.lojas', 'editar') && (
                      <button className="text-sm text-marca-700 hover:underline" onClick={() => setForm({ ...l })}>Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal titulo={form?.id ? 'Editar loja' : 'Nova loja'} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-2xl"
        rodape={<>
          <button type="button" className="btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
          <button type="submit" form="form-loja" className="btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>}>
        {form && (
          <form id="form-loja" onSubmit={salvar} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            {erro && <div className="sm:col-span-6"><Aviso>{erro}</Aviso></div>}
            {campo('codigo', 'Código', { type: 'number', min: 1, required: true }, 'sm:col-span-1')}
            {campo('nome', 'Nome da loja', { required: true }, 'sm:col-span-5')}
            {campo('razao_social', 'Razão social', {}, 'sm:col-span-6')}
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="loja-cnpj">CNPJ</label>
              <input id="loja-cnpj" className="campo" value={form.cnpj ?? ''} inputMode="numeric"
                onChange={e => setForm(f => f && ({ ...f, cnpj: formatarCnpj(e.target.value) }))} />
            </div>
            {campo('inscricao_estadual', 'Inscrição estadual', {}, 'sm:col-span-2')}
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="loja-regime">Regime tributário</label>
              <select id="loja-regime" className="campo" value={form.regime_tributario ?? ''}
                onChange={e => setForm(f => f && ({ ...f, regime_tributario: (e.target.value || null) as Formulario['regime_tributario'] }))}>
                <option value="">—</option>
                {Object.entries(REGIMES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </div>
            {campo('cep', 'CEP', { inputMode: 'numeric' }, 'sm:col-span-2')}
            {campo('logradouro', 'Endereço', {}, 'sm:col-span-4')}
            {campo('numero', 'Número', {}, 'sm:col-span-1')}
            {campo('complemento', 'Complemento', {}, 'sm:col-span-2')}
            {campo('bairro', 'Bairro', {}, 'sm:col-span-3')}
            {campo('cidade', 'Cidade', {}, 'sm:col-span-4')}
            {campo('uf', 'UF', { maxLength: 2 }, 'sm:col-span-2')}
            {campo('telefone', 'Telefone', { type: 'tel' }, 'sm:col-span-3')}
            {campo('email', 'E-mail', { type: 'email' }, 'sm:col-span-3')}
            <label className="flex items-center gap-2 text-sm sm:col-span-6">
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => f && ({ ...f, ativo: e.target.checked }))}
                className="h-4 w-4 accent-marca-600" />
              Loja ativa
            </label>
          </form>
        )}
      </Modal>
    </div>
  )
}
