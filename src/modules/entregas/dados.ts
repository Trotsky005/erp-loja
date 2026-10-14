// Carrega as entregas com venda, cliente, itens a entregar e produtos
import { supabase } from '../../lib/supabase'
import type { Entrega, Pessoa, Produto, Venda, VendaItemSaldo } from '../../lib/tipos'

export interface ItemEntrega extends VendaItemSaldo { produto: Produto | null }

export interface EntregaCompleta extends Entrega {
  venda: Venda
  cliente: Pessoa | null
  itens: ItemEntrega[]           // só itens com destino entrega e saldo > 0
  peso: number                   // peso estimado do saldo (itens sem peso contam 0)
  semPeso: number                // itens sem peso cadastrado
}

export async function carregarEntregas(status: Entrega['status'][], desde?: string): Promise<EntregaCompleta[]> {
  let q = supabase.from('entregas').select('*, vendas!inner(*)').in('status', status)
  if (desde) q = q.gte('updated_at', desde)
  const { data, error } = await q.order('created_at')
  if (error) throw error
  const entregas = (data ?? []) as (Entrega & { vendas: Venda })[]
  if (!entregas.length) return []

  const vendaIds = entregas.map(e => e.venda_id)
  const clienteIds = [...new Set(entregas.map(e => e.vendas.cliente_id).filter(Boolean) as string[])]
  const [it, cl] = await Promise.all([
    supabase.from('venda_itens_saldo').select('*').in('venda_id', vendaIds).eq('destino', 'entrega').order('ordem'),
    clienteIds.length ? supabase.from('pessoas').select('*').in('id', clienteIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (it.error) throw it.error
  const itens = ((it.data ?? []) as VendaItemSaldo[]).map(i => ({ ...i, quantidade: Number(i.quantidade), saiu: Number(i.saiu), saldo: Number(i.saldo) }))
  const prodIds = [...new Set(itens.map(i => i.produto_id))]
  const { data: prods } = prodIds.length ? await supabase.from('produtos').select('*').in('id', prodIds) : { data: [] }
  const porId = new Map(((prods ?? []) as Produto[]).map(p => [p.id, p] as [string, Produto]))
  const clientes = new Map(((cl.data ?? []) as Pessoa[]).map(c => [c.id, c] as [string, Pessoa]))

  return entregas.map(({ vendas, ...e }) => {
    const meus = itens.filter(i => i.venda_id === e.venda_id && (e.status !== 'a_separar' || i.saldo > 0))
      .map(i => ({ ...i, produto: porId.get(i.produto_id) ?? null }))
    let peso = 0, semPeso = 0
    for (const i of meus) {
      const p = i.produto
      if (!p || p.peso_insignificante) continue
      if (p.peso_kg === null) semPeso++
      else peso += Number(p.peso_kg) * i.saldo
    }
    return { ...e, venda: vendas, cliente: vendas.cliente_id ? clientes.get(vendas.cliente_id) ?? null : null, itens: meus, peso, semPeso }
  })
}
