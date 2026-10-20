-- ════════════════════════════════════════════════════════════════════════
--  BSB/ChSB rejasi, dars jadvali va eslatmalar
--
--  Menejer ikki jadvalni Excel'dan yuklaydi:
--    1) assessment_plan — qaysi sinfda, qaysi fandan, qachon BSB/ChSB bo'ladi
--    2) lessons         — dars jadvali (sinf, kun, dars raqami, fan, o'qituvchi)
--
--  Shu rejaga qarab o'qituvchi va menejerga eslatma chiqadi:
--    kechikkan / bugun / yaqinlashayotgan ishlar.
-- ════════════════════════════════════════════════════════════════════════

-- ───────────────────────── Dars jadvali ─────────────────────────
create table if not exists lessons (
  id         uuid primary key default gen_random_uuid(),
  year_id    int  not null references academic_years (id) on delete cascade,
  class_id   uuid not null references classes (id) on delete cascade,
  subject_id int  not null references subjects (id) on delete cascade,
  weekday    int  not null check (weekday between 1 and 7),   -- 1 = dushanba
  lesson_no  int  not null check (lesson_no between 1 and 12),
  teacher_id uuid references profiles (id) on delete set null,
  room       text,
  created_at timestamptz not null default now(),
  -- bitta sinfda bir vaqtda bitta dars
  unique (class_id, weekday, lesson_no)
);

create index if not exists lessons_year_idx on lessons (year_id, weekday, lesson_no);
create index if not exists lessons_teacher_idx on lessons (teacher_id, weekday);

-- ───────────────────── BSB/ChSB rejasi (kalendar) ─────────────────────
create table if not exists assessment_plan (
  id         uuid primary key default gen_random_uuid(),
  year_id    int  not null references academic_years (id) on delete cascade,
  quarter    int  not null check (quarter between 1 and 4),
  class_id   uuid not null references classes (id) on delete cascade,
  subject_id int  not null references subjects (id) on delete cascade,
  kind       assess_kind not null,
  idx        int  not null default 1,
  planned_on date not null,
  max_points numeric(5, 2),       -- ixtiyoriy: jurnalda shu ball taklif qilinadi
  note       text,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id, quarter, kind, idx)
);

create index if not exists plan_date_idx on assessment_plan (planned_on);
create index if not exists plan_scope_idx on assessment_plan (year_id, quarter, subject_id);

-- ───────────── Eslatma o'qilganligi ─────────────
-- Holat o'zgarsa (yaqin → bugun → kechikdi) eslatma yana «yangi» bo'ladi.
create table if not exists notification_reads (
  user_id uuid not null references profiles (id) on delete cascade,
  plan_id uuid not null references assessment_plan (id) on delete cascade,
  urgency text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, plan_id, urgency)
);

-- ───────────────────────────── RLS ─────────────────────────────
alter table lessons             enable row level security;
alter table assessment_plan     enable row level security;
alter table notification_reads  enable row level security;

drop policy if exists lessons_read on lessons;
create policy lessons_read on lessons for select to authenticated using (app_approved());
drop policy if exists lessons_write on lessons;
create policy lessons_write on lessons for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

drop policy if exists plan_read on assessment_plan;
create policy plan_read on assessment_plan for select to authenticated using (app_approved());
drop policy if exists plan_write on assessment_plan;
create policy plan_write on assessment_plan for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

drop policy if exists reads_own on notification_reads;
create policy reads_own on notification_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── Reja bo'yicha ishning bajarilish holati ─────────────
-- 'none'    — jurnalda ish hali yaratilmagan
-- 'partial' — ish bor, lekin baholar to'liq emas
-- 'done'    — ish bor va hamma o'quvchi baholangan
create or replace function app_plan_state(
  p_class_id   uuid,
  p_subject_id int,
  p_quarter    int,
  p_kind       assess_kind,
  p_idx        int
) returns text
  language plpgsql stable security definer set search_path = public as $$
declare
  v_total  int := 0;   -- biriktirmalar soni (guruhlar bilan)
  v_made   int := 0;   -- ish yaratilgan biriktirmalar
  v_full   int := 0;   -- to'liq baholangan biriktirmalar
  r        record;
begin
  for r in
    select a.id
      from assignments a
     where a.class_id = p_class_id and a.subject_id = p_subject_id
  loop
    v_total := v_total + 1;
    if exists (
      select 1 from assessments ass
       where ass.assignment_id = r.id and ass.quarter = p_quarter
         and ass.kind = p_kind and ass.idx = p_idx
    ) then
      v_made := v_made + 1;
      if (
        select count(*) from grades g
          join assessments ass on ass.id = g.assessment_id
         where ass.assignment_id = r.id and ass.quarter = p_quarter
           and ass.kind = p_kind and ass.idx = p_idx
      ) >= (select count(*) from app_roster(r.id)) then
        v_full := v_full + 1;
      end if;
    end if;
  end loop;

  if v_total = 0 or v_made = 0 then return 'none'; end if;
  if v_full >= v_total then return 'done'; end if;
  return 'partial';
end $$;

