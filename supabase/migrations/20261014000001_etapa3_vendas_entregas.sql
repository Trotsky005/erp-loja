-- =====================================================================
-- ERP Loja — Etapa 3: vendas (pedidos, sem nota fiscal na fase de testes),
-- saída da mercadoria (balcão / entrega), entregas e romaneios.
--
-- Fluxo:
--   venda → cada item sai "agora" no balcão, fica para "retirar depois"
--   ou vai para "entrega" → entregas aparecem no quadro → romaneio
--   (soma itens, peso, misturas, motorista) → retorno da rota.
-- Saldo de cada item = quantidade vendida − saídas (balcão + entregas).
--
-- Todas as gravações passam por funções (security definer) que conferem
-- a permissão do usuário com pode()/tem_acesso_loja(); as tabelas só têm
-- política de leitura. Nada é apagado: venda e romaneio são cancelados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Formas de pagamento (configuráveis)
-- ---------------------------------------------------------------------
create table public.formas_pagamento (
  codigo        text primary key,
  nome          text not null,
  ordem         int  not null default 0,
  permite_troco boolean not null default false,
  ativo         boolean not null default true
);
insert into public.formas_pagamento (codigo, nome, ordem, permite_troco) values
  ('dinheiro',       'Dinheiro',          10, true),
  ('pix',            'PIX',               20, false),
  ('cartao_debito',  'Cartão de débito',  30, false),
  ('cartao_credito', 'Cartão de crédito', 40, false),
  ('crediario',      'Crediário da loja', 50, false),
  ('boleto',         'Boleto',            60, false);

-- ---------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------
create sequence public.vendas_numero_seq;

