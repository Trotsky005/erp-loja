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
