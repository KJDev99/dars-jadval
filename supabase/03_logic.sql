-- ════════════════════════════════════════════════════════════════════════
--  Baho qo'yish mantiqi
--
--  O'SISH QOIDASI (serverda, aylanib o'tib bo'lmaydi):
--    Yangi ishning foizi quyidagi ikkisidan kam bo'lmasligi kerak:
--      1) o'quvchining shu fandan oldingi chorakdagi umumiy foizi;
--      2) shu chorakda hozirgacha yiq'ilgan umumiy foizi.
--    O'rtachaga o'zidan katta/teng son qo'shilsa o'rtacha pasaymaydi —
--    shuning uchun bu qoida umumiy o'sishni matematik kafolatlaydi.
--
--  2 KUNLIK MUDDAT: baho birinchi kiritilgandan keyin edit_days (2) kun
--  ichida tahrirlanadi, keyin qulflanadi.
-- ════════════════════════════════════════════════════════════════════════

-- Foizdan 5 ballik bahoga
create or replace function app_mark(p_pct numeric) returns int
  language sql stable security definer set search_path = public as $$
  select case
    when p_pct is null then null
    when p_pct >= (select mark5 from grading_rules where id = 1) then 5
    when p_pct >= (select mark4 from grading_rules where id = 1) then 4
    when p_pct >= (select mark3 from grading_rules where id = 1) then 3
    else 2
  end
$$;

-- Biriktirmaga tegishli o'quvchilar: guruh bo'lsa — guruh a'zolari,
-- bo'lmasa — butun sinf
create or replace function app_roster(p_assignment uuid)
  returns table (student_id uuid, full_name text, order_no int)
  language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.order_no
    from assignments a
    join students s on s.class_id = a.class_id and s.is_active
   where a.id = p_assignment
     and (
       a.group_id is null
       or exists (select 1 from group_students gs
                   where gs.group_id = a.group_id and gs.student_id = s.id)
     )
   order by s.order_no, s.full_name
$$;

-- Chorakdagi yig'indi: olingan ball va maksimal ball → [ball, maksimal]
--   p_exclude    — hisobdan chiqariladigan ish (tahrir qilinayotgani)
--   p_skip_extra — 10 ballik bahoni hisobdan chiqarish (uni tahrirlayotganda)
create or replace function app_quarter_sum(
  p_assignment uuid,
  p_student    uuid,
  p_quarter    int,
  p_exclude    uuid default null,
  p_skip_extra boolean default false
) returns numeric[]
  language sql stable security definer set search_path = public as $$
  select array[coalesce(sum(pts), 0), coalesce(sum(mx), 0)]
  from (
    select g.points as pts, ass.max_points as mx
      from grades g
      join assessments ass on ass.id = g.assessment_id
     where ass.assignment_id = p_assignment
       and ass.quarter = p_quarter
       and g.student_id = p_student
       and (p_exclude is null or ass.id <> p_exclude)
    union all
    select e.points, r.extra_total
      from quarter_extras e
      cross join grading_rules r
     where e.assignment_id = p_assignment
       and e.quarter = p_quarter
       and e.student_id = p_student
       and not p_skip_extra
  ) t
$$;

-- O'sish qoidasining «poli» (foizda). Manfiy qiymat — cheklov yo'q.
create or replace function app_floor_pct(
  p_assignment uuid,
  p_student    uuid,
  p_quarter    int,
  p_exclude    uuid default null,
  p_skip_extra boolean default false
) returns numeric
  language plpgsql stable security definer set search_path = public as $$
declare
  v_cur   numeric[];
  v_prev  numeric[];
  v_run   numeric;
  v_last  numeric;
begin
  -- shu chorakda hozirgacha (tahrirlanayotgan ishdan tashqari)
  v_cur := app_quarter_sum(p_assignment, p_student, p_quarter, p_exclude, p_skip_extra);
  if v_cur[2] > 0 then
    v_run := 100.0 * v_cur[1] / v_cur[2];
  end if;

  -- oldingi chorak
  if p_quarter > 1 then
    v_prev := app_quarter_sum(p_assignment, p_student, p_quarter - 1, null);
    if v_prev[2] > 0 then
      v_last := 100.0 * v_prev[1] / v_prev[2];
    end if;
  end if;

  return greatest(coalesce(v_run, -1), coalesce(v_last, -1));
end $$;