create table public.vendas (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint not null unique default nextval('public.vendas_numero_seq'),
  loja_id             uuid not null references public.lojas(id),
  cliente_id          uuid references public.pessoas(id),
  cliente_nome        text,                        -- consumidor sem cadastro
  status              text not null default 'finalizada' check (status in ('finalizada','cancelada')),
  subtotal            numeric(12,2) not null default 0,
  desconto            numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  teste               boolean not null default true,  -- fase de testes: pedido sem nota fiscal
  nf_numero           text,
  observacoes         text,
  entrega_endereco    text,
  entrega_data        date,
  entrega_obs         text,
  cancelada_em        timestamptz,
  cancelada_por       uuid,
  motivo_cancelamento text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index vendas_loja_data_idx on public.vendas (loja_id, created_at desc);
create index vendas_cliente_idx on public.vendas (cliente_id);

create table public.venda_itens (
  id             uuid primary key default gen_random_uuid(),
  venda_id       uuid not null references public.vendas(id),
  ordem          int  not null default 0,
  produto_id     uuid not null references public.produtos(id),
  codigo         text not null,          -- cópia do cadastro no momento da venda
  descricao      text not null,
  unidade        text not null,
  quantidade     numeric(12,3) not null check (quantidade > 0),
  preco_unitario numeric(12,4) not null,
  desconto       numeric(12,2) not null default 0,
  total          numeric(12,2) not null,
  destino        text not null default 'balcao' check (destino in ('balcao','entrega')) -- como sai o que não saiu na hora
);
create index venda_itens_venda_idx on public.venda_itens (venda_id);

create table public.venda_pagamentos (
  id        uuid primary key default gen_random_uuid(),
  venda_id  uuid not null references public.vendas(id),
  forma     text not null references public.formas_pagamento(codigo),
  valor     numeric(12,2) not null check (valor > 0),
  parcelas  int not null default 1
);
create index venda_pagamentos_venda_idx on public.venda_pagamentos (venda_id);

-- ---------------------------------------------------------------------
-- Romaneios, entregas e saídas
-- ---------------------------------------------------------------------
create table public.romaneios (
  id                  uuid primary key default gen_random_uuid(),
  numero              int  not null unique,
  data                date not null default (now() at time zone 'America/Sao_Paulo')::date,
  motorista_id        uuid references public.motoristas(id),
  ajudante_id         uuid references public.motoristas(id),
  veiculo_id          uuid references public.veiculos(id),
  status              text not null default 'em_rota' check (status in ('em_rota','finalizado','cancelado')),
  peso_total          numeric(12,3) not null default 0,
  sacos               numeric(12,3) not null default 0,
  observacao          text,
  finalizado_em       timestamptz,
  motivo_cancelamento text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.entregas (
  id            uuid primary key default gen_random_uuid(),
  venda_id      uuid not null unique references public.vendas(id),
  status        text not null default 'a_separar' check (status in ('a_separar','em_rota','entregue','cancelada')),
  romaneio_id   uuid references public.romaneios(id),   -- romaneio atual, enquanto em rota
  endereco      text,
  data_prevista date,
  observacao    text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index entregas_status_idx on public.entregas (status);

create table public.romaneio_entregas (
  romaneio_id       uuid not null references public.romaneios(id),
  entrega_id        uuid not null references public.entregas(id),
  ordem             int  not null default 0,
  mistura           boolean not null default false,   -- itens da venda saem como um único item em sacos
  mistura_nome      text,
  mistura_sacos     numeric(12,3),
  mistura_peso_saco numeric(12,3),
  resultado         text check (resultado in ('entregue','parcial','nao_entregue')),
  obs_retorno       text,
  primary key (romaneio_id, entrega_id)
);

create table public.romaneio_itens (
  id                   uuid primary key default gen_random_uuid(),
  romaneio_id          uuid not null references public.romaneios(id),
  entrega_id           uuid not null references public.entregas(id),
  venda_item_id        uuid not null references public.venda_itens(id),
  quantidade           numeric(12,3) not null check (quantidade > 0),  -- o que foi carregado
  peso_unit            numeric(12,3),                                    -- null = insignificante
  quantidade_entregue  numeric(12,3),
  unique (romaneio_id, venda_item_id)
);

create table public.saidas (
  id          uuid primary key default gen_random_uuid(),
  venda_id    uuid not null references public.vendas(id),
  tipo        text not null check (tipo in ('balcao','entrega')),
  romaneio_id uuid references public.romaneios(id),
  data        timestamptz not null default now(),
  observacao  text,
  cancelada   boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index saidas_venda_idx on public.saidas (venda_id);

create table public.saida_itens (
  saida_id      uuid not null references public.saidas(id),
  venda_item_id uuid not null references public.venda_itens(id),
  quantidade    numeric(12,3) not null check (quantidade > 0),
  primary key (saida_id, venda_item_id)
);
create index saida_itens_item_idx on public.saida_itens (venda_item_id);

-- Saldo por item: vendido − já saiu
create view public.venda_itens_saldo with (security_invoker = on) as
select vi.*,
       coalesce(s.saiu, 0)                 as saiu,
       vi.quantidade - coalesce(s.saiu, 0) as saldo
  from public.venda_itens vi
  left join (
    select si.venda_item_id, sum(si.quantidade) as saiu
      from public.saida_itens si
      join public.saidas sa on sa.id = si.saida_id
     where not sa.cancelada
     group by si.venda_item_id
  ) s on s.venda_item_id = vi.id;

-- Resumo para a lista de vendas (situação da saída da mercadoria)
create view public.vendas_resumo with (security_invoker = on) as
select v.*,
       coalesce(pe.nome, v.cliente_nome) as cliente,
       (select count(*) from public.venda_itens_saldo s
         where s.venda_id = v.id and s.destino = 'balcao' and s.saldo > 0) as itens_retirar,
       (select count(*) from public.venda_itens_saldo s
         where s.venda_id = v.id and s.destino = 'entrega' and s.saldo > 0) as itens_entregar,
       en.id     as entrega_id,
       en.status as entrega_status
  from public.vendas v
  left join public.pessoas  pe on pe.id = v.cliente_id
  left join public.entregas en on en.venda_id = v.id;

-- ---------------------------------------------------------------------
-- Carimbo e auditoria
-- ---------------------------------------------------------------------
create trigger carimbo before insert or update on public.vendas    for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.entregas  for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.romaneios for each row execute function public.tg_carimbo();
create trigger carimbo before insert or update on public.saidas    for each row execute function public.tg_carimbo();

create trigger auditoria after insert or update or delete on public.vendas    for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.entregas  for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.romaneios for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.saidas    for each row execute function public.tg_auditoria();
create trigger auditoria after insert or update or delete on public.formas_pagamento for each row execute function public.tg_auditoria();

-- ---------------------------------------------------------------------
-- RLS — só leitura; gravação pelas funções abaixo
-- ---------------------------------------------------------------------
alter table public.formas_pagamento  enable row level security;
alter table public.vendas            enable row level security;
alter table public.venda_itens       enable row level security;
alter table public.venda_pagamentos  enable row level security;
alter table public.romaneios         enable row level security;
alter table public.entregas          enable row level security;
alter table public.romaneio_entregas enable row level security;
alter table public.romaneio_itens    enable row level security;
alter table public.saidas            enable row level security;
alter table public.saida_itens       enable row level security;

create policy formas_ver    on public.formas_pagamento for select to authenticated using (public.usuario_ativo());
create policy formas_criar  on public.formas_pagamento for insert to authenticated with check (public.pode('admin.parametros','editar'));
create policy formas_editar on public.formas_pagamento for update to authenticated using (public.pode('admin.parametros','editar'));

create policy vendas_ver on public.vendas for select to authenticated
  using (public.tem_acesso_loja(loja_id)
         and (public.pode('vendas.pdv','ver') or public.pode('entregas.quadro','ver') or public.pode('entregas.romaneios','ver')));
create policy venda_itens_ver      on public.venda_itens      for select to authenticated using (exists (select 1 from public.vendas v where v.id = venda_id));
create policy venda_pagamentos_ver on public.venda_pagamentos for select to authenticated using (exists (select 1 from public.vendas v where v.id = venda_id));
create policy entregas_ver         on public.entregas         for select to authenticated using (exists (select 1 from public.vendas v where v.id = venda_id));
create policy saidas_ver           on public.saidas           for select to authenticated using (exists (select 1 from public.vendas v where v.id = venda_id));
create policy saida_itens_ver      on public.saida_itens      for select to authenticated using (exists (select 1 from public.saidas s where s.id = saida_id));
create policy romaneios_ver on public.romaneios for select to authenticated
  using (public.pode('entregas.romaneios','ver') or public.pode('entregas.quadro','ver'));
create policy romaneio_entregas_ver on public.romaneio_entregas for select to authenticated using (exists (select 1 from public.romaneios r where r.id = romaneio_id));
create policy romaneio_itens_ver    on public.romaneio_itens    for select to authenticated using (exists (select 1 from public.romaneios r where r.id = romaneio_id));

-- ---------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------

-- Recalcula a entrega de uma venda que não está em rota:
-- ainda tem saldo a entregar → "a separar"; senão → "entregue".
create or replace function public._recalcular_entrega(p_venda uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update entregas e
     set status = case when exists (select 1 from venda_itens_saldo s
                                     where s.venda_id = e.venda_id and s.destino = 'entrega' and s.saldo > 0)
                       then 'a_separar' else 'entregue' end,
         romaneio_id = null
   where e.venda_id = p_venda and e.status in ('a_separar','em_rota');
end $$;

-- Alterar preço ou dar desconto acima do limite exige permissão de gerência
-- (vendas.pdv / cancelar).
create or replace function public._pode_gerenciar_venda()
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode('vendas.pdv','cancelar');
$$;

-- ---------------------------------------------------------------------
-- finalizar_venda(p jsonb)
-- p = { loja_id, cliente_id?, cliente_nome?, desconto?, observacoes?,
--       entrega: { endereco?, data?, obs? },
--       itens: [ { produto_id, quantidade, preco_unitario?, desconto?, agora, destino:'balcao'|'entrega' } ],
--       pagamentos: [ { forma, valor, parcelas? } ] }
-- "agora" = quanto sai no balcão no ato; o resto fica para retirar depois
-- (destino balcão) ou vai para entrega.
-- ---------------------------------------------------------------------
create or replace function public.finalizar_venda(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_loja   uuid := nullif(p->>'loja_id','')::uuid;
  v_id     uuid;
  v_num    bigint;
  v_item   jsonb;
  v_prod   produtos%rowtype;
  v_vi     uuid;
  v_qtd    numeric; v_preco numeric; v_desc numeric; v_tot numeric; v_agora numeric;
  v_bruto  numeric := 0;
  v_sub    numeric := 0;
  v_descv  numeric := round(coalesce(nullif(p->>'desconto','')::numeric, 0), 2);
  v_total  numeric;
  v_pag    numeric;
  v_saida  uuid;
  v_ordem  int := 0;
  v_tem_entrega boolean := false;
  v_lim    numeric;
begin
  if not public.pode('vendas.pdv','criar') then raise exception 'Seu perfil não pode registrar vendas.'; end if;
  if v_loja is null or not public.tem_acesso_loja(v_loja) then raise exception 'Escolha uma loja válida.'; end if;
  if jsonb_array_length(coalesce(p->'itens','[]'::jsonb)) = 0 then raise exception 'A venda não tem itens.'; end if;
  if v_descv < 0 then raise exception 'Desconto inválido.'; end if;

  insert into vendas (loja_id, cliente_id, cliente_nome, observacoes, entrega_endereco, entrega_data, entrega_obs)
  values (v_loja,
          nullif(p->>'cliente_id','')::uuid,
          nullif(trim(p->>'cliente_nome'),''),
          nullif(trim(p->>'observacoes'),''),
          nullif(trim(p->'entrega'->>'endereco'),''),
          nullif(p->'entrega'->>'data','')::date,
          nullif(trim(p->'entrega'->>'obs'),''))
  returning id, numero into v_id, v_num;

  for v_item in select * from jsonb_array_elements(p->'itens') loop
    select * into v_prod from produtos where id = nullif(v_item->>'produto_id','')::uuid;
    if not found then raise exception 'Produto não encontrado.'; end if;
    if not v_prod.ativo then raise exception 'O produto % está inativo.', v_prod.descricao; end if;

    v_qtd := nullif(v_item->>'quantidade','')::numeric;
    if v_qtd is null or v_qtd <= 0 then raise exception 'Quantidade inválida em %.', v_prod.descricao; end if;

    v_preco := coalesce(nullif(v_item->>'preco_unitario','')::numeric, v_prod.preco_venda);
    if v_preco <> v_prod.preco_venda and not public._pode_gerenciar_venda() then
      raise exception 'Seu perfil não pode alterar o preço de %.', v_prod.descricao;
    end if;
    if v_preco < 0 then raise exception 'Preço inválido em %.', v_prod.descricao; end if;

    v_desc := round(coalesce(nullif(v_item->>'desconto','')::numeric, 0), 2);
    v_tot  := round(v_qtd * v_preco - v_desc, 2);
    if v_desc < 0 or v_tot < 0 then raise exception 'Desconto inválido em %.', v_prod.descricao; end if;

    v_agora := coalesce(nullif(v_item->>'agora','')::numeric, 0);
    if v_agora < 0 or v_agora > v_qtd then raise exception 'Quantidade que sai agora inválida em %.', v_prod.descricao; end if;

    v_ordem := v_ordem + 1;
    insert into venda_itens (venda_id, ordem, produto_id, codigo, descricao, unidade, quantidade, preco_unitario, desconto, total, destino)
    values (v_id, v_ordem, v_prod.id, v_prod.codigo, v_prod.descricao, v_prod.unidade, v_qtd, v_preco, v_desc, v_tot,
            case when v_item->>'destino' = 'entrega' then 'entrega' else 'balcao' end)
    returning id into v_vi;

    v_bruto := v_bruto + round(v_qtd * v_prod.preco_venda, 2);
    v_sub   := v_sub + v_tot;

    if v_agora > 0 then
      if v_saida is null then
        insert into saidas (venda_id, tipo, observacao) values (v_id, 'balcao', 'Retirado no ato da venda') returning id into v_saida;
      end if;
      insert into saida_itens (saida_id, venda_item_id, quantidade) values (v_saida, v_vi, v_agora);
    end if;

    if v_item->>'destino' = 'entrega' and v_agora < v_qtd then v_tem_entrega := true; end if;
  end loop;

  v_total := round(v_sub - v_descv, 2);
  if v_total < 0 then raise exception 'O desconto é maior que o valor da venda.'; end if;

  -- limite de desconto para quem não é gerência (parâmetro desconto_maximo_caixa, em %)
  if not public._pode_gerenciar_venda() and v_bruto > 0 then
    select coalesce((valor #>> '{}')::numeric, 0) into v_lim from parametros where chave = 'desconto_maximo_caixa';
    if (v_bruto - v_total) / v_bruto * 100 > coalesce(v_lim, 0) + 0.001 then
      raise exception 'Desconto de % %% passa do limite de % %% do seu perfil.',
        round((v_bruto - v_total) / v_bruto * 100, 1), coalesce(v_lim, 0);
    end if;
  end if;

  update vendas set subtotal = v_sub, desconto = v_descv, total = v_total where id = v_id;

  insert into venda_pagamentos (venda_id, forma, valor, parcelas)
  select v_id, x->>'forma', round((x->>'valor')::numeric, 2), greatest(coalesce(nullif(x->>'parcelas','')::int, 1), 1)
    from jsonb_array_elements(coalesce(p->'pagamentos','[]'::jsonb)) x
   where coalesce(nullif(x->>'valor','')::numeric, 0) > 0;

  select coalesce(sum(valor), 0) into v_pag from venda_pagamentos where venda_id = v_id;
  if v_pag <> v_total then
    raise exception 'Os pagamentos somam R$ % e a venda é de R$ %.',
      replace(to_char(v_pag, 'FM999999990.00'), '.', ','), replace(to_char(v_total, 'FM999999990.00'), '.', ',');
  end if;

  if v_tem_entrega then
    insert into entregas (venda_id, endereco, data_prevista, observacao)
    select id, entrega_endereco, entrega_data, entrega_obs from vendas where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'numero', v_num);
end $$;

-- ---------------------------------------------------------------------
-- registrar_retirada: cliente busca no balcão parte do saldo
-- p_itens = [ { venda_item_id, quantidade } ]
-- ---------------------------------------------------------------------
create or replace function public.registrar_retirada(p_venda uuid, p_itens jsonb, p_obs text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_venda vendas%rowtype;
  v_saida uuid;
  x       jsonb;
  v_q     numeric;
  v_saldo numeric;
  v_item  uuid;
begin
  select * into v_venda from vendas where id = p_venda;
  if not found or not public.tem_acesso_loja(v_venda.loja_id) then raise exception 'Venda não encontrada.'; end if;
  if not (public.pode('vendas.pdv','criar') or public.pode('entregas.quadro','editar')) then
    raise exception 'Seu perfil não pode registrar retiradas.';
  end if;
  if v_venda.status = 'cancelada' then raise exception 'Esta venda foi cancelada.'; end if;

  insert into saidas (venda_id, tipo, observacao) values (p_venda, 'balcao', nullif(trim(p_obs),'')) returning id into v_saida;

  for x in select * from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) loop
    v_q := coalesce(nullif(x->>'quantidade','')::numeric, 0);
    if v_q <= 0 then continue; end if;
    v_item := (x->>'venda_item_id')::uuid;
    select saldo into v_saldo from venda_itens_saldo where id = v_item and venda_id = p_venda;
    if v_saldo is null then raise exception 'Item não pertence a esta venda.'; end if;
    if v_q > v_saldo then raise exception 'Quantidade maior que o saldo (%).', v_saldo; end if;
    if exists (select 1 from romaneio_itens ri join romaneios r on r.id = ri.romaneio_id
                where ri.venda_item_id = v_item and r.status = 'em_rota') then
      raise exception 'Um dos itens está em rota de entrega; registre o retorno do romaneio antes.';
    end if;
    insert into saida_itens (saida_id, venda_item_id, quantidade) values (v_saida, v_item, v_q);
  end loop;

  if not exists (select 1 from saida_itens where saida_id = v_saida) then
    raise exception 'Informe a quantidade retirada de pelo menos um item.';
  end if;

  perform public._recalcular_entrega(p_venda);
  return v_saida;
end $$;

-- ---------------------------------------------------------------------
-- cancelar_venda
-- ---------------------------------------------------------------------
create or replace function public.cancelar_venda(p_venda uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_venda vendas%rowtype;
begin
  select * into v_venda from vendas where id = p_venda for update;
  if not found or not public.tem_acesso_loja(v_venda.loja_id) then raise exception 'Venda não encontrada.'; end if;
  if not public.pode('vendas.pdv','cancelar') then raise exception 'Seu perfil não pode cancelar vendas.'; end if;
  if v_venda.status = 'cancelada' then raise exception 'A venda já está cancelada.'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if exists (select 1 from entregas where venda_id = p_venda and status = 'em_rota') then
    raise exception 'A venda está em rota de entrega. Registre o retorno do romaneio antes de cancelar.';
  end if;

  update vendas set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancelamento = trim(p_motivo)
   where id = p_venda;
  update entregas set status = 'cancelada', romaneio_id = null where venda_id = p_venda and status <> 'entregue';
end $$;

-- ---------------------------------------------------------------------
-- criar_romaneio(p jsonb)
-- p = { motorista_id?, ajudante_id?, veiculo_id?, observacao?,
--       entregas: [ { entrega_id, mistura?, mistura_nome?, mistura_sacos?, mistura_peso_saco? } ],
--       itens:    [ { entrega_id, venda_item_id, quantidade } ],      -- o que vai na carga
--       pesos:    [ { produto_id, peso_kg?, insignificante? } ] }       -- pesos informados na hora
-- ---------------------------------------------------------------------
create or replace function public.criar_romaneio(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_num   int;
  e       jsonb;
  x       jsonb;
  v_ent   entregas%rowtype;
  v_vi    venda_itens%rowtype;
  v_prod  produtos%rowtype;
  v_loja  uuid;
  v_q     numeric;
  v_saldo numeric;
  v_mist  boolean;
  v_sacos_m numeric;
  v_peso_saco numeric;
  v_peso_total numeric := 0;
  v_sacos numeric := 0;
  v_ordem int := 0;
  v_padrao_saco numeric;
begin
  if not public.pode('entregas.romaneios','criar') then raise exception 'Seu perfil não pode montar romaneios.'; end if;
  if jsonb_array_length(coalesce(p->'entregas','[]'::jsonb)) = 0 then raise exception 'Escolha pelo menos uma entrega.'; end if;

  -- pesos informados na hora ficam salvos no cadastro do produto
  for x in select * from jsonb_array_elements(coalesce(p->'pesos','[]'::jsonb)) loop
    if coalesce((x->>'insignificante')::boolean, false) then
      update produtos set peso_kg = null, peso_insignificante = true, peso_sugerido_kg = null where id = (x->>'produto_id')::uuid;
    elsif coalesce(nullif(x->>'peso_kg','')::numeric, 0) > 0 then
      update produtos set peso_kg = (x->>'peso_kg')::numeric, peso_insignificante = false, peso_sugerido_kg = null where id = (x->>'produto_id')::uuid;
    end if;
  end loop;

  select coalesce((valor #>> '{}')::numeric, 50) into v_padrao_saco from parametros where chave = 'saco_mistura_kg';
  v_padrao_saco := coalesce(v_padrao_saco, 50);

  -- número sequencial (continua a numeração antiga)
  select (valor #>> '{}')::int into v_num from parametros where chave = 'proximo_romaneio' for update;
  if v_num is null then select coalesce(max(numero), 0) + 1 into v_num from romaneios; end if;
  while exists (select 1 from romaneios where numero = v_num) loop v_num := v_num + 1; end loop;
  update parametros set valor = to_jsonb(v_num + 1) where chave = 'proximo_romaneio';

  insert into romaneios (numero, motorista_id, ajudante_id, veiculo_id, observacao)
  values (v_num, nullif(p->>'motorista_id','')::uuid, nullif(p->>'ajudante_id','')::uuid,
          nullif(p->>'veiculo_id','')::uuid, nullif(trim(p->>'observacao'),''))
  returning id into v_id;

  for e in select * from jsonb_array_elements(p->'entregas') loop
    select * into v_ent from entregas where id = (e->>'entrega_id')::uuid for update;
    if not found then raise exception 'Entrega não encontrada.'; end if;
    select loja_id into v_loja from vendas where id = v_ent.venda_id;
    if not public.tem_acesso_loja(v_loja) then raise exception 'Entrega de loja sem acesso.'; end if;
    if v_ent.status <> 'a_separar' then
      raise exception 'A entrega da venda % não está disponível (situação: %).', (select numero from vendas where id = v_ent.venda_id), v_ent.status;
    end if;

    v_mist := coalesce((e->>'mistura')::boolean, false);
    v_sacos_m := nullif(e->>'mistura_sacos','')::numeric;
    v_peso_saco := coalesce(nullif(e->>'mistura_peso_saco','')::numeric, v_padrao_saco);
    if v_mist then
      if coalesce(v_sacos_m, 0) <= 0 then raise exception 'Informe quantos sacos tem a mistura.'; end if;
      v_sacos := v_sacos + v_sacos_m;
      v_peso_total := v_peso_total + v_sacos_m * v_peso_saco;
    end if;

    v_ordem := v_ordem + 1;
    insert into romaneio_entregas (romaneio_id, entrega_id, ordem, mistura, mistura_nome, mistura_sacos, mistura_peso_saco)
    values (v_id, v_ent.id, v_ordem, v_mist,
            case when v_mist then coalesce(nullif(trim(e->>'mistura_nome'),''), 'Mistura') end,
            case when v_mist then v_sacos_m end,
            case when v_mist then v_peso_saco end);
    update entregas set status = 'em_rota', romaneio_id = v_id where id = v_ent.id;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p->'itens','[]'::jsonb)) loop
    v_q := coalesce(nullif(x->>'quantidade','')::numeric, 0);
    if v_q <= 0 then continue; end if;
    select * into v_vi from venda_itens where id = (x->>'venda_item_id')::uuid;
    if not found then raise exception 'Item não encontrado.'; end if;
    select re.mistura into v_mist
      from romaneio_entregas re join entregas en on en.id = re.entrega_id
     where re.romaneio_id = v_id and re.entrega_id = (x->>'entrega_id')::uuid and en.venda_id = v_vi.venda_id;
    if not found then raise exception 'Item % não pertence às entregas escolhidas.', v_vi.descricao; end if;
    select saldo into v_saldo from venda_itens_saldo where id = v_vi.id;
    if v_q > v_saldo then raise exception 'Quantidade de % maior que o saldo a entregar (%).', v_vi.descricao, v_saldo; end if;

    select * into v_prod from produtos where id = v_vi.produto_id;
    if not v_mist and not v_prod.peso_insignificante and v_prod.peso_kg is null then
      raise exception 'Falta o peso de % (%).', v_prod.descricao, v_prod.codigo;
    end if;

    insert into romaneio_itens (romaneio_id, entrega_id, venda_item_id, quantidade, peso_unit)
    values (v_id, (x->>'entrega_id')::uuid, v_vi.id, v_q, case when v_prod.peso_insignificante then null else v_prod.peso_kg end);

    if not v_mist then
      v_peso_total := v_peso_total + v_q * coalesce(case when v_prod.peso_insignificante then 0 else v_prod.peso_kg end, 0);
      if v_prod.vem_em_saco or upper(v_prod.unidade) = 'SC' then v_sacos := v_sacos + v_q; end if;
    end if;
  end loop;

  if exists (select 1 from romaneio_entregas re where re.romaneio_id = v_id
              and not exists (select 1 from romaneio_itens ri where ri.romaneio_id = v_id and ri.entrega_id = re.entrega_id)) then
    raise exception 'Há entrega sem nenhum item na carga.';
  end if;

  update romaneios set peso_total = round(v_peso_total, 3), sacos = v_sacos where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num);
end $$;

-- ---------------------------------------------------------------------
-- retorno_romaneio: o que foi entregue
-- p = [ { entrega_id, resultado:'entregue'|'parcial'|'nao_entregue', obs?,
--         itens: [ { venda_item_id, quantidade } ] } ]   -- itens só no parcial
-- ---------------------------------------------------------------------
create or replace function public.retorno_romaneio(p_romaneio uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rom   romaneios%rowtype;
  e       jsonb;
  v_ent   entregas%rowtype;
  v_res   text;
  v_saida uuid;
  ri      romaneio_itens%rowtype;
  v_q     numeric;
begin
  if not (public.pode('entregas.quadro','editar') or public.pode('entregas.romaneios','criar')) then
    raise exception 'Seu perfil não pode registrar o retorno.';
  end if;
  select * into v_rom from romaneios where id = p_romaneio for update;
  if not found then raise exception 'Romaneio não encontrado.'; end if;
  if v_rom.status <> 'em_rota' then raise exception 'O romaneio % já foi %.', v_rom.numero, v_rom.status; end if;

  for e in select * from jsonb_array_elements(coalesce(p,'[]'::jsonb)) loop
    select * into v_ent from entregas where id = (e->>'entrega_id')::uuid for update;
    if not found or not exists (select 1 from romaneio_entregas where romaneio_id = p_romaneio and entrega_id = v_ent.id) then
      raise exception 'Entrega não pertence a este romaneio.';
    end if;
    v_res := e->>'resultado';
    if v_res not in ('entregue','parcial','nao_entregue') then raise exception 'Resultado inválido.'; end if;

    update romaneio_entregas set resultado = v_res, obs_retorno = nullif(trim(e->>'obs'),'')
     where romaneio_id = p_romaneio and entrega_id = v_ent.id;

    if v_res <> 'nao_entregue' then
      insert into saidas (venda_id, tipo, romaneio_id, observacao)
      values (v_ent.venda_id, 'entrega', p_romaneio, 'Romaneio ' || v_rom.numero) returning id into v_saida;

      for ri in select * from romaneio_itens where romaneio_id = p_romaneio and entrega_id = v_ent.id loop
        if v_res = 'entregue' then
          v_q := ri.quantidade;
        else
          select coalesce(nullif(y->>'quantidade','')::numeric, 0) into v_q
            from jsonb_array_elements(coalesce(e->'itens','[]'::jsonb)) y
           where (y->>'venda_item_id')::uuid = ri.venda_item_id;
          v_q := coalesce(v_q, 0);
        end if;
        if v_q < 0 or v_q > ri.quantidade then raise exception 'Quantidade entregue maior que a carregada.'; end if;
        update romaneio_itens set quantidade_entregue = v_q where id = ri.id;
        if v_q > 0 then insert into saida_itens (saida_id, venda_item_id, quantidade) values (v_saida, ri.venda_item_id, v_q); end if;
      end loop;

      if not exists (select 1 from saida_itens where saida_id = v_saida) then
        delete from saidas where id = v_saida;   -- parcial sem nada entregue
      end if;
    else
      update romaneio_itens set quantidade_entregue = 0 where romaneio_id = p_romaneio and entrega_id = v_ent.id;
    end if;

    perform public._recalcular_entrega(v_ent.venda_id);
  end loop;

  if exists (select 1 from romaneio_entregas where romaneio_id = p_romaneio and resultado is null) then
    raise exception 'Informe o retorno de todas as entregas do romaneio.';
  end if;

  update romaneios set status = 'finalizado', finalizado_em = now() where id = p_romaneio;
end $$;

-- ---------------------------------------------------------------------
-- cancelar_romaneio: desfaz a carga (entregas voltam para "a separar")
-- ---------------------------------------------------------------------
create or replace function public.cancelar_romaneio(p_romaneio uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rom romaneios%rowtype;
begin
  if not public.pode('entregas.romaneios','cancelar') then raise exception 'Seu perfil não pode cancelar romaneios.'; end if;
  select * into v_rom from romaneios where id = p_romaneio for update;
  if not found then raise exception 'Romaneio não encontrado.'; end if;
  if v_rom.status <> 'em_rota' then raise exception 'Só é possível cancelar romaneio em rota.'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;

  update romaneios set status = 'cancelado', motivo_cancelamento = trim(p_motivo) where id = p_romaneio;
  update entregas set status = 'a_separar', romaneio_id = null where romaneio_id = p_romaneio and status = 'em_rota';
end $$;

-- ---------------------------------------------------------------------
-- Execução: só usuários logados; funções internas ninguém chama direto
-- ---------------------------------------------------------------------
revoke execute on function public._recalcular_entrega(uuid)              from public, anon, authenticated;
revoke execute on function public._pode_gerenciar_venda()                from public, anon, authenticated;
revoke execute on function public.finalizar_venda(jsonb)                 from public, anon;
revoke execute on function public.registrar_retirada(uuid, jsonb, text)  from public, anon;
revoke execute on function public.cancelar_venda(uuid, text)             from public, anon;
revoke execute on function public.criar_romaneio(jsonb)                  from public, anon;
revoke execute on function public.retorno_romaneio(uuid, jsonb)          from public, anon;
revoke execute on function public.cancelar_romaneio(uuid, text)          from public, anon;
grant  execute on function public.finalizar_venda(jsonb)                 to authenticated;
grant  execute on function public.registrar_retirada(uuid, jsonb, text)  to authenticated;
grant  execute on function public.cancelar_venda(uuid, text)             to authenticated;
grant  execute on function public.criar_romaneio(jsonb)                  to authenticated;
grant  execute on function public.retorno_romaneio(uuid, jsonb)          to authenticated;
grant  execute on function public.cancelar_romaneio(uuid, text)          to authenticated;

-- ---------------------------------------------------------------------
-- Menu / permissões
-- ---------------------------------------------------------------------
update public.recursos set nome = 'Vendas (pedidos)' where codigo = 'vendas.pdv';
