# Baholash — maktab summativ baholash tizimi

O'quvchilarning BSB va ChSB natijalarini yuritish, baholarning **doimiy o'sishini**
kafolatlash va maktab bo'yicha statistika olish uchun veb-ilova.

**Chorak = 100 ball:** BSB jami **50** + ChSB **40** + o'qituvchi chorak oxirida qo'yadigan **10** ball.

Texnologiya: React + TypeScript + Vite + Tailwind, backend — **Supabase** (Postgres + Auth + RLS).

---

## Rollar

| Rol | Nima qiladi |
|---|---|
| **Administrator** | Faqat akkauntlarni tasdiqlaydi, rol beradi, parolni almashtiradi. Fanlar va o'quv yillarini sozlaydi. |
| **Menejer** | Sinflarni qo'shadi, o'quvchilarni Excel'dan import qiladi, maktab statistikasini ko'radi va Excel'ga yuklaydi. Baho qo'ymaydi. |
| **O'qituvchi** | O'z fanidan jurnal yuritadi: BSB/ChSB qo'shadi, baho qo'yadi (avtomatik yoki qo'lda), 10 ballik bahoni kiritadi. Sinflarni **faqat ko'radi**, qo'sha olmaydi. |

Birinchi ro'yxatdan o'tgan foydalanuvchi avtomatik **administrator** bo'ladi va darhol
tasdiqlanadi. Qolganlarning hammasi `pending` holatda turadi.

## O'sish qoidasi

Yangi ishning foizi ikkita qiymatdan kam bo'lmasligi kerak:

1. o'quvchining shu fandan **oldingi chorakdagi** umumiy foizi;
2. shu chorakda **hozirgacha yig'ilgan** umumiy foizi.

O'rtachaga o'zidan katta yoki teng son qo'shilsa o'rtacha pasaymaydi — demak umumiy o'sish
matematik kafolatlanadi, shuningdek `1+2`, `3+4`, `1+3`, `2+4` chorak o'rtachalari ham o'sadi.

Qoida **serverda** (`save_grade`, `save_extra` funksiyalarida) tekshiriladi, `grades` jadvaliga
to'g'ridan-to'g'ri yozish RLS bilan taqiqlangan — ya'ni qoidani aylanib o'tib bo'lmaydi.
Qo'lda past baho kiritilsa: baho **saqlanmaydi**, o'qituvchiga minimal ruxsat etilgan ball
ko'rsatilgan toast chiqadi, urinish esa `blocked_attempts` jadvalida qoladi (menejer ko'radi).

**Baho 2 kun ichida tahrirlanadi**, keyin qulflanadi (`grading_rules.edit_days`).

---

## O'rnatish

### 1. Supabase proyekt

