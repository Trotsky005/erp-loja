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
1. Base: banco, login, perfis, lojas, auditoria ✅
2. Cadastros (produtos com importação em massa e peso, clientes, motoristas) ✅
3. **Vendas (pedidos) + saída da mercadoria + entregas/romaneio** ✅ — decisão de 2026-10-14: em vez de
   subir PDF de nota, a venda é feita no próprio sistema e dela sai tudo (balcão, retirar depois, entrega).
   Na fase de testes as vendas são **pedidos sem nota fiscal** (`vendas.teste = true`).
4. **Caixa diário** e financeiro básico (substitui o Caixa do Dia), ligado às vendas/pagamentos
5. Estoque e compras (entrada por XML), baixando estoque pelas saídas
6. Melhorias do PDV (leitor, atalhos, orçamento, crediário)
7. Fiscal (NFC-e/NF-e em homologação, depois produção) — a partir daqui o Microvix pode ser desligado
8. Trocas/devoluções, transferências, contábil, relatórios e painel

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
- 2026-10-13: **CST nas configurações tributárias** (como vem do Microvix): com 3 códigos =
  compra | venda dentro do estado | venda fora do estado (ex.: 0.40 | 0.40 | 0.20); com 2 códigos =
  compra | venda (a venda é igual dentro e fora). CST com origem: 0.40 → 040. As configurações são
  criadas automaticamente na importação (`lerConfigMicrovix`). Configurações 040→000 com benefício
  (SP010360 etc.) ficam marcadas "conferir com a contabilidade".
- 2026-10-13: **CEST ≠ CST**: CEST (7 dígitos) só é obrigatório em produtos com ST (CST 060); conferir na etapa fiscal.
- 2026-10-13: Catálogo de produtos é único para todas as lojas; o saldo é por loja (módulo de estoque).
- 2026-10-13: Importação de produtos (arquivo "Registro de Inventário" do Microvix, .xls em HTML, ou CSV):
  cria os novos e atualiza descrição, preço, NCM, unidade, grupo e impostos dos existentes; **nunca apaga
  peso já cadastrado**; só grava o que mudou (para não encher a auditoria).
- 2026-10-13: Peso sugerido: tirado do nome do produto (ex.: "15KG") só para produtos vendidos por
  unidade/saco, ignorando faixas ("22 A 45KG") e remédios (MG). Fica "a conferir" até alguém aceitar.
- 2026-10-13: Quem pode montar romaneio (entregas.romaneios/criar) pode alterar **só o peso** do produto.
- 2026-10-14: **Saída da mercadoria por item da venda**: "leva agora", "entregar", "retira depois", ou parte
  agora + resto entrega/retirada. Saldo do item = vendido − saídas (tabelas `saidas`/`saida_itens`, view
  `venda_itens_saldo`). Retirada posterior no balcão: tela Vendas › abrir pedido › Registrar retirada.
- 2026-10-14: Venda com item para entregar cria uma `entrega` (status a_separar → em_rota → entregue/cancelada).
  Entrega parcial no retorno volta para "a separar" só com o que faltou.
- 2026-10-14: Gravações de venda/entrega/romaneio só pelas funções `finalizar_venda`, `registrar_retirada`,
  `cancelar_venda`, `criar_romaneio`, `retorno_romaneio`, `cancelar_romaneio` (security definer, conferem
  `pode()`/`tem_acesso_loja()`); as tabelas só têm política de leitura.
- 2026-10-14: Alterar preço e dar desconto acima de `desconto_maximo_caixa` (%) exige `vendas.pdv/cancelar`
  (gerência). Cancelar venda também; venda em rota não pode ser cancelada.
- 2026-10-14: Romaneio: número vem de `parametros.proximo_romaneio` (continua do 0127); itens iguais somados;
  mistura = um item em sacos (peso do saco padrão `saco_mistura_kg`); peso faltando é pedido na hora e salvo
  no produto; impressão = romaneio (1 via) + pedido de entrega por venda (2 vias), sem cliente no romaneio.
- 2026-10-14: Numeração das vendas por sequence; números podem pular quando uma venda dá erro (normal).

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
- 2026-10-13: **Etapa 2 (cadastros)** — migration `20261013000003_etapa2_cadastros.sql` (config_tributarias,
  produtos, pessoas, veiculos, motoristas; pg_trgm no schema `extensions`; RPC `aceitar_pesos_sugeridos`);
  telas Produtos (busca, edição, importação do Microvix, peso sugerido), Configurações tributárias,
  Clientes e fornecedores (localização colada do Google Maps, dia fixo de entrega, nome da mistura),
  Veículos e motoristas (Daniel, Betinho, Claudinho, Diego, Nano). Próximo romaneio = 127.
  Pendente: importar clientes do Microvix (aguardando o arquivo).
- 2026-10-14: Produtos importados (17.478, 18 configurações tributárias). Pesos da planilha Romaneio 2.0
  aplicados (só onde o produto estava sem peso; códigos de barras corrompidos pelo Excel ficaram de fora);
  malhas POP 3212/3213 marcadas como peso insignificante. ~435 pesos sugeridos aguardando conferência.
- 2026-10-14: **Etapa 3 (vendas + entregas)** — migration `20261014000001_etapa3_vendas_entregas.sql`
  (formas_pagamento, vendas, venda_itens, venda_pagamentos, entregas, romaneios, romaneio_entregas,
  romaneio_itens, saidas, saida_itens, views venda_itens_saldo e vendas_resumo, funções de gravação);
  telas Nova venda, Vendas e retiradas, Quadro de entregas (kanban + montar romaneio), Romaneios (retorno,
  cancelamento) e impressão (/imprimir/venda/:id, /imprimir/romaneio/:id). Testado em Postgres local e no
  Supabase (com rollback).
