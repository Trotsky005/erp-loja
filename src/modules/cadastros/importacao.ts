// Leitura dos arquivos de produtos exportados do Microvix e comparação com o cadastro.
// Formatos aceitos:
//  • Relatório "Registro de Inventário" / "Produtos Cadastrados" exportado como .xls
//    (o Microvix gera uma página HTML com tabela, mesmo com extensão .xls)
//  • CSV com cabeçalho (separador ; ou ,)

import { lerNumero } from '../../lib/formato'

export interface ProdutoArquivo {
  codigo: string
  descricao: string
  referencia: string | null
  unidade: string
  ncm: string | null
  preco_venda: number | null
  grupo: string | null
  config_microvix: string | null   // texto da coluna "Conf. Tribut."
  peso_kg: number | null           // peso bruto/líquido do Microvix, quando preenchido
}

/** Nomes de coluna aceitos (sem acento, minúsculo) → campo. */
const COLUNAS: Record<string, keyof ProdutoArquivo> = {
  'codigo': 'codigo', 'cod': 'codigo', 'cod.': 'codigo', 'codigo do produto': 'codigo',
  'descricao': 'descricao', 'produto': 'descricao', 'nome': 'descricao',
  'referencia': 'referencia', 'ref.': 'referencia',
  'und.': 'unidade', 'und': 'unidade', 'unidade': 'unidade', 'un': 'unidade',
  'ncm': 'ncm',
  'preco de venda unit.': 'preco_venda', 'preco de venda': 'preco_venda', 'preco_venda': 'preco_venda', 'preco': 'preco_venda',
  'conf. tribut.': 'config_microvix', 'configuracao tributaria': 'config_microvix',
  'peso bruto (kg)': 'peso_kg', 'peso liq. (kg)': 'peso_kg', 'peso (kg)': 'peso_kg', 'peso': 'peso_kg', 'peso_kg': 'peso_kg',
  'linha': 'grupo', 'grupo': 'grupo', 'setor': 'grupo',
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Converte as linhas de uma tabela (lista de células) em produtos.
 * Reconhece a linha de cabeçalho pelos nomes das colunas e as linhas de
 * agrupamento do Microvix (ex.: ["", "1-GERAL"]) como grupo do produto.
 */
export function linhasParaProdutos(linhas: string[][]): { produtos: ProdutoArquivo[]; avisos: string[] } {
  const avisos: string[] = []
  let mapa: Partial<Record<keyof ProdutoArquivo, number>> | null = null
  let grupoAtual: string | null = null
  const porCodigo = new Map<string, ProdutoArquivo>()

  for (const celulas of linhas) {
    const c = celulas.map(x => (x ?? '').trim())
    if (c.every(x => !x)) continue

    // cabeçalho
    const nomes = c.map(normalizar)
    if (nomes.includes('codigo') && (nomes.includes('descricao') || nomes.includes('produto'))) {
      mapa = {}
      nomes.forEach((n, i) => {
        const campo = COLUNAS[n]
        if (campo && mapa![campo] === undefined) mapa![campo] = i
      })
      continue
    }
    if (!mapa) continue

    // agrupamento do Microvix: primeira célula vazia e um título
    if (c.length <= 3 && !c[0] && c[1]) { grupoAtual = c[1].replace(/^\d+\s*-\s*/, '').trim() || null; continue }

    const pega = (campo: keyof ProdutoArquivo) => {
      const i = mapa![campo]
      return i === undefined ? '' : (c[i] ?? '')
    }
    const codigo = pega('codigo')
    const descricao = pega('descricao')
    if (!codigo || !descricao || normalizar(codigo).startsWith('total')) continue

    const peso = lerNumero(pega('peso_kg'))
    const p: ProdutoArquivo = {
      codigo,
      descricao: descricao.replace(/\s+/g, ' '),
      referencia: pega('referencia') || null,
      unidade: (pega('unidade') || 'UN').toUpperCase(),
      ncm: pega('ncm').replace(/\D/g, '') || null,
      preco_venda: lerNumero(pega('preco_venda')),
      grupo: pega('grupo') || grupoAtual,
      config_microvix: pega('config_microvix') || null,
      peso_kg: peso && peso > 0 ? peso : null,
    }
    if (porCodigo.has(codigo)) avisos.push(`Código ${codigo} aparece mais de uma vez; ficou a última linha.`)
    porCodigo.set(codigo, p)
  }
  if (!mapa) avisos.push('Não encontrei a linha de cabeçalho (colunas "Código" e "Descrição").')
  return { produtos: [...porCodigo.values()], avisos }
}

/** Lê o arquivo escolhido pelo usuário (HTML do Microvix ou CSV) e devolve as linhas da tabela. */
export async function lerArquivo(arquivo: File): Promise<string[][]> {
  const texto = await arquivo.text()
  if (/<table/i.test(texto)) {
    const doc = new DOMParser().parseFromString(texto, 'text/html')
    return [...doc.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(td => (td.textContent ?? '').trim()))
  }
  return lerCsv(texto)
}

export function lerCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let linha: string[] = [], campo = '', aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') aspas = false
      else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); linhas.push(linha); linha = []; campo = ''
    } else campo += ch
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

