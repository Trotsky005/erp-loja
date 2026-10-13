import { useEffect, type ReactNode } from 'react'

export function Icone({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">{titulo}</h1>
        {descricao && <p className="mt-0.5 text-sm text-stone-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  const cores = {
    erro: 'border-marca-200 bg-marca-50 text-marca-800',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  }[tipo]
  return <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${cores}`}>{children}</div>
}

export function Modal({ titulo, aberto, aoFechar, children, rodape, largura = 'max-w-lg' }: {
  titulo: string
  aberto: boolean
  aoFechar: () => void
  children: ReactNode
  rodape?: ReactNode
  largura?: string
}) {
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto, aoFechar])

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 sm:items-center"
      onMouseDown={aoFechar}>
      <div role="dialog" aria-modal="true" aria-label={titulo}
        className={`cartao w-full ${largura} bg-white`} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 className="font-semibold text-stone-900">{titulo}</h2>
          <button type="button" onClick={aoFechar} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Fechar">
            <Icone d="M6 6l12 12M18 6L6 18" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">{rodape}</div>}
      </div>
    </div>
  )
}

export function Selo({ cor = 'cinza', children }: { cor?: 'verde' | 'cinza' | 'vermelho' | 'ambar'; children: ReactNode }) {
  const c = {
    verde: 'bg-emerald-100 text-emerald-800',
    cinza: 'bg-stone-100 text-stone-600',
    vermelho: 'bg-marca-100 text-marca-800',
    ambar: 'bg-amber-100 text-amber-800',
  }[cor]
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <div className="py-10 text-center text-sm text-stone-500">{texto}</div>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-stone-500">{children}</div>
}

export function SemPermissao() {
  return (
    <div className="cartao mx-auto mt-10 max-w-md p-6 text-center">
      <h1 className="font-semibold text-stone-900">Sem permissão</h1>
      <p className="mt-1 text-sm text-stone-500">Seu perfil não tem acesso a esta tela. Fale com o administrador.</p>
    </div>
  )
}
