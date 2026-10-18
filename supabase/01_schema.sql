-- ════════════════════════════════════════════════════════════════════════
--  BAHOLASH TIZIMI — jadvallar
--  Chorak = 100 ball:  BSB jami 50  +  ChSB 40  +  o'qituvchi bahosi 10
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────── Turlar ─────────────────────────────
do $$ begin
  create type user_role as enum ('admin', 'manager', 'teacher');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('pending', 'approved', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assess_kind as enum ('bsb', 'chsb');
exception when duplicate_object then null; end $$;

-- Chorak natijasining tarkibi — nizom o'zgarsa faqat shu satr o'zgaradi
create table if not exists grading_rules (
  id          int primary key default 1 check (id = 1),
  bsb_total   int not null default 50,   -- chorakdagi barcha BSB lar jami
  chsb_total  int not null default 40,   -- bitta ChSB
  extra_total int not null default 10,   -- o'qituvchi chorak oxirida qo'yadi
  edit_days   int not null default 2,    -- baho necha kun tahrirlanadi
  mark5       numeric not null default 86,
  mark4       numeric not null default 71,
  mark3       numeric not null default 56
);
insert into grading_rules (id) values (1) on conflict do nothing;

-- ───────────────────────── Foydalanuvchilar ─────────────────────────
create table if not exists subjects (
  id       serial primary key,
  name     text not null unique,
  is_split boolean not null default false  -- guruhga bo'linadigan fan (ingliz, rus tili)
);

create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  login      text not null unique,
  last_name  text not null,
  first_name text not null,
  role       user_role not null default 'teacher',
  subject_id int references subjects (id) on delete set null,
  status     user_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles (role, status);

-- ───────────────────────── Sinflar va o'quvchilar ─────────────────────
create table if not exists academic_years (
  id        serial primary key,
  name      text not null unique,          -- «2026-2027»
  is_active boolean not null default false
);

create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  year_id    int not null references academic_years (id) on delete cascade,
  grade      int not null check (grade between 1 and 11),
  letter     text not null check (char_length(letter) between 1 and 2),
  created_at timestamptz not null default now(),
  unique (year_id, grade, letter)
);

create table if not exists students (
  id        uuid primary key default gen_random_uuid(),
  class_id  uuid not null references classes (id) on delete cascade,
  full_name text not null,
  order_no  int not null default 0,
  is_active boolean not null default true
);

create index if not exists students_class_idx on students (class_id);

-- Bo'linadigan fanlar uchun guruhlar
create table if not exists groups (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes (id) on delete cascade,
  subject_id int not null references subjects (id) on delete cascade,
  name       text not null,                 -- «1-guruh», «2-guruh»
  unique (class_id, subject_id, name)
);

create table if not exists group_students (
  group_id   uuid not null references groups (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  primary key (group_id, student_id)
);

-- ───────────────────── O'qituvchi–sinf–fan biriktirmasi ───────────────
create table if not exists assignments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes (id) on delete cascade,
  subject_id int not null references subjects (id) on delete cascade,
  teacher_id uuid not null references profiles (id) on delete cascade,
  group_id   uuid references groups (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Bir sinf-fan (yoki sinf-fan-guruh) bitta o'qituvchiga tegishli
create unique index if not exists assignments_uniq_group
  on assignments (class_id, subject_id, group_id) where group_id is not null;
create unique index if not exists assignments_uniq_whole
  on assignments (class_id, subject_id) where group_id is null;
create index if not exists assignments_teacher_idx on assignments (teacher_id);

-- ──────────────────────────── Baholash ishlari ────────────────────────
create table if not exists assessments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  quarter       int not null check (quarter between 1 and 4),
  kind          assess_kind not null,
  idx           int not null default 1,        -- 1-BSB, 2-BSB ...
  title         text,
  max_points    numeric(5, 2) not null check (max_points > 0),
  held_on       date not null default current_date,
  created_at    timestamptz not null default now()
);

create unique index if not exists assessments_uniq
  on assessments (assignment_id, quarter, kind, idx);
create index if not exists assessments_scope_idx on assessments (assignment_id, quarter);

create table if not exists grades (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments (id) on delete cascade,
  student_id    uuid not null references students (id) on delete cascade,
  points        numeric(5, 2) not null check (points >= 0),
  is_auto       boolean not null default false,
  created_at    timestamptz not null default now(),  -- 2 kunlik tahrir muddati shundan
  updated_at    timestamptz not null default now(),
  author_id     uuid references profiles (id) on delete set null,
  unique (assessment_id, student_id)
);

create index if not exists grades_student_idx on grades (student_id);

-- Chorak oxiridagi 10 ballik baho
create table if not exists quarter_extras (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  quarter       int not null check (quarter between 1 and 4),
  student_id    uuid not null references students (id) on delete cascade,
  points        numeric(5, 2) not null check (points >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  author_id     uuid references profiles (id) on delete set null,
  unique (assignment_id, quarter, student_id)
);

-- Baholarning o'zgarish tarixi — menejer doimiy ko'rib turadi
create table if not exists grade_log (
  id            bigserial primary key,
  assignment_id uuid references assignments (id) on delete cascade,
  student_id    uuid references students (id) on delete cascade,
  target        text not null,                  -- 'grade' | 'extra'
  quarter       int,
  old_points    numeric(5, 2),
  new_points    numeric(5, 2),
  is_auto       boolean not null default false,
  actor_id      uuid references profiles (id) on delete set null,
  at            timestamptz not null default now()
);

create index if not exists grade_log_at_idx on grade_log (at desc);
create index if not exists grade_log_assignment_idx on grade_log (assignment_id, quarter);

-- O'sish qoidasi to'xtatgan urinishlar — menejer ko'radi
create table if not exists blocked_attempts (
  id            bigserial primary key,
  assignment_id uuid references assignments (id) on delete cascade,
  student_id    uuid references students (id) on delete cascade,
  quarter       int,
  tried_points  numeric(5, 2),
  min_points    numeric(5, 2),
  actor_id      uuid references profiles (id) on delete set null,
  at            timestamptz not null default now()
);

create index if not exists blocked_at_idx on blocked_attempts (at desc);
