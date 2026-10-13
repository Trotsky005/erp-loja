# ERP da Loja — Especificação Viva

> Este arquivo é a fonte da verdade do sistema. Sempre que uma regra de negócio mudar,
> atualize este arquivo junto com o código. Leia-o inteiro antes de qualquer alteração.

## 1. Visão geral
Sistema web único de gestão (ERP) para a empresa, inspirado no Linx Microvix, mas feito sob medida
e evoluído aos poucos conforme as necessidades da operação. Reúne em um só lugar:
cadastros, vendas, estoque, compras, financeiro, caixa diário, fiscal **e entregas/logística**.

- Empresa com mais de uma loja (ex.: Casa de Ração e Material de Construção). As lojas são
  cadastráveis — nunca fixar nomes de loja no código.
- Cerca de 17.000 produtos: ração, remédios veterinários, itens agropecuários, material de
  construção, papelaria e alimentos.
- Idioma: português (Brasil). Moeda: R$. Fuso: America/Sao_Paulo.
- Uso no computador da loja e no celular (layout responsivo).
- Cor principal da identidade visual: **vermelho**.

## 2. Princípios de arquitetura (para o sistema poder crescer)
1. **Modular**: cada módulo (cadastros, vendas, estoque, financeiro, caixa, fiscal, entregas…)
   tem sua pasta, suas tabelas e suas telas. Um módulo novo não deve exigir reescrever outro.
2. **Banco único e relacional**: todos os módulos usam o mesmo banco (Supabase/Postgres) e se ligam
   pelas mesmas entidades (loja, produto, cliente, nota, usuário). É isso que dá o "controle geral".
3. **Mudanças de banco só por migrations versionadas** (nunca alterar tabela "na mão").
4. **Código versionado no GitHub**, com commits pequenos e descritivos.
5. **Configurável antes de fixo**: regras que podem mudar (status, formas de pagamento, motoristas,
   perfis, alíquotas, pesos) ficam em tabelas de configuração, não no código.
6. **Nada é apagado**: vendas, notas, romaneios e lançamentos são cancelados/estornados, com motivo.
7. **Auditoria**: registrar quem criou/alterou/cancelou e quando, em todas as tabelas importantes.
8. **Ambiente de teste**: toda funcionalidade nova é testada com dados de teste antes de ir para uso.
9. Ao terminar uma alteração, atualizar a seção "Regras de negócio" e o "Histórico de mudanças".

## 3. Stack
- Front-end: React + TypeScript + Vite + Tailwind
- Banco, login e permissões: Supabase (Postgres, Auth, Row Level Security, Storage para PDFs/XMLs)
- Hospedagem: gratuita no início (ex.: Vercel ou Netlify)
- Emissão fiscal (NF-e / NFC-e): via API de terceiros (ex.: Focus NFe, NFE.io, PlugNotas),
  começando sempre em **homologação**
- Geração de PDF para impressão (romaneio, fechamento de caixa, relatórios) no próprio sistema

## 3.1 Estrutura do projeto
```
supabase/migrations/      → mudanças do banco, uma por arquivo, em ordem de data (nunca editar uma já aplicada)
src/lib/                  → cliente Supabase, tipos das tabelas
src/core/auth/            → login, usuário logado, lojas permitidas, função pode(recurso, acao)
src/core/layout/menu.ts   → registro de módulos/telas do menu (incluir aqui cada tela nova)
src/core/layout/          → menu lateral, barra do topo com seletor de loja
src/core/ui/              → componentes reutilizáveis (Modal, Aviso, CabecalhoPagina, Selo…)
src/modules/<modulo>/     → telas de cada módulo (admin, cadastros, entregas, caixa…)
src/App.tsx               → rotas
```
Estilos: Tailwind v4, cor da marca em `--color-marca-*` (src/index.css); classes prontas
`btn-primario`, `btn-secundario`, `campo`, `rotulo`, `cartao`, `tabela`.

**Como incluir uma tela nova:** (1) migration com as tabelas + RLS + trigger de auditoria;
(2) registrar o recurso na tabela `recursos`; (3) item em `menu.ts`; (4) rota em `App.tsx`;
(5) checar permissão com `pode('codigo.recurso', 'ver'|'criar'|'editar'|'cancelar')` na tela.

**Padrões do banco** (ver migration da etapa 1): toda tabela tem `created_at/by`, `updated_at/by`
(trigger `tg_carimbo`), trigger `tg_auditoria`, RLS ligada e políticas usando `pode()` e
`tem_acesso_loja()`. Não criar política de DELETE em tabelas de movimento.

