-- Drawing2CAD: accounts, coins, conversion jobs, payments, storage.
--
-- Job lifecycle (status):
--   estimating  -> uploaded; waiting for the engine (or the owner) to price it
--   quoted      -> tier + coin cost set; waiting for the customer to confirm
--   queued      -> customer confirmed; coins taken; waiting for the engine
--   processing  -> engine is building the model (progress + stage shown live)
--   done        -> STEP + preview ready
--   failed      -> could not be converted; any coins taken are refunded
--   cancelled   -> customer cancelled before paying
--
-- Customers act through create/confirm/cancel functions. Everything that moves a job forward after that
-- (quote, start, progress, complete, fail) is service-role only: the Next.js server calls it for the owner
-- panel, and the conversion engine will call it with the service key.

-- ---------------------------------------------------------------------------------------------
-- Reference data: tiers and coin packs (public pricing)
-- ---------------------------------------------------------------------------------------------

create table public.tiers (
  id text primary key check (id in ('simple', 'medium', 'complex')),
  name text not null,
  coins integer not null check (coins > 0),
  summary text not null,
  example_id text not null,
  sort integer not null default 0
);

insert into public.tiers (id, name, coins, summary, example_id, sort) values
  ('simple', 'Simple', 20, 'One prismatic part: plates, spacers, brackets. Holes, slots, pockets, fillets and chamfers.', 'mounting-plate', 1),
  ('medium', 'Medium', 50, 'Several views with sections: housings, blocks, flanged parts, turned parts with features.', 'pillow-block', 2),
  ('complex', 'Complex', 100, 'Castings and machined housings: shells, ribs, bosses, intersecting bores, many tapped holes.', 'gearbox-housing', 3);

create table public.coin_packs (
  id text primary key,
  name text not null,
  coins integer not null check (coins > 0),
  price_inr integer not null check (price_inr > 0), -- paise
  price_usd integer not null check (price_usd > 0), -- cents
  active boolean not null default true,
  sort integer not null default 0
);

insert into public.coin_packs (id, name, coins, price_inr, price_usd, sort) values
  ('starter', 'Starter', 50, 49900, 900, 1),
  ('studio', 'Studio', 150, 129900, 2400, 2),
  ('workshop', 'Workshop', 500, 399900, 7200, 3);

-- ---------------------------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  coins integer not null default 0 check (coins >= 0),
  created_at timestamptz not null default now()
);

create table public.admins (
  email text primary key
);

insert into public.admins (email) values ('mehrasaransh2004@gmail.com');

create table public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text not null check (reason in ('signup_bonus', 'purchase', 'conversion', 'refund', 'grant', 'adjustment')),
  job_id uuid,
  payment_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);

-- Signup bonus: enough for one Simple conversion.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bonus integer := 20;
begin
  insert into public.profiles (id, email, full_name, avatar_url, coins)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    bonus
  );
  insert into public.coin_ledger (user_id, delta, balance_after, reason, note)
  values (new.id, bonus, bonus, 'signup_bonus', 'Welcome coins');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  source_path text not null,
  source_kind text not null check (source_kind in ('pdf', 'image', 'dwg', 'dxf')),
  source_bytes bigint not null check (source_bytes > 0),
  units text not null default 'auto' check (units in ('auto', 'mm', 'inch')),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'estimating'
    check (status in ('estimating', 'quoted', 'queued', 'processing', 'done', 'failed', 'cancelled')),
  tier text references public.tiers (id),
  coins_cost integer check (coins_cost > 0),
  coins_charged integer not null default 0 check (coins_charged >= 0),
  estimate_note text,
  progress integer not null default 0 check (progress between 0 and 100),
  stage text,
  error text,
  step_path text,
  glb_path text,
  thumb_path text,
  result jsonb,
  created_at timestamptz not null default now(),
  quoted_at timestamptz,
  confirmed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index jobs_user_idx on public.jobs (user_id, created_at desc);
