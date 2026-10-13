import { useCallback, useEffect, useState } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import type { Parametro } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, SemPermissao } from '../../core/ui/componentes'

/** Converte o texto digitado no tipo certo, de acordo com o valor atual. */
function converter(texto: string, atual: unknown): unknown {
  const t = texto.trim()
  if (t === '') return null
  if (typeof atual === 'boolean') return t === 'true'
  if (typeof atual === 'number' || atual === null) {
    const n = Number(t.replace(',', '.'))
    if (!Number.isNaN(n)) return n
  }
  return t
}

export function ParametrosPage() {
  const { pode } = useAuth()
  const [lista, setLista] = useState<Parametro[] | null>(null)
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('parametros').select('*').order('chave')
    if (error) setErro(mensagemErro(error))
    setLista((data as Parametro[]) ?? [])
    setRascunho({})
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  if (!pode('admin.parametros')) return <SemPermissao />
  const podeEditar = pode('admin.parametros', 'editar')

  async function salvar(p: Parametro) {
    setErro(''); setOk('')
    const valor = p.chave in rascunho ? converter(rascunho[p.chave], p.valor) : p.valor
    const { error } = await supabase.from('parametros').update({ valor }).eq('chave', p.chave)
    if (error) { setErro(mensagemErro(error)); return }
    setOk('Parâmetro salvo.')
    await carregar()
  }

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina titulo="Parâmetros globais" descricao="Regras do sistema que podem ser ajustadas sem mexer no código." />
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      {ok && <div className="mb-4"><Aviso tipo="ok">{ok}</Aviso></div>}
      <div className="cartao divide-y divide-stone-100">
        {!lista ? <Carregando /> : lista.map(p => (
          <div key={p.chave} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-stone-900">{p.descricao ?? p.chave}</div>
              <div className="font-mono text-xs text-stone-400">{p.chave}</div>
            </div>
            {typeof p.valor === 'boolean' ? (
              <select className="campo w-32" disabled={!podeEditar}
                value={rascunho[p.chave] ?? String(p.valor)}
                onChange={e => setRascunho(r => ({ ...r, [p.chave]: e.target.value }))}>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            ) : (
              <input className="campo w-32" disabled={!podeEditar}
                value={rascunho[p.chave] ?? (p.valor === null ? '' : String(p.valor))}
                onChange={e => setRascunho(r => ({ ...r, [p.chave]: e.target.value }))} />
            )}
            {podeEditar && (
              <button className="btn-secundario" disabled={!(p.chave in rascunho)} onClick={() => void salvar(p)}>Salvar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
