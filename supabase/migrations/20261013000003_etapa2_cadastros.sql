-- =====================================================================
-- ERP Loja — Etapa 2: cadastros (configurações tributárias, produtos,
-- clientes/fornecedores, veículos e motoristas)
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Configurações tributárias
-- Regra da empresa (2026-10-13): no Microvix a configuração traz os CSTs
-- em sequência. Com 3 códigos: compra | venda dentro do estado | venda
-- fora do estado. Com 2 códigos: compra | venda (igual dentro e fora).
-- ---------------------------------------------------------------------
create table public.config_tributarias (
  id                          uuid primary key default gen_random_uuid(),
  nome                        text not null unique,
  descricao_microvix          text unique,       -- texto exato do Microvix (usado na importação)
  cst_compra                  char(3) not null,
  cst_venda_interna           char(3) not null,
  cst_venda_interestadual     char(3) not null,
  pis_cofins_cst              char(2) not null default '01',
  beneficio_interno           text,              -- código de benefício fiscal (cBenef), ex.: SP010360
  beneficio_interestadual     text,
  reducao_base_interestadual  numeric(5,2) not null default 0,  -- % de redução da base fora do estado
  observacao                  text,
  ativo                       boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

-- ---------------------------------------------------------------------
-- Produtos (catálogo único, vale para todas as lojas; saldo por loja
-- fica no módulo de estoque)
-- ---------------------------------------------------------------------
create table public.produtos (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  codigo_barras         text,
  referencia            text,
  descricao             text not null,
  unidade               text not null default 'UN',
  ncm                   text,
  cest                  text,
  grupo                 text,
  marca                 text,
  preco_venda           numeric(12,2) not null default 0,
  preco_custo           numeric(12,4),
  estoque_minimo        numeric(12,3),
  peso_kg               numeric(12,3),           -- peso por unidade de venda
  peso_insignificante   boolean not null default false,  -- fica em branco no romaneio e não soma
  peso_sugerido_kg      numeric(12,3),           -- tirado do nome do produto, aguardando conferência
  vem_em_saco           boolean not null default false,
  config_tributaria_id  uuid references public.config_tributarias(id),
  ativo                 boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index produtos_descricao_trgm on public.produtos using gin (descricao extensions.gin_trgm_ops);
create index produtos_codigo_barras_idx on public.produtos (codigo_barras);
create index produtos_ativo_idx on public.produtos (ativo);

-- ---------------------------------------------------------------------
-- Clientes e fornecedores
-- ---------------------------------------------------------------------
create table public.pessoas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text unique,                 -- código no Microvix, quando houver
  tipo               text not null default 'cliente' check (tipo in ('cliente','fornecedor','ambos')),
  pessoa             char(1) not null default 'F' check (pessoa in ('F','J')),
  cpf_cnpj           text,
  nome               text not null,
  fantasia           text,
  inscricao_estadual text,
  telefone           text,
  celular            text,
  email              text,
  cep                text,
  logradouro         text,
  numero             text,
  complemento        text,
  bairro             text,
  cidade             text,
  uf                 char(2),
  latitude           numeric(10,7),
  longitude          numeric(10,7),
  limite_credito     numeric(12,2),
  dia_entrega        text,                        -- dia fixo de entrega, quando houver (ex.: 'terça')
  nome_mistura       text,                        -- nome do item quando o pedido é mistura (ex.: 'Mistura do Guisinho')
  observacoes        text,
  ativo              boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index pessoas_nome_trgm on public.pessoas using gin (nome extensions.gin_trgm_ops);
create index pessoas_cpf_cnpj_idx on public.pessoas (cpf_cnpj);

-- ---------------------------------------------------------------------
-- Veículos e motoristas
-- ---------------------------------------------------------------------
create table public.veiculos (
  id            uuid primary key default gen_random_uuid(),
  descricao     text not null,
  placa         text,
  capacidade_kg numeric(10,2),
  ativo         boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.motoristas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  funcao      text not null default 'motorista' check (funcao in ('motorista','ajudante','ambos')),
  telefone    text,
  usuario_id  uuid references public.usuarios(id),  -- login no sistema, se tiver
  veiculo_id  uuid references public.veiculos(id),  -- veículo que costuma usar
  ativo       boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

-- ---------------------------------------------------------------------
-- Carimbo e auditoria
-- ---------------------------------------------------------------------
create trigger carimbo before insert or update on public.config_tributarias for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.produtos           for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.pessoas            for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.veiculos           for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.motoristas         for each row execute function public.tg_carimbo();

create trigger auditoria after insert or update or delete on public.config_tributarias for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.produtos           for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.pessoas            for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.veiculos           for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.motoristas         for each row execute function public.tg_auditoria();

-- ---------------------------------------------------------------------
-- RLS — leitura para qualquer usuário ativo (vendas, entregas e caixa
-- precisam consultar), escrita conforme permissão. Sem DELETE.
-- ---------------------------------------------------------------------
alter table public.config_tributarias enable row level security;
alter table public.produtos           enable row level security;
alter table public.pessoas            enable row level security;
alter table public.veiculos           enable row level security;
alter table public.motoristas         enable row level security;

create policy config_trib_ver    on public.config_tributarias for select to authenticated using (public.usuario_ativo());
create policy config_trib_criar  on public.config_tributarias for insert to authenticated with check (public.pode('cadastros.produtos','editar'));
create policy config_trib_editar on public.config_tributarias for update to authenticated using (public.pode('cadastros.produtos','editar'));

create policy produtos_ver    on public.produtos for select to authenticated using (public.usuario_ativo());
create policy produtos_criar  on public.produtos for insert to authenticated with check (public.pode('cadastros.produtos','criar'));
create policy produtos_editar on public.produtos for update to authenticated
  using (public.pode('cadastros.produtos','editar') or public.pode('entregas.romaneios','criar'));

create policy pessoas_ver    on public.pessoas for select to authenticated using (public.usuario_ativo());
create policy pessoas_criar  on public.pessoas for insert to authenticated with check (public.pode('cadastros.pessoas','criar'));
create policy pessoas_editar on public.pessoas for update to authenticated using (public.pode('cadastros.pessoas','editar'));

create policy veiculos_ver    on public.veiculos for select to authenticated using (public.usuario_ativo());
create policy veiculos_criar  on public.veiculos for insert to authenticated with check (public.pode('cadastros.motoristas','criar'));
create policy veiculos_editar on public.veiculos for update to authenticated using (public.pode('cadastros.motoristas','editar'));

create policy motoristas_ver    on public.motoristas for select to authenticated using (public.usuario_ativo());
create policy motoristas_criar  on public.motoristas for insert to authenticated with check (public.pode('cadastros.motoristas','criar'));
create policy motoristas_editar on public.motoristas for update to authenticated using (public.pode('cadastros.motoristas','editar'));

-- Quem monta romaneio pode corrigir o peso do produto (regra do romaneio);
-- os demais campos continuam exigindo permissão de cadastro.
create or replace function public.tg_produtos_restringe_romaneio()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.pode('cadastros.produtos','editar') and public.pode('entregas.romaneios','criar') then
    if (to_jsonb(new) - array['peso_kg','peso_insignificante','peso_sugerido_kg','updated_at','updated_by'])
       is distinct from (to_jsonb(old) - array['peso_kg','peso_insignificante','peso_sugerido_kg','updated_at','updated_by']) then
      raise exception 'Seu perfil só pode alterar o peso do produto.';
    end if;
  end if;
  return new;
end $$;
create trigger restringe_romaneio before update on public.produtos
  for each row execute function public.tg_produtos_restringe_romaneio();
revoke execute on function public.tg_produtos_restringe_romaneio() from public, anon, authenticated;

-- Aceita de uma vez os pesos sugeridos (tirados do nome) dos produtos ainda sem peso.
-- Roda com as permissões de quem chama (RLS vale normalmente).
create or replace function public.aceitar_pesos_sugeridos()
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  update produtos set peso_kg = peso_sugerido_kg, peso_sugerido_kg = null
   where peso_kg is null and peso_sugerido_kg is not null and not peso_insignificante;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.aceitar_pesos_sugeridos() from public, anon;
grant execute on function public.aceitar_pesos_sugeridos() to authenticated;

-- ---------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------
-- As configurações tributárias são criadas pela importação do Microvix
-- (tela Produtos › Importar), lendo o texto de cada configuração.

insert into public.motoristas (nome, funcao) values
  ('Daniel', 'motorista'), ('Betinho', 'motorista'), ('Claudinho', 'motorista'),
  ('Diego', 'motorista'), ('Nano', 'motorista');

-- último romaneio feito no processo antigo: 0126
update public.parametros set valor = '127'::jsonb where chave = 'proximo_romaneio';
