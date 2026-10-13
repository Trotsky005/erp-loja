import { useState, type FormEvent } from 'react'
import { mensagemErro, supabase } from '../lib/supabase'
import { Aviso } from '../core/ui/componentes'

type Modo = 'entrar' | 'solicitar' | 'recuperar'

export function Login() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(''); setOk(''); setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else if (modo === 'solicitar') {
        const { error } = await supabase.auth.signUp({
          email, password: senha,
          options: { data: { nome }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setOk('Pedido enviado. Confirme o e-mail pelo link que você recebeu e aguarde o administrador liberar seu acesso.')
        setModo('entrar')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setOk('Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.')
        setModo('entrar')
      }
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  const titulo = { entrar: 'Entrar', solicitar: 'Solicitar acesso', recuperar: 'Recuperar senha' }[modo]

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-marca-700 to-marca-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <img src="/icone.svg" alt="" className="h-10 w-10 rounded-lg ring-2 ring-white/30" />
          <span className="text-2xl font-semibold tracking-tight">ERP Loja</span>
        </div>
        <form onSubmit={enviar} className="cartao space-y-4 p-6">
          <h1 className="text-lg font-semibold text-stone-900">{titulo}</h1>
          {erro && <Aviso>{erro}</Aviso>}
          {ok && <Aviso tipo="ok">{ok}</Aviso>}

          {modo === 'solicitar' && (
            <div>
              <label className="rotulo" htmlFor="nome">Seu nome</label>
              <input id="nome" className="campo" required value={nome} onChange={e => setNome(e.target.value)} />
            </div>
          )}
          <div>
            <label className="rotulo" htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" className="campo" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {modo !== 'recuperar' && (
            <div>
              <label className="rotulo" htmlFor="senha">Senha</label>
              <input id="senha" type="password" minLength={6} required className="campo"
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                value={senha} onChange={e => setSenha(e.target.value)} />
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn-primario w-full">
            {enviando ? 'Aguarde…' : { entrar: 'Entrar', solicitar: 'Enviar pedido', recuperar: 'Enviar link' }[modo]}
          </button>

          <div className="flex justify-between text-xs">
            {modo === 'entrar' ? (
              <>
                <button type="button" className="text-marca-700 hover:underline" onClick={() => setModo('solicitar')}>Solicitar acesso</button>
                <button type="button" className="text-stone-500 hover:underline" onClick={() => setModo('recuperar')}>Esqueci a senha</button>
              </>
            ) : (
              <button type="button" className="text-marca-700 hover:underline" onClick={() => setModo('entrar')}>Voltar para entrar</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
