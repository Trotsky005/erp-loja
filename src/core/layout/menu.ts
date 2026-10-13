// Registro dos módulos do sistema.
// Para incluir um módulo novo: adicione o item aqui (com o código do recurso
// cadastrado na tabela "recursos") e a rota em src/App.tsx.

export interface ItemMenu {
  nome: string
  rota: string
  recurso: string
  /** false = ainda não construído (mostra a tela "em construção") */
  pronto: boolean
}

export interface GrupoMenu {
  modulo: string
  icone: string // caminho SVG (24x24, traço)
  itens: ItemMenu[]
}

const emBreve = (codigo: string) => `/em-construcao/${codigo}`

export const MENU: GrupoMenu[] = [
  {
    modulo: 'Cadastros',
    icone: 'M4 6h16M4 12h16M4 18h10',
    itens: [
      { nome: 'Produtos', rota: '/cadastros/produtos', recurso: 'cadastros.produtos', pronto: true },
      { nome: 'Clientes e fornecedores', rota: '/cadastros/pessoas', recurso: 'cadastros.pessoas', pronto: true },
      { nome: 'Veículos e motoristas', rota: '/cadastros/motoristas', recurso: 'cadastros.motoristas', pronto: true },
      { nome: 'Configurações tributárias', rota: '/cadastros/tributacao', recurso: 'cadastros.produtos', pronto: true },
    ],
  },
  {
    modulo: 'Entregas',
    icone: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    itens: [
      { nome: 'Quadro de entregas', rota: emBreve('entregas.quadro'), recurso: 'entregas.quadro', pronto: false },
      { nome: 'Romaneios', rota: emBreve('entregas.romaneios'), recurso: 'entregas.romaneios', pronto: false },
    ],
  },
  {
    modulo: 'Caixa',
    icone: 'M3 7h18v12H3zM3 11h18M7 15h3',
    itens: [
      { nome: 'Fechamento de caixa', rota: emBreve('caixa.fechamento'), recurso: 'caixa.fechamento', pronto: false },
      { nome: 'Conferência', rota: emBreve('caixa.conferencia'), recurso: 'caixa.conferencia', pronto: false },
    ],
  },
  {
    modulo: 'Financeiro',
    icone: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
    itens: [
      { nome: 'Contas a pagar', rota: emBreve('financeiro.pagar'), recurso: 'financeiro.pagar', pronto: false },
      { nome: 'Contas a receber', rota: emBreve('financeiro.receber'), recurso: 'financeiro.receber', pronto: false },
    ],
  },
  {
    modulo: 'Estoque',
    icone: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
    itens: [
      { nome: 'Estoque e compras', rota: emBreve('estoque.movimento'), recurso: 'estoque.movimento', pronto: false },
    ],
  },
  {
    modulo: 'Vendas',
    icone: 'M3 4h2l2.5 11h11L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    itens: [
      { nome: 'PDV / Venda rápida', rota: emBreve('vendas.pdv'), recurso: 'vendas.pdv', pronto: false },
    ],
  },
  {
    modulo: 'Fiscal',
    icone: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    itens: [
      { nome: 'Notas fiscais', rota: emBreve('fiscal.notas'), recurso: 'fiscal.notas', pronto: false },
    ],
  },
  {
    modulo: 'Relatórios',
    icone: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    itens: [
      { nome: 'Relatórios', rota: emBreve('relatorios.geral'), recurso: 'relatorios.geral', pronto: false },
    ],
  },
  {
    modulo: 'Administrativo',
    icone: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    itens: [
      { nome: 'Lojas', rota: '/admin/lojas', recurso: 'admin.lojas', pronto: true },
      { nome: 'Usuários', rota: '/admin/usuarios', recurso: 'admin.usuarios', pronto: true },
      { nome: 'Perfis e permissões', rota: '/admin/perfis', recurso: 'admin.perfis', pronto: true },
      { nome: 'Parâmetros', rota: '/admin/parametros', recurso: 'admin.parametros', pronto: true },
      { nome: 'Auditoria', rota: '/admin/auditoria', recurso: 'admin.auditoria', pronto: true },
    ],
  },
]

export const TODOS_ITENS = MENU.flatMap(g => g.itens.map(i => ({ ...i, modulo: g.modulo })))
