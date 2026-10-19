\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

-- ══════════════════ 1. RO'YXATDAN O'TISH ══════════════════
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111', 'admin@maktab.local',
  '{"login":"admin","last_name":"Adminov","first_name":"Bosh","role":"teacher"}'::jsonb);

insert into auth.users (id, email, raw_user_meta_data) values
 ('22222222-2222-2222-2222-222222222222', 'menejer@maktab.local',
  '{"login":"menejer","last_name":"Menejerov","first_name":"Olim","role":"manager"}'::jsonb);

insert into auth.users (id, email, raw_user_meta_data)
select '33333333-3333-3333-3333-333333333333', 'matem@maktab.local',
  jsonb_build_object('login','matem','last_name','Aliyev','first_name','Vali',
                     'role','teacher','subject_id',(select id from subjects where name='Matematika')::text);

insert into auth.users (id, email, raw_user_meta_data)
select '44444444-4444-4444-4444-444444444444', 'fizik@maktab.local',
  jsonb_build_object('login','fizik','last_name','Boboyev','first_name','Sardor',
                     'role','teacher','subject_id',(select id from subjects where name='Fizika')::text);

do $$
declare r record;
begin
  select role::text as role, status::text as status into r from profiles where login='admin';
  if r.role <> 'admin' or r.status <> 'approved' then
    raise exception 'FAIL: birinchi foydalanuvchi admin bo''lmadi (%, %)', r.role, r.status;
  end if;
  raise notice 'OK  birinchi ro''yxatdan o''tgan = admin, darhol tasdiqlangan';

  select role::text as role, status::text as status into r from profiles where login='menejer';
  if r.role <> 'manager' or r.status <> 'pending' then
    raise exception 'FAIL: menejer holati noto''g''ri (%, %)', r.role, r.status;
  end if;
  raise notice 'OK  menejer «pending» holatda kutmoqda';

  if (select subject_id from profiles where login='matem') is null then
    raise exception 'FAIL: o''qituvchiga fan biriktirilmadi';
  end if;
  raise notice 'OK  o''qituvchiga fan biriktirildi';
end $$;

-- ══════════════════ 2. ADMIN TASDIQLAYDI ══════════════════
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;

update profiles set status='approved' where login in ('menejer','matem','fizik');

do $$ begin
  if (select count(*) from profiles where status='approved') <> 4 then
    raise exception 'FAIL: admin tasdiqlay olmadi';
  end if;
  raise notice 'OK  admin uchala akkauntni tasdiqladi';
end $$;

-- ══════════════════ 3. MENEJER: SINF VA O'QUVCHILAR ══════════════════
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;

insert into classes (year_id, grade, letter)
select id, 8, 'a' from academic_years where is_active;

insert into students (class_id, full_name, order_no)
select c.id, s.nom, s.n from classes c,
 (values ('Aliyev Aziz',1),('Boboyeva Zuhra',2),('Davlatov Sardor',3)) as s(nom,n)
where c.grade=8 and c.letter='a';

do $$ begin
  if (select count(*) from students) <> 3 then raise exception 'FAIL: o''quvchilar qo''shilmadi'; end if;
  raise notice 'OK  menejer sinf va 3 o''quvchi qo''shdi';
end $$;

-- ══════════════════ 4. O'QITUVCHI SINF QO'SHA OLMAYDI ══════════════════
reset role;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;

do $$
declare bloklandi boolean := false;
begin
  begin
    insert into classes (year_id, grade, letter)
    select id, 9, 'z' from academic_years where is_active;
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: o''qituvchi sinf qo''sha oldi!'; end if;
  raise notice 'OK  o''qituvchi sinf qo''sha olmaydi (faqat ko''radi)';

  if (select count(*) from classes) <> 1 then raise exception 'FAIL: o''qituvchi sinfni ko''rmayapti'; end if;
  raise notice 'OK  o''qituvchi sinflarni ko''ra oladi';
end $$;

-- ══════════════════ 5. JURNAL OCHISH VA BSB ══════════════════
insert into assignments (class_id, subject_id, teacher_id)
select c.id, p.subject_id, p.id from classes c, profiles p
 where c.grade=8 and c.letter='a' and p.login='matem';

insert into assessments (assignment_id, quarter, kind, idx, max_points)
select a.id, 1, 'bsb', 1, 10 from assignments a;

do $$
declare n int;
begin
  select count(*) into n from journal_rows((select id from assessments where idx=1 and quarter=1));
  if n <> 3 then raise exception 'FAIL: journal_rows % satr qaytardi', n; end if;
  raise notice 'OK  journal_rows 3 o''quvchini qaytardi';
end $$;

-- 1-BSB: baholar qo'yiladi (tarix yo'q — cheklov yo'q)
do $$
declare ass uuid := (select id from assessments where idx=1 and quarter=1);
  res jsonb;
