import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { limparBusca, moeda, numero } from '../../lib/formato'
import type { Pessoa, Produto } from '../../lib/tipos'

/** Atrasa a busca enquanto a pessoa digita. */
function useAtraso<T>(valor: T, ms = 250) {
  const [v, setV] = useState(valor)
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t) }, [valor, ms])
  return v
}

async function buscarProdutos(termo: string): Promise<Produto[]> {
  const t = limparBusca(termo)
  if (!t) return []
  let q = supabase.from('produtos').select('*').eq('ativo', true)
  if (/^\d+$/.test(t)) {
    // código ou código de barras exato primeiro
    const { data } = await supabase.from('produtos').select('*').eq('ativo', true).or(`codigo.eq.${t},codigo_barras.eq.${t}`).limit(5)
    if (data && data.length) return data as Produto[]
    q = q.or(`codigo.ilike.${t}%,descricao.ilike.%${t}%`)
  } else {
    t.split(/\s+/).forEach(p => { q = q.ilike('descricao', `%${p}%`) })
  }
  const { data } = await q.order('descricao').limit(20)
  return (data as Produto[]) ?? []
}

/**
 * Campo de busca de produto. Enter com um único resultado (ex.: leitor de
 * código de barras) já adiciona o produto.
 */
export function BuscaProduto({ aoEscolher, autoFocus }: { aoEscolher: (p: Produto) => void; autoFocus?: boolean }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Produto[]>([])
  const [ativo, setAtivo] = useState(0)
  const [aberto, setAberto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const termo = useAtraso(texto)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vale = true
    if (!termo.trim()) { setResultados([]); return }
    setBuscando(true)
    void buscarProdutos(termo).then(r => { if (vale) { setResultados(r); setAtivo(0); setBuscando(false) } })
    return () => { vale = false }
  }, [termo])

  function escolher(p: Produto) {
    aoEscolher(p)
    setTexto(''); setResultados([]); setAberto(false)
    campo.current?.focus()
  }

  async function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Escape') setAberto(false)
    else if (e.key === 'Enter') {
      e.preventDefault()
      // leitor de código de barras digita rápido e aperta Enter antes da busca atrasada
      const lista = termo === texto ? resultados : await buscarProdutos(texto)
      if (lista[ativo] ?? lista[0]) escolher(lista[ativo] ?? lista[0])
    }
  }

  return (
    <div className="relative">
      <input ref={campo} className="campo" autoFocus={autoFocus} value={texto} aria-label="Buscar produto"
        placeholder="Produto: código, código de barras ou nome (ex.: racao 15kg)"
        onChange={e => { setTexto(e.target.value); setAberto(true) }} onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)} onKeyDown={e => void tecla(e)} />
      {aberto && texto.trim() && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
          {buscando && !resultados.length ? <div className="px-3 py-2 text-sm text-stone-500">Buscando…</div>
            : !resultados.length ? <div className="px-3 py-2 text-sm text-stone-500">Nenhum produto encontrado.</div>
            : resultados.map((p, i) => (
              <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => escolher(p)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === ativo ? 'bg-marca-50' : 'hover:bg-stone-50'}`}>
                <span className="w-20 shrink-0 font-mono text-xs text-stone-500">{p.codigo}</span>
                <span className="flex-1">{p.descricao}</span>
                <span className="text-xs text-stone-500">{p.unidade}{p.peso_kg !== null && ` · ${numero(Number(p.peso_kg))} kg`}</span>
                <span className="w-24 text-right font-medium">{moeda(Number(p.preco_venda))}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export function BuscaCliente({ valor, aoEscolher }: { valor: Pessoa | null; aoEscolher: (p: Pessoa | null) => void }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Pessoa[]>([])
  const [aberto, setAberto] = useState(false)
  const termo = useAtraso(texto)

  useEffect(() => {
    let vale = true
    const t = limparBusca(termo)
    if (!t) { setResultados([]); return }
    let q = supabase.from('pessoas').select('*').eq('ativo', true).in('tipo', ['cliente', 'ambos'])
    const dig = t.replace(/\D/g, '')
    if (dig.length >= 3 && dig.length === t.replace(/[.\-/\s()]/g, '').length) q = q.or(`cpf_cnpj.ilike.%${dig}%,celular.ilike.%${dig}%,telefone.ilike.%${dig}%,codigo.eq.${dig}`)
    else t.split(/\s+/).forEach(p => { q = q.or(`nome.ilike.%${p}%,fantasia.ilike.%${p}%`) })
    void q.order('nome').limit(15).then(({ data }) => { if (vale) setResultados((data as Pessoa[]) ?? []) })
    return () => { vale = false }
  }, [termo])

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm">
        <div>
          <div className="font-medium">{valor.nome}{valor.fantasia && <span className="font-normal text-stone-500"> ({valor.fantasia})</span>}</div>
          <div className="text-xs text-stone-500">{[valor.cpf_cnpj, valor.celular ?? valor.telefone, valor.cidade].filter(Boolean).join(' · ') || 'sem dados de contato'}</div>
        </div>
        <button type="button" className="text-xs text-marca-700 hover:underline" onClick={() => aoEscolher(null)}>trocar</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input className="campo" value={texto} aria-label="Buscar cliente" placeholder="Cliente: nome, CPF/CNPJ ou telefone"
        onChange={e => { setTexto(e.target.value); setAberto(true) }} onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)} />
      {aberto && texto.trim() && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
          {!resultados.length ? <div className="px-3 py-2 text-sm text-stone-500">Nenhum cliente encontrado. Cadastre em Cadastros › Clientes.</div>
            : resultados.map(p => (
              <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { aoEscolher(p); setTexto('') }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50">
                <span className="font-medium">{p.nome}</span>{p.fantasia && <span className="text-stone-500"> ({p.fantasia})</span>}
                <span className="block text-xs text-stone-500">{[p.cpf_cnpj, p.celular ?? p.telefone, p.cidade].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