-- ───────── Reja satri kimga tegishli: o'qituvchini aniqlash ─────────
-- 1) jurnalda biriktirma bo'lsa — uning o'qituvchisi
-- 2) bo'lmasa — dars jadvalidagi o'qituvchi
-- 3) u ham bo'lmasa — shu fanning barcha o'qituvchilari
create or replace function app_plan_teachers(p_class_id uuid, p_subject_id int)
  returns setof uuid
  language sql stable security definer set search_path = public as $$
  with asg as (
    select distinct a.teacher_id
      from assignments a
     where a.class_id = p_class_id and a.subject_id = p_subject_id
  ), les as (
    select distinct l.teacher_id
      from lessons l
     where l.class_id = p_class_id and l.subject_id = p_subject_id
       and l.teacher_id is not null
  )
  select teacher_id from asg
  union
  select teacher_id from les where not exists (select 1 from asg)
  union
  select p.id from profiles p
   where p.role = 'teacher' and p.status = 'approved' and p.subject_id = p_subject_id
     and not exists (select 1 from asg) and not exists (select 1 from les)
$$;

-- ───────────────────────── Eslatmalar ─────────────────────────
-- Chaqiruvchiga tegishli, e'tibor talab qiladigan reja satrlari.
--   urgency: 'late' (muddati o'tgan) | 'today' (bugun) | 'soon' (yaqinlashdi)
create or replace function plan_feed(p_soon int default 7)
  returns table (
    plan_id      uuid,
    quarter      int,
    class_id     uuid,
    class_name   text,
    subject_id   int,
    subject_name text,
    kind         assess_kind,
    idx          int,
    planned_on   date,
    max_points   numeric,
    days         int,
    state        text,
    urgency      text,
    teacher_id   uuid,
    teacher_name text,
    is_read      boolean
  )
  language plpgsql stable security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_staff boolean := app_is_staff();
begin
  if not app_approved() then
    return;
  end if;

  return query
  select p.id,
         p.quarter,
         p.class_id,
         c.grade || c.letter as class_name,
         p.subject_id,
         s.name,
         p.kind,
         p.idx,
         p.planned_on,
         p.max_points,
         (p.planned_on - current_date)::int as days,
         st.state,
         u.urgency,
         t.teacher_id,
         coalesce(t.names, '—') as teacher_name,
         exists (
           select 1 from notification_reads nr
            where nr.user_id = v_me and nr.plan_id = p.id and nr.urgency = u.urgency
         ) as is_read
    from assessment_plan p
    join classes c  on c.id = p.class_id
    join subjects s on s.id = p.subject_id
    join academic_years y on y.id = p.year_id and y.is_active
    cross join lateral (
      select case
               when p.planned_on < current_date then 'late'
               when p.planned_on = current_date then 'today'
               else 'soon'
             end as urgency
    ) u
    cross join lateral (
      select app_plan_state(p.class_id, p.subject_id, p.quarter, p.kind, p.idx) as state
    ) st
    -- reja satri kimga tegishli: biriktirma → dars jadvali → fan o'qituvchilari
    left join lateral (
      select (array_agg(pr.id order by pr.last_name, pr.first_name))[1] as teacher_id,
             string_agg(pr.last_name || ' ' || pr.first_name, ', '
                        order by pr.last_name, pr.first_name) as names,
             bool_or(pr.id = v_me) as mine
        from app_plan_teachers(p.class_id, p.subject_id) x
        join profiles pr on pr.id = x
    ) t on true
   where st.state <> 'done'
     and p.planned_on <= current_date + p_soon
     and (v_staff or coalesce(t.mine, false))
   order by p.planned_on, c.grade, c.letter, s.name;
end $$;

-- Eslatmani o'qilgan deb belgilash
create or replace function mark_feed_read(p_plan_ids uuid[], p_urgencies text[])
  returns int
  language plpgsql security definer set search_path = public as $$
declare
  v_n int := 0;
begin
  if not app_approved() then
    return 0;
  end if;
  insert into notification_reads (user_id, plan_id, urgency)
  select auth.uid(), unnest(p_plan_ids), unnest(p_urgencies)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ───────── Menejer uchun: reja va bajarilish holati ─────────
create or replace view v_plan_status with (security_invoker = true) as
select p.id            as plan_id,
       p.year_id,
       p.quarter,
       p.class_id,
       c.grade,
       c.letter,
       c.grade || c.letter as class_name,
       p.subject_id,
       s.name          as subject_name,
       p.kind,
       p.idx,
       p.planned_on,
       p.max_points,
       p.note,
       (p.planned_on - current_date)::int as days,
       app_plan_state(p.class_id, p.subject_id, p.quarter, p.kind, p.idx) as state
  from assessment_plan p
  join classes c  on c.id = p.class_id
  join subjects s on s.id = p.subject_id;

-- ───────── Dars jadvali: nomlar bilan ─────────
create or replace view v_timetable with (security_invoker = true) as
select l.id,
       l.year_id,
       l.class_id,
       c.grade,
       c.letter,
       c.grade || c.letter as class_name,
       l.subject_id,
       s.name as subject_name,
       l.weekday,
       l.lesson_no,
       l.teacher_id,
       p.last_name || ' ' || p.first_name as teacher_name,
       l.room
  from lessons l
  join classes c  on c.id = l.class_id
  join subjects s on s.id = l.subject_id
  left join profiles p on p.id = l.teacher_id;

-- ───────────────────── Huquqlar ─────────────────────
grant select, insert, update, delete on lessons, assessment_plan, notification_reads
  to authenticated;
grant select on v_plan_status, v_timetable to authenticated;
grant execute on function plan_feed(int), mark_feed_read(uuid[], text[]),
                          app_plan_state(uuid, int, int, assess_kind, int),
                          app_plan_teachers(uuid, int)
  to authenticated;
