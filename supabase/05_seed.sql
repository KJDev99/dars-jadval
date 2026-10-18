-- ════════════════════════════════════════════════════════════════════════
--  Boshlang'ich ma'lumotlar: fanlar va o'quv yili
--  Qayta ishga tushirish xavfsiz (on conflict do nothing).
-- ════════════════════════════════════════════════════════════════════════

insert into subjects (name, is_split) values
  ('Ona tili va adabiyot', false),
  ('Matematika',           false),
  ('Algebra',              false),
  ('Geometriya',           false),
  ('Fizika',               false),
  ('Kimyo',                false),
  ('Biologiya',            false),
  ('Geografiya',           false),
  ('Tarix',                false),
  ('Ingliz tili',          true),
  ('Rus tili',             true),
  ('Informatika',          false),
  ('Tasviriy san''at',     false),
  ('Musiqa',               false),
  ('Jismoniy tarbiya',     false),
  ('Texnologiya',          false),
  ('Tarbiya',              false)
on conflict (name) do nothing;

insert into academic_years (name, is_active) values ('2026-2027', true)
on conflict (name) do nothing;

-- Faol yil bittadan ko'p bo'lmasligi uchun
create unique index if not exists academic_years_one_active
  on academic_years (is_active) where is_active;
