import { useState } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import { Aviso, Modal } from '../../core/ui/componentes'
import {
  comparar, lerArquivo, lerConfigMicrovix, linhasParaProdutos,
  type ProdutoAtual, type ProdutoArquivo, type ResultadoComparacao,
} from './importacao'

type Etapa = 'escolher' | 'analisando' | 'resumo' | 'gravando' | 'pronto'
const LOTE = 500
const NOMES_CAMPO: Record<string, string> = {
  descricao: 'descrição', referencia: 'referência', unidade: 'unidade', ncm: 'NCM',
  preco_venda: 'preço', grupo: 'grupo', config_tributaria_id: 'impostos', peso_kg: 'peso',
}

/** Busca todas as linhas de uma tabela, de 1000 em 1000 (limite da API). */
async function buscarTudo<T>(tabela: string, colunas: string): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select(colunas).order('codigo').range(de, de + 999)
    if (error) throw error
    todos.push(...((data ?? []) as unknown as T[]))
    if (!data || data.length < 1000) return todos
  }
}

export function ImportarProdutos({ aberto, aoFechar, aoConcluir }: { aberto: boolean; aoFechar: () => void; aoConcluir: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>('escolher')
  const [erro, setErro] = useState('')
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [arquivo, setArquivo] = useState<ProdutoArquivo[]>([])
  const [resultado, setResultado] = useState<ResultadoComparacao | null>(null)
  const [configsCriadas, setConfigsCriadas] = useState(0)
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 })

  function fechar() {
    if (etapa === 'gravando') return
    setEtapa('escolher'); setErro(''); setResultado(null); setArquivo([]); setNomeArquivo('')
    aoFechar()
  }

  async function analisar(f: File) {
    setErro(''); setNomeArquivo(f.name); setEtapa('analisando')
    try {
      const { produtos, avisos } = linhasParaProdutos(await lerArquivo(f))
      if (!produtos.length) throw new Error(avisos[0] ?? 'Nenhum produto encontrado no arquivo.')
      setArquivo(produtos)

      // cria as configurações tributárias que ainda não existem
      const { data: cfg, error: e1 } = await supabase.from('config_tributarias').select('id, descricao_microvix')
      if (e1) throw e1
      const existentes = new Set((cfg ?? []).map(c => c.descricao_microvix))
      const novas = [...new Set(produtos.map(p => p.config_microvix).filter((t): t is string => !!t && !existentes.has(t)))]
        .map(lerConfigMicrovix).filter(c => c !== null)
      if (novas.length) {
        const { error } = await supabase.from('config_tributarias').insert(novas)
        if (error) throw error
      }
      setConfigsCriadas(novas.length)
      const { data: cfg2, error: e2 } = await supabase.from('config_tributarias').select('id, descricao_microvix')
      if (e2) throw e2
      const configPorTexto = new Map<string, string>((cfg2 ?? []).filter(c => c.descricao_microvix).map(c => [c.descricao_microvix as string, c.id as string] as [string, string]))

      const atuais = await buscarTudo<ProdutoAtual>('produtos',
        'codigo, descricao, referencia, unidade, ncm, preco_venda, grupo, config_tributaria_id, codigo_barras, peso_kg, peso_sugerido_kg')
      setResultado(comparar(produtos, new Map<string, ProdutoAtual>(atuais.map(a => [a.codigo, { ...a, preco_venda: Number(a.preco_venda), peso_kg: a.peso_kg === null ? null : Number(a.peso_kg), peso_sugerido_kg: a.peso_sugerido_kg === null ? null : Number(a.peso_sugerido_kg) }] as [string, ProdutoAtual])), configPorTexto))
      setEtapa('resumo')
    } catch (e) {
      setErro(mensagemErro(e)); setEtapa('escolher')
    }
  }

  async function gravar() {
    if (!resultado) return
    const linhas = [...resultado.novos, ...resultado.alterados.map(a => a.linha)]
    setEtapa('gravando'); setErro(''); setProgresso({ feito: 0, total: linhas.length })
    try {
      for (let i = 0; i < linhas.length; i += LOTE) {
        const lote = linhas.slice(i, i + LOTE)
        const { error } = await supabase.from('produtos').upsert(lote, { onConflict: 'codigo' })
        if (error) throw error
        setProgresso({ feito: Math.min(i + LOTE, linhas.length), total: linhas.length })
      }
      setEtapa('pronto')
      aoConcluir()
    } catch (e) {
      setErro(`Parou em ${progresso.feito} de ${linhas.length}: ${mensagemErro(e)}. Pode importar de novo: o que já foi gravado não se repete.`)
      setEtapa('resumo')
    }
  }

  const alteradosPorCampo = new Map<string, number>()
  resultado?.alterados.forEach(a => a.campos.forEach(c => alteradosPorCampo.set(c, (alteradosPorCampo.get(c) ?? 0) + 1)))
  const comSugestao = resultado?.novos.filter(n => n.peso_sugerido_kg !== null).length ?? 0

  return (
    <Modal titulo="Importar produtos do Microvix" aberto={aberto} aoFechar={fechar} largura="max-w-2xl"
      rodape={
        etapa === 'resumo' ? <>
          <button className="btn-secundario" onClick={fechar}>Cancelar</button>
          <button className="btn-primario" disabled={!resultado || resultado.novos.length + resultado.alterados.length === 0} onClick={() => void gravar()}>
            Gravar {(resultado?.novos.length ?? 0) + (resultado?.alterados.length ?? 0)} produtos
          </button>
        </> : etapa === 'pronto' ? <button className="btn-primario" onClick={fechar}>Fechar</button> : undefined
      }>
      <div className="space-y-4 text-sm">
        {erro && <Aviso>{erro}</Aviso>}

        {etapa === 'escolher' && <>
          <p className="text-stone-600">
            No Microvix, gere o relatório <strong>Registro de Inventário</strong> (ou Produtos Cadastrados) e exporte em Excel.
            Também aceito CSV com as colunas <em>código, descrição, unidade, NCM, preço</em>.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-stone-600">
            <li>Produtos novos são cadastrados; os que já existem têm descrição, preço, NCM, unidade e impostos atualizados.</li>
            <li>O <strong>peso já cadastrado nunca é apagado</strong> pela importação.</li>
            <li>Nada é gravado antes de você ver o resumo e confirmar.</li>
          </ul>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-stone-300 p-8 text-center hover:border-marca-500 hover:bg-marca-50/40">
            <span className="font-medium text-stone-800">Escolher arquivo</span>
            <span className="text-xs text-stone-500">.xls exportado do Microvix, .html ou .csv</span>
            <input type="file" accept=".xls,.html,.htm,.csv,.txt" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) void analisar(f) }} />
          </label>
        </>}

        {etapa === 'analisando' && <p className="py-8 text-center text-stone-500">Lendo {nomeArquivo} e comparando com o cadastro…</p>}

        {(etapa === 'resumo' || etapa === 'gravando') && resultado && <>
          <p className="text-stone-600"><strong>{nomeArquivo}</strong>: {arquivo.length.toLocaleString('pt-BR')} produtos no arquivo.</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Novos', resultado.novos.length, 'text-emerald-700'],
              ['Com alteração', resultado.alterados.length, 'text-amber-700'],
              ['Sem mudança', resultado.iguais, 'text-stone-500'],
            ].map(([nome, n, cor]) => (
              <div key={nome as string} className="rounded-lg border border-stone-200 p-3 text-center">
                <div className={`text-2xl font-semibold ${cor}`}>{(n as number).toLocaleString('pt-BR')}</div>
                <div className="text-xs text-stone-500">{nome}</div>
              </div>
            ))}
          </div>
          {alteradosPorCampo.size > 0 && (
            <p className="text-stone-600">
              Alterações: {[...alteradosPorCampo].map(([c, n]) => `${NOMES_CAMPO[c] ?? c} (${n.toLocaleString('pt-BR')})`).join(', ')}.
            </p>
          )}
          {configsCriadas > 0 && <Aviso tipo="info">{configsCriadas} configuraç{configsCriadas === 1 ? 'ão tributária nova foi cadastrada' : 'ões tributárias novas foram cadastradas'} a partir do arquivo.</Aviso>}
          {comSugestao > 0 && <Aviso tipo="info">{comSugestao.toLocaleString('pt-BR')} produtos novos vão com <strong>peso sugerido pelo nome</strong> (ex.: "15KG"). Confira e aceite em Produtos › filtro "Peso sugerido".</Aviso>}
          {resultado.configsDesconhecidas.size > 0 && (
            <Aviso>Não consegui ler {resultado.configsDesconhecidas.size} configuração(ões) tributária(s); esses produtos ficam sem impostos definidos.</Aviso>
          )}
          {etapa === 'gravando' && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-stone-500">
                <span>Gravando…</span><span>{progresso.feito.toLocaleString('pt-BR')} de {progresso.total.toLocaleString('pt-BR')}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full bg-marca-600 transition-all" style={{ width: `${progresso.total ? (100 * progresso.feito) / progresso.total : 0}%` }} />
              </div>
            </div>
          )}
        </>}

        {etapa === 'pronto' && (
          <Aviso tipo="ok">Importação concluída: {progresso.total.toLocaleString('pt-BR')} produtos gravados.</Aviso>
        )}
      </div>
    </Modal>
  )
}
