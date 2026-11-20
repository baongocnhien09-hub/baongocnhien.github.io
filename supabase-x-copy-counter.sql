create table if not exists public.eomland_x_copy_counter (
  id smallint primary key check (id = 1),
  total_copies bigint not null default 0 check (total_copies >= 0)
);

insert into public.eomland_x_copy_counter (id, total_copies)
values (1, 0)
on conflict (id) do nothing;

alter table public.eomland_x_copy_counter enable row level security;

create or replace function public.get_eomland_x_copy_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select total_copies
  from public.eomland_x_copy_counter
  where id = 1;
$$;

create or replace function public.increment_eomland_x_copy_count()
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  updated_total bigint;
begin
  update public.eomland_x_copy_counter
  set total_copies = total_copies + 1
  where id = 1
  returning total_copies into updated_total;

  return updated_total;
end;
$$;

revoke all on function public.get_eomland_x_copy_count() from public;
revoke all on function public.increment_eomland_x_copy_count() from public;
grant execute on function public.get_eomland_x_copy_count() to anon, authenticated;
grant execute on function public.increment_eomland_x_copy_count() to anon, authenticated;
revoke all on public.eomland_x_copy_counter from anon, authenticated;
