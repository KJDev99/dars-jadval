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
    insert into classes (year_id, grade, letter) select id, 9, 'z' from academic_years where is_active;
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: o''qituvchi sinf qo''sha oldi!'; end if;
  raise notice 'OK  o''qituvchi sinf qo''sha olmaydi (faqat ko''radi)';

  if (select count(*) from classes) <> 1 then raise exception 'FAIL: o''qituvchi sinfni ko''rmayapti'; end if;
  raise notice 'OK  o''qituvchi sinflarni ko''ra oladi';
end $$;

-- ══════════════════ 5. JURNAL VA 1-BSB ══════════════════
insert into assignments (class_id, subject_id, teacher_id)
select c.id, p.subject_id, p.id from classes c, profiles p
 where c.grade=8 and c.letter='a' and p.login='matem';

insert into assessments (assignment_id, quarter, kind, idx, max_points)
select a.id, 1, 'bsb', 1, 10 from assignments a;

do $$
declare ass uuid := (select id from assessments where idx=1 and quarter=1);
  res jsonb;
  cp record;
begin
  if (select count(*) from journal_rows(ass)) <> 3 then raise exception 'FAIL: journal_rows'; end if;
  raise notice 'OK  journal_rows 3 o''quvchini qaytardi';

  select * into cp from class_progress((select assignment_id from assessments where id=ass), 1, ass);
  if cp.floor_pct is not null then raise exception 'FAIL: birinchi ishda cheklov bo''lmasligi kerak'; end if;
  raise notice 'OK  birinchi ishda cheklov yo''q (floor_pct = null)';

  -- 8, 9, 10 → sinf = 27/30 = 90%
  for res in
    select save_grade(ass, s.id, v.ball)
      from students s
      join (values ('Aliyev Aziz',8),('Boboyeva Zuhra',9),('Davlatov Sardor',10)) as v(nom,ball)
        on v.nom = s.full_name
  loop
    if not (res->>'ok')::boolean then raise exception 'FAIL: 1-BSB saqlanmadi %', res; end if;
  end loop;

  select * into cp from class_progress((select assignment_id from assessments where id=ass), 1, ass);
  if round(cp.quarter_pct) <> 90 then raise exception 'FAIL: sinf foizi % ', cp.quarter_pct; end if;
  raise notice 'OK  1-BSB: sinf o''rtachasi 90%% (8+9+10 = 27/30)';
end $$;

-- ══════════════════ 6. ALOHIDA O'QUVCHI PASAYISHI MUMKIN ══════════════════
insert into assessments (assignment_id, quarter, kind, idx, max_points)
select a.id, 1, 'bsb', 2, 10 from assignments a;

do $$
declare ass2 uuid := (select id from assessments where idx=2 and quarter=1);
  asg uuid := (select id from assignments limit 1);
  s1 uuid := (select id from students where full_name='Aliyev Aziz');
  s2 uuid := (select id from students where full_name='Boboyeva Zuhra');
  s3 uuid := (select id from students where full_name='Davlatov Sardor');
  res jsonb; cp record;
