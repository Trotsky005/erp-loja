import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../core/auth/AuthProvider'
import { TODOS_ITENS } from '../core/layout/menu'

function TelaCentral({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-stone-100 p-4">
      <div className="cartao w-full max-w-md p-6 text-center">
        <img src="/icone.svg" alt="" className="mx-auto mb-3 h-10 w-10" />
        <h1 className="text-lg font-semibold text-stone-900">{titulo}</h1>
        <div className="mt-2 space-y-3 text-sm text-stone-600">{children}</div>
      </div>
    </div>
  )
}

export function ConfigurarSupabase() {
  return (
    <TelaCentral titulo="Falta configurar o banco de dados">
      <p>Crie o arquivo <code className="rounded bg-stone-100 px-1">.env</code> (ou as variáveis na hospedagem) com:</p>
      <pre className="overflow-x-auto rounded bg-stone-900 p-3 text-left text-xs text-stone-100">VITE_SUPABASE_URL=...{'\n'}VITE_SUPABASE_ANON_KEY=...</pre>
      <p>Os valores ficam no Supabase, em Project Settings → API.</p>
    </TelaCentral>
  )
}

export function AguardandoLiberacao() {
  const { usuario, sair, recarregar } = useAuth()
  return (
    <TelaCentral titulo="Acesso aguardando liberação">
      <p>Olá{usuario ? `, ${usuario.nome}` : ''}. Seu pedido de acesso foi registrado.</p>
      <p>Um administrador precisa definir seu perfil e suas lojas antes de você usar o sistema.</p>
      <div className="flex justify-center gap-2 pt-2">
        <button className="btn-secundario" onClick={() => void recarregar()}>Verificar de novo</button>
        <button className="btn-primario" onClick={() => void sair()}>Sair</button>
      </div>
    </TelaCentral>
  )
}

export function EmConstrucao() {
  const { codigo } = useParams()
  const item = TODOS_ITENS.find(i => i.recurso === codigo)
  return (
    <div className="cartao mx-auto mt-6 max-w-lg p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-marca-50 text-marca-600">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-stone-900">{item ? `${item.modulo} › ${item.nome}` : 'Módulo'}</h1>
      <p className="mt-1 text-sm text-stone-500">Esta tela ainda está em construção. Veja a ordem de construção no CLAUDE.md do projeto.</p>
    </div>
  )
}
