// Tipos das tabelas da etapa 1 (ver supabase/migrations)

export type Acao = 'ver' | 'criar' | 'editar' | 'cancelar'

export interface Loja {
  id: string
  codigo: number
  nome: string
  razao_social: string | null
  cnpj: string | null
  inscricao_estadual: string | null
  regime_tributario: 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  telefone: string | null
  email: string | null
  ativo: boolean
}

export interface Perfil {
  id: string
  nome: string
  descricao: string | null
  admin: boolean
  ativo: boolean
}

export interface Recurso {
  codigo: string
  modulo: string
  nome: string
  ordem: number
}

export interface PerfilPermissao {
  perfil_id: string
  recurso: string
  pode_ver: boolean
  pode_criar: boolean
  pode_editar: boolean
  pode_cancelar: boolean
}

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil_id: string | null
  todas_lojas: boolean
  ativo: boolean
  created_at: string
}

export interface Parametro {
  chave: string
  valor: unknown
  descricao: string | null
  updated_at: string
}

export interface RegistroAuditoria {
  id: number
  tabela: string
  registro_id: string | null
  acao: 'INSERT' | 'UPDATE' | 'DELETE'
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  usuario_id: string | null
  data: string
}

// ---- Etapa 2: cadastros ----

export interface ConfigTributaria {
  id: string
  nome: string
  descricao_microvix: string | null
  cst_compra: string
  cst_venda_interna: string
  cst_venda_interestadual: string
  pis_cofins_cst: string
  beneficio_interno: string | null
  beneficio_interestadual: string | null
  reducao_base_interestadual: number
  observacao: string | null
  ativo: boolean
}

export interface Produto {
  id: string
  codigo: string
  codigo_barras: string | null
  referencia: string | null
  descricao: string
  unidade: string
  ncm: string | null
  cest: string | null
  grupo: string | null
  marca: string | null
  preco_venda: number
  preco_custo: number | null
  estoque_minimo: number | null
  peso_kg: number | null
  peso_insignificante: boolean
  peso_sugerido_kg: number | null
  vem_em_saco: boolean
  config_tributaria_id: string | null
  ativo: boolean
}

export interface Pessoa {
  id: string
  codigo: string | null
  tipo: 'cliente' | 'fornecedor' | 'ambos'
  pessoa: 'F' | 'J'
  cpf_cnpj: string | null
  nome: string
  fantasia: string | null
  inscricao_estadual: string | null
  telefone: string | null
  celular: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  latitude: number | null
  longitude: number | null
  limite_credito: number | null
  dia_entrega: string | null
  nome_mistura: string | null
  observacoes: string | null
  ativo: boolean
}

export interface Veiculo {
  id: string
  descricao: string
  placa: string | null
  capacidade_kg: number | null
  ativo: boolean
}

export interface Motorista {
  id: string
  nome: string
  funcao: 'motorista' | 'ajudante' | 'ambos'
  telefone: string | null
  usuario_id: string | null
  veiculo_id: string | null
  ativo: boolean
}

// ---- Etapa 3: vendas e entregas ----

export interface FormaPagamento {
  codigo: string
  nome: string
  ordem: number
  permite_troco: boolean
  ativo: boolean
}

export interface Venda {
  id: string
  numero: number
  loja_id: string
  cliente_id: string | null
  cliente_nome: string | null
  status: 'finalizada' | 'cancelada'
  subtotal: number
  desconto: number
  total: number
  teste: boolean
  nf_numero: string | null
  observacoes: string | null
  entrega_endereco: string | null
  entrega_data: string | null
  entrega_obs: string | null
  cancelada_em: string | null
  motivo_cancelamento: string | null
  created_at: string
  created_by: string | null
}

export interface VendaResumo extends Venda {
  cliente: string | null
  itens_retirar: number
  itens_entregar: number
  entrega_id: string | null
  entrega_status: StatusEntrega | null
}

export interface VendaItemSaldo {
  id: string
  venda_id: string
  ordem: number
  produto_id: string
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  preco_unitario: number
  desconto: number
  total: number
  destino: 'balcao' | 'entrega'
  saiu: number
  saldo: number
}

export interface VendaPagamento {
  id: string
  venda_id: string
  forma: string
  valor: number
  parcelas: number
}

export type StatusEntrega = 'a_separar' | 'em_rota' | 'entregue' | 'cancelada'

export interface Entrega {
  id: string
  venda_id: string
  status: StatusEntrega
  romaneio_id: string | null
  endereco: string | null
  data_prevista: string | null
  observacao: string | null
  created_at: string
}

export interface Romaneio {
  id: string
  numero: number
  data: string
  motorista_id: string | null
  ajudante_id: string | null
  veiculo_id: string | null
  status: 'em_rota' | 'finalizado' | 'cancelado'
  peso_total: number
  sacos: number
  observacao: string | null
  finalizado_em: string | null
  motivo_cancelamento: string | null
  created_at: string
}

export interface RomaneioEntrega {
  romaneio_id: string
  entrega_id: string
  ordem: number
  mistura: boolean
  mistura_nome: string | null
  mistura_sacos: number | null
  mistura_peso_saco: number | null
  resultado: 'entregue' | 'parcial' | 'nao_entregue' | null
  obs_retorno: string | null
}

export interface RomaneioItem {
  id: string
  romaneio_id: string
  entrega_id: string
  venda_item_id: string
  quantidade: number
  peso_unit: number | null
  quantidade_entregue: number | null
}

export interface Saida {
  id: string
  venda_id: string
  tipo: 'balcao' | 'entrega'
  romaneio_id: string | null
  data: string
  observacao: string | null
  cancelada: boolean
  created_by: string | null
}

export interface SaidaItem {
  saida_id: string
  venda_item_id: string
  quantidade: number
}
