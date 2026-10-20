-- ════════════════════════════════════════════════════════════════════════
--  Reja, dars jadvali va eslatmalar sinovi.
--  smoke-test.sql dan KEYIN ishga tushiriladi (uning ma'lumotlaridan foydalanadi).
-- ════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

-- ══════════════ 1. MENEJER: DARS JADVALI VA REJA ══════════════
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;

-- Dars jadvali: 8a da matematika (matem) va fizika (fizik)
insert into lessons (year_id, class_id, subject_id, weekday, lesson_no, teacher_id)
select y.id, c.id, s.id, 1, 1, p.id
  from academic_years y, classes c, subjects s, profiles p
 where y.is_active and c.grade = 8 and c.letter = 'a'
   and s.name = 'Matematika' and p.login = 'matem';

insert into lessons (year_id, class_id, subject_id, weekday, lesson_no, teacher_id)
select y.id, c.id, s.id, 1, 2, p.id
  from academic_years y, classes c, subjects s, profiles p
 where y.is_active and c.grade = 8 and c.letter = 'a'
   and s.name = 'Fizika' and p.login = 'fizik';

do $$ begin
  if (select count(*) from lessons) <> 2 then raise exception 'FAIL: dars jadvali yozilmadi'; end if;
  raise notice 'OK  menejer dars jadvalini kiritdi (2 dars)';
end $$;

-- Reja: 3-chorak, matematika — muddati o'tgan; fizika — bugun
insert into assessment_plan (year_id, quarter, class_id, subject_id, kind, idx, planned_on, max_points)
select y.id, 3, c.id, s.id, 'bsb', 1, current_date - 2, 10
  from academic_years y, classes c, subjects s
 where y.is_active and c.grade = 8 and c.letter = 'a' and s.name = 'Matematika';

insert into assessment_plan (year_id, quarter, class_id, subject_id, kind, idx, planned_on, max_points)
select y.id, 3, c.id, s.id, 'bsb', 1, current_date, 10
  from academic_years y, classes c, subjects s
 where y.is_active and c.grade = 8 and c.letter = 'a' and s.name = 'Fizika';

-- Yana bittasi: uzoq kelajakda — eslatmaga tushmasligi kerak
insert into assessment_plan (year_id, quarter, class_id, subject_id, kind, idx, planned_on)
select y.id, 3, c.id, s.id, 'chsb', 1, current_date + 60
  from academic_years y, classes c, subjects s
 where y.is_active and c.grade = 8 and c.letter = 'a' and s.name = 'Matematika';

do $$ begin
  if (select count(*) from assessment_plan) <> 3 then raise exception 'FAIL: reja yozilmadi'; end if;
  raise notice 'OK  menejer rejani kiritdi (3 satr)';
end $$;

-- ══════════════ 2. MENEJER ESLATMALARI ══════════════
do $$
declare n int; r record;
begin
  select count(*) into n from plan_feed(7);
  if n <> 2 then raise exception 'FAIL: menejer % ta eslatma ko''rdi (2 bo''lishi kerak)', n; end if;
  raise notice 'OK  menejer 2 ta eslatma ko''rdi (60 kundan keyingisi ro''yxatda yo''q)';

  select * into r from plan_feed(7) where subject_name = 'Matematika';
  if r.urgency <> 'late' then raise exception 'FAIL: holat % (late bo''lishi kerak)', r.urgency; end if;
  if r.days <> -2 then raise exception 'FAIL: kun farqi %', r.days; end if;
  if r.state <> 'none' then raise exception 'FAIL: state %', r.state; end if;
  if r.teacher_name not like 'Aliyev%' then raise exception 'FAIL: o''qituvchi % ', r.teacher_name; end if;
  raise notice 'OK  kechikkan ish: % · % · % kun · %', r.class_name, r.subject_name, r.days, r.teacher_name;

  select * into r from plan_feed(7) where subject_name = 'Fizika';
  if r.urgency <> 'today' then raise exception 'FAIL: fizika holati %', r.urgency; end if;
  if r.teacher_name not like 'Boboyev%' then
    raise exception 'FAIL: dars jadvalidan o''qituvchi aniqlanmadi: %', r.teacher_name;
  end if;
  raise notice 'OK  bugungi ish dars jadvalidagi o''qituvchiga bog''landi: %', r.teacher_name;
end $$;

-- ══════════════ 3. O'QITUVCHI FAQAT O'ZINIKINI KO'RADI ══════════════
reset role;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';  -- matem
set role authenticated;

do $$
declare n int; r record;
begin
  select count(*) into n from plan_feed(7);
  if n <> 1 then raise exception 'FAIL: matematika o''qituvchisi % ta eslatma ko''rdi', n; end if;
  select * into r from plan_feed(7);
  if r.subject_name <> 'Matematika' then raise exception 'FAIL: begona fan eslatmasi: %', r.subject_name; end if;
  if r.is_read then raise exception 'FAIL: eslatma o''qilgan deb belgilangan'; end if;
  raise notice 'OK  o''qituvchi faqat o''z fanidagi eslatmani ko''rdi (o''qilmagan)';
end $$;

-- ══════════════ 4. O'QILGAN DEB BELGILASH ══════════════
do $$
declare r record; v_n int;
begin
  select * into r from plan_feed(7);
  v_n := mark_feed_read(array[r.plan_id], array[r.urgency]);
  if v_n <> 1 then raise exception 'FAIL: belgilanmadi (%)', v_n; end if;

  select * into r from plan_feed(7);
  if not r.is_read then raise exception 'FAIL: eslatma hali o''qilmagan holatda'; end if;
  raise notice 'OK  eslatma «o''qildi» deb belgilandi';
end $$;

-- ══════════════ 5. HOLAT O'ZGARISHI: none → partial → done ══════════════
do $$
declare asg uuid := (select id from assignments limit 1);
  cls uuid := (select id from classes where grade = 8 and letter = 'a');
  sub int  := (select id from subjects where name = 'Matematika');
  ass uuid;
  st text;
  res jsonb;
begin
  st := app_plan_state(cls, sub, 3, 'bsb', 1);
  if st <> 'none' then raise exception 'FAIL: boshlang''ich holat %', st; end if;

  -- jurnalda ishni yaratamiz
  insert into assessments (assignment_id, quarter, kind, idx, max_points)
  values (asg, 3, 'bsb', 1, 10) returning id into ass;

  st := app_plan_state(cls, sub, 3, 'bsb', 1);
  if st <> 'partial' then raise exception 'FAIL: ish yaratilgandan keyin holat %', st; end if;
  raise notice 'OK  ish yaratildi → holat «partial»';

  -- bitta o'quvchini baholaymiz
  res := save_grade(ass, (select id from students where full_name = 'Aliyev Aziz'), 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL: baho saqlanmadi %', res; end if;
  st := app_plan_state(cls, sub, 3, 'bsb', 1);
  if st <> 'partial' then raise exception 'FAIL: chala baholashda holat %', st; end if;
  raise notice 'OK  chala baholashda holat «partial» qoldi';

  -- qolganlarini ham
  res := save_grade(ass, (select id from students where full_name = 'Boboyeva Zuhra'), 10);
  res := save_grade(ass, (select id from students where full_name = 'Davlatov Sardor'), 10);
  st := app_plan_state(cls, sub, 3, 'bsb', 1);
  if st <> 'done' then raise exception 'FAIL: to''liq baholashda holat %', st; end if;
  raise notice 'OK  hamma baholangach holat «done»';

  -- bajarilgan ish eslatmadan chiqib ketishi kerak
  if exists (select 1 from plan_feed(7)) then
    raise exception 'FAIL: bajarilgan ish eslatmada qoldi';
  end if;
  raise notice 'OK  bajarilgan ish eslatmalardan chiqdi';
end $$;

-- ══════════════ 6. O'QITUVCHI REJANI O'ZGARTIRA OLMAYDI ══════════════
do $$
declare bloklandi boolean := false;
begin
  begin
    insert into assessment_plan (year_id, quarter, class_id, subject_id, kind, idx, planned_on)
    select y.id, 4, c.id, s.id, 'bsb', 1, current_date
      from academic_years y, classes c, subjects s
     where y.is_active and c.grade = 8 and c.letter = 'a' and s.name = 'Matematika';
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: o''qituvchi rejaga satr qo''shdi!'; end if;
  raise notice 'OK  o''qituvchi rejani o''zgartira olmaydi (faqat menejer)';

  bloklandi := false;
  begin
    insert into lessons (year_id, class_id, subject_id, weekday, lesson_no)
    select y.id, c.id, s.id, 3, 5 from academic_years y, classes c, subjects s
     where y.is_active and c.grade = 8 and c.letter = 'a' and s.name = 'Matematika';
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: o''qituvchi dars jadvalini o''zgartirdi!'; end if;
  raise notice 'OK  o''qituvchi dars jadvalini o''zgartira olmaydi';

  if (select count(*) from lessons) <> 2 then raise exception 'FAIL: jadval ko''rinmayapti'; end if;
  if (select count(*) from v_timetable) <> 2 then raise exception 'FAIL: v_timetable ko''rinmayapti'; end if;
  raise notice 'OK  o''qituvchi dars jadvalini va rejani ko''ra oladi';
end $$;

-- ══════════════ 7. NATIJA ══════════════
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;

\pset tuples_only off
\echo ''
\echo '--- Reja holati (menejer ko''rinishi) ---'
select class_name, subject_name, quarter, kind, idx, planned_on, days, state
  from v_plan_status order by planned_on;

\echo ''
\echo '--- Dars jadvali ---'
select class_name, weekday, lesson_no, subject_name, teacher_name from v_timetable
 order by weekday, lesson_no;

\pset tuples_only on
reset role;
\echo ''
\echo '════════ REJA VA ESLATMA SINOVLARI O''TDI ════════'
