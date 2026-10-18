-- ════════════════════════════════════════════════════════════════════════
--  Rollar, ro'yxatdan o'tish va RLS siyosatlari
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────── Yordamchi funksiyalar ───────────────────────
-- RLS ichida profiles jadvalini o'qish rekursiyaga olib kelmasligi uchun
-- security definer ishlatiladi.

create or replace function app_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function app_approved() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'approved' from profiles where id = auth.uid()), false)
$$;

-- Admin va menejer — «shtab»: sinf, o'quvchi, statistikaga to'liq huquq
create or replace function app_is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select status = 'approved' and role in ('admin', 'manager') from profiles where id = auth.uid()
  ), false)
$$;

create or replace function app_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select status = 'approved' and role = 'admin' from profiles where id = auth.uid()
  ), false)
$$;

-- Biriktirma shu o'qituvchiningmi
create or replace function app_owns(p_assignment uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a where a.id = p_assignment and a.teacher_id = auth.uid()
  ) and app_approved()
$$;

-- Baholash ishi shu o'qituvchining biriktirmasigami
create or replace function app_owns_assessment(p_assessment uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assessments ass
      join assignments a on a.id = ass.assignment_id
     where ass.id = p_assessment and a.teacher_id = auth.uid()
  ) and app_approved()
$$;

-- ──────────────────── Ro'yxatdan o'tish (auth → profiles) ────────────
-- Login bilan kirish uchun mijoz `login@<domen>` ko'rinishidagi email
-- yasaydi; haqiqiy ism, fan va rol metadata orqali keladi.
-- Rolni mijoz tanlaydi, lekin faqat teacher/manager — admin bo'lib olish mumkin emas.
-- Jadval bo'sh bo'lsa, birinchi ro'yxatdan o'tgan odam admin bo'ladi.

create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first    boolean := not exists (select 1 from profiles);
  v_role     user_role;
  v_login    text;
  v_subject  int;
begin
  v_login := nullif(trim(coalesce(v_meta ->> 'login', split_part(new.email, '@', 1))), '');
  if v_login is null then
    raise exception 'login majburiy';
  end if;

  v_role := case
    when v_first then 'admin'::user_role
    when (v_meta ->> 'role') = 'manager' then 'manager'::user_role
    else 'teacher'::user_role
  end;

  v_subject := nullif(v_meta ->> 'subject_id', '')::int;
  if v_role <> 'teacher' then
    v_subject := null;
  end if;

  insert into profiles (id, login, last_name, first_name, role, subject_id, status)
  values (
    new.id,
    lower(v_login),
    coalesce(nullif(trim(v_meta ->> 'last_name'), ''), '—'),
    coalesce(nullif(trim(v_meta ->> 'first_name'), ''), '—'),
    v_role,
    v_subject,
    case when v_first then 'approved'::user_status else 'pending'::user_status end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────── BSB jami 50, ChSB bitta va 40 ball bo'lishi ───────────
create or replace function check_assessment_limits() returns trigger
  language plpgsql as $$
declare
  r      grading_rules;
  v_sum  numeric;
  v_cnt  int;
begin
  select * into r from grading_rules where id = 1;

  if new.kind = 'bsb' then
    select coalesce(sum(max_points), 0) into v_sum
      from assessments
     where assignment_id = new.assignment_id
       and quarter = new.quarter
       and kind = 'bsb'
       and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
    if v_sum + new.max_points > r.bsb_total then
      raise exception 'BSB_LIMIT:%', r.bsb_total - v_sum
        using hint = 'Chorakdagi BSB lar jami ' || r.bsb_total || ' balldan oshmasligi kerak';
    end if;
  else
    select count(*) into v_cnt
      from assessments
     where assignment_id = new.assignment_id
       and quarter = new.quarter
       and kind = 'chsb'
       and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
    if v_cnt > 0 then
      raise exception 'CHSB_EXISTS' using hint = 'Chorakda faqat bitta ChSB bo''ladi';
    end if;
    if new.max_points <> r.chsb_total then
      raise exception 'CHSB_POINTS:%', r.chsb_total
        using hint = 'ChSB doim ' || r.chsb_total || ' ballik';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists assessments_limits on assessments;
create trigger assessments_limits
  before insert or update on assessments
  for each row execute function check_assessment_limits();

-- ──────────────────────────── RLS yoqish ─────────────────────────────
alter table grading_rules    enable row level security;
alter table subjects         enable row level security;
alter table profiles         enable row level security;
alter table academic_years   enable row level security;
alter table classes          enable row level security;
alter table students         enable row level security;
alter table groups           enable row level security;
alter table group_students   enable row level security;
alter table assignments      enable row level security;
alter table assessments      enable row level security;
alter table grades           enable row level security;
alter table quarter_extras   enable row level security;
alter table grade_log        enable row level security;
alter table blocked_attempts enable row level security;

-- Qoidalar: hamma o'qiydi, faqat admin o'zgartiradi
drop policy if exists rules_read on grading_rules;
create policy rules_read on grading_rules for select to authenticated using (true);
drop policy if exists rules_write on grading_rules;
create policy rules_write on grading_rules for update to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- Fanlar
-- Fanlar ro'yxati ro'yxatdan o'tish formasida ham kerak, shuning uchun
-- kirmagan foydalanuvchi ham o'qiy oladi (maxfiy ma'lumot emas)
drop policy if exists subjects_read on subjects;
create policy subjects_read on subjects for select to anon, authenticated using (true);
drop policy if exists subjects_write on subjects;
create policy subjects_write on subjects for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

