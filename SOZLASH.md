# Supabase'ni sozlash — boshidan oxirigacha

Bu fayl bo'yicha ketma-ket yursangiz, tizim to'liq ishlaydi. Har bir qadamda
**nima bosilishi** va **nima ko'rinishi kerakligi** yozilgan. Taxminiy vaqt: 25–40 daqiqa.

> Tartibni buzmang. Ayniqsa 3-qadam (SQL) va 4-qadam (Auth sozlamasi) — ularsiz
> ro'yxatdan o'tish ishlamaydi.

---

## Boshlashdan oldin kerak bo'ladi

| Nima | Qayerdan | Tekshirish |
|---|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) (LTS) | `node -v` → `v18...` yoki undan yuqori |
| Supabase hisobi | [supabase.com](https://supabase.com) | GitHub yoki email bilan |
| Loyiha kodi | shu papka | `package.json` bor |

Terminalni loyiha papkasida oching:

```bash
cd C:\Users\jamsh\Desktop\dars-jadval
npm install
```

---

## 1-qadam. Supabase proyekt yaratish

1. [supabase.com](https://supabase.com) → **Start your project** → hisobga kiring.
2. **New project** tugmasi.
3. Maydonlarni to'ldiring:

   | Maydon | Nima yozish |
   |---|---|
   | **Name** | `baholash` |
   | **Database Password** | Kuchli parol yarating va **alohida joyga saqlang** — keyin zaxira olishda kerak bo'ladi, qayta ko'rsatilmaydi |
   | **Region** | `Central EU (Frankfurt)` — O'zbekistondan eng tez ishlaydiganlaridan |
   | **Plan** | `Free` |

4. **Create new project** → 1–2 daqiqa kutasiz (proyekt tayyorlanadi).

> **Eslatma:** bepul tarifda 2 tagacha proyekt bo'ladi. Shu bitta proyekt maktab uchun yetarli.

---

## 2-qadam. API kalitlarini olish

1. Chap menyuda pastda **Project Settings** (⚙️ tishli g'ildirak).
2. **API** bo'limi (yoki **API Keys**).
3. Ikkita qiymatni ko'chirib oling:

   - **Project URL** — `https://abcdefghijklm.supabase.co` ko'rinishida
   - **anon public** kaliti — `eyJhbGciOi...` deb boshlanadigan uzun matn

> **`service_role` kalitini hech qachon ilovaga yozmang va hech kimga bermang** —
> u barcha himoyani chetlab o'tadi. Faqat `anon public` kerak.

4. Loyiha papkasida `.env` fayl yarating (`.env.example` dan nusxa olib):

```bash
copy .env.example .env
```

5. `.env` ni ochib to'ldiring:

```ini
VITE_SUPABASE_URL=https://abcdefghijklm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_LOGIN_DOMAIN=maktab.local
```

> `.env` fayl git'ga tushmaydi (`.gitignore` da) — kalitlar sizda qoladi.

---

## 3-qadam. Bazani yaratish (SQL)

Chap menyuda **SQL Editor** → **New query**.

Quyidagi **5 ta faylni shu tartibda** ishga tushiring. Har safar: faylni matn
muharririda oching → hammasini nusxa oling (Ctrl+A, Ctrl+C) → SQL Editorga qo'ying →
**Run** (yoki Ctrl+Enter) → `Success. No rows returned` chiqishini kuting → keyingisiga o'ting.

| № | Fayl | Nima qiladi |
|---|---|---|
| 1 | `supabase/01_schema.sql` | jadvallar |
| 2 | `supabase/02_security.sql` | rollar, ro'yxatdan o'tish triggeri, himoya (RLS) |
| 3 | `supabase/03_logic.sql` | baho qo'yish va o'sish qoidasi |
| 4 | `supabase/04_stats.sql` | statistika ko'rinishlari |
| 5 | `supabase/05_seed.sql` | fanlar va 2026-2027 o'quv yili |

**Tekshirish.** SQL Editorda yangi so'rov ochib ishga tushiring:

```sql
select count(*) as fanlar from subjects;
select name, is_active from academic_years;
```

Natija: `fanlar = 17`, `2026-2027 | true`. Shunday bo'lsa — baza tayyor.

> Agar qizil xato chiqsa: xato matnini to'liq nusxa olib menga yuboring.
> Fayllarni qayta ishga tushirish xavfsiz — ular `create ... if not exists` bilan yozilgan.

---

## 4-qadam. Kirish sozlamalari (eng muhim qadam)

O'qituvchilarda email yo'q — ular **login va parol** bilan kiradi. Buning uchun
ilova ichkarida `login@maktab.local` ko'rinishidagi soxta email yasaydi, demak
**email tasdiqlashni o'chirish shart**.

1. Chap menyu → **Authentication** → **Sign In / Providers** (yoki **Providers**).
2. **Email** qatorini oching.
3. Shunday qiling:

   | Sozlama | Qiymat |
   |---|---|
   | **Enable email provider** | **yoqilgan** |
   | **Confirm email** | **o'chirilgan** ⬅️ eng muhimi |
   | **Secure email change** | farqi yo'q |
   | **Minimum password length** | `6` |

4. **Save** bosing.

5. **Authentication → URL Configuration** → **Site URL** ga `http://localhost:5180`
   yozing (keyin saytni hostingga joylasangiz, o'sha manzilga almashtirasiz).

> **Agar ro'yxatdan o'tishda "Email address is invalid" xatosi chiqsa:**
> `.env` dagi `VITE_LOGIN_DOMAIN` ni `maktab.local` dan `maktab.uz` ga almashtiring
> va `npm run dev` ni qayta ishga tushiring. Email baribir yuborilmaydi.

---

## 5-qadam. Ilovani ishga tushirish

```bash
npm run dev
```

Brauzerda `http://localhost:5180` ochiladi.

- Agar **«Supabase sozlanmagan»** yozuvi chiqsa → `.env` to'ldirilmagan yoki
  `npm run dev` qayta ishga tushirilmagan (`.env` o'zgarsa qayta ishga tushirish shart).
- Kirish oynasi chiqsa — hammasi joyida.

---

## 6-qadam. Birinchi administrator

**Birinchi ro'yxatdan o'tgan odam avtomatik administrator bo'ladi va darhol tasdiqlanadi.**
Shuning uchun birinchi bo'lib **o'zingiz** ro'yxatdan o'ting.

1. **Ro'yxatdan o'tish** yorlig'i.
2. Rol: **Menejer** yoki **O'qituvchi** — farqi yo'q, baribir admin bo'lasiz.
3. Familiya, ism, login (masalan `admin`), parol (kamida 6 belgi) → **Ro'yxatdan o'tish**.
4. Ichkariga kirasiz va yuqorida **Foydalanuvchilar**, **Sozlamalar** menyusi ko'rinadi.

**Tekshirish** (SQL Editorda):

```sql
select login, role, status from profiles;
```

Natija: `admin | admin | approved`.

> Agar adashib birinchi bo'lib boshqa odam ro'yxatdan o'tgan bo'lsa, o'zingizni
> qo'lda admin qilish mumkin:
> ```sql
> update profiles set role = 'admin', status = 'approved' where login = 'sizning_loginingiz';
> ```

---

## 7-qadam. Parol almashtirish funksiyasi (Edge Function)

Admin boshqa odamning parolini almashtirishi uchun kerak. **Bu qadamsiz ham tizim
to'liq ishlaydi** — faqat admin paneldagi 🔑 tugmasi ishlamaydi (har kim o'z parolini
Profil sahifasida o'zi almashtira oladi).

```bash
npm install -g supabase
supabase login
```

Brauzer ochiladi → ruxsat berasiz → terminalga qaytasiz.

Proyekt ref'ini **Project Settings → General → Reference ID** dan oling (`abcdefghijklm`):

```bash
supabase link --project-ref abcdefghijklm
supabase functions deploy admin-users
```

Oxirida `Deployed Function admin-users` chiqadi. Kalitlarni qo'shish shart emas —
Supabase o'zi beradi.

**Tekshirish:** admin panelida biror foydalanuvchi qatoridagi 🔑 tugmasini bosing,
yangi parol kiriting → «yangi parol o'rnatildi» chiqishi kerak.

---

## 8-qadam. Haqiqiy ma'lumot bilan to'liq sinov

Shu ketma-ketlikni bir marta bajarib chiqing — hamma narsa ishlayotganiga ishonch hosil qilasiz.

### 8.1. Fanlar va o'quv yilini tekshirish
**Sozlamalar** sahifasi: 17 ta fan va faol `2026-2027` turibdi. Kerak bo'lsa fan qo'shing;
«guruhga bo'linadi» belgisi ingliz va rus tilida yoqilgan bo'lishi kerak.

### 8.2. Menejer va o'qituvchi qo'shish
1. Brauzerda **boshqa oyna** (Chrome: yangi profil yoki yashirin rejim) oching.
2. `http://localhost:5180` → **Ro'yxatdan o'tish** → rol **Menejer** → login `menejer`.
3. «Tasdiqlash kutilmoqda» ekrani chiqadi — to'g'ri.
4. Yana bir yashirin oyna: rol **O'qituvchi**, fan **Matematika**, login `matem`.
5. Admin oynasida **Foydalanuvchilar** → ikkalasiga **Tasdiqlash** → ular «Tekshirish»
   tugmasini bossa, ichkariga kiradi.

### 8.3. Sinf va o'quvchilar (menejer oynasida)
1. **Sinflar** → **Namuna** tugmasi — `oquvchilar-namuna.xlsx` yuklab olinadi.
2. Uni ochib, o'z maktabingiz ro'yxatini yozing: `Sinf` ustuni (`8a`) va `F.I.Sh.`.
3. **Excel'dan import** → faylni tanlang → ko'rinadigan ro'yxatni tekshiring →
   **… o'quvchini yuklash**.
4. Sinflar ro'yxatida sinf va o'quvchilar soni chiqadi.

> Bir faylni ikki marta yuklamang — o'quvchilar ikkilanib ketadi. Ikkilangan bo'lsa,
> sinfni ochib ortiqchasini 🗑 bilan o'chiring.

### 8.4. Baholash (o'qituvchi oynasida)
1. **Jurnal** → sinfni tanlang → **Jurnalni ochish**.
2. **BSB qo'shish** → maksimal ball `10` → **Qo'shish**.
3. **Avtomatik baholash** → hamma o'quvchiga ball qo'yiladi.
4. Endi qo'lda sinab ko'ring: biror o'quvchining balini **kamaytiring** (masalan 9 → 4)
   va maydondan chiqing (Tab yoki Enter).
   **Kutilgan natija:** qizil toast — «baho saqlanmadi — umumiy foiz tushib ketadi.
   Kamida N ball qo'ying», maydon esa eski qiymatiga qaytadi. ✅ O'sish qoidasi ishlayapti.
5. Balni **oshiring** (9 → 10) — saqlanadi, yashil ✓ chiqadi.
6. Yana BSB lar qo'shing (jami 50 ballgacha), keyin **ChSB (40)**, oxirida **10 ballik** →
   **Avtomatik**.
7. **Chorak yakuni** yorlig'i: har bir o'quvchida jami ball, foiz va baho (2–5) ko'rinadi.
8. 2-chorakka o'ting va yana baholang — endi minimal ballar 1-chorak darajasidan past
   bo'lmaydi.

### 8.5. Statistika (menejer oynasida)
**Statistika** → choraklar bo'yicha o'sish, o'qituvchilar/sinflar/fanlar kesimi,
«to'xtatilgan urinishlar» ustuni (4-bandda qilgan urinishingiz shu yerda ko'rinadi).
**Excel'ga yuklash** → 5 varaqli fayl tushadi.

**O'zgarishlar** sahifasi: kim, qachon, qaysi bahoni qo'ygani va tahrirlagani.

### 8.6. 2 kunlik qulfni sinash
Haqiqatda 2 kun kutish shart emas — SQL Editorda bitta bahoni «eskirtirib» ko'ring:

```sql
-- eng oxirgi bahoni 3 kun oldin qo'yilgan qilib belgilaymiz
update grades set created_at = now() - interval '3 days'
 where id = (select id from grades order by created_at desc limit 1);
```

Jurnalni yangilang: o'sha o'quvchining maydoni kulrang va 🔒 belgisi bilan bo'ladi,
o'zgartirib bo'lmaydi. Orqaga qaytarish:

```sql
update grades set created_at = now()
 where id = (select id from grades order by created_at desc limit 1);
```

---

## 9-qadam. Saytni internetga joylash

Eng oson yo'l — **Vercel** (bepul):

1. Loyihani GitHub'ga yuklang.
2. [vercel.com](https://vercel.com) → **Add New → Project** → repo'ni tanlang.
3. **Environment Variables** bo'limiga qo'shing:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public kalit
   - `VITE_LOGIN_DOMAIN` = `maktab.local`
4. **Deploy**.
5. Chiqqan manzilni (`https://baholash.vercel.app`) Supabase'ning
   **Authentication → URL Configuration → Site URL** iga yozing.

Netlify yoki Cloudflare Pages ham xuddi shunday: build buyrug'i `npm run build`,
chiqish papkasi `dist`.

---

## 10-qadam. Xavfsizlik: zaxira va «uxlab qolmaslik»

### Zaxira (backup)
Bepul tarifda avtomatik zaxira yo'q. **Har chorak oxirida** qo'lda oling:

```bash
supabase db dump --db-url "postgresql://postgres:<PAROL>@db.<REF>.supabase.co:5432/postgres" -f zaxira-2026-11.sql
```

`<PAROL>` — 1-qadamda saqlagan Database Password, `<REF>` — proyekt ref'i.
Faylni kompyuterда va bulutda (Google Drive) saqlang.

Qo'shimcha: menejer **Statistika → Excel'ga yuklash** bilan har chorak oxirida
hisobotni ham saqlab qo'ysin.

### Proyekt pauza qilmasligi uchun
Bepul tarifda **1 hafta** hech kim ishlatmasa proyekt to'xtab qoladi (ma'lumot
yo'qolmaydi, lekin qo'lda qayta yoqish kerak). Yozgi ta'til uchun repo'da tayyor
avtomatlashtirish bor — `.github/workflows/keepalive.yml`:

1. GitHub'da repo → **Settings → Secrets and variables → Actions → New repository secret**
2. `SUPABASE_URL` va `SUPABASE_ANON_KEY` qo'shing.
3. Har dushanba avtomatik so'rov yuboriladi.

Agar proyekt baribir pauza qilsa: Supabase panelida **Restore project** tugmasi chiqadi,
bir bosishda qaytadi.

---

## 11-qadam. Yangi o'quv yili (kelasi yilda)

1. Admin → **Sozlamalar** → **O'quv yillari** → `2027-2028` qo'shing → **Faol qilish**.
2. Menejer yangi sinflarni qo'shadi va o'quvchilarni Excel'dan yuklaydi.
3. Eski yil ma'lumotlari bazada qoladi, statistika esa yangi yildan noldan yig'iladi.
4. Baza to'lib qolsa (3–4 yildan keyin), eski yilni Excel'ga saqlab, bazadan o'chirasiz:
   ```sql
   delete from academic_years where name = '2026-2027';  -- sinflar va baholar ham ketadi
   ```
   Buni faqat zaxira olgandan keyin qiling.

---

## Muammolar va yechimlari

| Xato / holat | Sabab | Yechim |
|---|---|---|
| «Supabase sozlanmagan» | `.env` yo'q yoki to'ldirilmagan | `.env` ni to'ldiring, `npm run dev` ni qayta ishga tushiring |
| «Login yoki parol xato» | parol noto'g'ri yoki login boshqa | Admin 🔑 orqali yangi parol beradi |
| Ro'yxatdan o'tishda «Email address is invalid» | Supabase `.local` domenini qabul qilmayapti | `.env` da `VITE_LOGIN_DOMAIN=maktab.uz` qiling, qayta ishga tushiring |
| «Email signups are disabled» | Email provider o'chiq | 4-qadam: Authentication → Email → yoqing |
| Ro'yxatdan o'tgach hech narsa bo'lmayapti | «Confirm email» yoqiq qolgan | 4-qadam: o'chiring; eski foydalanuvchini Authentication → Users dan o'chirib, qayta ro'yxatdan o'ting |
| `function journal_rows does not exist` | `03_logic.sql` ishga tushirilmagan | 3-qadamni tartib bilan takrorlang |
| `new row violates row-level security policy` | foydalanuvchi tasdiqlanmagan yoki roli mos emas | Admin → Foydalanuvchilar → Tasdiqlash; sinf qo'shishni menejer qiladi |
| Sinflar ro'yxati bo'sh (o'qituvchida) | faol o'quv yili yo'q yoki sinf kiritilmagan | Sozlamalar → o'quv yilini faol qiling; menejer sinf qo'shsin |
| «admin-users funksiyasi deploy qilinmagan» | 7-qadam bajarilmagan | 7-qadamni bajaring yoki parolni foydalanuvchining o'zi almashtirsin |
| Baho saqlanmayapti, qizil toast chiqyapti | o'sish qoidasi — ball juda past | Toastda ko'rsatilgan minimal balldan kam bo'lmasin |
| Baho maydoni kulrang, 🔒 | 2 kun o'tgan | Qoida shunday. Muddatni admin **Sozlamalar → Tahrir muddati** dan o'zgartirishi mumkin |
| Proyekt «paused» | 1 hafta ishlatilmagan | Supabase panelida **Restore project** |

---

## Qisqacha eslatma (keyin kerak bo'ladi)

```bash
npm run dev        # ishlab chiqish serveri
npm run build      # dist/ ga yig'ish
npm run typecheck  # kod tekshiruvi

# Supabase SQL Editorda foydali so'rovlar:
select login, role, status from profiles order by created_at;     # foydalanuvchilar
select count(*) from students;                                    # o'quvchilar soni
select * from v_school_quarter;                                   # maktab statistikasi
select pg_size_pretty(pg_database_size(current_database()));       # baza hajmi
```
