import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import { limparBusca, lerNumero, moeda } from '../../lib/formato'
import type { Pessoa } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

const POR_PAGINA = 50
const TIPOS = { cliente: 'Cliente', fornecedor: 'Fornecedor', ambos: 'Cliente e fornecedor' } as const
const DIAS = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

type Form = Omit<Pessoa, 'id' | 'limite_credito' | 'latitude' | 'longitude'> & {
  id?: string; limite_credito: string; latitude: string; longitude: string
}
const VAZIO: Form = {
  codigo: '', tipo: 'cliente', pessoa: 'F', cpf_cnpj: '', nome: '', fantasia: '', inscricao_estadual: '', telefone: '', celular: '',
  email: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'SP', latitude: '', longitude: '',
  limite_credito: '', dia_entrega: '', nome_mistura: '', observacoes: '', ativo: true,
}

function formatarDocumento(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

export function PessoasPage() {
  const { pode } = useAuth()
  const [lista, setLista] = useState<Pessoa[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [tipo, setTipo] = useState<'' | Pessoa['tipo']>('')
  const [form, setForm] = useState<Form | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLista(null)
    let q = supabase.from('pessoas').select('*', { count: 'exact' }).eq('ativo', true)
    if (tipo) q = q.in('tipo', tipo === 'ambos' ? ['ambos'] : [tipo, 'ambos'])
    const termo = limparBusca(buscaAplicada)
    if (termo) {
      const digitos = termo.replace(/\D/g, '')
      if (digitos.length >= 3 && digitos.length === termo.replace(/[.\-/\s]/g, '').length)
        q = q.or(`cpf_cnpj.ilike.%${formatarDocumento(digitos)}%,codigo.eq.${digitos},telefone.ilike.%${digitos}%,celular.ilike.%${digitos}%`)
      else termo.split(/\s+/).forEach(p => { q = q.or(`nome.ilike.%${p}%,fantasia.ilike.%${p}%`) })
    }
    const { data, count, error } = await q.order('nome').range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
    if (error) setErro(mensagemErro(error))
    setLista((data as Pessoa[]) ?? []); setTotal(count ?? 0)
  }, [buscaAplicada, tipo, pagina])
  useEffect(() => { void carregar() }, [carregar])

  if (!pode('cadastros.pessoas')) return <SemPermissao />
  const podeEditar = pode('cadastros.pessoas', 'editar')

  function abrir(p?: Pessoa) {
    setErro('')
    setForm(p ? { ...p, limite_credito: p.limite_credito == null ? '' : String(p.limite_credito).replace('.', ','),
      latitude: p.latitude == null ? '' : String(p.latitude), longitude: p.longitude == null ? '' : String(p.longitude) } : { ...VAZIO })
  }

  /** Aceita "-22.73, -45.12" colado do Google Maps no campo de latitude. */
  function colarCoordenadas(texto: string) {
    const m = texto.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/)
    if (m) setForm(f => f && ({ ...f, latitude: m[1], longitude: m[2] }))
    else setForm(f => f && ({ ...f, latitude: texto, longitude: '' }))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setSalvando(true); setErro('')
    const { id, ...f } = form
    const limpo = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v]))
    const dados = {
      ...limpo,
      nome: f.nome.trim(),
      pessoa: f.cpf_cnpj && f.cpf_cnpj.replace(/\D/g, '').length > 11 ? 'J' : 'F',
      uf: f.uf ? f.uf.toUpperCase() : null,
      limite_credito: lerNumero(f.limite_credito),
      latitude: lerNumero(f.latitude.replace(',', '.')), longitude: lerNumero(f.longitude.replace(',', '.')),
    }
    const { error } = id ? await supabase.from('pessoas').update(dados).eq('id', id) : await supabase.from('pessoas').insert(dados)
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setForm(null); await carregar()
  }

  const campo = (k: keyof Form, rotulo: string, classe = '', extra: Record<string, unknown> = {}) => (
    <div className={classe}>
      <label className="rotulo" htmlFor={`pes-${k}`}>{rotulo}</label>
      <input id={`pes-${k}`} className="campo" disabled={!podeEditar && !!form?.id} value={(form?.[k] as string | null) ?? ''}
        onChange={e => setForm(f => f && ({ ...f, [k]: e.target.value }))} {...extra} />
    </div>
  )
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina titulo="Clientes e fornecedores" descricao={`${total.toLocaleString('pt-BR')} cadastro(s)`}
        acoes={pode('cadastros.pessoas', 'criar') && <button className="btn-primario" onClick={() => abrir()}>Novo cadastro</button>} />
      {erro && !form && <div className="mb-3"><Aviso>{erro}</Aviso></div>}

      <form onSubmit={e => { e.preventDefault(); setPagina(0); setBuscaAplicada(busca) }} className="cartao mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-56 flex-1">
          <label className="rotulo" htmlFor="busca-pes">Buscar</label>
          <input id="busca-pes" className="campo" placeholder="Nome, CPF/CNPJ, telefone ou código" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="tipo-pes">Tipo</label>
          <select id="tipo-pes" className="campo" value={tipo} onChange={e => { setPagina(0); setTipo(e.target.value as typeof tipo) }}>
            <option value="">Todos</option><option value="cliente">Clientes</option><option value="fornecedor">Fornecedores</option>
          </select>
        </div>
        <button type="submit" className="btn-primario">Buscar</button>
      </form>

      <div className="cartao overflow-x-auto">
        {!lista ? <Carregando /> : lista.length === 0 ? <Vazio>{buscaAplicada ? 'Nada encontrado.' : 'Nenhum cadastro ainda.'}</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Nome</th><th>CPF/CNPJ</th><th>Telefone</th><th>Cidade</th><th>Entrega</th><th>Tipo</th><th /></tr></thead>
            <tbody>
              {lista.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">{p.nome}{p.fantasia && <span className="block text-xs font-normal text-stone-500">{p.fantasia}</span>}</td>
                  <td className="whitespace-nowrap">{p.cpf_cnpj ?? '—'}</td>
                  <td className="whitespace-nowrap">{p.celular ?? p.telefone ?? '—'}</td>
                  <td>{p.cidade ? `${p.cidade}${p.uf ? '/' + p.uf : ''}` : '—'}</td>
                  <td className="text-xs">
                    {p.dia_entrega && <Selo cor="ambar">{p.dia_entrega}</Selo>}
                    {p.latitude !== null && <span className="ml-1 text-emerald-700" title="Localização cadastrada">📍</span>}
                    {p.nome_mistura && <span className="ml-1 text-stone-500">{p.nome_mistura}</span>}
                  </td>
                  <td><Selo>{TIPOS[p.tipo]}</Selo></td>
                  <td className="text-right"><button className="text-sm text-marca-700 hover:underline" onClick={() => abrir(p)}>{podeEditar ? 'Editar' : 'Ver'}</button></td>
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

      <Modal titulo={form?.id ? form.nome : 'Novo cadastro'} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-3xl"
        rodape={<>
          <button className="btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
          {(podeEditar || !form?.id) && <button type="submit" form="form-pessoa" className="btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>}
        </>}>
        {form && (
          <form id="form-pessoa" onSubmit={salvar} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            {erro && <div className="sm:col-span-6"><Aviso>{erro}</Aviso></div>}
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="pes-tipo">Tipo</label>
              <select id="pes-tipo" className="campo" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as Pessoa['tipo'] })}>
                {Object.entries(TIPOS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="pes-doc">CPF ou CNPJ</label>
              <input id="pes-doc" className="campo" inputMode="numeric" value={form.cpf_cnpj ?? ''} onChange={e => setForm({ ...form, cpf_cnpj: formatarDocumento(e.target.value) })} />
            </div>
            {campo('codigo', 'Código (Microvix)', 'sm:col-span-2')}
            {campo('nome', 'Nome / razão social', 'sm:col-span-4', { required: true })}
            {campo('fantasia', 'Apelido / fantasia', 'sm:col-span-2')}
            {campo('celular', 'Celular / WhatsApp', 'sm:col-span-2', { type: 'tel' })}
            {campo('telefone', 'Telefone', 'sm:col-span-2', { type: 'tel' })}
            {campo('email', 'E-mail', 'sm:col-span-2', { type: 'email' })}
            {campo('cep', 'CEP', 'sm:col-span-2', { inputMode: 'numeric' })}
            {campo('logradouro', 'Endereço', 'sm:col-span-3')}
            {campo('numero', 'Número', 'sm:col-span-1')}
            {campo('bairro', 'Bairro', 'sm:col-span-2')}
            {campo('cidade', 'Cidade', 'sm:col-span-3')}
            {campo('uf', 'UF', 'sm:col-span-1', { maxLength: 2 })}
            {campo('complemento', 'Complemento / referência', 'sm:col-span-6')}

            <fieldset className="rounded-md border border-stone-200 p-3 sm:col-span-6">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Entrega</legend>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="rotulo" htmlFor="pes-lat">Localização (cole do Google Maps)</label>
                  <input id="pes-lat" className="campo" placeholder="-22.7311, -45.1245" value={form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : form.latitude}
                    onChange={e => colarCoordenadas(e.target.value)} />
                  {form.latitude && form.longitude && (
                    <a className="mt-1 inline-block text-xs text-sky-700 hover:underline" target="_blank" rel="noreferrer"
                      href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}>Ver no mapa</a>
                  )}
                </div>
                <div>
                  <label className="rotulo" htmlFor="pes-dia">Dia fixo de entrega</label>
                  <select id="pes-dia" className="campo" value={form.dia_entrega ?? ''} onChange={e => setForm({ ...form, dia_entrega: e.target.value })}>
                    {DIAS.map(d => <option key={d} value={d}>{d || 'livre'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rotulo" htmlFor="pes-mist">Nome da mistura</label>
                  <input id="pes-mist" className="campo" placeholder="ex.: Mistura do Guisinho" value={form.nome_mistura ?? ''} onChange={e => setForm({ ...form, nome_mistura: e.target.value })} />
                </div>
              </div>
            </fieldset>

            {campo('limite_credito', 'Limite de crédito (R$)', 'sm:col-span-2', { inputMode: 'decimal' })}
            {campo('inscricao_estadual', 'Inscrição estadual', 'sm:col-span-2')}
            <div className="sm:col-span-6">
              <label className="rotulo" htmlFor="pes-obs">Observações</label>
              <textarea id="pes-obs" rows={2} className="campo" value={form.observacoes ?? ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            {form.id && (
              <label className="flex items-center gap-2 text-sm sm:col-span-6">
                <input type="checkbox" className="h-4 w-4 accent-marca-600" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
                Cadastro ativo {form.limite_credito && <span className="text-stone-400">· limite {moeda(lerNumero(form.limite_credito))}</span>}
              </label>
            )}
          </form>
        )}
      </Modal>
    </div>
  )
}
