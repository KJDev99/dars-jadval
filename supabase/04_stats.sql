-- ════════════════════════════════════════════════════════════════════════
--  Statistika ko'rinishlari (menejer paneli va Excel eksport uchun)
--  Barchasi security_invoker — ya'ni RLS har bir foydalanuvchiga
--  o'z huquqi bo'yicha qo'llanadi.
-- ════════════════════════════════════════════════════════════════════════

-- Bitta o'quvchining bitta fandan bitta chorakdagi yakuni
create or replace view v_student_quarter with (security_invoker = true) as
with parts as (
  select asg.id as assignment_id, asg.class_id, asg.subject_id, asg.teacher_id,
         ass.quarter, g.student_id,
         g.points as pts, ass.max_points as mx,
         ass.kind = 'bsb'  as is_bsb,
         ass.kind = 'chsb' as is_chsb,
         false as is_extra
    from grades g
    join assessments ass on ass.id = g.assessment_id
    join assignments asg on asg.id = ass.assignment_id
  union all
  select asg.id, asg.class_id, asg.subject_id, asg.teacher_id,
         e.quarter, e.student_id,
         e.points, r.extra_total::numeric,
         false, false, true
    from quarter_extras e
    join assignments asg on asg.id = e.assignment_id
    cross join grading_rules r
   where r.id = 1
)
select p.assignment_id,
       p.class_id,
       c.grade,
       c.letter,
       c.grade || c.letter            as class_name,
       c.year_id,
       p.subject_id,
       sub.name                       as subject_name,
       p.teacher_id,
       p.quarter,
       p.student_id,
       st.full_name                   as student_name,
       sum(p.pts)                     as points,
       sum(p.mx)                      as max_points,
       round(100.0 * sum(p.pts) / nullif(sum(p.mx), 0), 2) as pct,
       app_mark(round(100.0 * sum(p.pts) / nullif(sum(p.mx), 0), 2)) as mark,
       sum(case when p.is_bsb then p.pts else 0 end)   as bsb_points,
       sum(case when p.is_chsb then p.pts else 0 end)  as chsb_points,
       sum(case when p.is_extra then p.pts else 0 end) as extra_points,
       count(*) filter (where p.is_bsb)                as bsb_count
  from parts p
  join classes c  on c.id = p.class_id
  join students st on st.id = p.student_id
  join subjects sub on sub.id = p.subject_id
 group by p.assignment_id, p.class_id, c.grade, c.letter, c.year_id,
          p.subject_id, sub.name, p.teacher_id, p.quarter, p.student_id, st.full_name;

-- O'qituvchi kesimida
create or replace view v_teacher_quarter with (security_invoker = true) as
select teacher_id,
       year_id,
       quarter,
       count(*)                                   as rows_cnt,
       count(distinct student_id)                 as students,
       count(distinct class_id)                   as classes,
       round(avg(pct), 2)                         as avg_pct,
       round(avg(mark), 2)                        as avg_mark,
       round(100.0 * count(*) filter (where mark >= 4) / count(*), 1) as quality,
       round(100.0 * count(*) filter (where mark >= 3) / count(*), 1) as progress
  from v_student_quarter
 group by teacher_id, year_id, quarter;

-- Sinf kesimida
create or replace view v_class_quarter with (security_invoker = true) as
select class_id,
       class_name,
       grade,
       year_id,
       quarter,
       count(distinct student_id)                 as students,
       count(distinct subject_id)                 as subjects,
       round(avg(pct), 2)                         as avg_pct,
       round(avg(mark), 2)                        as avg_mark,
       round(100.0 * count(*) filter (where mark >= 4) / count(*), 1) as quality,
       round(100.0 * count(*) filter (where mark >= 3) / count(*), 1) as progress
  from v_student_quarter
 group by class_id, class_name, grade, year_id, quarter;

-- Fan kesimida
create or replace view v_subject_quarter with (security_invoker = true) as
select subject_id,
       subject_name,
       year_id,
       quarter,
       count(distinct student_id)                 as students,
       count(distinct teacher_id)                 as teachers,
       round(avg(pct), 2)                         as avg_pct,
       round(avg(mark), 2)                        as avg_mark,
       round(100.0 * count(*) filter (where mark >= 4) / count(*), 1) as quality,
       round(100.0 * count(*) filter (where mark >= 3) / count(*), 1) as progress
  from v_student_quarter
 group by subject_id, subject_name, year_id, quarter;

-- Maktab bo'yicha umumiy
create or replace view v_school_quarter with (security_invoker = true) as
select year_id,
       quarter,
       count(distinct student_id)                 as students,
       count(distinct teacher_id)                 as teachers,
       count(distinct class_id)                   as classes,
       round(avg(pct), 2)                         as avg_pct,
       round(avg(mark), 2)                        as avg_mark,
       round(100.0 * count(*) filter (where mark >= 4) / count(*), 1) as quality,
       round(100.0 * count(*) filter (where mark >= 3) / count(*), 1) as progress
  from v_student_quarter
 group by year_id, quarter;

-- O'quvchi bo'yicha barcha fanlardan chorak o'rtachasi
-- (choraklarni qo'shib o'rtachasini topish uchun: 1+2, 1+3, 2+4 ...)
create or replace view v_student_quarter_avg with (security_invoker = true) as
select student_id,
       student_name,
       class_id,
       class_name,
       year_id,
       quarter,
       count(*)           as subjects,
       round(avg(pct), 2) as avg_pct,
       round(avg(mark), 2) as avg_mark
  from v_student_quarter
 group by student_id, student_name, class_id, class_name, year_id, quarter;

-- Baholarning o'zgarish faolligi: o'qituvchi qanday baho qo'ygan,
-- nechtasini qo'lda tahrirlagan, nechtasi o'sish qoidasida to'xtatilgan
create or replace view v_teacher_activity with (security_invoker = true) as
select a.teacher_id,
       l.quarter,
       count(*)                                        as changes,
       count(*) filter (where l.is_auto)               as auto_changes,
       count(*) filter (where not l.is_auto)           as manual_changes,
       count(*) filter (where l.old_points is not null) as edits,
       count(*) filter (where l.target = 'extra')      as extra_changes,
       min(l.at)                                       as first_at,
       max(l.at)                                       as last_at
  from grade_log l
  join assignments a on a.id = l.assignment_id
 group by a.teacher_id, l.quarter;

create or replace view v_teacher_blocked with (security_invoker = true) as
select a.teacher_id,
       b.quarter,
       count(*)      as blocked,
       max(b.at)     as last_at
  from blocked_attempts b
  join assignments a on a.id = b.assignment_id
 group by a.teacher_id, b.quarter;