create index jobs_status_idx on public.jobs (status, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- Customer: register an uploaded drawing. The file must already be in the drawings bucket under the
-- caller's own folder.
create or replace function public.create_job(
  p_name text,
  p_source_path text,
  p_source_kind text,
  p_source_bytes bigint,
  p_units text default 'auto',
  p_notes text default null
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  open_jobs integer;
  job public.jobs;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if split_part(p_source_path, '/', 1) <> uid::text then
    raise exception 'file is not yours' using errcode = '42501';
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'drawings' and o.name = p_source_path
  ) then
    raise exception 'file not found' using errcode = 'P0002';
  end if;
  select count(*) into open_jobs from public.jobs
    where user_id = uid and status in ('estimating', 'quoted', 'queued', 'processing');
  if open_jobs >= 5 then
    raise exception 'too many open conversions' using errcode = 'P0001', hint = 'open_limit';
  end if;
  insert into public.jobs (user_id, name, source_path, source_kind, source_bytes, units, notes)
  values (uid, left(btrim(p_name), 120), p_source_path, p_source_kind, p_source_bytes, coalesce(p_units, 'auto'), nullif(btrim(p_notes), ''))
  returning * into job;
  return job;
end;
$$;

-- Customer: accept the quote. Takes the coins and queues the job.
create or replace function public.confirm_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  job public.jobs;
  balance integer;
begin
  select * into job from public.jobs where id = p_job_id and user_id = uid for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if job.status <> 'quoted' then
    raise exception 'job is not waiting for confirmation' using errcode = 'P0001', hint = 'bad_status';
  end if;
  select coins into balance from public.profiles where id = uid for update;
  if balance < job.coins_cost then
    raise exception 'not enough coins' using errcode = 'P0001', hint = 'insufficient_coins';
  end if;
  update public.profiles set coins = coins - job.coins_cost where id = uid;
  insert into public.coin_ledger (user_id, delta, balance_after, reason, job_id, note)
  values (uid, -job.coins_cost, balance - job.coins_cost, 'conversion', job.id, job.name);
  update public.jobs
    set status = 'queued', coins_charged = job.coins_cost, confirmed_at = now(), stage = 'In the queue'
    where id = job.id
    returning * into job;
  return job;
end;
$$;

-- Customer: withdraw a drawing before paying for it.
create or replace function public.cancel_job(p_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  job public.jobs;
begin
  update public.jobs set status = 'cancelled', finished_at = now()
    where id = p_job_id and user_id = uid and status in ('estimating', 'quoted')
    returning * into job;
  if not found then
    raise exception 'job cannot be cancelled' using errcode = 'P0001', hint = 'bad_status';
  end if;
  return job;
end;
$$;

-- Customer: rename a model in their history.
create or replace function public.rename_job(p_job_id uuid, p_name text)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs;
begin
  if char_length(btrim(p_name)) = 0 then
    raise exception 'name is empty' using errcode = '22023';
  end if;
  update public.jobs set name = left(btrim(p_name), 120)
    where id = p_job_id and user_id = (select auth.uid())
    returning * into job;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  return job;
end;
$$;

revoke execute on function public.create_job(text, text, text, bigint, text, text) from public, anon;
revoke execute on function public.confirm_job(uuid) from public, anon;
revoke execute on function public.cancel_job(uuid) from public, anon;
revoke execute on function public.rename_job(uuid, text) from public, anon;
grant execute on function public.create_job(text, text, text, bigint, text, text) to authenticated;
grant execute on function public.confirm_job(uuid) to authenticated;
grant execute on function public.cancel_job(uuid) to authenticated;
grant execute on function public.rename_job(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Engine / owner transitions (service role only)
-- ---------------------------------------------------------------------------------------------

-- Take the oldest job waiting at a given status, so two workers never pick the same one.
create or replace function public.engine_claim_job(p_status text)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs;
begin
  if p_status not in ('estimating', 'queued') then
    raise exception 'can only claim estimating or queued jobs';
  end if;
  select * into job from public.jobs
    where status = p_status
    order by created_at
    limit 1
    for update skip locked;
  if not found then
    return null;
  end if;
  if p_status = 'queued' then
    update public.jobs set status = 'processing', started_at = now(), progress = 2, stage = 'Reading the drawing'
      where id = job.id returning * into job;
  end if;
  return job;
end;
$$;

create or replace function public.engine_quote_job(p_job_id uuid, p_tier text, p_note text default null)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs;
  cost integer;
begin
  select coins into cost from public.tiers where id = p_tier;
  if cost is null then
    raise exception 'unknown tier %', p_tier;
  end if;
  update public.jobs
    set status = 'quoted', tier = p_tier, coins_cost = cost, estimate_note = p_note, quoted_at = now()
    where id = p_job_id and status in ('estimating', 'quoted')
    returning * into job;
  if not found then
    raise exception 'job is not waiting for a quote';
  end if;
  return job;
end;
$$;

create or replace function public.engine_progress(p_job_id uuid, p_progress integer, p_stage text)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs;
begin
  update public.jobs
    set status = 'processing',
        started_at = coalesce(started_at, now()),
        progress = greatest(0, least(99, p_progress)),
        stage = p_stage
    where id = p_job_id and status in ('queued', 'processing')
    returning * into job;
  if not found then
    raise exception 'job is not in progress';
  end if;
  return job;
end;
$$;

create or replace function public.engine_complete_job(
  p_job_id uuid,
  p_step_path text,
  p_glb_path text,
  p_thumb_path text,
  p_result jsonb
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs;
begin
  update public.jobs
    set status = 'done', progress = 100, stage = 'Done', step_path = p_step_path, glb_path = p_glb_path,
        thumb_path = p_thumb_path, result = p_result, error = null, finished_at = now()
    where id = p_job_id and status in ('queued', 'processing')
    returning * into job;
  if not found then
    raise exception 'job is not in progress';
  end if;
  return job;
end;
$$;

-- Fails a job from any open state and gives back whatever was charged.
create or replace function public.engine_fail_job(p_job_id uuid, p_error text)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs;
  balance integer;
begin
  select * into job from public.jobs where id = p_job_id for update;
  if not found or job.status not in ('estimating', 'quoted', 'queued', 'processing') then
    raise exception 'job is not open';
  end if;
  if job.coins_charged > 0 then
    update public.profiles set coins = coins + job.coins_charged where id = job.user_id
      returning coins into balance;
    insert into public.coin_ledger (user_id, delta, balance_after, reason, job_id, note)
    values (job.user_id, job.coins_charged, balance, 'refund', job.id, job.name);
  end if;
  update public.jobs
    set status = 'failed', error = p_error, stage = 'Could not convert', coins_charged = 0, finished_at = now()
    where id = job.id
    returning * into job;
  return job;
end;
$$;

-- Owner: give or take coins (manual top-ups, goodwill).
create or replace function public.grant_coins(p_user_id uuid, p_coins integer, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance integer;
begin
  update public.profiles set coins = coins + p_coins where id = p_user_id returning coins into balance;
  if not found then
    raise exception 'no such user';
  end if;
  insert into public.coin_ledger (user_id, delta, balance_after, reason, note)
  values (p_user_id, p_coins, balance, case when p_coins >= 0 then 'grant' else 'adjustment' end, p_note);
  return balance;
end;
$$;

revoke execute on function public.engine_claim_job(text) from public, anon, authenticated;
revoke execute on function public.engine_quote_job(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.engine_progress(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.engine_complete_job(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.engine_fail_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.grant_coins(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.engine_claim_job(text) to service_role;
grant execute on function public.engine_quote_job(uuid, text, text) to service_role;
grant execute on function public.engine_progress(uuid, integer, text) to service_role;
grant execute on function public.engine_complete_job(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.engine_fail_job(uuid, text) to service_role;
grant execute on function public.grant_coins(uuid, integer, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Payments (Razorpay). Rows are written by the Next.js server with the service key.
-- ---------------------------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pack_id text not null references public.coin_packs (id),
  coins integer not null check (coins > 0),
  amount integer not null check (amount > 0), -- minor units
  currency text not null check (currency in ('INR', 'USD')),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index payments_user_idx on public.payments (user_id, created_at desc);

-- Idempotent: the checkout callback and the webhook may both arrive; coins are added once.
create or replace function public.credit_payment(p_order_id text, p_payment_id text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  balance integer;
begin
  select * into pay from public.payments where razorpay_order_id = p_order_id for update;
  if not found then
    raise exception 'unknown order %', p_order_id;
  end if;
  if pay.status = 'paid' then
    return pay;
  end if;
  update public.profiles set coins = coins + pay.coins where id = pay.user_id returning coins into balance;
  insert into public.coin_ledger (user_id, delta, balance_after, reason, payment_id, note)
  values (pay.user_id, pay.coins, balance, 'purchase', pay.id, pay.coins || ' coins');
  update public.payments set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now()
    where id = pay.id returning * into pay;
  return pay;
end;
$$;

revoke execute on function public.credit_payment(text, text) from public, anon, authenticated;
grant execute on function public.credit_payment(text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Row level security and grants (tables are not exposed to the Data API automatically)
-- ---------------------------------------------------------------------------------------------

alter table public.tiers enable row level security;
alter table public.coin_packs enable row level security;
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;

grant select on public.tiers, public.coin_packs to anon, authenticated;
grant select on public.profiles, public.coin_ledger, public.jobs, public.payments to authenticated;
grant all on public.tiers, public.coin_packs, public.profiles, public.admins, public.coin_ledger, public.jobs, public.payments to service_role;

create policy "pricing is public" on public.tiers for select to anon, authenticated using (true);
create policy "packs are public" on public.coin_packs for select to anon, authenticated using (active);
create policy "own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own ledger" on public.coin_ledger for select to authenticated using ((select auth.uid()) = user_id);
create policy "own jobs" on public.jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own payments" on public.payments for select to authenticated using ((select auth.uid()) = user_id);
-- admins has RLS on and no policies: only is_admin() (security definer) and the service role read it.

-- Live job updates on the model page.
alter publication supabase_realtime add table public.jobs;

-- ---------------------------------------------------------------------------------------------
-- Storage: drawings (customer uploads) and models (results), both private
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('drawings', 'drawings', false, 52428800), ('models', 'models', false, 104857600)
on conflict (id) do nothing;

create policy "upload own drawings" on storage.objects for insert to authenticated
  with check (bucket_id = 'drawings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "read own drawings" on storage.objects for select to authenticated
  using (bucket_id = 'drawings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "read own models" on storage.objects for select to authenticated
  using (bucket_id = 'models' and (storage.foldername(name))[1] = (select auth.uid())::text);