begin
  -- 1-o'quvchiga 8 dan 4 ga tushirib qo'yamiz — ish to'liq emas, ruxsat
  res := save_grade(ass2, s1, 4);
  if not (res->>'ok')::boolean then raise exception 'FAIL: alohida o''quvchiga past ball qo''yilmadi %', res; end if;
  raise notice 'OK  ALOHIDA o''quvchiga past baho qo''yish mumkin (4/10)';

  res := save_grade(ass2, s2, 5);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;

  select * into cp from class_progress(asg, 1, ass2);
  if cp.complete then raise exception 'FAIL: ish to''liq emas edi'; end if;
  if cp.ok then raise exception 'FAIL: sinf sharti bajarilmagan bo''lishi kerak'; end if;
  raise notice 'OK  sinf holati: 2/3 baholandi, shart hozircha bajarilmagan (yana % ball kerak)', cp.need_points;

  -- oxirgi o'quvchi kiritilganda sinf tekshiruvi ishlaydi
  res := save_grade(ass2, s3, 10);
  if (res->>'ok')::boolean then raise exception 'FAIL: sinf o''rtachasi tushib ketdi, lekin saqlandi!'; end if;
  if res->>'error' <> 'CLASS_TOO_LOW' then raise exception 'FAIL: xato turi %', res->>'error'; end if;
  raise notice 'OK  SINF o''rtachasi tushganda saqlanmadi (CLASS_TOO_LOW: % → kerak >= %)',
    res->>'class_pct', res->>'floor_pct';

  if (select count(*) from blocked_attempts) < 1 then
    raise exception 'FAIL: to''xtatilgan urinish yozilmadi';
  end if;
  raise notice 'OK  to''xtatilgan urinish menejer uchun yozib qo''yildi';

  -- boshqalarning ballini ko'taramiz
  res := save_grade(ass2, s1, 9);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
  res := save_grade(ass2, s2, 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
  res := save_grade(ass2, s3, 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL: to''g''ri to''plam saqlanmadi %', res; end if;
  raise notice 'OK  ballar ko''tarilgach to''liq to''plam saqlandi (29/30)';

  select * into cp from class_progress(asg, 1, ass2);
  if not cp.complete or not cp.ok then raise exception 'FAIL: holat ok bo''lishi kerak'; end if;
  raise notice 'OK  sinf chorak o''rtachasi % (90%% dan o''sdi)', cp.quarter_pct;

  -- to'liq baholangandan keyin: bitta o'quvchini pasaytirish mumkin, agar sinf ushlab tursa
  res := save_grade(ass2, s1, 8);
  if not (res->>'ok')::boolean then raise exception 'FAIL: sinf ushlab turganda pasaytirishga ruxsat berilmadi %', res; end if;
  raise notice 'OK  sinf o''rtachasi yetarli bo''lsa, o''quvchini pasaytirish mumkin (9 → 8)';

  -- lekin sinfni buzadigan pasayish — yo'q
  res := save_grade(ass2, s1, 2);
  if (res->>'ok')::boolean then raise exception 'FAIL: sinfni buzadigan pasayish o''tib ketdi!'; end if;
  raise notice 'OK  sinfni buzadigan pasayish to''xtatildi';

  res := save_grade(ass2, s1, 9);  -- holatni tiklaymiz
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
end $$;

-- ══════════════════ 7. OMMAVIY SAQLASH (AVTOMATIK BAHOLASH) ══════════════════
insert into assessments (assignment_id, quarter, kind, idx, max_points)
select a.id, 1, 'bsb', 3, 10 from assignments a;

do $$
declare ass3 uuid := (select id from assessments where idx=3 and quarter=1);
  res jsonb; n_before int;
begin
  select count(*) into n_before from grades;

  -- past to'plam: hammasi bekor qilinishi kerak
  res := save_grades(ass3, (select jsonb_agg(jsonb_build_object('student_id', student_id, 'points', 5))
                              from app_roster((select id from assignments limit 1))), true);
  if (res->>'saved')::int <> 0 then raise exception 'FAIL: past to''plam saqlandi %', res; end if;
  if res->>'error' <> 'CLASS_TOO_LOW' then raise exception 'FAIL: xato turi %', res->>'error'; end if;
  if (select count(*) from grades) <> n_before then
    raise exception 'FAIL: bekor qilish ishlamadi (yozuvlar qoldi)';
  end if;
  raise notice 'OK  ommaviy saqlashda past to''plam BUTUNLAY bekor qilindi';

  -- o'sadigan to'plam
  res := save_grades(ass3, (select jsonb_agg(jsonb_build_object('student_id', student_id, 'points', 10))
                              from app_roster((select id from assignments limit 1))), true);
  if (res->>'saved')::int <> 3 then raise exception 'FAIL: o''sadigan to''plam saqlanmadi %', res; end if;
  raise notice 'OK  o''sadigan to''plam saqlandi (3 ta baho)';
end $$;

-- ══════════════════ 8. BSB 50 / ChSB 40 CHEKLOVI ══════════════════
do $$
declare bloklandi boolean := false;
begin
  begin
    insert into assessments (assignment_id, quarter, kind, idx, max_points)
    select a.id, 1, 'bsb', 4, 25 from assignments a;      -- 30 + 25 = 55 > 50
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: BSB jami 50 dan oshib ketdi!'; end if;
  raise notice 'OK  BSB lar jami 50 balldan oshmaydi';

  bloklandi := false;
  begin
    insert into assessments (assignment_id, quarter, kind, idx, max_points)
    select a.id, 1, 'chsb', 1, 30 from assignments a;
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: ChSB 30 ballik bo''lib qoldi!'; end if;
  raise notice 'OK  ChSB faqat 40 ballik bo''ladi';
end $$;

-- ══════════════════ 9. 10 BALLIK BAHO (SINF DARAJASIDA) ══════════════════
do $$
declare asg uuid := (select id from assignments limit 1);
  s1 uuid := (select id from students where full_name='Aliyev Aziz');
  s2 uuid := (select id from students where full_name='Boboyeva Zuhra');
  s3 uuid := (select id from students where full_name='Davlatov Sardor');
  res jsonb; cp record; q numeric;
begin
  select quarter_pct into q from class_progress(asg, 1, null);
  raise notice '    10 ballikdan oldin sinf chorak o''rtachasi = %', q;

  res := save_extra(asg, 1, s1, 4);      -- bittasiga past — ruxsat
  if not (res->>'ok')::boolean then raise exception 'FAIL: 10 ballik past baho qo''yilmadi %', res; end if;
  res := save_extra(asg, 1, s2, 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;

  res := save_extra(asg, 1, s3, 10);     -- to'liq bo'ladi → tekshiruv
  if (res->>'ok')::boolean then raise exception 'FAIL: 10 ballikda sinf tushib ketdi, lekin saqlandi!'; end if;
  raise notice 'OK  10 ballik bahoda ham sinf qoidasi ishlaydi (CLASS_TOO_LOW)';

  res := save_extra(asg, 1, s1, 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
  res := save_extra(asg, 1, s3, 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL: to''g''ri to''plam saqlanmadi %', res; end if;

  select * into cp from class_progress(asg, 1, null);
  if not cp.complete or not cp.ok then raise exception 'FAIL: 10 ballik holati %', cp; end if;
  raise notice 'OK  10 ballik to''liq kiritildi, sinf o''rtachasi % ', cp.quarter_pct;
end $$;

-- ══════════════════ 10. KEYINGI CHORAK ══════════════════
insert into assessments (assignment_id, quarter, kind, idx, max_points)
select a.id, 2, 'bsb', 1, 10 from assignments a;

do $$
declare ass uuid := (select id from assessments where quarter=2 and idx=1);
  asg uuid := (select id from assignments limit 1);
  s1 uuid := (select id from students where full_name='Aliyev Aziz');
  s2 uuid := (select id from students where full_name='Boboyeva Zuhra');
  s3 uuid := (select id from students where full_name='Davlatov Sardor');
  res jsonb; cp record; v_floor numeric;
begin
  select floor_pct into v_floor from class_progress(asg, 2, ass);
  raise notice '    1-chorakdagi sinf darajasi 2-chorak uchun pol = %', v_floor;
  if v_floor is null then raise exception 'FAIL: 2-chorakda pol bo''lishi kerak'; end if;

  res := save_grade(ass, s1, 9);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
  res := save_grade(ass, s2, 9);
  if not (res->>'ok')::boolean then raise exception 'FAIL %', res; end if;
  res := save_grade(ass, s3, 9);   -- 27/30 = 90% < 1-chorak darajasi
  if (res->>'ok')::boolean then raise exception 'FAIL: 2-chorakda sinf pasayishi o''tib ketdi!'; end if;
  raise notice 'OK  2-chorakda sinf 1-chorakdan past bo''lsa saqlanmaydi';

  res := save_grade(ass, s1, 10);
  res := save_grade(ass, s2, 10);
  res := save_grade(ass, s3, 10);
  if not (res->>'ok')::boolean then raise exception 'FAIL: o''sgan to''plam saqlanmadi %', res; end if;
  select * into cp from class_progress(asg, 2, ass);
  raise notice 'OK  2-chorakda o''sish bilan saqlandi (sinf %)', cp.quarter_pct;
end $$;

-- ══════════════════ 11. 2 KUNLIK QULF ══════════════════
reset role;
update grades set created_at = now() - interval '3 days'
 where assessment_id = (select id from assessments where quarter=1 and idx=1);
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;

do $$
declare ass uuid := (select id from assessments where quarter=1 and idx=1);
  st uuid := (select id from students where full_name='Boboyeva Zuhra');
  res jsonb; lk boolean;
begin
  select locked into lk from journal_rows(ass) where student_id = st;
  if not lk then raise exception 'FAIL: baho qulflanmadi'; end if;
  res := save_grade(ass, st, 10);
  if (res->>'ok')::boolean then raise exception 'FAIL: 2 kundan keyin o''zgartirildi!'; end if;
  if res->>'error' <> 'LOCKED' then raise exception 'FAIL: xato turi %', res->>'error'; end if;
  raise notice 'OK  2 kundan keyin baho qulflandi (LOCKED)';
end $$;

-- ══════════════════ 12. QOIDANI CHETLAB O'TISH MUMKIN EMAS ══════════════════
do $$
declare bloklandi boolean := false;
begin
  begin
    insert into grades (assessment_id, student_id, points)
    select (select id from assessments where quarter=2 and idx=1),
           (select id from students where full_name='Davlatov Sardor'), 1;
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: grades jadvaliga to''g''ridan-to''g''ri yozildi!'; end if;
  raise notice 'OK  grades jadvaliga to''g''ridan-to''g''ri yozib bo''lmaydi';

  bloklandi := false;
  begin
    perform save_grade_raw((select id from assessments where quarter=2 and idx=1),
                           (select id from students where full_name='Davlatov Sardor'), 1, false, false);
  exception when others then bloklandi := true;
  end;
  if not bloklandi then raise exception 'FAIL: tekshiruvsiz ichki funksiya chaqirildi!'; end if;
  raise notice 'OK  tekshiruvni o''chiradigan ichki funksiya mijozga yopiq';
end $$;

-- ══════════════════ 13. BEGONA O'QITUVCHI ══════════════════
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

-- ══════════════════ 14. MENEJER STATISTIKASI ══════════════════
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;

\pset tuples_only off
\echo ''
\echo '--- SINF bo''yicha choraklar (o''sish shu yerda kafolatlangan) ---'
select class_name, quarter, students, avg_pct, avg_mark, quality from v_class_quarter order by quarter;

\echo ''
\echo '--- PARALLEL (8-sinflar) ---'
select grade, quarter, students, avg_pct from v_grade_quarter order by grade, quarter;

\echo ''
\echo '--- MAKTAB ---'
select quarter, students, avg_pct, avg_mark, quality, progress from v_school_quarter order by quarter;

\echo ''
\echo '--- O''quvchilar (alohida pasayish mumkin) ---'
select student_name, quarter, points, max_points, pct, mark
  from v_student_quarter order by student_name, quarter;

\pset tuples_only on
do $$
declare q1 numeric; q2 numeric;
begin
  select avg_pct into q1 from v_class_quarter where quarter=1;
  select avg_pct into q2 from v_class_quarter where quarter=2;
  if q2 < q1 then raise exception 'FAIL: sinf o''rtachasi pasaydi (% → %)', q1, q2; end if;
  raise notice 'OK  SINF o''rtachasi o''sdi: % → %', q1, q2;

  select avg_pct into q1 from v_grade_quarter where quarter=1;
  select avg_pct into q2 from v_grade_quarter where quarter=2;
  if q2 < q1 then raise exception 'FAIL: parallel pasaydi'; end if;
  raise notice 'OK  PARALLEL (8-sinflar) o''rtachasi o''sdi: % → %', q1, q2;

  select avg_pct into q1 from v_school_quarter where quarter=1;
  select avg_pct into q2 from v_school_quarter where quarter=2;
  if q2 < q1 then raise exception 'FAIL: maktab pasaydi'; end if;
  raise notice 'OK  MAKTAB o''rtachasi o''sdi: % → %', q1, q2;
end $$;

reset role;
\echo ''
\echo '════════ BARCHA SINOVLAR O''TDI ════════'