begin
  for res in
    select save_grade(ass, s.id, v.ball)
      from students s
      join (values ('Aliyev Aziz',8),('Boboyeva Zuhra',9),('Davlatov Sardor',10)) as v(nom,ball)
        on v.nom = s.full_name
  loop
    if not (res->>'ok')::boolean then raise exception 'FAIL: 1-BSB saqlanmadi %', res; end if;
  end loop;
  raise notice 'OK  1-BSB: 8, 9, 10 ball qo''yildi';
end $$;

-- ══════════════════ 6. O'SISH QOIDASI ══════════════════
insert into assessments (assignment_id, quarter, kind, idx, max_points)
select a.id, 1, 'bsb', 2, 10 from assignments a;

do $$
declare ass2 uuid := (select id from assessments where idx=2 and quarter=1);
  st uuid := (select id from students where full_name='Aliyev Aziz');  -- 8/10 = 80%
  res jsonb;
  mn numeric;
begin
  select min_points into mn from journal_rows(ass2) where student_id = st;
  if mn <> 8 then raise exception 'FAIL: minimal ball 8 bo''lishi kerak, keldi %', mn; end if;
  raise notice 'OK  minimal ball to''g''ri hisoblandi (80%% → 8 ball)';

  res := save_grade(ass2, st, 7);                 -- pasaytirishga urinish
  if (res->>'ok')::boolean then raise exception 'FAIL: past baho saqlandi!'; end if;
  if res->>'error' <> 'TOO_LOW' then raise exception 'FAIL: xato turi % ', res->>'error'; end if;
  if (res->>'min_points')::numeric <> 8 then raise exception 'FAIL: min_points %', res->>'min_points'; end if;
  raise notice 'OK  past baho SAQLANMADI (TOO_LOW, kamida 8 ball)';

  if (select count(*) from blocked_attempts) <> 1 then
    raise exception 'FAIL: to''xtatilgan urinish yozilmadi';
  end if;
  raise notice 'OK  to''xtatilgan urinish menejer uchun yozib qo''yildi';

  res := save_grade(ass2, st, 9);                 -- o'sish
  if not (res->>'ok')::boolean then raise exception 'FAIL: 9 ball saqlanmadi %', res; end if;
  raise notice 'OK  yuqori baho (9) saqlandi';
end $$;

-- Qolgan ikkitasiga ham 2-BSB
do $$
declare ass2 uuid := (select id from assessments where idx=2 and quarter=1);
  res jsonb;
