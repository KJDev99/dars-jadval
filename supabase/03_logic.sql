-- ════════════════════════════════════════════════════════════════════════
--  Baho qo'yish mantiqi
--
--  O'SISH QOIDASI — SINF DARAJASIDA (serverda, aylanib o'tib bo'lmaydi):
--    Alohida o'quvchi pasayishi mumkin. Pasaymasligi kerak bo'lgan narsa —
--    SINFNING o'rtacha foizi. Ish (BSB/ChSB/10 ballik) to'liq baholab
--    bo'lingach, sinfning chorakdagi umumiy foizi quyidagidan past
--    bo'lmasligi kerak:
--      1) shu sinfning oldingi chorakdagi umumiy foizi;
--      2) shu chorakda hozirgacha yig'ilgan umumiy foizi.
--
--    Sinf o'rtachasiga o'zidan katta/teng qiymat qo'shilsa o'rtacha
--    pasaymaydi — shuning uchun sinf doim o'sadi. Har bir sinf o'ssa,
--    parallel (masalan barcha 7-sinflar) va butun maktab ham o'sadi.
--
--    Ish to'liq baholanmaguncha baholar erkin kiritiladi — tekshiruv
--    oxirgi o'quvchi kiritilganda ishlaydi, shundan keyin esa har bir
--    tahrirda.
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

