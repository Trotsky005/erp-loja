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
