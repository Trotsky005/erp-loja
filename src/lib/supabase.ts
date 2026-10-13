import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && chave)

export const supabase = createClient(
  url ?? 'https://nao-configurado.supabase.co',
  chave ?? 'nao-configurado',
)

/** Traduz mensagens de erro comuns do Supabase para português. */
export function mensagemErro(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? erro)
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail pelo link enviado antes de entrar.'
  if (msg.includes('User already registered')) return 'Já existe um acesso com este e-mail.'
  if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (msg.includes('row-level security')) return 'Você não tem permissão para esta ação.'
  if (msg.includes('duplicate key')) return 'Já existe um registro com estes dados.'
  return msg
}
