import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './core/auth/AuthProvider'
import { AppLayout } from './core/layout/AppLayout'
import { Carregando } from './core/ui/componentes'
import { supabaseConfigurado } from './lib/supabase'
import { AguardandoLiberacao, ConfigurarSupabase, EmConstrucao } from './pages/Avisos'
import { Inicio } from './pages/Inicio'
import { Login } from './pages/Login'
import { AuditoriaPage } from './modules/admin/AuditoriaPage'
import { LojasPage } from './modules/admin/LojasPage'
import { ParametrosPage } from './modules/admin/ParametrosPage'
import { PerfisPage } from './modules/admin/PerfisPage'
import { UsuariosPage } from './modules/admin/UsuariosPage'
import { ConfigTributariasPage } from './modules/cadastros/ConfigTributariasPage'
import { MotoristasPage } from './modules/cadastros/MotoristasPage'
import { PessoasPage } from './modules/cadastros/PessoasPage'
import { ProdutosPage } from './modules/cadastros/ProdutosPage'

function Rotas() {
  const { carregando, sessao, usuario } = useAuth()

  if (carregando) return <Carregando texto="Abrindo o sistema…" />
  if (!sessao) return <Login />
  if (!usuario) return <Carregando texto="Carregando seu cadastro…" />
  if (!usuario.ativo) return <AguardandoLiberacao />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Inicio />} />
        {/* Administrativo */}
        <Route path="admin/lojas" element={<LojasPage />} />
        <Route path="admin/usuarios" element={<UsuariosPage />} />
        <Route path="admin/perfis" element={<PerfisPage />} />
        <Route path="admin/parametros" element={<ParametrosPage />} />
        <Route path="admin/auditoria" element={<AuditoriaPage />} />
        {/* Cadastros */}
        <Route path="cadastros/produtos" element={<ProdutosPage />} />
        <Route path="cadastros/pessoas" element={<PessoasPage />} />
        <Route path="cadastros/motoristas" element={<MotoristasPage />} />
        <Route path="cadastros/tributacao" element={<ConfigTributariasPage />} />
        {/* Módulos ainda não construídos */}
        <Route path="em-construcao/:codigo" element={<EmConstrucao />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!supabaseConfigurado) return <ConfigurarSupabase />
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}
