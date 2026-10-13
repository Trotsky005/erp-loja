-- =====================================================================
-- ERP Loja — Etapa 1: base (lojas, usuários, perfis, permissões,
-- parâmetros e auditoria)
-- Regras: nada é apagado (sem DELETE; usar "ativo"), toda tabela
-- importante tem auditoria e RLS.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table public.lojas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             int  not null unique,
  nome               text not null,
  razao_social       text,
  cnpj               text,
  inscricao_estadual text,
  regime_tributario  text check (regime_tributario in ('simples_nacional','lucro_presumido','lucro_real')),
  cep                text,
  logradouro         text,
  numero             text,
  complemento        text,
  bairro             text,
  cidade             text,
  uf                 char(2),
  telefone           text,
  email              text,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);

create table public.perfis (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  descricao   text,
  -- administrador tem acesso total, independente da matriz de permissões
  admin       boolean not null default false,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- Catálogo de telas/recursos do sistema (cada módulo registra os seus)
create table public.recursos (
  codigo  text primary key,          -- ex.: 'admin.lojas'
  modulo  text not null,             -- ex.: 'Administrativo'
  nome    text not null,             -- ex.: 'Lojas'
  ordem   int  not null default 0
);

create table public.perfil_permissoes (
  perfil_id     uuid not null references public.perfis(id),
  recurso       text not null references public.recursos(codigo),
  pode_ver      boolean not null default false,
  pode_criar    boolean not null default false,
  pode_editar   boolean not null default false,
  pode_cancelar boolean not null default false,
  primary key (perfil_id, recurso)
);

create table public.usuarios (
  id           uuid primary key references auth.users(id),
  nome         text not null,
  email        text not null,
  perfil_id    uuid references public.perfis(id),
  todas_lojas  boolean not null default false,
  ativo        boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

create table public.usuario_lojas (
  usuario_id uuid not null references public.usuarios(id),
  loja_id    uuid not null references public.lojas(id),
  primary key (usuario_id, loja_id)
);

create table public.parametros (
  chave      text primary key,
  valor      jsonb not null,
  descricao  text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.auditoria (
  id          bigserial primary key,
  tabela      text not null,
  registro_id text,
  acao        text not null check (acao in ('INSERT','UPDATE','DELETE')),
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id  uuid,
  data        timestamptz not null default now()
);
create index auditoria_tabela_idx on public.auditoria (tabela, registro_id);
create index auditoria_data_idx   on public.auditoria (data desc);

-- ---------------------------------------------------------------------
-- Funções de apoio (permissões)
-- ---------------------------------------------------------------------

create or replace function public.usuario_ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select u.ativo from usuarios u where u.id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.admin
      from usuarios u join perfis p on p.id = u.perfil_id
     where u.id = auth.uid() and u.ativo and p.ativo
  ), false);
$$;

-- acao: 'ver' | 'criar' | 'editar' | 'cancelar'
create or replace function public.pode(p_recurso text, p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce((
    select case p_acao
             when 'ver'      then pp.pode_ver
             when 'criar'    then pp.pode_criar
             when 'editar'   then pp.pode_editar
             when 'cancelar' then pp.pode_cancelar
             else false end
      from usuarios u
      join perfil_permissoes pp on pp.perfil_id = u.perfil_id
     where u.id = auth.uid() and u.ativo and pp.recurso = p_recurso
  ), false);
$$;

create or replace function public.tem_acesso_loja(p_loja uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from usuarios u
     where u.id = auth.uid() and u.ativo
       and (u.todas_lojas or exists (
             select 1 from usuario_lojas ul
              where ul.usuario_id = u.id and ul.loja_id = p_loja))
  );
$$;

-- ---------------------------------------------------------------------
-- Triggers: updated_at/by, created_by e auditoria
-- ---------------------------------------------------------------------

create or replace function public.tg_carimbo()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.tg_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes  jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_id     text  := coalesce(v_depois->>'id', v_antes->>'id', v_depois->>'chave', v_antes->>'chave');
begin
  insert into auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, v_id, tg_op, v_antes, v_depois, auth.uid());
  return coalesce(new, old);
end $$;

create trigger carimbo before insert or update on public.lojas    for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.perfis   for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.usuarios for each row execute function public.tg_carimbo();

create or replace function public.tg_carimbo_parametros()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger carimbo before insert or update on public.parametros for each row execute function public.tg_carimbo_parametros();

create trigger auditoria after insert or update or delete on public.lojas             for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.perfis            for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.perfil_permissoes for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.usuarios          for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.usuario_lojas     for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.parametros        for each row execute function public.tg_auditoria();

-- ---------------------------------------------------------------------
-- Novo usuário do Supabase Auth → linha em "usuarios"
-- O primeiro usuário do sistema vira Administrador ativo; os demais
-- entram inativos até um administrador liberar perfil e lojas.
-- ---------------------------------------------------------------------

create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_primeiro boolean := not exists (select 1 from usuarios);
begin
  insert into usuarios (id, nome, email, perfil_id, todas_lojas, ativo, created_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    case when v_primeiro then (select id from perfis where admin order by created_at limit 1) end,
    v_primeiro,
    v_primeiro,
    new.id
  );
  return new;
end $$;

create trigger novo_usuario after insert on auth.users
  for each row execute function public.tg_novo_usuario();

-- ---------------------------------------------------------------------
-- Row Level Security
-- Nenhuma política de DELETE: nada é apagado, só desativado/cancelado.
-- ---------------------------------------------------------------------

alter table public.lojas             enable row level security;
alter table public.perfis            enable row level security;
alter table public.recursos          enable row level security;
alter table public.perfil_permissoes enable row level security;
alter table public.usuarios          enable row level security;
alter table public.usuario_lojas     enable row level security;
alter table public.parametros        enable row level security;
alter table public.auditoria         enable row level security;

-- lojas: cada um vê as lojas a que tem acesso
create policy lojas_ver    on public.lojas for select to authenticated using (public.tem_acesso_loja(id));
create policy lojas_criar  on public.lojas for insert to authenticated with check (public.pode('admin.lojas','criar'));
create policy lojas_editar on public.lojas for update to authenticated
  using (public.pode('admin.lojas','editar') and public.tem_acesso_loja(id))
  with check (public.pode('admin.lojas','editar'));

-- perfis, recursos e permissões: leitura para usuários ativos, escrita para quem pode
create policy perfis_ver    on public.perfis for select to authenticated using (public.usuario_ativo());
create policy perfis_criar  on public.perfis for insert to authenticated with check (public.pode('admin.perfis','criar'));
create policy perfis_editar on public.perfis for update to authenticated using (public.pode('admin.perfis','editar'));

create policy recursos_ver on public.recursos for select to authenticated using (public.usuario_ativo());

create policy permissoes_ver    on public.perfil_permissoes for select to authenticated using (public.usuario_ativo());
create policy permissoes_criar  on public.perfil_permissoes for insert to authenticated with check (public.pode('admin.perfis','editar'));
create policy permissoes_editar on public.perfil_permissoes for update to authenticated using (public.pode('admin.perfis','editar'));

-- usuarios: cada um vê o próprio cadastro; quem pode vê/edita todos
create policy usuarios_ver    on public.usuarios for select to authenticated
  using (id = auth.uid() or public.pode('admin.usuarios','ver'));
create policy usuarios_editar on public.usuarios for update to authenticated
  using (public.pode('admin.usuarios','editar'));

create policy usuario_lojas_ver on public.usuario_lojas for select to authenticated
  using (usuario_id = auth.uid() or public.pode('admin.usuarios','ver'));
create policy usuario_lojas_criar on public.usuario_lojas for insert to authenticated
  with check (public.pode('admin.usuarios','editar'));
-- vínculo usuário×loja é configuração, não movimento: pode ser removido
create policy usuario_lojas_remover on public.usuario_lojas for delete to authenticated
  using (public.pode('admin.usuarios','editar'));

create policy parametros_ver    on public.parametros for select to authenticated using (public.usuario_ativo());
create policy parametros_criar  on public.parametros for insert to authenticated with check (public.pode('admin.parametros','editar'));
create policy parametros_editar on public.parametros for update to authenticated using (public.pode('admin.parametros','editar'));

create policy auditoria_ver on public.auditoria for select to authenticated using (public.pode('admin.auditoria','ver'));

-- ---------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------

insert into public.perfis (nome, descricao, admin) values
  ('Administrador',        'Acesso total ao sistema',                 true),
  ('Gerente',              'Gestão das lojas, sem configurações',     false),
  ('Financeiro',           'Contas, caixa e conferência',             false),
  ('Caixa',                'Vendas e fechamento do próprio caixa',    false),
  ('Logística/Expedição',  'Entregas, romaneios e motoristas',        false),
  ('Motorista',            'Consulta e retorno das próprias entregas', false);

insert into public.recursos (codigo, modulo, nome, ordem) values
  ('admin.lojas',          'Administrativo', 'Lojas',                   10),
  ('admin.usuarios',       'Administrativo', 'Usuários',                20),
  ('admin.perfis',         'Administrativo', 'Perfis e permissões',     30),
  ('admin.parametros',     'Administrativo', 'Parâmetros globais',      40),
  ('admin.auditoria',      'Administrativo', 'Auditoria',               50),
  ('cadastros.produtos',   'Cadastros',      'Produtos',               110),
  ('cadastros.pessoas',    'Cadastros',      'Clientes e fornecedores', 120),
  ('cadastros.motoristas', 'Cadastros',      'Veículos e motoristas',  130),
  ('entregas.quadro',      'Entregas',       'Quadro de entregas',     210),
  ('entregas.romaneios',   'Entregas',       'Romaneios',              220),
  ('caixa.fechamento',     'Caixa',          'Fechamento de caixa',    310),
  ('caixa.conferencia',    'Caixa',          'Conferência de caixa',   320),
  ('financeiro.pagar',     'Financeiro',     'Contas a pagar',         410),
  ('financeiro.receber',   'Financeiro',     'Contas a receber',       420),
  ('estoque.movimento',    'Estoque',        'Estoque e compras',      510),
  ('vendas.pdv',           'Vendas',         'PDV / Venda rápida',     610),
  ('fiscal.notas',         'Fiscal',         'Notas fiscais',          710),
  ('relatorios.geral',     'Relatórios',     'Relatórios',             810);

-- Permissões padrão (o administrador pode mudar tudo depois na tela de perfis)
insert into public.perfil_permissoes (perfil_id, recurso, pode_ver, pode_criar, pode_editar, pode_cancelar)
select p.id, r.codigo, true, true, true, true
  from public.perfis p cross join public.recursos r
 where p.nome = 'Gerente' and r.codigo not like 'admin.%';

insert into public.perfil_permissoes (perfil_id, recurso, pode_ver, pode_criar, pode_editar, pode_cancelar)
select p.id, r.codigo, true, true, true, r.codigo <> 'caixa.fechamento'
  from public.perfis p cross join public.recursos r
 where p.nome = 'Financeiro'
   and r.codigo in ('caixa.fechamento','caixa.conferencia','financeiro.pagar','financeiro.receber','relatorios.geral','cadastros.pessoas');

insert into public.perfil_permissoes (perfil_id, recurso, pode_ver, pode_criar, pode_editar, pode_cancelar)
select p.id, r.codigo, true, true, r.codigo <> 'cadastros.pessoas', false
  from public.perfis p cross join public.recursos r
 where p.nome = 'Caixa'
   and r.codigo in ('vendas.pdv','caixa.fechamento','cadastros.pessoas');

insert into public.perfil_permissoes (perfil_id, recurso, pode_ver, pode_criar, pode_editar, pode_cancelar)
select p.id, r.codigo, true, true, true, true
  from public.perfis p cross join public.recursos r
 where p.nome = 'Logística/Expedição'
   and r.codigo in ('entregas.quadro','entregas.romaneios','cadastros.motoristas');

insert into public.perfil_permissoes (perfil_id, recurso, pode_ver, pode_criar, pode_editar, pode_cancelar)
select p.id, r.codigo, true, false, r.codigo = 'entregas.quadro', false
  from public.perfis p cross join public.recursos r
 where p.nome = 'Motorista'
   and r.codigo in ('entregas.quadro','entregas.romaneios');

insert into public.parametros (chave, valor, descricao) values
  ('venda_estoque_negativo', 'false'::jsonb, 'Permite vender produto sem saldo em estoque'),
  ('desconto_maximo_caixa',  '5'::jsonb,     'Desconto máximo (%) que o perfil Caixa pode dar sem autorização'),
  ('saco_mistura_kg',        '50'::jsonb,    'Peso padrão (kg) de um saco de mistura no romaneio'),
  ('proximo_romaneio',       'null'::jsonb,  'Próximo número de romaneio — preencher com o número seguinte ao último romaneio feito');

-- Lojas iniciais (podem ser editadas/completadas na tela de Lojas)
insert into public.lojas (codigo, nome) values
  (1, 'Casa de Ração'),
  (2, 'Material de Construção');