## 4. Usuários e permissões
Perfis configuráveis: Administrador, Gerente, Financeiro, Caixa, Logística/Expedição, Motorista.
- Permissão por tela e por ação (ver, criar, editar, cancelar).
- Usuário pode ser restrito a uma ou mais lojas (quem é de uma loja não vê o financeiro da outra;
  o administrador vê tudo).
- Seletor de loja no topo da tela, sem precisar sair do sistema.

## 5. Módulos

### 5.1 Administrativo
- Dados da empresa e das lojas (CNPJ, IE, endereço, regime tributário, certificado digital A1)
- Usuários, perfis e permissões
- Parâmetros globais (ex.: venda com estoque negativo, desconto máximo por perfil)

### 5.2 Cadastros
- **Produtos**: código, EAN, descrição, unidade, NCM, CEST, categoria, marca, custo, preço, margem,
  estoque mínimo, lote/validade, **peso (kg)**, flag "vem em saco", status. Importação em massa
  por Excel/CSV.
- Clientes e fornecedores (CPF/CNPJ, endereço, **coordenadas de entrega**, telefone, limite de
  crédito, dia fixo de entrega quando houver)
- Unidades, NCM/CEST, depósitos, centros de custo, plano de contas
- Configuração tributária (CFOP, CST/CSOSN, alíquotas), com suporte à isenção de ICMS de itens
  agropecuários (art. 41 do Anexo I do RICMS/SP)
- Formas e planos de pagamento: dinheiro, PIX, cartão (débito/crédito/parcelado), boleto,
  crediário da loja
- Promoções, campanhas e cupons
- **Veículos e motoristas** (com ajudantes)

### 5.3 Vendas e operações
- PDV / venda rápida (código de barras ou nome, desconto com motivo, várias formas de pagamento)
- Pedido de venda com opção **"para entrega"** → gera automaticamente uma entrega (módulo 5.8)
- Emissão de NFC-e e NF-e
- Devolução e troca (com vale-troca)
- Crediário: ficha do cliente, parcelas, recebimento
- Sangria e suprimento

### 5.4 Estoque e compras
- Entrada por XML da NF-e do fornecedor (vincular itens do fornecedor aos produtos), entrada manual,
  CT-e de frete
- Recebimento e conferência de compras
- Transferência entre lojas e depósitos
- Balanço/inventário (contagem, processamento, ajuste, estorno)
- Saída do estoque vinculada à entrega quando aplicável

### 5.5 Caixa diário (absorve o projeto "Caixa do Dia")
- Abertura e fechamento por loja; frentes separadas: Caixa e Financeiro de cada loja, e Banco
- Fechamento mostra totais por forma de pagamento, crediário recebido, sangrias, suprimentos, trocas
- Conferência pelo financeiro: valor informado × sistema × extrato bancário, registrando diferenças
- Depósitos são transferências do caixa para o Banco; boletos recebidos entram no Banco;
  contas pagas por PIX saem pelo Banco
- PDF de cada fechamento salvo no sistema

### 5.6 Financeiro
- Contas a pagar e a receber (lançar, alterar, baixar total/parcial, estornar)
- Compras no cartão de crédito da empresa viram parcelas a pagar
- Fluxo de caixa (realizado e previsto), contas bancárias, transferências, conciliação (OFX)
- Despesas fixas recorrentes
- Folha e encargos: lançamento manual por funcionário e por loja

### 5.7 Fiscal e contábil
- Gestão dos XMLs emitidos e recebidos; cancelamento de notas
- DRE, balancete, balanço patrimonial, livro razão

### 5.8 Entregas e logística (absorve o "Separador de Notas" e o romaneio de carga)
**Origem das entregas**
- Automática: pedidos/notas emitidos no sistema marcados "para entrega".
- Manual (fase de transição, enquanto ainda se usa o Microvix): upload do PDF da nota/pedido;
  o sistema lê os itens e permite conferir/corrigir.

**Quadro (Kanban) de entregas** — status configuráveis, padrão inicial:
`A separar → Impresso → Em rota (por motorista) → Entregue` + `Parcial` e `Cancelada`.
- Não permitir incluir de novo uma nota já "Entregue" (mostrar aviso).
- Cancelar nota pelo sistema (vai para "Cancelada", com motivo).

**Saldo a entregar por item**
- Cada item da entrega tem quantidade vendida, quantidade já entregue e saldo.
- Nas notas em PDF da transição, anotações manuais valem como entrega já feita:
  "-10" num item = 10 unidades já entregues; "foi", "entregue" ou ✓ = item todo entregue.

**Montagem de carga / romaneio**
1. Selecionar entregas pendentes.
2. O sistema soma os itens iguais entre as notas e mostra só o saldo pendente.
3. Lista de carga editável: ajustar quantidades do que realmente vai na viagem.
4. Peso: usar o peso do cadastro do produto; se não tiver, pedir na hora e salvar no cadastro;
   permitir "peso insignificante" (fica em branco e não soma no total).
