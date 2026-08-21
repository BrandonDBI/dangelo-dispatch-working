-- Persist a supervisor-controlled order for the Incoming Jobs queue.
alter table public.jobs
  add column if not exists incoming_sort_order bigint;

with ranked as (
  select id, row_number() over (order by created_at asc, id asc) as position
  from public.jobs
  where start_date is null
)
update public.jobs j
set incoming_sort_order = ranked.position
from ranked
where j.id = ranked.id
  and j.incoming_sort_order is null;

update public.jobs
set incoming_sort_order = null
where start_date is not null
  and incoming_sort_order is not null;

create or replace function public.set_incoming_job_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.start_date is null then
    if new.incoming_sort_order is null
       or (tg_op = 'UPDATE' and old.start_date is not null) then
      select coalesce(max(j.incoming_sort_order), 0) + 1
      into new.incoming_sort_order
      from public.jobs j
      where j.start_date is null
        and (tg_op = 'INSERT' or j.id <> new.id);
    end if;
  else
    new.incoming_sort_order := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_incoming_job_order on public.jobs;
create trigger set_incoming_job_order
before insert or update of start_date, incoming_sort_order on public.jobs
for each row execute function public.set_incoming_job_order();

create index if not exists jobs_incoming_sort_order_idx
on public.jobs (incoming_sort_order, id)
where start_date is null;