-- Ishni kiritish uchun jurnal holati: har bir o'quvchiga minimal ruxsat
-- etilgan ball, hozirgi bahosi va qulflanganligi
create or replace function journal_rows(p_assessment uuid)
  returns table (
    student_id  uuid,
    full_name   text,
    order_no    int,
    points      numeric,
    is_auto     boolean,
    floor_pct   numeric,
    min_points  numeric,
    locked      boolean,
    created_at  timestamptz
  )
  language plpgsql stable security definer set search_path = public as $$
declare
  v_ass assessments;
  v_rul grading_rules;
begin
  select * into v_ass from assessments where id = p_assessment;
  if v_ass.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if not (app_owns(v_ass.assignment_id) or app_is_staff()) then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_rul from grading_rules where id = 1;

  return query
  select r.student_id,
         r.full_name,
         r.order_no,
         g.points,
         coalesce(g.is_auto, false),
         f.pct,
         ceil(f.pct * v_ass.max_points) / 100.0,
         coalesce(g.created_at + make_interval(days => v_rul.edit_days) < now(), false),
         g.created_at
    from app_roster(v_ass.assignment_id) r
    left join grades g on g.assessment_id = p_assessment and g.student_id = r.student_id
    cross join lateral (
      select greatest(app_floor_pct(v_ass.assignment_id, r.student_id, v_ass.quarter, p_assessment), 0) as pct
    ) f
   order by r.order_no, r.full_name;
end $$;

-- ───────────────────────── Bitta bahoni saqlash ─────────────────────────
-- Natija: {ok: true, points: n} yoki {ok: false, error: '...', min_points: n}
create or replace function save_grade(
  p_assessment uuid,
  p_student    uuid,
  p_points     numeric,
  p_auto       boolean default false
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_ass    assessments;
  v_rul    grading_rules;
  v_old    grades;
  v_floor  numeric;
  v_min    numeric;
  v_pct    numeric;
begin
  select * into v_ass from assessments where id = p_assessment;
  if v_ass.id is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if not app_owns(v_ass.assignment_id) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  select * into v_rul from grading_rules where id = 1;

  if p_points < 0 or p_points > v_ass.max_points then
    return jsonb_build_object('ok', false, 'error', 'OVER_MAX',
                              'max_points', v_ass.max_points);
  end if;

  select * into v_old from grades
   where assessment_id = p_assessment and student_id = p_student;

  -- 2 kunlik muddat
  if v_old.id is not null
     and v_old.created_at + make_interval(days => v_rul.edit_days) < now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED',
                              'until', v_old.created_at + make_interval(days => v_rul.edit_days));
  end if;

  -- o'sish qoidasi
  v_floor := greatest(app_floor_pct(v_ass.assignment_id, p_student, v_ass.quarter, p_assessment), 0);
  v_min := ceil(v_floor * v_ass.max_points) / 100.0;
  v_pct := 100.0 * p_points / v_ass.max_points;

  if v_floor > 0 and v_pct < v_floor - 0.001 then
    insert into blocked_attempts (assignment_id, student_id, quarter, tried_points, min_points, actor_id)
    values (v_ass.assignment_id, p_student, v_ass.quarter, p_points, v_min, auth.uid());
    return jsonb_build_object('ok', false, 'error', 'TOO_LOW',
                              'min_points', v_min, 'floor_pct', round(v_floor, 2));
  end if;

  insert into grades (assessment_id, student_id, points, is_auto, author_id)
  values (p_assessment, p_student, p_points, p_auto, auth.uid())
  on conflict (assessment_id, student_id)
  do update set points = excluded.points,
                is_auto = excluded.is_auto,
                updated_at = now(),
                author_id = auth.uid();

  insert into grade_log (assignment_id, student_id, target, quarter, old_points, new_points, is_auto, actor_id)
  values (v_ass.assignment_id, p_student, 'grade', v_ass.quarter, v_old.points, p_points, p_auto, auth.uid());

  return jsonb_build_object('ok', true, 'points', p_points);
end $$;