-- Profillar: o'zini har kim ko'radi; tasdiqlanganlar bir-birini ko'radi
-- (ism-familiya statistikada kerak). Rol va statusni faqat admin o'zgartiradi.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated
  using (id = auth.uid() or app_approved());

drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles for update to authenticated
  using (app_is_admin()) with check (app_is_admin());

drop policy if exists profiles_admin_delete on profiles;
create policy profiles_admin_delete on profiles for delete to authenticated
  using (app_is_admin());

-- O'quv yili, sinflar, o'quvchilar: hamma ko'radi, menejer/admin boshqaradi
drop policy if exists years_read on academic_years;
create policy years_read on academic_years for select to authenticated using (app_approved());
drop policy if exists years_write on academic_years;
create policy years_write on academic_years for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

drop policy if exists classes_read on classes;
create policy classes_read on classes for select to authenticated using (app_approved());
drop policy if exists classes_write on classes;
create policy classes_write on classes for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

drop policy if exists students_read on students;
create policy students_read on students for select to authenticated using (app_approved());
drop policy if exists students_write on students;
create policy students_write on students for all to authenticated
  using (app_is_staff()) with check (app_is_staff());

-- Guruhlar: menejer ham, shu fanning o'qituvchisi ham bo'la oladi
drop policy if exists groups_read on groups;
create policy groups_read on groups for select to authenticated using (app_approved());
drop policy if exists groups_write on groups;
create policy groups_write on groups for all to authenticated
  using (
    app_is_staff()
    or (app_approved() and subject_id = (select subject_id from profiles where id = auth.uid()))
  )
  with check (
    app_is_staff()
    or (app_approved() and subject_id = (select subject_id from profiles where id = auth.uid()))
  );

drop policy if exists group_students_read on group_students;
create policy group_students_read on group_students for select to authenticated using (app_approved());
drop policy if exists group_students_write on group_students;
create policy group_students_write on group_students for all to authenticated
  using (
    app_is_staff() or exists (
      select 1 from groups g join profiles p on p.id = auth.uid()
       where g.id = group_id and g.subject_id = p.subject_id and p.status = 'approved'
    )
  )
  with check (
    app_is_staff() or exists (
      select 1 from groups g join profiles p on p.id = auth.uid()
       where g.id = group_id and g.subject_id = p.subject_id and p.status = 'approved'
    )
  );

-- Biriktirmalar: o'qituvchi o'z fanidan o'ziga biriktiradi
drop policy if exists assignments_read on assignments;
create policy assignments_read on assignments for select to authenticated using (app_approved());

drop policy if exists assignments_insert on assignments;
create policy assignments_insert on assignments for insert to authenticated
  with check (
    app_is_staff()
    or (
      app_approved()
      and teacher_id = auth.uid()
      and subject_id = (select subject_id from profiles where id = auth.uid())
    )
  );

drop policy if exists assignments_delete on assignments;
create policy assignments_delete on assignments for delete to authenticated
  using (app_is_staff() or teacher_id = auth.uid());

-- Baholash ishlari: faqat egasi yaratadi/o'chiradi, qolganlar ko'radi
drop policy if exists assessments_read on assessments;
create policy assessments_read on assessments for select to authenticated using (app_approved());
drop policy if exists assessments_write on assessments;
create policy assessments_write on assessments for all to authenticated
  using (app_owns(assignment_id) or app_is_staff())
  with check (app_owns(assignment_id) or app_is_staff());

-- Baholar: YOZISH faqat save_grade()/save_grades() funksiyalari orqali.
-- Shuning uchun insert/update siyosati berilmaydi — o'sish qoidasini
-- va 2 kunlik muddatni aylanib o'tish imkoni qolmaydi.
-- Baholarni o'z biriktirmasi bo'yicha o'qituvchi, qolgan hammasini
-- menejer va admin ko'radi (menejerga statistika kerak).
drop policy if exists grades_read on grades;
create policy grades_read on grades for select to authenticated
  using (app_is_staff() or app_owns_assessment(assessment_id));
drop policy if exists grades_delete on grades;
create policy grades_delete on grades for delete to authenticated
  using (app_is_staff());

drop policy if exists extras_read on quarter_extras;
create policy extras_read on quarter_extras for select to authenticated
  using (app_is_staff() or app_owns(assignment_id));
drop policy if exists extras_delete on quarter_extras;
create policy extras_delete on quarter_extras for delete to authenticated
  using (app_is_staff());

-- Tarix va to'xtatilgan urinishlar: faqat o'qish
drop policy if exists log_read on grade_log;
create policy log_read on grade_log for select to authenticated
  using (app_is_staff() or app_owns(assignment_id));

drop policy if exists blocked_read on blocked_attempts;
create policy blocked_read on blocked_attempts for select to authenticated
  using (app_is_staff() or app_owns(assignment_id));