/** Código numérico com tamanho de código de barras (EAN-8/UPC-12/EAN-13/DUN-14). */
export const pareceCodigoBarras = (codigo: string) => /^\d+$/.test(codigo) && [8, 12, 13, 14].includes(codigo.length)

const UNIDADES_COM_PESO_NO_NOME = new Set(['UN', 'SC', 'PC', 'FD', 'PAC', 'PCT', 'BD', 'CX', 'GL', 'BL'])

/**
 * Sugere o peso a partir do nome (ex.: "RACAO X 15KG" → 15). Só para produtos
 * vendidos por unidade/saco; produtos vendidos por KG/metro ficam sem sugestão.
 * Ignora faixas ("22 A 45KG", "7,6 - 15KG" = peso do animal nos vermífugos)
 * e produtos com dosagem em MG/ML, que costumam ser remédios.
 */
export function sugerirPeso(descricao: string, unidade: string): number | null {
  if (!UNIDADES_COM_PESO_NO_NOME.has(unidade.toUpperCase())) return null
  const d = descricao.toUpperCase()
  if (/\d\s*(MG|MCG)(?![A-Z])/.test(d)) return null
  const achados = [...d.matchAll(/(\d+(?:[.,]\d+)?)\s*(KG|KGS)(?![A-Z])/g)]
  if (achados.length !== 1) return null                      // nenhum ou ambíguo (ex.: "2KG E 5KG")
  const antes = d.slice(0, achados[0].index)
  if (/\d\s*(A|-|ATE|À|AO)\s*$/.test(antes)) return null      // faixa de peso
  const n = Number(achados[0][1].replace(',', '.'))
  return n > 0 && n <= 1000 ? n : null
}

// ---- Configuração tributária a partir do texto do Microvix ----

export interface NovaConfigTributaria {
  nome: string
  descricao_microvix: string
  cst_compra: string
  cst_venda_interna: string
  cst_venda_interestadual: string
  pis_cofins_cst: string
  beneficio_interno: string | null
  beneficio_interestadual: string | null
  reducao_base_interestadual: number
  observacao: string | null
}

/**
 * Lê textos como "Lucro Real - CST 0.40 | 0.40 | 0.20 - PIS/COFINS 01 - SP010410 | SP020090 - 0% | 60% (26)".
 * Regra da empresa: 3 CSTs = compra | venda dentro do estado | venda fora do estado;
 * 2 CSTs = compra | venda (igual dentro e fora).
 */