5. **Misturas** (pedidos de matéria-prima de ração): entram como um único item em sacos
   (padrão 50 kg por saco, editável), com nome configurável por cliente.
6. Escolher motorista e ajudante → entregas vão para "Em rota (motorista)".
7. Numeração do romaneio sequencial, continuando a numeração atual.
8. Layout do romaneio: cabeçalho com Nº, Motorista, Notas, Data, Peso total, Sacos; tabela com
   Quantidade | Item | Unidade | Peso | Visto. Sem cliente, endereço ou observações, e sem número
   da nota ao lado de cada item.
9. Impressão: notas originais em 2 vias e romaneio em 1 via; opção de imprimir só as notas
   ou só o romaneio.

**Retorno da rota**
- Marcar cada entrega como Entregue ou Parcial (informando o que foi entregue; o saldo volta
  para a fila "A separar").
- Histórico de romaneios consultável (nº, motorista, ajudante, data, notas, observação).

**Futuro (não fazer agora)**
- Roteirização semanal por proximidade (2 a 3 veículos, saída sempre do mesmo depósito,
  clientes com dia fixo + entregas livres).
- App/tela de celular para o motorista confirmar entregas.

### 5.9 Relatórios e painel
- Todos com filtro por loja e período, exportação Excel/PDF
- Vendas (diário, por produto, ranking, motivo de desconto), estoque (saldo, mínimo, validade,
  histórico), compras e custos, financeiro (pagar/receber), caixa, clientes, vale-troca
- Entregas: pendentes, por motorista, peso transportado, entregas parciais
- Painel inicial: vendas do dia/mês, ticket médio, contas vencendo, estoque crítico, entregas pendentes

## 6. Ordem de construção
1. Base: banco, login, perfis, lojas, auditoria
2. Cadastros (produtos com importação em massa e peso, clientes, motoristas)
3. **Entregas** (com upload de PDF — substitui o Separador de Notas atual)
4. **Caixa diário** e financeiro básico (substitui o Caixa do Dia)
5. Estoque e compras (entrada por XML)
6. PDV e vendas, ligando vendas → entregas automaticamente
7. Fiscal (NFC-e/NF-e em homologação, depois produção) — a partir daqui o Microvix pode ser desligado
8. Crediário, trocas, transferências, contábil, relatórios e painel

Em cada etapa: mostrar o esquema das tabelas antes de codificar, entregar telas funcionando
com dados de teste e atualizar este arquivo.

## 7. Regras de negócio adicionais
(Adicionar aqui cada regra nova combinada, com data.)
- 2026-10-13: Acesso de novos usuários: a pessoa pede acesso na tela de login ("Solicitar acesso"),
  entra **inativa e sem perfil**, e só usa o sistema depois que um administrador define perfil e
  lojas em Administrativo › Usuários. O **primeiro** usuário cadastrado vira Administrador automaticamente.
- 2026-10-13: Perfil com `admin = true` tem acesso total e ignora a matriz de permissões.
- 2026-10-13: Nas permissões, criar/editar/cancelar exigem "ver"; tirar "ver" tira as demais.
- 2026-10-13: Lojas e perfis não são apagados, só desativados. O vínculo usuário×loja pode ser removido.

## 8. Histórico de mudanças
- 2026-10-13: especificação inicial.
- 2026-10-13: **Etapa 1 concluída (código)** — projeto React/Vite/Tailwind; migration
  `20261013000001_etapa1_base.sql` (lojas, perfis, recursos, perfil_permissoes, usuarios,
  usuario_lojas, parametros, auditoria, RLS e dados iniciais); telas de login, início, Lojas,
  Usuários, Perfis e permissões, Parâmetros e Auditoria; menu com todos os módulos ("em breve").
  Banco testado em Postgres local (permissões e auditoria).
- 2026-10-13: Banco aplicado no Supabase (projeto `egercwtblyjvbiomukzb`, o antigo do Caixa do Dia,
  região sa-east-1) + migration `seguranca_funcoes` (search_path fixo, funções sem acesso anônimo).
  As tabelas antigas do Caixa do Dia (vazias) ainda existem no projeto: a remoção
  (`20261013000000_remove_caixa_do_dia_antigo.sql`) depende de confirmação no Supabase.
- 2026-10-13: Site publicado na Vercel (projeto `erp-loja`, conta trotsky005's projects):
  **https://erp-loja-ten.vercel.app** — publica sozinho a cada push no `main`. Configuração pública
  do Supabase em `.env.production` (chave publishable; a chave secreta nunca vai para o código).