1. [supabase.com](https://supabase.com) da yangi proyekt yarating (region: Frankfurt yoki
   Singapore — O'zbekistonga yaqinroq).
2. **SQL Editor** da `supabase/` papkasidagi fayllarni **shu tartibda** ishga tushiring:

   ```
   01_schema.sql     → jadvallar
   02_security.sql   → rollar, ro'yxatdan o'tish triggeri, RLS siyosatlari
   03_logic.sql      → baho qo'yish va o'sish qoidasi
   04_stats.sql      → statistika ko'rinishlari
   05_seed.sql       → fanlar va o'quv yili
   ```

   Hammasi qayta ishga tushirishga xavfsiz (idempotent).

3. **Authentication → Sign In / Providers → Email** bo'limida:
   - `Confirm email` — **o'chirilgan** bo'lishi kerak (o'qituvchilar login bilan kiradi, email yo'q);
   - `Minimum password length` — 6.

### 2. Ilova

```bash
npm install
cp .env.example .env     # ichiga Supabase URL va anon key ni yozing
npm run dev
```

Kalitlar: **Project Settings → API** (`Project URL` va `anon public`).

### 3. Parol almashtirish funksiyasi (ixtiyoriy, lekin kerak)

Admin boshqa foydalanuvchining parolini almashtirishi uchun Edge Function kerak
(brauzerdan service kaliti ishlatilmaydi):

```bash
npm i -g supabase
supabase login
supabase link --project-ref <proyekt-ref>
supabase functions deploy admin-users
```

Funksiya deploy qilinmasa, tizimning qolgan hammasi ishlaydi — faqat admin paneldagi
"parolni almashtirish" tugmasi ishlamaydi (har kim o'z parolini **Profil** sahifasida
o'zi almashtira oladi).

### 4. Birinchi ishga tushirish tartibi

1. Ilovaga kiring → **Ro'yxatdan o'tish** → o'zingizni kiritasiz → **administrator** bo'lasiz.
2. **Sozlamalar**da o'quv yili faol ekanini tekshiring (`2026-2027` tayyor turadi).
3. Menejer va o'qituvchilar ro'yxatdan o'tadi → siz **Foydalanuvchilar**da tasdiqlaysiz.
4. Menejer **Sinflar → Excel'dan import** bilan o'quvchilarni yuklaydi.
   Fayl ustunlari: `Sinf` (`8a`) va `F.I.Sh.` — namunani shu sahifadan yuklab olish mumkin.
5. O'qituvchi **Jurnal**da sinfni tanlab "Jurnalni ochish" bosadi va baholashni boshlaydi.

---

## Ishlab chiqarishga joylash

```bash
npm run build      # natija: dist/
```

`dist/` — oddiy statik fayllar, har qanday hostingda ishlaydi (Vercel, Netlify, Cloudflare
Pages, GitHub Pages). Ichki papkaga joylasangiz: `BASE_PATH=/baholash/ npm run build`.

Marshrutlar `HashRouter` da — server sozlamasi (rewrite) shart emas.

---

## Supabase bepul tarif bir maktabga yetadimi?

Ha. 1000 o'quvchi, 60 o'qituvchi, 15 fan uchun **yiliga ≈100 MB** (baholar, 10 ballik baholar,
o'zgarish tarixi bilan). Bepul tarifda 500 MB baza beriladi — tizim schemalari ~50 MB olgandan
keyin ham **3–4 o'quv yili** sig'adi. Rasm va fayl saqlanmaydi, egress (5 GB/oy) ham muammo emas.

Bepul tarifda e'tibor berish kerak bo'lgan uchta narsa:

1. **1 hafta harakatsiz qolsa proyekt pauza qiladi.** Yozgi ta'til xavfli —
   `.github/workflows/keepalive.yml` haftada bir marta bazaga so'rov yuborib turadi
   (GitHub repo → Settings → Secrets → `SUPABASE_URL` va `SUPABASE_ANON_KEY` qo'shilsa ishlaydi).
2. **Avtomatik zaxira (backup) yo'q.** Maktab baholari — yo'qotib bo'lmaydigan ma'lumot.
   Har chorak oxirida qo'lda zaxira oling:
   ```bash
   supabase db dump --db-url "postgresql://postgres:<parol>@db.<ref>.supabase.co:5432/postgres" -f zaxira.sql
   ```
   Yoki Pro tarifga ($25/oy) o'tilsa: kunlik backup, 8 GB baza, pauza yo'q.
3. **2 ta proyekt** — dev va prod uchun yetadi.

Har yili yangi o'quv yili qo'shilganda statistika noldan yig'iladi, eski yil saqlanib qoladi.
Baza to'lib qolsa, eski yilni Excel'ga eksport qilib bazadan o'chirish kifoya.

---

## Loyiha tuzilishi

```
supabase/
  01_schema.sql … 05_seed.sql   baza: jadvallar, RLS, mantiq, ko'rinishlar
  functions/admin-users/        parol almashtirish (Edge Function)
src/
  lib/        supabase klienti, tiplar, baholash hisoblari, Excel
  store/      auth (zustand)
  ui/         Layout, Toast, mavzu, umumiy komponentlar, ikonkalar
  pages/
    LoginPage, PendingPage, ProfilePage
    admin/    foydalanuvchilar, sozlamalar
    manager/  statistika, sinflar, sinf kartasi, o'zgarishlar tarixi
    teacher/  jurnal, baho jadvali, 10 ballik, guruhlar, natijalarim
```

## Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | ishlab chiqish serveri (localhost:5180) |
| `npm run build` | `dist/` ga yig'ish |
| `npm run preview` | yig'ilgan versiyani ko'rish |
| `npm run typecheck` | TypeScript tekshiruvi |