export function lerConfigMicrovix(texto: string): NovaConfigTributaria | null {
  const mCst = texto.match(/CST\s+([\d.]+(?:\s*\|\s*[\d.]+)*)/i)
  const mPis = texto.match(/PIS\/COFINS\s+(\d{2})/i)
  if (!mCst || !mPis) return null
  const csts = mCst[1].split('|').map(x => x.trim().replace('.', '').padStart(3, '0'))
  const [compra, interna, inter] =
    csts.length >= 3 ? [csts[0], csts[1], csts[2]] : csts.length === 2 ? [csts[0], csts[1], csts[1]] : [csts[0], csts[0], csts[0]]
  const beneficios = [...texto.matchAll(/\b([A-Z]{2}\d{6})\b/g)].map(m => m[1])
  const percentuais = [...texto.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map(m => Number(m[1].replace(',', '.')))
  const id = texto.match(/\((\d+)\)\s*$/)?.[1]
  const partes = [`compra ${compra}`, interna === inter ? `venda ${interna}` : `SP ${interna} / fora ${inter}`, `PIS/COFINS ${mPis[1]}`]
  if (beneficios.length) partes.push(beneficios.join(' | '))
  const reducao = percentuais.length ? percentuais[percentuais.length - 1] : 0
  const observacao = compra === '040' && interna === '000' && beneficios.length
    ? `Conferir com a contabilidade: benefício ${beneficios.join(' | ')} com venda tributada (000).`
    : null
  return {
    nome: `CST ${partes.join(' · ')}${id ? ` (#${id})` : ''}`,
    descricao_microvix: texto,
    cst_compra: compra,
    cst_venda_interna: interna,
    cst_venda_interestadual: inter,
    pis_cofins_cst: mPis[1],
    beneficio_interno: beneficios[0] ?? null,
    beneficio_interestadual: beneficios[1] ?? null,
    reducao_base_interestadual: reducao,
    observacao,
  }
}

// ---- Comparação com o cadastro atual ----

export interface ProdutoAtual {
  codigo: string
  descricao: string
  referencia: string | null
  unidade: string
  ncm: string | null
  preco_venda: number
  grupo: string | null
  config_tributaria_id: string | null
  codigo_barras: string | null
  peso_kg: number | null
  peso_sugerido_kg: number | null
}

export interface LinhaImportacao {
  codigo: string
  descricao: string
  referencia: string | null
  unidade: string
  ncm: string | null
  preco_venda: number
  grupo: string | null
  config_tributaria_id: string | null
  codigo_barras: string | null
  peso_kg: number | null
  peso_sugerido_kg: number | null
}

export interface ResultadoComparacao {
  novos: LinhaImportacao[]
  alterados: { linha: LinhaImportacao; campos: string[] }[]
  iguais: number
  configsDesconhecidas: Map<string, number>
}

const CAMPOS_COMPARADOS: (keyof LinhaImportacao)[] =
  ['descricao', 'referencia', 'unidade', 'ncm', 'preco_venda', 'grupo', 'config_tributaria_id']

/**
 * Compara o arquivo com o cadastro. Nunca apaga o peso já cadastrado:
 * o peso do arquivo só entra se o produto ainda não tem peso.
 */
export function comparar(
  arquivo: ProdutoArquivo[],
  atuais: Map<string, ProdutoAtual>,
  configPorTexto: Map<string, string>,
): ResultadoComparacao {
  const novos: LinhaImportacao[] = []
  const alterados: { linha: LinhaImportacao; campos: string[] }[] = []
  const configsDesconhecidas = new Map<string, number>()
  let iguais = 0

  for (const p of arquivo) {
    let configId: string | null = null
    if (p.config_microvix) {
      configId = configPorTexto.get(p.config_microvix) ?? null
      if (!configId) configsDesconhecidas.set(p.config_microvix, (configsDesconhecidas.get(p.config_microvix) ?? 0) + 1)
    }
    const atual = atuais.get(p.codigo)
    const linha: LinhaImportacao = {
      codigo: p.codigo,
      descricao: p.descricao,
      referencia: p.referencia ?? atual?.referencia ?? null,
      unidade: p.unidade,
      ncm: p.ncm ?? atual?.ncm ?? null,
      preco_venda: p.preco_venda ?? atual?.preco_venda ?? 0,
      grupo: p.grupo ?? atual?.grupo ?? null,
      config_tributaria_id: configId ?? atual?.config_tributaria_id ?? null,
      codigo_barras: atual?.codigo_barras ?? (pareceCodigoBarras(p.codigo) ? p.codigo : null),
      peso_kg: atual?.peso_kg ?? p.peso_kg,
      peso_sugerido_kg: atual
        ? atual.peso_sugerido_kg
        : (p.peso_kg ? null : sugerirPeso(p.descricao, p.unidade)),
    }
    if (!atual) { novos.push(linha); continue }
    const campos = CAMPOS_COMPARADOS.filter(k => (linha[k] ?? null) !== (atual[k as keyof ProdutoAtual] ?? null))
    if (atual.peso_kg === null && linha.peso_kg !== null) campos.push('peso_kg')
    if (campos.length) alterados.push({ linha, campos })
    else iguais++
  }
  return { novos, alterados, iguais, configsDesconhecidas }
}
