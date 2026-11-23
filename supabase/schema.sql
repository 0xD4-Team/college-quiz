-- انسخ هذا الملف كاملاً في Supabase SQL Editor واضغط Run
-- الطلبة يقدروا يرسلوا درجاتهم فقط، والمدرس (authenticated) يقرأ ويمسح النتائج.

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null check (score between 0 and 100),
  correct integer not null,
  total integer not null,
  duration_sec integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.quiz_results enable row level security;

-- نمنع كل الصلاحيات الافتراضية ثم نرجّع المطلوب فقط
revoke all on public.quiz_results from anon, authenticated;
grant insert on public.quiz_results to anon;
grant select, delete on public.quiz_results to authenticated;

drop policy if exists "Students can submit results" on public.quiz_results;
create policy "Students can submit results"
on public.quiz_results for insert
to anon
with check (true);

drop policy if exists "Teachers can read results" on public.quiz_results;
create policy "Teachers can read results"
on public.quiz_results for select
to authenticated
using (true);

drop policy if exists "Teachers can delete results" on public.quiz_results;
create policy "Teachers can delete results"
on public.quiz_results for delete
to authenticated
using (true);
