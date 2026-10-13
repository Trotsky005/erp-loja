-- Ajustes de segurança apontados pelo Security Advisor do Supabase.

-- 1) search_path fixo nas funções de carimbo
alter function public.tg_carimbo()            set search_path = public;
alter function public.tg_carimbo_parametros() set search_path = public;

-- 2) Ninguém de fora (anon) executa funções do sistema pela API
revoke execute on function public.usuario_ativo()                from public, anon;
revoke execute on function public.is_admin()                     from public, anon;
revoke execute on function public.pode(text, text)               from public, anon;
revoke execute on function public.tem_acesso_loja(uuid)          from public, anon;
revoke execute on function public.tg_auditoria()                 from public, anon, authenticated;
revoke execute on function public.tg_novo_usuario()              from public, anon, authenticated;
revoke execute on function public.tg_carimbo()                   from public, anon, authenticated;
revoke execute on function public.tg_carimbo_parametros()        from public, anon, authenticated;

-- usuários logados continuam usando as funções de permissão (as regras de RLS dependem delas)
grant execute on function public.usuario_ativo()       to authenticated;
grant execute on function public.is_admin()            to authenticated;
grant execute on function public.pode(text, text)      to authenticated;
grant execute on function public.tem_acesso_loja(uuid) to authenticated;
