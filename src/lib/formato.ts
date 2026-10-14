// Formatação e leitura de números no padrão brasileiro

export const moeda = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const numero = (v: number | null | undefined, casas = 3) =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas })

/** Lê "1.234,56", "1234,56" ou "1234.56" e devolve número (ou null). */
export function lerNumero(texto: string | null | undefined): number | null {
  if (texto === null || texto === undefined) return null
  let s = String(texto).trim().replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Remove caracteres que quebram filtros da API (vírgula, parênteses). */
export const limparBusca = (t: string) => t.replace(/[,()*%\\]/g, ' ').trim()

const FUSO = 'America/Sao_Paulo'

/** "2026-10-14" ou timestamp → "14/10/2026" */
export function dataBR(v: string | null | undefined) {
  if (!v) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [a, m, d] = v.split('-'); return `${d}/${m}/${a}` }
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: FUSO })
}

export const dataHoraBR = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }) : '—'

/** Data de hoje no fuso da loja, no formato do banco (AAAA-MM-DD). */
export function hojeISO(diasAMais = 0) {
  const d = new Date(Date.now() + diasAMais * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: FUSO })
}

/** Número do romaneio com 4 dígitos (0127). */
export const numRomaneio = (n: number) => String(n).padStart(4, '0')

/** Quantidade sem casas desnecessárias (10, 2,5, 0,375). */
export const qtd = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
