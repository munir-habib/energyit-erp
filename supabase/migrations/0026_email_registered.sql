-- Recuperar password: antes de enviar o link, o ecrã diz ao utilizador se o email já está registado.
-- Função SECURITY DEFINER (anon não pode ler auth.users) que devolve apenas um boolean.
-- Nota: isto permite saber se um email tem conta (enumeração) — escolha consciente do produto.
create or replace function public.email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function public.email_registered(text) from public;
grant execute on function public.email_registered(text) to anon, authenticated;
