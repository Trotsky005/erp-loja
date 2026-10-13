import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { mensagemErro, supabase } from '../../lib/supabase'
import { lerNumero, numero } from '../../lib/formato'
import type { Motorista, Usuario, Veiculo } from '../../lib/tipos'
import { useAuth } from '../../core/auth/AuthProvider'
import { Aviso, CabecalhoPagina, Carregando, Modal, Selo, SemPermissao, Vazio } from '../../core/ui/componentes'

const FUNCOES = { motorista: 'Motorista', ajudante: 'Ajudante', ambos: 'Motorista e ajudante' } as const

type FormMotorista = Omit<Motorista, 'id'> & { id?: string }
type FormVeiculo = Omit<Veiculo, 'id' | 'capacidade_kg'> & { id?: string; capacidade_kg: string }

export function MotoristasPage() {
  const { pode } = useAuth()
  const [motoristas, setMotoristas] = useState<Motorista[] | null>(null)
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [usuarios, setUsuarios] = useState<Pick<Usuario, 'id' | 'nome'>[]>([])
  const [fm, setFm] = useState<FormMotorista | null>(null)
  const [fv, setFv] = useState<FormVeiculo | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const [m, v, u] = await Promise.all([
      supabase.from('motoristas').select('*').order('ativo', { ascending: false }).order('nome'),
      supabase.from('veiculos').select('*').order('ativo', { ascending: false }).order('descricao'),
      supabase.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    ])
    const falha = m.error ?? v.error
    if (falha) setErro(mensagemErro(falha))
    setMotoristas((m.data as Motorista[]) ?? [])
    setVeiculos((v.data as Veiculo[]) ?? [])
    setUsuarios(u.data ?? [])   // só aparece para quem pode ver usuários
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  if (!pode('cadastros.motoristas')) return <SemPermissao />
  const podeEditar = pode('cadastros.motoristas', 'editar')
  const podeCriar = pode('cadastros.motoristas', 'criar')

  async function salvarMotorista(e: FormEvent) {
    e.preventDefault()
    if (!fm) return
    const { id, ...d } = fm
    const dados = { ...d, nome: d.nome.trim(), telefone: d.telefone || null, usuario_id: d.usuario_id || null, veiculo_id: d.veiculo_id || null }
    const { error } = id ? await supabase.from('motoristas').update(dados).eq('id', id) : await supabase.from('motoristas').insert(dados)
    if (error) { setErro(mensagemErro(error)); return }
    setFm(null); await carregar()
  }

  async function salvarVeiculo(e: FormEvent) {
    e.preventDefault()
    if (!fv) return
    const { id, ...d } = fv
    const dados = { ...d, descricao: d.descricao.trim(), placa: d.placa ? d.placa.toUpperCase().trim() : null, capacidade_kg: lerNumero(d.capacidade_kg) }
    const { error } = id ? await supabase.from('veiculos').update(dados).eq('id', id) : await supabase.from('veiculos').insert(dados)
    if (error) { setErro(mensagemErro(error)); return }
    setFv(null); await carregar()
  }

  const nomeVeiculo = (id: string | null) => veiculos.find(v => v.id === id)?.descricao
  const nomeUsuario = (id: string | null) => usuarios.find(u => u.id === id)?.nome

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section>
        <CabecalhoPagina titulo="Motoristas e ajudantes" descricao="Quem sai nas entregas. Aparecem na hora de montar o romaneio."
          acoes={podeCriar && <button className="btn-primario" onClick={() => { setErro(''); setFm({ nome: '', funcao: 'motorista', telefone: '', usuario_id: null, veiculo_id: null, ativo: true }) }}>Novo</button>} />
        {erro && !fm && !fv && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
        <div className="cartao overflow-x-auto">
          {!motoristas ? <Carregando /> : motoristas.length === 0 ? <Vazio>Nenhum cadastrado.</Vazio> : (
            <table className="tabela">
              <thead><tr><th>Nome</th><th>Função</th><th>Telefone</th><th>Veículo</th><th>Login no sistema</th><th /></tr></thead>
              <tbody>
                {motoristas.map(m => (
                  <tr key={m.id} className={m.ativo ? '' : 'opacity-50'}>
                    <td className="font-medium">{m.nome}{!m.ativo && <span className="ml-2"><Selo>Inativo</Selo></span>}</td>
                    <td>{FUNCOES[m.funcao]}</td>
                    <td>{m.telefone ?? '—'}</td>
                    <td>{nomeVeiculo(m.veiculo_id) ?? '—'}</td>
                    <td>{m.usuario_id ? (nomeUsuario(m.usuario_id) ?? 'sim') : <span className="text-stone-400">sem login</span>}</td>
                    <td className="text-right">{podeEditar && <button className="text-sm text-marca-700 hover:underline" onClick={() => { setErro(''); setFm({ ...m, telefone: m.telefone ?? '' }) }}>Editar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <CabecalhoPagina titulo="Veículos" descricao="A capacidade de carga serve para avisar quando o romaneio passar do limite."
          acoes={podeCriar && <button className="btn-primario" onClick={() => { setErro(''); setFv({ descricao: '', placa: '', capacidade_kg: '', ativo: true }) }}>Novo veículo</button>} />
        <div className="cartao overflow-x-auto">
          {veiculos.length === 0 ? <Vazio>Nenhum veículo cadastrado.</Vazio> : (
            <table className="tabela">
              <thead><tr><th>Veículo</th><th>Placa</th><th className="text-right">Capacidade (kg)</th><th /></tr></thead>
              <tbody>
                {veiculos.map(v => (
                  <tr key={v.id} className={v.ativo ? '' : 'opacity-50'}>
                    <td className="font-medium">{v.descricao}{!v.ativo && <span className="ml-2"><Selo>Inativo</Selo></span>}</td>
                    <td className="font-mono">{v.placa ?? '—'}</td>
                    <td className="text-right">{v.capacidade_kg !== null ? numero(Number(v.capacidade_kg), 0) : '—'}</td>
                    <td className="text-right">{podeEditar && <button className="text-sm text-marca-700 hover:underline"
                      onClick={() => { setErro(''); setFv({ ...v, capacidade_kg: v.capacidade_kg === null ? '' : String(v.capacidade_kg) }) }}>Editar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Modal titulo={fm?.id ? fm.nome : 'Novo motorista ou ajudante'} aberto={!!fm} aoFechar={() => setFm(null)}
        rodape={<><button className="btn-secundario" onClick={() => setFm(null)}>Cancelar</button><button type="submit" form="form-mot" className="btn-primario">Salvar</button></>}>
        {fm && (
          <form id="form-mot" onSubmit={salvarMotorista} className="space-y-3">
            {erro && <Aviso>{erro}</Aviso>}
            <div><label className="rotulo" htmlFor="mot-nome">Nome</label>
              <input id="mot-nome" className="campo" required value={fm.nome} onChange={e => setFm({ ...fm, nome: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="rotulo" htmlFor="mot-funcao">Função</label>
                <select id="mot-funcao" className="campo" value={fm.funcao} onChange={e => setFm({ ...fm, funcao: e.target.value as Motorista['funcao'] })}>
                  {Object.entries(FUNCOES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select></div>
              <div><label className="rotulo" htmlFor="mot-tel">Telefone</label>
                <input id="mot-tel" className="campo" type="tel" value={fm.telefone ?? ''} onChange={e => setFm({ ...fm, telefone: e.target.value })} /></div>
              <div><label className="rotulo" htmlFor="mot-vei">Veículo que costuma usar</label>
                <select id="mot-vei" className="campo" value={fm.veiculo_id ?? ''} onChange={e => setFm({ ...fm, veiculo_id: e.target.value || null })}>
                  <option value="">—</option>{veiculos.filter(v => v.ativo).map(v => <option key={v.id} value={v.id}>{v.descricao}</option>)}
                </select></div>
              <div><label className="rotulo" htmlFor="mot-usr">Login no sistema</label>
                <select id="mot-usr" className="campo" value={fm.usuario_id ?? ''} onChange={e => setFm({ ...fm, usuario_id: e.target.value || null })}>
                  <option value="">sem login</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select></div>
            </div>
            {fm.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-marca-600" checked={fm.ativo} onChange={e => setFm({ ...fm, ativo: e.target.checked })} />Ativo</label>}
          </form>
        )}
      </Modal>

      <Modal titulo={fv?.id ? fv.descricao : 'Novo veículo'} aberto={!!fv} aoFechar={() => setFv(null)}
        rodape={<><button className="btn-secundario" onClick={() => setFv(null)}>Cancelar</button><button type="submit" form="form-vei" className="btn-primario">Salvar</button></>}>
        {fv && (
          <form id="form-vei" onSubmit={salvarVeiculo} className="space-y-3">
            {erro && <Aviso>{erro}</Aviso>}
            <div><label className="rotulo" htmlFor="vei-desc">Descrição</label>
              <input id="vei-desc" className="campo" required placeholder="ex.: Caminhão Mercedes 710" value={fv.descricao} onChange={e => setFv({ ...fv, descricao: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="rotulo" htmlFor="vei-placa">Placa</label>
                <input id="vei-placa" className="campo font-mono" value={fv.placa ?? ''} onChange={e => setFv({ ...fv, placa: e.target.value })} /></div>
              <div><label className="rotulo" htmlFor="vei-cap">Capacidade de carga (kg)</label>
                <input id="vei-cap" className="campo" inputMode="decimal" value={fv.capacidade_kg} onChange={e => setFv({ ...fv, capacidade_kg: e.target.value })} /></div>
            </div>
            {fv.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-marca-600" checked={fv.ativo} onChange={e => setFv({ ...fv, ativo: e.target.checked })} />Ativo</label>}
          </form>
        )}
      </Modal>
    </div>
  )
}