begin
  res := save_grade(ass2, (select id from students where full_name='Boboyeva Zuhra'), 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
  res := save_grade(ass2, (select id from students where full_name='Davlatov Sardor'), 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
end $$;

-- ══════════════════ 7. BSB 50 BALL CHEKLOVI VA ChSB 40 ══════════════════
do $$
declare bloklandi boolean := false;
begin
  begin
    insert into assessments (assignment_id, quarter, kind, idx, max_points)
    select a.id, 1, 'bsb', 3, 45 from assignments a;      -- 20 + 45 = 65 > 50
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: BSB jami 50 dan oshib ketdi!'; end if;
  raise notice 'OK  BSB lar jami 50 balldan oshmaydi';

  bloklandi := false;
  begin
    insert into assessments (assignment_id, quarter, kind, idx, max_points)
    select a.id, 1, 'chsb', 1, 30 from assignments a;     -- ChSB doim 40
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: ChSB 30 ballik bo''lib qoldi!'; end if;
  raise notice 'OK  ChSB faqat 40 ballik bo''ladi';
end $$;

-- ══════════════════ 8. 10 BALLIK BAHO ══════════════════
do $$
declare asg uuid := (select id from assignments limit 1);
  st uuid := (select id from students where full_name='Aliyev Aziz');  -- (8+9)/20 = 85%
  res jsonb;
  r record;
begin
  select min_points, pct_now into r from extra_rows(asg, 1) where student_id = st;
  if round(r.pct_now) <> 85 then raise exception 'FAIL: chorak foizi % ', r.pct_now; end if;
  if r.min_points <> 8.5 then raise exception 'FAIL: 10 ballik minimal % ', r.min_points; end if;
  raise notice 'OK  10 ballik uchun minimal = 8.5 (85%% darajasi)';

  res := save_extra(asg, 1, st, 8);
  if (res->>'ok')::boolean then raise exception 'FAIL: past 10 ballik saqlandi'; end if;
  raise notice 'OK  past 10 ballik baho saqlanmadi';

  res := save_extra(asg, 1, st, 9);
  if not (res->>'ok')::boolean then raise exception 'FAIL: 9 ball saqlanmadi %', res; end if;
  raise notice 'OK  9 ball saqlandi → chorak foizi o''sdi';
end $$;

-- ══════════════════ 9. KEYINGI CHORAK ══════════════════
insert into assessments (assignment_id, quarter, kind, idx, max_points)
select a.id, 2, 'bsb', 1, 10 from assignments a;

do $$
declare ass uuid := (select id from assessments where quarter=2 and idx=1);
  st uuid := (select id from students where full_name='Aliyev Aziz');
  res jsonb;
  mn numeric;
  q1 numeric;
begin
  select pct into q1 from v_student_quarter where student_id=st and quarter=1;
  select min_points into mn from journal_rows(ass) where student_id = st;
  raise notice '    1-chorak foizi = %, 2-chorakdagi minimal ball = %', q1, mn;
  if mn < 8 then raise exception 'FAIL: 2-chorak minimal bali juda past'; end if;

  res := save_grade(ass, st, 7);
  if (res->>'ok')::boolean then raise exception 'FAIL: 2-chorakda pasayish o''tib ketdi!'; end if;
  raise notice 'OK  2-chorakda oldingi chorakdan past baho saqlanmaydi';

  res := save_grade(ass, st, 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
  raise notice 'OK  2-chorakda o''sish bilan baho qo''yildi';
end $$;

-- ══════════════════ 10. 2 KUNLIK QULF ══════════════════
reset role;
update grades set created_at = now() - interval '3 days'
 where assessment_id = (select id from assessments where quarter=1 and idx=1);
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;

do $$
declare ass uuid := (select id from assessments where quarter=1 and idx=1);
  st uuid := (select id from students where full_name='Boboyeva Zuhra');
  res jsonb;
  lk boolean;
begin
  select locked into lk from journal_rows(ass) where student_id = st;
  if not lk then raise exception 'FAIL: baho qulflanmadi'; end if;
  res := save_grade(ass, st, 10);
  if (res->>'ok')::boolean then raise exception 'FAIL: 2 kundan keyin o''zgartirildi!'; end if;
  if res->>'error' <> 'LOCKED' then raise exception 'FAIL: xato turi %', res->>'error'; end if;
  raise notice 'OK  2 kundan keyin baho qulflandi (LOCKED)';
end $$;

-- ══════════════════ 11. BAHOLARGA TO'G'RIDAN-TO'G'RI YOZIB BO'LMAYDI ══════════════════
do $$
declare bloklandi boolean := false;
begin
  begin
    insert into grades (assessment_id, student_id, points)
    select (select id from assessments where quarter=2 and idx=1),
           (select id from students where full_name='Davlatov Sardor'), 1;
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: qoidani chetlab o''tib baho yozildi!'; end if;
  raise notice 'OK  grades jadvaliga to''g''ridan-to''g''ri yozib bo''lmaydi';
end $$;

-- ══════════════════ 12. BEGONA O'QITUVCHI ══════════════════
reset role;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
set role authenticated;

do $$
declare n int; res jsonb;
begin
  select count(*) into n from grades;
  if n <> 0 then raise exception 'FAIL: fizika o''qituvchisi begona baholarni ko''rdi (% ta)', n; end if;
  raise notice 'OK  boshqa o''qituvchining baholari ko''rinmaydi';

  res := save_grade((select id from assessments where quarter=2 and idx=1),
                    (select id from students where full_name='Aliyev Aziz'), 10);
  if (res->>'ok')::boolean then raise exception 'FAIL: begona o''qituvchi baho qo''ydi!'; end if;
  raise notice 'OK  begona o''qituvchi baho qo''ya olmaydi (FORBIDDEN)';
end $$;

-- ══════════════════ 13. MENEJER STATISTIKASI ══════════════════
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;

\pset tuples_only off
\echo ''
\echo '--- Menejer: o''quvchilar bo''yicha chorak natijasi ---'
select student_name, quarter, points, max_points, pct, mark
  from v_student_quarter order by student_name, quarter;

\echo ''
\echo '--- Menejer: maktab bo''yicha choraklar ---'
select quarter, students, avg_pct, avg_mark, quality, progress from v_school_quarter order by quarter;

\echo ''
\echo '--- Menejer: o''qituvchi faolligi ---'
select p.login, a.changes, a.manual_changes, a.auto_changes
  from v_teacher_activity a join profiles p on p.id = a.teacher_id;

\echo ''
\echo '--- Menejer: to''xtatilgan urinishlar ---'
select count(*) as bloklangan from v_teacher_blocked;

\pset tuples_only on
do $$ begin
  if (select count(*) from v_school_quarter) < 2 then
    raise exception 'FAIL: menejer statistikani ko''rmayapti';
  end if;
  raise notice 'OK  menejer barcha statistikani ko''ra oladi';
end $$;

reset role;
\echo ''
\echo '════════ BARCHA SINOVLAR O''TDI ════════'
