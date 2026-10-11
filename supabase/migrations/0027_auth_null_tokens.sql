-- Login a falhar com "converting NULL to string is unsupported" (erro 500 em /token e /recover).
-- Causa: utilizadores em auth.users com colunas de token a NULL (típico de contas criadas à mão
-- no painel ou por SQL). O GoTrue espera '' e rebenta ao ler a linha, por isso NENHUMA password
-- funciona para essa conta, mesmo correta.
--
-- 1) Corrige todas as contas existentes.
-- 2) Trigger que impede NULL nestas colunas em qualquer conta nova ou atualizada (futuras).

update auth.users
set confirmation_token         = coalesce(confirmation_token, ''),
    recovery_token             = coalesce(recovery_token, ''),
    email_change_token_new     = coalesce(email_change_token_new, ''),
    email_change               = coalesce(email_change, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change               = coalesce(phone_change, ''),
    phone_change_token         = coalesce(phone_change_token, ''),
    reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_new is null
   or email_change is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

create or replace function public.auth_users_no_null_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.confirmation_token         := coalesce(new.confirmation_token, '');
  new.recovery_token             := coalesce(new.recovery_token, '');
  new.email_change_token_new     := coalesce(new.email_change_token_new, '');
  new.email_change               := coalesce(new.email_change, '');
  new.email_change_token_current := coalesce(new.email_change_token_current, '');
  new.phone_change               := coalesce(new.phone_change, '');
  new.phone_change_token         := coalesce(new.phone_change_token, '');
  new.reauthentication_token     := coalesce(new.reauthentication_token, '');
  return new;
end;
$$;

drop trigger if exists auth_users_no_null_tokens on auth.users;
create trigger auth_users_no_null_tokens
  before insert or update on auth.users
  for each row execute function public.auth_users_no_null_tokens();
