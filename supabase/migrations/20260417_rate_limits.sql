-- Rate limiting infrastructure used by Edge Functions.
-- The `check_rate_limit` RPC is called from `supabase/functions/_shared/rateLimit.ts`
-- before any expensive downstream work (Gemini, TTS, etc).

create table if not exists public.rate_limits (
  identifier text not null,
  endpoint text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (identifier, endpoint, window_start)
);

create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

-- RLS: the table is only ever touched by the service role (via the Edge Function),
-- so we enable RLS with zero user-facing policies to close it to clients.
alter table public.rate_limits enable row level security;

-- Returns TRUE when the caller is still under the limit and the increment
-- was recorded; FALSE when the limit is exhausted.
create or replace function public.check_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  -- Bucket requests by a fixed window anchored to the current second / p_window_seconds.
  v_window_start := date_trunc('second', now())
    - make_interval(secs => extract(epoch from now())::integer % p_window_seconds);

  insert into public.rate_limits (identifier, endpoint, window_start, request_count)
  values (p_identifier, p_endpoint, v_window_start, 1)
  on conflict (identifier, endpoint, window_start)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into v_count;

  -- Opportunistic cleanup of old windows (keeps table small).
  delete from public.rate_limits
  where window_start < now() - make_interval(secs => p_window_seconds * 10);

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
