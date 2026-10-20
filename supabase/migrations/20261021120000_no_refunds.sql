-- Coins are not refunded. Failing a job closes it and keeps whatever was charged.
create or replace function public.engine_fail_job(p_job_id uuid, p_error text)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs;
begin
  update public.jobs
    set status = 'failed', error = p_error, stage = 'Could not convert', finished_at = now()
    where id = p_job_id and status in ('estimating', 'quoted', 'queued', 'processing')
    returning * into job;
  if not found then
    raise exception 'job is not open';
  end if;
  return job;
end;
$$;
