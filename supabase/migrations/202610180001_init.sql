-- 大曜命运档案：运行于 Supabase PostgreSQL。先在新项目的 SQL Editor 执行。
-- 所有业务表启用 RLS；浏览器永远不直接访问这些表。
create extension if not exists pgcrypto;

create table if not exists public.redemption_codes (
  id uuid primary key default gen_random_uuid(),
  lookup_hash text not null unique,
  order_reference text unique,
  batch_id uuid not null,
  total_uses integer not null default 3 check(total_uses between 1 and 10),
  used_uses integer not null default 0 check(used_uses >= 0 and used_uses <= total_uses),
  status text not null default 'active' check(status in ('active','frozen','revoked')),
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);
create index if not exists idx_redemption_batch on public.redemption_codes(batch_id, created_at);

create table if not exists public.access_sessions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.redemption_codes(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_access_code on public.access_sessions(code_id);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.redemption_codes(id),
  state text not null default 'in_progress' check(state in ('in_progress','completed','invalidated')),
  answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers) = 'object'),
  game_version text not null default 'ancient-palace-v1',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_sessions_code on public.game_sessions(code_id, started_at desc);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null unique references public.game_sessions(id),
  code_id uuid not null references public.redemption_codes(id),
  ending_id text not null,
  episode integer not null check (episode between 1 and 90),
  evaluation jsonb not null,
  game_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_results_code on public.results(code_id, created_at desc);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_shares_result on public.share_links(result_id);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.redeem_attempts (
  fingerprint text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);

-- 仅暴露服务端 Edge Function。匿名/普通 Supabase Auth 无表级权限。
do $$ declare table_name text; begin
  foreach table_name in array array[
    'redemption_codes','access_sessions','game_sessions','results',
    'share_links','admin_users','audit_logs','redeem_attempts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;

-- 原子占用一次资格。UPDATE 行级锁保证两个并发请求不能同时占用最后一次。
create or replace function public.reserve_game_session(p_code_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid;
begin
  update public.redemption_codes
  set used_uses = used_uses + 1
  where id = p_code_id and status='active' and expires_at > now() and used_uses < total_uses;
  if not found then raise exception 'NO_CREDITS' using errcode='P0001'; end if;
  insert into public.game_sessions(code_id) values(p_code_id) returning id into v_session_id;
  return v_session_id;
end $$;

-- 服务器计算结局后，单事务防重复结算。答案行锁必须先于服务器评分；
-- 因此完成接口负责在保存的答案确认后将请求提交，客户端不能提供评分值。
create or replace function public.finish_game_session(
  p_game_id uuid, p_code_id uuid, p_ending_id text, p_episode int,
  p_evaluation jsonb, p_game_version text, p_expected_answers jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session public.game_sessions%rowtype; v_result_id uuid;
begin
  select * into v_session from public.game_sessions where id=p_game_id and code_id=p_code_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode='P0001'; end if;
  if v_session.state='completed' then
    select id into v_result_id from public.results where game_session_id=p_game_id;
    return v_result_id;
  end if;
  if v_session.state<>'in_progress' or v_session.answers<>p_expected_answers then
    raise exception 'ANSWERS_CHANGED' using errcode='P0001';
  end if;
  insert into public.results(game_session_id,code_id,ending_id,episode,evaluation,game_version)
  values(p_game_id,p_code_id,p_ending_id,p_episode,p_evaluation,p_game_version)
  returning id into v_result_id;
  update public.game_sessions set state='completed',completed_at=now() where id=p_game_id;
  return v_result_id;
end $$;

revoke all on function public.reserve_game_session(uuid) from public, anon, authenticated;
revoke all on function public.finish_game_session(uuid,uuid,text,int,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_game_session(uuid) to service_role;
grant execute on function public.finish_game_session(uuid,uuid,text,int,jsonb,text,jsonb) to service_role;

create or replace function public.save_game_answer(
  p_game_id uuid, p_code_id uuid, p_question integer, p_choice text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_answers jsonb;
begin
  if p_question not between 1 and 16 or p_choice not in ('A','B','C','D') then
    raise exception 'INVALID_ANSWER';
  end if;
  update public.game_sessions
  set answers = jsonb_set(answers,array[p_question::text],to_jsonb(p_choice),true)
  where id=p_game_id and code_id=p_code_id and state='in_progress'
  returning answers into v_answers;
  if not found then raise exception 'SESSION_NOT_EDITABLE'; end if;
  return v_answers;
end $$;

create or replace function public.reset_game_answers(p_game_id uuid,p_code_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.game_sessions set answers='{}'::jsonb
  where id=p_game_id and code_id=p_code_id and state='in_progress';
  return found;
end $$;
revoke all on function public.save_game_answer(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.reset_game_answers(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_game_answer(uuid,uuid,integer,text) to service_role;
grant execute on function public.reset_game_answers(uuid,uuid) to service_role;