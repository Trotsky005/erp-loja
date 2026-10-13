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
