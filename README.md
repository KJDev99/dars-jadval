# Dars Jadval — maktab dars jadvalini avtomatlashtirish

Umumiy o'rta ta'lim maktablari uchun dars jadvalini avtomatik tuzuvchi tizim.
O'zbekiston Respublikasi **tayanch o'quv rejasi** asosida ishlaydi.

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # ishlab chiqarish uchun yig'ish
npm run bench      # generatorni brauzersiz sinash (konsolda hisobot)
npm run bench:inc  # "minimal o'zgarish" rejimini sinash
```

Ma'lumotlar brauzerning `localStorage` xotirasida saqlanadi — server yoki baza talab qilinmaydi.

## Ma'lumot manbasi

O'quv reja O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirining
**2026-yil 10-apreldagi 133-son buyrug'i**, 1-ilova — "Ta'lim o'zbek tilida olib boriladigan
umumiy o'rta ta'lim muassasalari uchun 2026-2027-o'quv yiliga mo'ljallangan tayanch o'quv reja"
hujjatidan olingan.

Haftalik jami soatlar: 1-sinf 21, 2–4 24, 5 29, 6 30, 7 35, 8 33, 9 34, 10 31, 11 31 — jami **316 soat**.
Barcha qator va ustun yig'indilari rasmiy hujjat bilan solishtirib tekshirilgan
(`npm run bench` buni har safar qayta tekshiradi).

## Bo'limlar

| Bo'lim | Vazifasi |
|---|---|
| Boshqaruv paneli | Umumiy ko'rsatkichlar, o'quv reja bilan solishtirish |
| Sinflar | Sinf qo'shish/o'chirish, har bir sinf uchun alohida soat sozlash |
| O'qituvchilar | Mutaxassislik, o'qita oladigan fanlar, yuklama chegarasi, band kunlar |
| O'quv reja | Fan × sinf matritsasi — istalgan soatni tahrirlash |
| Tarifikatsiya | Har bir (sinf, fan) uchun o'qituvchi biriktirish + darslarni boshqa o'qituvchiga o'tkazish |
| Shartlar va izohlar | Bo'sh kun, bo'sh soat, aniq soat, kunlik chegara, erkin izoh |
| Jadval yaratish | Cheklovlarni sozlash, yangidan yaratish yoki minimal o'zgarish bilan qayta hisoblash |
| Dars jadvali | Sinf / o'qituvchi / umumiy ko'rinish, qo'lda tahrirlash, qulflash, chop etish, CSV |
| Tekshiruv | Tuzilgan jadvalning barcha qoidalarga mosligini mustaqil tekshirish |

## Jadvalga o'zgartirish kiritish

Jadval tuzilgandan keyin uni **qaytadan tuzmasdan** o'zgartirish mumkin. Tizim mavjud jadvalni
asos qilib oladi va faqat yangi shart uchun zarur bo'lgan darslarni ko'chiradi.

### 1. Qo'shimcha shartlar (izohlar)

«Shartlar va izohlar» bo'limida:

| Shart | Ma'nosi |
|---|---|
| O'qituvchining bo'sh kuni | Shu kunda unga umuman dars qo'yilmaydi |
| O'qituvchining bo'sh soati | Shu kunning shu soatida bo'sh bo'ladi (masalan, kengash yig'ilishi) |
| O'qituvchida aniq soat | Tarifikatsiyada unga aniq shuncha soat beriladi |
| Kunlik dars chegarasi | Bir kunda shuncha soatdan ortiq dars bermaydi |
| Kunlik oyna chegarasi | Shu o'qituvchi uchun alohida oyna normasi |
| Izoh | Faqat eslatma, jadvalga ta'sir qilmaydi |

Har bir shartni vaqtincha **o'chirib qo'yish** (checkbox) mumkin — o'chirilgan shart jadvalga ta'sir qilmaydi.

### 2. Darslarni boshqa o'qituvchiga o'tkazish

«Tarifikatsiya → ⇄ Darslarni o'tkazish»: kimdan, kimga, qaysi sinf-fanlar. Tizim oldindan tekshiradi:
qabul qiluvchi bu fan bo'yicha mutaxassismi va yuklama chegarasidan oshib ketmaydimi. Kerak bo'lsa
fanni uning mutaxassisliklariga qo'shib qo'yadi.

### 3. Jadvalni qo'lda tahrirlash

«Dars jadvali → Sinf bo'yicha»: ikkita darsni ketma-ket bosing — o'rinlari almashadi va ikkalasi
avtomatik **qulflanadi**. Qulflangan dars qayta hisoblashda joyidan qo'zg'almaydi. 🔓/🔒 belgisi bilan
istalgan darsni alohida qulflash mumkin.

### 4. Qayta hisoblash

«Jadval yaratish» bo'limida ikki tugma:

- **↻ Qayta hisoblash (minimal o'zgarish)** — mavjud jadvalni asos qilib oladi. Natijada
  «Nima o'zgardi» ro'yxati chiqadi: qaysi sinfning qaysi darsi qayerdan qayerga ko'chgani.
- **▶ Yangidan yaratish** — butunlay yangi jadval (barcha darslar o'rnini o'zgartirishi mumkin).

**Barqarorlik** slayderi 0 dan 200 gacha: 0 — erkin qayta tuzish, 200 — faqat juda zarur o'zgarish.
Og'irliklar shunday tanlangan-ki, barqarorlik hech qachon qattiq cheklovdan ustun kelmaydi —
jadval "qimirlamasin" deb qoida buzilmaydi.

## Cheklovlar

### Qattiq (buzilishi mumkin emas)

1. O'qituvchi bir vaqtda ikki sinfda dars bera olmaydi.
2. **Sinf jadvalida bo'shliq (oyna) bo'lmaydi** — darslar 1-soatdan uzluksiz ketma-ket boradi.
3. **O'qituvchida kuniga ko'pi bilan 1 ta oyna** (sozlanadi). Ya'ni "1-soat dars, keyin 6-soat dars" holati yuzaga kelmaydi.
4. O'qituvchi band deb belgilagan kunda unga dars qo'yilmaydi.
5. **1–4-sinflar 5 kunlik, 5-sinfdan yuqorisi 6 kunlik** o'qish.
6. Haftalik soatlar o'quv rejaga aniq mos keladi.
7. O'qituvchi yuklamasi `minHours`–`maxHours` oralig'ida (standart 4–24 soat).

### Yumshoq (imkon qadar bajariladi)

- Bir fan bir sinfda bir kunda faqat bir marta. Haftalik soat o'quv kunlaridan ko'p bo'lsa
  (masalan 5 kunlik sinfda 6 soatlik fan) — kunda 2 marta bo'lishiga yo'l qo'yiladi, lekin
  bunday holatlar minimallashtiriladi.
- Og'ir fanlar (matematika, fizika, kimyo) kunning boshiga yaqin joylashadi.
- Jismoniy tarbiya birinchi soatga qo'yilmaydi.
- Darslar hafta kunlariga teng taqsimlanadi va bir fan kunlari orasi uzoqroq bo'ladi.

## Yarim soatli fanlar (juft/toq hafta)

8- va 9-sinflarda Geografiya 1,5 soat va Iqtisodiy bilim asoslari 0,5 soat.
Tizim ularni **bitta katakka** joylaydi: toq haftada Geografiya, juft haftada Iqtisodiy bilim asoslari.
Jadvalda bu katak "toq hafta / juft hafta" belgisi bilan ko'rsatiladi.

## Algoritm

Jadval uch bosqichda tuziladi:

**1. Kunlarga taqsimlash.** Har bir sinfning haftalik darslari kunlarga teng bo'linadi
(`floor(U/D)` va qoldiq). Fanlar kunlarga shunday tarqatiladi-ki, bir fan bir kunda takrorlanmasin
va bir fanning kunlari orasi uzoq bo'lsin.

**2. Soatlarga joylash (och ko'z algoritm).** Har bir sinf-kun uchun darslar 1-soatdan boshlab
ketma-ket to'ldiriladi — shu sababli **sinf jadvalida bo'shliq strukturaviy jihatdan mumkin emas**.
Har bir soatga o'qituvchisi bo'sh bo'lgan dars tanlanadi.

**3. Lokal qidiruv (simulated annealing).** Uch turdagi amal qo'llaniladi:

| Amal | Ta'siri |
|---|---|
| Bir kun ichida ikki soatni almashtirish | Kun tarkibi o'zgarmaydi |
| Bir sinfning ikki kunidagi darslarni almashtirish | Kunlar tarkibi o'zgaradi, soni saqlanadi |
| Darsni boshqa kunga ko'chirish | **Kundagi dars soni o'zgaradi** |

Uchinchi amal muhim: masalan boshlang'ich sinf o'qituvchisiga chorshanba bo'sh kun berish uchun
sinfning chorshanbadagi dars soni 4 dan 3 ga tushishi kerak (qolgan kunlar 5,5,4,4). Faqat
almashtirish amallari bilan buni qilib bo'lmaydi.

Har bir amal jarima funksiyasining o'zgarishi bo'yicha baholanadi:

```
jarima = 4000·(o'qituvchi to'qnashuvi)
       + 2000·(bo'sh bo'lishi kerak bo'lgan kun/soatda dars)
       +  400·(ruxsatdan ortiq oyna)
       +  400·(fan bir kunda takrorlanishi)
       +  250·(kunlik yuklama oshishi)
       +    2·(kun yuklamasi notekisligi)²
       +  ≤200·(mavjud jadvaldan siljish — barqarorlik)
       +  yumshoq pedagogik jarimalar (0…12)
```

Barqarorlik jarimasining yuqori chegarasi (200) eng kichik qattiq jarimadan (250) past —
shuning uchun "jadval qimirlamasin" degan intilish hech qachon qoidani buzishga olib kelmaydi.

Hisoblash Web Worker'da bajariladi — interfeys qotib qolmaydi.

Solver ishga tushishdan oldin **bajarib bo'lmaydigan shartlarni** ham aniqlaydi (masalan
o'qituvchining soati ochiq kunlarga sig'masligi) va buni hisobotda ko'rsatadi.

### Sinov natijasi (30 sinf, 60 o'qituvchi, 855 dars soati)

`npm run bench` — noldan jadval tuzish:

```
Vaqt: 0.6 s
O'qituvchi to'qnashuvi: 0
Sinf jadvalidagi bo'shliqlar: 0
Ortiqcha o'qituvchi oynalari: 0
Xatolar: 0
```

`npm run bench:inc` — o'zgartirish kiritib qayta hisoblash:

| Ssenariy | Xato | Ko'chgan darslar |
|---|---|---|
| 3 o'qituvchiga bo'sh kun + 1 bo'sh soat + oyna normasi 0 | 0 | **21 / 855 (2,5%)** |
| — o'sha shartlar bilan yangidan tuzilganda | 0 | 767 / 855 (89,7%) |
| Darslarni boshqa o'qituvchiga o'tkazish | 0 | 6 / 855 (0,7%) |
| Qo'lda 2 ta darsni almashtirish + qulflash | 0 | **2 / 855 (0,2%)** |

## Loyiha tuzilishi

```
src/
  data/curriculum.ts    — rasmiy tayanch o'quv reja (fan × sinf soatlari)
  data/seed.ts          — 30 sinf va 60 o'qituvchining boshlang'ich bazasi
  lib/derive.ts         — soatlarni hisoblash, dars birliklarini qurish
  lib/rules.ts          — qo'shimcha shartlarni cheklovlarga aylantirish
  lib/view.ts           — jadvalni ko'rsatish uchun indeks
  lib/export.ts         — CSV / JSON eksport
  scheduler/assign.ts   — tarifikatsiya + darslarni o'tkazish
  scheduler/solver.ts   — jadval generatori (noldan va inkremental)
  scheduler/validate.ts — mustaqil tekshiruvchi
  scheduler/worker.ts   — Web Worker
  pages/                — interfeys sahifalari
  store.ts              — holat (zustand + localStorage)
scripts/
  bench.ts              — noldan tuzishni sinash
  bench-incremental.ts  — o'zgartirish ssenariylarini sinash
```

## Keyingi bosqichlar (startup uchun)

- Backend + baza (ko'p maktab, foydalanuvchilar, o'quv yillari tarixi)
- `erp.maktab.uz` bilan integratsiya (tayanch o'quv reja va tarifikatsiyani import qilish)
- Ikki smenali maktablar
- Xona (kabinet) va laboratoriyalar cheklovi
- Qo'lda tahrirlash: darsni sudrab ko'chirish (drag & drop) va darhol tekshirish
- Excel (.xlsx) eksporti, tayyor blank shakllar