-- ──────────────────── Ko'p bahoni birdan saqlash ────────────────────
-- p_items: [{"student_id": "...", "points": 42}, ...]
-- Har bir satr alohida tekshiriladi; xatolari bo'lsa qolgani saqlanadi.
create or replace function save_grades(
  p_assessment uuid,
  p_items      jsonb,
  p_auto       boolean default false
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_item   jsonb;
  v_res    jsonb;
  v_out    jsonb := '[]'::jsonb;
  v_saved  int := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_res := save_grade(
      p_assessment,
      (v_item ->> 'student_id')::uuid,
      (v_item ->> 'points')::numeric,
      p_auto
    );
    if (v_res ->> 'ok')::boolean then
      v_saved := v_saved + 1;
    else
      v_out := v_out || jsonb_build_array(v_res || jsonb_build_object('student_id', v_item ->> 'student_id'));
    end if;
  end loop;
  return jsonb_build_object('saved', v_saved, 'failed', v_out);
end $$;

-- ───────────── Chorak oxiridagi 10 ballik baho ─────────────
create or replace function save_extra(
  p_assignment uuid,
  p_quarter    int,
  p_student    uuid,
  p_points     numeric
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_rul    grading_rules;
  v_old    quarter_extras;
  v_floor  numeric;
  v_min    numeric;
  v_pct    numeric;
begin
  if not app_owns(p_assignment) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_rul from grading_rules where id = 1;

  if p_points < 0 or p_points > v_rul.extra_total then
    return jsonb_build_object('ok', false, 'error', 'OVER_MAX', 'max_points', v_rul.extra_total);
  end if;

  select * into v_old from quarter_extras
   where assignment_id = p_assignment and quarter = p_quarter and student_id = p_student;

  if v_old.id is not null
     and v_old.created_at + make_interval(days => v_rul.edit_days) < now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED',
                              'until', v_old.created_at + make_interval(days => v_rul.edit_days));
  end if;

  -- 10 ballik bahoni hisobdan chiqarib polni topamiz
  v_floor := greatest(
    app_floor_pct(p_assignment, p_student, p_quarter, null, true), 0);
  v_min := ceil(v_floor * v_rul.extra_total) / 100.0;
  v_pct := 100.0 * p_points / v_rul.extra_total;

  if v_floor > 0 and v_pct < v_floor - 0.001 then
    insert into blocked_attempts (assignment_id, student_id, quarter, tried_points, min_points, actor_id)
    values (p_assignment, p_student, p_quarter, p_points, v_min, auth.uid());
    return jsonb_build_object('ok', false, 'error', 'TOO_LOW',
                              'min_points', v_min, 'floor_pct', round(v_floor, 2));
  end if;

  insert into quarter_extras (assignment_id, quarter, student_id, points, author_id)
  values (p_assignment, p_quarter, p_student, p_points, auth.uid())
  on conflict (assignment_id, quarter, student_id)
  do update set points = excluded.points, updated_at = now(), author_id = auth.uid();

  insert into grade_log (assignment_id, student_id, target, quarter, old_points, new_points, is_auto, actor_id)
  values (p_assignment, p_student, 'extra', p_quarter, v_old.points, p_points, false, auth.uid());

  return jsonb_build_object('ok', true, 'points', p_points);
end $$;

-- 10 ballik baho jadvali: o'quvchi, hozirgi chorak yig'indisi (10 ballsiz),
-- minimal ruxsat etilgan ball va qulf holati
create or replace function extra_rows(p_assignment uuid, p_quarter int)
  returns table (
    student_id uuid,
    full_name  text,
    order_no   int,
    points     numeric,
    min_points numeric,
    locked     boolean,
    q_points   numeric,
    q_max      numeric,
    pct_now    numeric
  )
  language plpgsql stable security definer set search_path = public as $$
declare
  v_rul grading_rules;
begin
  if not (app_owns(p_assignment) or app_is_staff()) then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_rul from grading_rules where id = 1;

  return query
  select r.student_id,
         r.full_name,
         r.order_no,
         e.points,
         ceil(f.floor_pct * v_rul.extra_total) / 100.0,
         coalesce(e.created_at + make_interval(days => v_rul.edit_days) < now(), false),
         s.qs[1],
         s.qs[2],
         round(100.0 * s.qs[1] / nullif(s.qs[2], 0), 2)
    from app_roster(p_assignment) r
    left join quarter_extras e
           on e.assignment_id = p_assignment and e.quarter = p_quarter
          and e.student_id = r.student_id
    cross join lateral (
      select app_quarter_sum(p_assignment, r.student_id, p_quarter, null, true) as qs
    ) s
    cross join lateral (
      select greatest(app_floor_pct(p_assignment, r.student_id, p_quarter, null, true), 0) as floor_pct
    ) f
   order by r.order_no, r.full_name;
end $$;