-- ─────────────────── Bitta o'quvchining yig'indisi ───────────────────
-- (avtomatik baho taklif qilish va chorak yakunini ko'rsatish uchun)
create or replace function app_student_sum(
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
       and r.id = 1
       and not p_skip_extra
  ) t
$$;

-- ──────────────────────── SINF yig'indisi ────────────────────────
-- O'sish qoidasi shu yerdan hisoblanadi: butun sinf bo'yicha
-- olingan ball va maksimal ball.
create or replace function app_class_sum(
  p_assignment uuid,
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
       and (p_exclude is null or ass.id <> p_exclude)
    union all
    select e.points, r.extra_total
      from quarter_extras e
      cross join grading_rules r
     where e.assignment_id = p_assignment
       and e.quarter = p_quarter
       and r.id = 1
       and not p_skip_extra
  ) t
$$;

-- Sinf uchun «pol» (foizda). Manfiy qiymat — cheklov yo'q.
create or replace function app_class_floor_pct(
  p_assignment uuid,
  p_quarter    int,
  p_exclude    uuid default null,
  p_skip_extra boolean default false
) returns numeric
  language plpgsql stable security definer set search_path = public as $$
declare
  v_cur  numeric[];
  v_prev numeric[];
  v_run  numeric;
  v_last numeric;
begin
  v_cur := app_class_sum(p_assignment, p_quarter, p_exclude, p_skip_extra);
  if v_cur[2] > 0 then
    v_run := 100.0 * v_cur[1] / v_cur[2];
  end if;

  if p_quarter > 1 then
    v_prev := app_class_sum(p_assignment, p_quarter - 1, null, false);
    if v_prev[2] > 0 then
      v_last := 100.0 * v_prev[1] / v_prev[2];
    end if;
  end if;

  return greatest(coalesce(v_run, -1), coalesce(v_last, -1));
end $$;

-- ───────────────── Sinfning joriy holati (jurnal sarlavhasi) ─────────────────
-- p_assessment berilsa — shu BSB/ChSB bo'yicha; berilmasa — 10 ballik baho.
create or replace function class_progress(
  p_assignment uuid,
  p_quarter    int,
  p_assessment uuid default null
) returns table (
  roster       int,       -- sinfdagi o'quvchilar soni
  filled       int,       -- baho qo'yilganlar soni
  work_pct     numeric,   -- shu ishning sinf bo'yicha foizi
  quarter_pct  numeric,   -- chorakning hozirgi umumiy foizi
  floor_pct    numeric,   -- pasaymasligi kerak bo'lgan daraja
  complete     boolean,   -- hamma baholandimi
  ok           boolean,   -- o'sish shartini bajaradimi
  need_points  numeric    -- shart bajarilishi uchun yana necha ball kerak
)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_rul    grading_rules;
  v_max    numeric;
  v_sum    numeric;
  v_cnt    int;
  v_other  numeric[];
  v_floor  numeric;
  v_target numeric;
begin
  if not (app_owns(p_assignment) or app_is_staff()) then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_rul from grading_rules where id = 1;

  if p_assessment is null then
    v_max := v_rul.extra_total;
    select coalesce(sum(points), 0), count(*) into v_sum, v_cnt
      from quarter_extras
     where assignment_id = p_assignment and quarter = p_quarter;
    v_other := app_class_sum(p_assignment, p_quarter, null, true);
    v_floor := app_class_floor_pct(p_assignment, p_quarter, null, true);
  else
    select max_points into v_max from assessments where id = p_assessment;
    select coalesce(sum(points), 0), count(*) into v_sum, v_cnt
      from grades where assessment_id = p_assessment;
    v_other := app_class_sum(p_assignment, p_quarter, p_assessment, false);
    v_floor := app_class_floor_pct(p_assignment, p_quarter, p_assessment, false);
  end if;

  roster := (select count(*) from app_roster(p_assignment));
  filled := v_cnt;
  work_pct := case when v_cnt > 0 then round(100.0 * v_sum / (v_cnt * v_max), 2) end;
  quarter_pct := case when v_other[2] + v_cnt * v_max > 0
                 then round(100.0 * (v_other[1] + v_sum) / (v_other[2] + v_cnt * v_max), 2) end;
  floor_pct := case when v_floor > 0 then round(v_floor, 2) end;
  complete := v_cnt >= roster and roster > 0;

  if v_floor <= 0 then
    need_points := 0;
  else
    -- hamma o'quvchi baholangandagi maksimal ballga nisbatan hisoblaymiz
    v_target := v_floor / 100.0 * (v_other[2] + roster * v_max);
    need_points := round(greatest(v_target - (v_other[1] + v_sum), 0), 2);
  end if;

  ok := need_points <= 0.001;
  return next;
end $$;

-- ───────────────── Jurnal satrlari ─────────────────
-- base_pct — o'quvchining shu chorakdagi (yoki oldingi chorakdagi) o'z
-- darajasi. Cheklov emas, avtomatik baho taklif qilish uchun asos.
create or replace function journal_rows(p_assessment uuid)
  returns table (
    student_id uuid,
    full_name  text,
    order_no   int,
    points     numeric,
    is_auto    boolean,
    base_pct   numeric,
    locked     boolean,
    created_at timestamptz
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
         b.pct,
         coalesce(g.created_at + make_interval(days => v_rul.edit_days) < now(), false),
         g.created_at
    from app_roster(v_ass.assignment_id) r
    left join grades g on g.assessment_id = p_assessment and g.student_id = r.student_id
    cross join lateral (
      select case
               when s.cur[2] > 0 then round(100.0 * s.cur[1] / s.cur[2], 2)
               when s.prev[2] > 0 then round(100.0 * s.prev[1] / s.prev[2], 2)
             end as pct
        from (
          select app_student_sum(v_ass.assignment_id, r.student_id, v_ass.quarter, p_assessment) as cur,
                 case when v_ass.quarter > 1
                      then app_student_sum(v_ass.assignment_id, r.student_id, v_ass.quarter - 1)
                      else array[0, 0]::numeric[] end as prev
        ) s
    ) b
   order by r.order_no, r.full_name;
end $$;

-- ───────────────── Bitta bahoni saqlash ─────────────────
-- Ichki variant: p_check = false bo'lsa sinf tekshiruvi o'tkazilmaydi
-- (ommaviy saqlashda butun to'plam oxirida bir marta tekshiriladi).
-- Bu funksiyani mijoz chaqira olmaydi — 04_stats.sql da huquqi olib tashlangan.
create or replace function save_grade_raw(
  p_assessment uuid,
  p_student    uuid,
  p_points     numeric,
  p_auto       boolean,
  p_check      boolean
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_ass    assessments;
  v_rul    grading_rules;
  v_old    grades;
  v_other  numeric[];
  v_sum    numeric;
  v_cnt    int;
  v_roster int;
  v_floor  numeric;
  v_newpts numeric;
  v_newmax numeric;
  v_pct    numeric;
  v_need   numeric;
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

  -- ── Sinf darajasidagi o'sish tekshiruvi ──
  if p_check then
    v_floor := app_class_floor_pct(v_ass.assignment_id, v_ass.quarter, p_assessment, false);

    if v_floor > 0 then
      v_other := app_class_sum(v_ass.assignment_id, v_ass.quarter, p_assessment, false);
      select coalesce(sum(points), 0), count(*) into v_sum, v_cnt
        from grades where assessment_id = p_assessment and student_id <> p_student;
      v_roster := (select count(*) from app_roster(v_ass.assignment_id));

      v_newpts := v_other[1] + v_sum + p_points;
      v_newmax := v_other[2] + (v_cnt + 1) * v_ass.max_points;
      v_pct := 100.0 * v_newpts / nullif(v_newmax, 0);

      -- Tekshiruv faqat ish to'liq baholanganda ishlaydi
      if v_cnt + 1 >= v_roster and v_pct < v_floor - 0.001 then
        -- shu o'quvchiga kamida qancha ball kerakligi
        v_need := round(greatest(v_floor / 100.0 * v_newmax - (v_other[1] + v_sum), 0), 2);

        insert into blocked_attempts (assignment_id, student_id, quarter, tried_points, min_points, actor_id)
        values (v_ass.assignment_id, p_student, v_ass.quarter, p_points,
                least(v_need, v_ass.max_points), auth.uid());

        return jsonb_build_object(
          'ok', false,
          'error', 'CLASS_TOO_LOW',
          'class_pct', round(v_pct, 2),
          'floor_pct', round(v_floor, 2),
          'need_points', v_need,
          'max_points', v_ass.max_points);
      end if;
    end if;
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

-- Mijoz chaqiradigan variant — tekshiruv doim yoqilgan
create or replace function save_grade(
  p_assessment uuid,
  p_student    uuid,
  p_points     numeric,
  p_auto       boolean default false
) returns jsonb
  language sql security definer set search_path = public as $$
  select save_grade_raw(p_assessment, p_student, p_points, p_auto, true)
$$;

-- ──────────────── Ko'p bahoni birdan saqlash ────────────────
-- p_items: [{"student_id": "...", "points": 42}, ...]
-- Har bir satr alohida yoziladi, sinf tekshiruvi esa oxirida bir marta.
-- Sinf o'sish shartini bajarmasa — butun to'plam bekor qilinadi.
create or replace function save_grades(
  p_assessment uuid,
  p_items      jsonb,
  p_auto       boolean default false
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_ass   assessments;
  v_item  jsonb;
  v_res   jsonb;
  v_out   jsonb := '[]'::jsonb;
  v_saved int := 0;
  v_cp    record;
  v_fail  jsonb;
begin
  select * into v_ass from assessments where id = p_assessment;
  if v_ass.id is null then
    return jsonb_build_object('saved', 0, 'failed', '[]'::jsonb, 'error', 'NOT_FOUND');
  end if;
  if not app_owns(v_ass.assignment_id) then
    return jsonb_build_object('saved', 0, 'failed', '[]'::jsonb, 'error', 'FORBIDDEN');
  end if;

  begin
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_res := save_grade_raw(
        p_assessment,
        (v_item ->> 'student_id')::uuid,
        (v_item ->> 'points')::numeric,
        p_auto,
        false
      );
      if (v_res ->> 'ok')::boolean then
        v_saved := v_saved + 1;
      else
        v_out := v_out || jsonb_build_array(v_res || jsonb_build_object('student_id', v_item ->> 'student_id'));
      end if;
    end loop;

    select * into v_cp from class_progress(v_ass.assignment_id, v_ass.quarter, p_assessment);
    if v_cp.complete and not v_cp.ok then
      v_fail := jsonb_build_object(
        'error', 'CLASS_TOO_LOW',
        'class_pct', v_cp.quarter_pct,
        'floor_pct', v_cp.floor_pct,
        'need_points', v_cp.need_points);
      raise exception 'CLASS_TOO_LOW' using errcode = 'ZZ001';
    end if;
  exception when sqlstate 'ZZ001' then
    -- hamma yozuvlar bekor qilindi
    insert into blocked_attempts (assignment_id, quarter, tried_points, min_points, actor_id)
    values (v_ass.assignment_id, v_ass.quarter, null, (v_fail ->> 'need_points')::numeric, auth.uid());
    return jsonb_build_object('saved', 0, 'failed', '[]'::jsonb) || v_fail;
  end;

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
  v_other  numeric[];
  v_sum    numeric;
  v_cnt    int;
  v_roster int;
  v_floor  numeric;
  v_newpts numeric;
  v_newmax numeric;
  v_pct    numeric;
  v_need   numeric;
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

  v_floor := app_class_floor_pct(p_assignment, p_quarter, null, true);

  if v_floor > 0 then
    v_other := app_class_sum(p_assignment, p_quarter, null, true);
    select coalesce(sum(points), 0), count(*) into v_sum, v_cnt
      from quarter_extras
     where assignment_id = p_assignment and quarter = p_quarter and student_id <> p_student;
    v_roster := (select count(*) from app_roster(p_assignment));

    v_newpts := v_other[1] + v_sum + p_points;
    v_newmax := v_other[2] + (v_cnt + 1) * v_rul.extra_total;
    v_pct := 100.0 * v_newpts / nullif(v_newmax, 0);

    if v_cnt + 1 >= v_roster and v_pct < v_floor - 0.001 then
      v_need := round(greatest(v_floor / 100.0 * v_newmax - (v_other[1] + v_sum), 0), 2);

      insert into blocked_attempts (assignment_id, student_id, quarter, tried_points, min_points, actor_id)
      values (p_assignment, p_student, p_quarter, p_points,
              least(v_need, v_rul.extra_total::numeric), auth.uid());

      return jsonb_build_object(
        'ok', false,
        'error', 'CLASS_TOO_LOW',
        'class_pct', round(v_pct, 2),
        'floor_pct', round(v_floor, 2),
        'need_points', v_need,
        'max_points', v_rul.extra_total);
    end if;
  end if;

  insert into quarter_extras (assignment_id, quarter, student_id, points, author_id)
  values (p_assignment, p_quarter, p_student, p_points, auth.uid())
  on conflict (assignment_id, quarter, student_id)
  do update set points = excluded.points, updated_at = now(), author_id = auth.uid();

  insert into grade_log (assignment_id, student_id, target, quarter, old_points, new_points, is_auto, actor_id)
  values (p_assignment, p_student, 'extra', p_quarter, v_old.points, p_points, false, auth.uid());

  return jsonb_build_object('ok', true, 'points', p_points);
end $$;

-- 10 ballik baho jadvali
create or replace function extra_rows(p_assignment uuid, p_quarter int)
  returns table (
    student_id uuid,
    full_name  text,
    order_no   int,
    points     numeric,
    locked     boolean,
    q_points   numeric,   -- 10 ballsiz yig'ilgan ball
    q_max      numeric,
    base_pct   numeric    -- o'quvchining shu chorakdagi darajasi
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
         coalesce(e.created_at + make_interval(days => v_rul.edit_days) < now(), false),
         s.qs[1],
         s.qs[2],
         round(100.0 * s.qs[1] / nullif(s.qs[2], 0), 2)
    from app_roster(p_assignment) r
    left join quarter_extras e
           on e.assignment_id = p_assignment and e.quarter = p_quarter
          and e.student_id = r.student_id
    cross join lateral (
      select app_student_sum(p_assignment, r.student_id, p_quarter, null, true) as qs
    ) s
   order by r.order_no, r.full_name;
end $$;
