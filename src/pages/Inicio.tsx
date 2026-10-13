import { Link } from 'react-router-dom'
import { useAuth } from '../core/auth/AuthProvider'
import { Icone } from '../core/ui/componentes'
import { MENU } from '../core/layout/menu'

export function Inicio() {
  const { usuario, lojaAtual, pode } = useAuth()
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const grupos = MENU.map(g => ({ ...g, itens: g.itens.filter(i => pode(i.recurso)) })).filter(g => g.itens.length)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">{saudacao}, {usuario?.nome?.split(' ')[0]}</h1>
        <p className="text-sm text-stone-500">
          {lojaAtual ? <>Você está trabalhando na loja <strong className="text-stone-700">{lojaAtual.nome}</strong>.</> : 'Nenhuma loja liberada para você ainda.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map(g => (
          <div key={g.modulo} className="cartao p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-marca-50 text-marca-600">
                <Icone d={g.icone} className="h-4 w-4" />
              </span>
              <h2 className="font-semibold text-stone-900">{g.modulo}</h2>
            </div>
            <ul className="space-y-1">
              {g.itens.map(i => (
                <li key={i.rota}>
                  <Link to={i.rota} className="flex items-center justify-between rounded px-2 py-1 text-sm text-stone-700 hover:bg-stone-50 hover:text-marca-700">
                    {i.nome}
                    {!i.pronto && <span className="text-[10px] uppercase tracking-wide text-stone-400">em breve</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
