# Mahalliy sinov (faqat dasturchi uchun)

Bu papkadagi fayllar **Supabase'da ishlatilmaydi** — ular kodni o'zgartirgandan keyin
mantiq buzilmaganini mahalliy PostgreSQL'da tekshirish uchun.

- `00_supabase_stub.sql` — Supabase muhitini taqlid qiladi (`auth.users`, `auth.uid()`,
  `anon`/`authenticated` rollari)
- `plan-test.sql` — 13 ta tekshiruv: BSB rejasi, dars jadvali, eslatmalar (kimga
  borishi, o'qilgan deb belgilash, holat `none → partial → done`)
- `smoke-test.sql` — 28 ta tekshiruv: rollar va tasdiqlash, RLS, **sinf darajasidagi
  o'sish qoidasi** (alohida o'quvchi pasayishi mumkin, sinf — yo'q), ommaviy saqlashning
  butunlay bekor qilinishi, 2 kunlik qulf, BSB 50 / ChSB 40 cheklovi, 10 ballik baho,
  sinf → parallel → maktab o'sishi

## Ishga tushirish

PostgreSQL 15+ kerak (Supabase PG 15/17 da ishlaydi).

```bash
createdb baholash_test
psql -d baholash_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/00_supabase_stub.sql \
  -f supabase/01_schema.sql \
  -f supabase/02_security.sql \
  -f supabase/03_logic.sql \
  -f supabase/04_stats.sql \
  -f supabase/05_seed.sql \
  -f supabase/06_plan.sql \
  -f supabase/tests/smoke-test.sql \
  -f supabase/tests/plan-test.sql
```

Oxirida `BARCHA SINOVLAR O'TDI` chiqishi kerak. Har bir tekshiruv muvaffaqiyatsiz
bo'lsa `FAIL: ...` bilan to'xtaydi.

> **Diqqat:** `smoke-test.sql` va `plan-test.sql` ni haqiqiy (ishlab turgan) bazada ishga tushirmang —
> u sinov foydalanuvchilari, sinf va baholar yaratadi.
