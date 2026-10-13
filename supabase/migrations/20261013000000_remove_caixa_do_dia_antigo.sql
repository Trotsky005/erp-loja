-- Limpeza do projeto Supabase reaproveitado: remove as tabelas da versão
-- antiga do "Caixa do Dia" (que voltou a usar Google Planilhas).
-- Em um projeto novo/limpo este arquivo não faz nada.
drop table if exists public.lancamentos       cascade;
drop table if exists public.fechamentos       cascade;
drop table if exists public.contas_pagar      cascade;
drop table if exists public.boletos_receber   cascade;
drop table if exists public.contas_fixas      cascade;
drop table if exists public.cheques_recebidos cascade;
drop table if exists public.cheques_emitidos  cascade;
drop table if exists public.config            cascade;
drop table if exists public.senhas            cascade;
drop table if exists public.sessoes           cascade;
