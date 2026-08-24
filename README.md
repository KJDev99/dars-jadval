# Dars Jadval — maktab dars jadvalini avtomatlashtirish

Umumiy o'rta ta'lim maktablari uchun dars jadvalini avtomatik tuzuvchi tizim.
O'zbekiston Respublikasi **tayanch o'quv rejasi** asosida ishlaydi.

## Ishga tushirish

```bash
npm install
npm run dev          # http://localhost:5180
npm run build        # ishlab chiqarish uchun yig'ish
npm run bench        # generatorni brauzersiz sinash (konsolda hisobot)
npm run bench:inc    # "minimal o'zgarish" rejimini sinash
npm run bench:cat    # toifa bo'yicha dars taqsimotini sinash
npm run bench:seeds  # turli urug'larda barqarorlikni sinash
npm run bench:excel  # Excel eksport → import → jadval zanjirini sinash
npm run bench:site   # sayt kontenti, kirish va so'rovlar mantig'ini sinash
npm run smoke        # barcha sahifalarni chizib, ishga tushish xatolarini topish
```

Interfeys **yorug'** va **qorong'i** mavzuda ishlaydi — yon paneldagi tugmadan
tanlanadi (yorug' / qorong'i / tizim mavzusi). Tanlov saqlanadi.

Ma'lumotlar brauzerning `localStorage` xotirasida saqlanadi — server yoki baza talab qilinmaydi.

## Tizimning uch qismi

| Qism | Manzil | Kim kiradi |
|---|---|---|
| **Rasmiy sayt** | `/` | Hamma — ochiq |
| **Ma'muriyat paneli** | `/boshqaruv` | Direktor va zavuch — login va parol bilan |
| **O'qituvchi kabineti** | `/kabinet` | O'qituvchi — pasport seriyasi va raqami bilan |

Yopiq bo'limlar alohida bo'laklarga ajratilgan: saytga kirgan mehmon boshqaruv paneli
kodini umuman yuklamaydi.

### Sinov uchun kirish ma'lumotlari

| Rol | Login | Parol |
|---|---|---|
| Direktor | `direktor` | `maktab2026` |
| Zavuch | `zavuch` | `zavuch2026` |

O'qituvchi kabinetiga kirish uchun pasport ma'lumoti kerak. Har bir o'qituvchining
seriyasi va raqami «Foydalanuvchilar» bo'limida ko'rinadi va o'zgartiriladi; kirish
sahifasidagi «Sinov uchun ma'lumot» bandi bitta tayyor hisobni ko'rsatadi.

Seans `sessionStorage` da saqlanadi — brauzer oynasi yopilganda tizimdan chiqiladi.

## Rasmiy sayt

Maktabning ochiq sahifalari — hech qanday kirishsiz ko'rinadi.

| Sahifa | Mazmuni |
|---|---|
| Bosh sahifa | Tashkil etilgan yili, shior, ko'rsatkichlar, rahbariyat, a'lochilar, bitiruvchilar, yangiliklar |
| Maktab haqida | To'liq tarix, tamoyillar, rasm va yangiliklar ro'yxati |
| Rahbariyat | Har bir a'zoning lavozimi, staji, ma'lumoti, qabul vaqti, faoliyati va mukofotlari |
| Pedagoglar | Toifa va mutaxassislik bo'yicha filtr, qidiruv; har biri uchun alohida sahifa |
| Yutuqlar | A'lochi o'quvchilar (bosqich va yil bo'yicha filtr) hamda faxriy bitiruvchilar |
| Dars jadvali | Umumiy jadval — sinf yoki o'qituvchi kesimida, chop etish bilan |
| Aloqa | Manzil, telefon, qabul kunlari va murojaat shakli |

Pedagog sahifasida (`/oqituvchilar/:id`) o'qituvchining toifasi, staji, ma'lumoti,
o'qitadigan fanlari, sinf rahbarligi, yutuqlari va **haftalik dars jadvali** ko'rsatiladi.

Barcha rasmlar uchun joy tayyorlangan: rasm yuklanmagan bo'lsa ismdan olingan bosh
harflar va ismga bog'liq rangdagi chiroyli o'rin egallagich chiziladi. Rasm yuklanganda
u brauzerda 900 px gacha kichraytirilib, JPEG ga siqiladi.

## O'qituvchining shaxsiy kabineti

O'qituvchi pasport seriyasi (2 harf) va raqami (7 raqam) bilan kiradi.

| Bo'lim | Mazmuni |
|---|---|
| Bosh sahifa | Bugungi darslar, haftalik yuklama va stavka, oynalar, shaxsiy shartlar |
| Dars jadvalim | To'liq haftalik jadval, kunlar kesimidagi yig'indi, chop etish |
| Ma'lumotlarim | O'zgartirish taklif qilinadigan maydonlar + ma'muriyat belgilaydigan maydonlar |
| So'rovlarim | Yangi ariza yuborish va yuborilganlarining holati |

**O'qituvchi hech narsani o'zi o'zgartira olmaydi.** «Ma'lumotlarim» bo'limida maydon
tahrirlanadi, tizim eski va yangi qiymatni taqqoslab **faqat o'zgargan maydonlarni**
so'rovga qo'shadi. Ma'muriyat so'rovni qabul qilsa — o'zgarishlar kartochkaga avtomatik
ko'chadi; rad etsa — hech narsa o'zgarmaydi.

Jadval yoki yuklama bo'yicha so'rovda aniq darsni tanlash mumkin (kun, soat, sinf, fan) —
u so'rov matniga qo'shiladi.

## Rollar va ruxsatlar

| Bo'lim | Direktor | Zavuch | O'qituvchi |
|---|---|---|---|
| Sinflar, o'qituvchilar, o'quv reja, tarifikatsiya, Excel | ✓ | ✓ | — |
| Shartlar, jadval yaratish, dars jadvali, tekshiruv | ✓ | ✓ | — |
| O'qituvchi so'rovlari | ✓ | ✓ | o'ziniki |
| Rasmiy sayt kontenti | ✓ | — | — |
| Foydalanuvchilar va pasport ma'lumotlari | ✓ | — | — |
| O'z jadvali va ma'lumotini ko'rish | — | — | ✓ |

O'qituvchi ma'lumotlarini **faqat direktor yoki zavuch** o'zgartiradi — kartochka orqali
yoki so'rovni qabul qilish orqali.

## Sayt kontentini boshqarish

«Rasmiy sayt» bo'limi (direktor) besh qismdan iborat: maktab ma'lumoti (nom, yil, shior,
matn, aloqa, rasmlar, ko'rsatkichlar), rahbariyat, a'lochi o'quvchilar, faxriy
bitiruvchilar va yangiliklar. Har bir ro'yxat qo'shish / tahrirlash / o'chirish, rahbariyat
esa qo'shimcha ravishda tartibni o'zgartirishni qo'llab-quvvatlaydi.

## Backendga o'tish

Hozircha hamma narsa brauzerda ishlaydi. Server qismi ulanganda o'zgartiriladigan joylar:

| Fayl | Nima o'zgaradi |
|---|---|
| `src/authStore.ts` | `loginAdmin` / `loginTeacher` server so'roviga almashadi, parollar serverda shifrlanadi |
| `src/lib/image.ts` | Rasm data URL o'rniga serverga yuklanadi |
| `src/store.ts` | `persist` o'rniga API bilan sinxronlash |
| `src/site/ContactPage.tsx` | Murojaat shakli serverga yuboriladi |

Qolgan kod — sahifalar, jadval generatori, tekshiruvchi va Excel — o'zgarishsiz qoladi.

## Ma'lumot manbasi

O'quv reja O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirining
**2026-yil 10-apreldagi 133-son buyrug'i**, 1-ilova — "Ta'lim o'zbek tilida olib boriladigan
umumiy o'rta ta'lim muassasalari uchun 2026-2027-o'quv yiliga mo'ljallangan tayanch o'quv reja"
hujjatidan olingan.

Haftalik jami soatlar: 1-sinf 21, 2–4 24, 5 29, 6 30, 7 35, 8 33, 9 34, 10 31, 11 31 — jami **316 soat**.
Barcha qator va ustun yig'indilari rasmiy hujjat bilan solishtirib tekshirilgan
(`npm run bench` buni har safar qayta tekshiradi).

## Ma'muriyat panelining bo'limlari

| Bo'lim | Vazifasi |
|---|---|
| Boshqaruv paneli | Umumiy ko'rsatkichlar, o'quv reja bilan solishtirish |
| Sinflar | Sinf qo'shish/o'chirish, sinf rahbarini tayinlash, alohida soat sozlash |
| O'qituvchilar | Malaka toifasi, mutaxassislik, o'qita oladigan fanlar, yuklama chegarasi, band kunlar |
| O'quv reja | Fan × sinf matritsasi — istalgan soatni tahrirlash |
| Tarifikatsiya | Har bir (sinf, fan) uchun o'qituvchi biriktirish + darslarni boshqa o'qituvchiga o'tkazish |
| Excel | O'qituvchilar, toifalar va tarifikatsiyani Excelga chiqarish; tayyor fayldan o'qib jadval tuzish |
| Shartlar va izohlar | Metodik kunlar, bo'sh kun, bo'sh soat, aniq soat, kunlik chegara, erkin izoh |
| Jadval yaratish | Cheklovlarni sozlash, yangidan yaratish yoki minimal o'zgarish bilan qayta hisoblash |
| Dars jadvali | Sinf / o'qituvchi / umumiy ko'rinish, qo'lda tahrirlash, qulflash, chop etish, CSV |
| Tekshiruv | Tuzilgan jadvalning barcha qoidalarga mosligini mustaqil tekshirish |
| O'qituvchi so'rovlari | Kabinetdan kelgan arizalar: qabul qilish, rad etish, javob yozish |
| Rasmiy sayt | Sayt kontenti — maktab ma'lumoti, rahbariyat, o'quvchilar, bitiruvchilar, yangiliklar |
| Foydalanuvchilar | Ma'muriyat hisoblari va o'qituvchilarning pasport ma'lumotlari |

## Excel bilan ishlash

Butun tarifikatsiyani — kim, qaysi sinfda, qaysi fandan, necha soat dars beradi —
Excelda tayyorlab, keyin shu fayl asosida jadval tuzish mumkin.

### Yuklab olish

«Excel» bo'limidagi ikkita tugma:

- **Excelga yuklab olish** — bazadagi joriy holat to'ldirilgan holda chiqadi;
- **Bo'sh shablon** — faqat sarlavhalar va ma'lumotnoma qoladi.

Kitobda 4 ta varaq bo'ladi:

| Varaq | Mazmuni |
|---|---|
| O'qituvchilar | F.I.Sh., toifa, mutaxassislik, o'qitadigan fanlar, min/max soat, sinf rahbarligi, bo'sh kunlar |
| Tarifikatsiya | Har bir qator — bitta o'qituvchining bitta sinfdagi bitta fani va haftalik soati |
| Sinflar | Sinflar, sinf rahbari, o'quv kunlari va haftalik soat |
| Ma'lumotnoma | To'ldirish qoidalari, fanlar ro'yxati, toifalar va hafta kunlari |

Xuddi shu kitobni «O'qituvchilar» va «Tarifikatsiya» bo'limlaridagi **Excel** tugmasi ham beradi.

### Yuklash

Fayl «Excel» bo'limiga tashlanadi yoki tanlanadi. O'qishdan oldin mazmuni ko'rsatiladi:
nechta o'qituvchi, nechta dars qatori, jami soat, qaysi qatorlarda ogohlantirish bor.
Faqat shundan keyin «Qo'llash» bosiladi.

Fayl **erkin to'ldirilishi** mumkin — o'qish sarlavha nomlari bo'yicha boradi:

- ustunlar tartibi ixtiyoriy, sarlavhalar sinonim bo'lishi mumkin
  («F.I.Sh.» / «F.I.O» / «O'qituvchi», «Toifa» / «Daraja», «Haftalik soat» / «Soat» …);
- sinf «7-A», «7A», «7 A» yoki «7-А» (kirill) ko'rinishida yozilaveradi;
- fan to'liq nomi bilan ham, qisqartmasi bilan ham beriladi («Jismoniy tarbiya», «Jism.t.»);
- toifa: «Oliy toifa», «1-toifa», «2-toifa», «Toifasiz» yoki shunga yaqin yozuv;
- faylda uchragan yangi o'qituvchi va yangi sinf avtomatik qo'shiladi.

Tanilmagan qiymat jimgina tashlab yuborilmaydi — qator raqami bilan ogohlantirishga tushadi.

### Qo'llashdagi ikki tanlov

| Bayroq | Ma'nosi |
|---|---|
| Faqat fayldagi o'qituvchilar qolsin | Bazadagi, faylda uchramagan o'qituvchilar o'chiriladi. Belgilanmasa — saqlanadi |
| Sinf o'quv rejasi aynan fayl bo'yicha | Faylda ko'rsatilmagan fanlar o'sha sinfda 0 soat bo'ladi |

Ikkinchi bayroq yoqilganda tuzilgan jadval faylga **to'liq** mos tushadi: fayldagi soatlar
sinf o'quv rejasiga, o'qituvchilar esa tarifikatsiyaga yoziladi. Shu sababli «Jadval yaratish»da
avtomatik taqsimot umuman ishlamaydi — hamma narsa fayldagidek qoladi.

Sinf rahbari ko'rsatilgan bo'lsa, unga o'z sinfida 1 soat **Ma'naviyat soati** avtomatik qo'shiladi.

### Sinov (`npm run bench:excel`)

Skript butun zanjirni tekshiradi: 30 sinf va 60 o'qituvchi Excelga yoziladi, fayl bo'sh
bazaga qayta o'qiladi va 465 ta biriktirish, toifalar, sinf rahbarlari hamda soatlar
bir xilligi solishtiriladi. So'ng qo'lda tuzilgan (sarlavhalari boshqacha, ustunlari
boshqa tartibdagi) fayl o'qiladi va oxirida import qilingan ma'lumot bilan jadval tuzilib,
tekshiruvchidan o'tkaziladi — **0 xato**.

## Malaka toifasi va stavka bo'yicha taqsimot

Har bir o'qituvchining **malaka toifasi** bo'ladi: *Oliy toifa*, *1-toifa*, *2-toifa* yoki *toifasiz*.
Tarifikatsiyada soatlar shu tartibda taqsimlanadi:

1. **1-bosqich** — har bir o'qituvchiga bittadan stavka (standart 18 soat) ajratiladi.
   Navbat: oliy toifa → 1-toifa → 2-toifa → toifasiz.
2. **2-bosqich** — stavkasi to'lganlarga qolgan soatlar yana o'sha tartibda ulanadi.

Bir stavka necha soatligi «Jadval yaratish → Sozlamalar» da o'zgartiriladi.

Algoritm buni ballash orqali bajaradi (`assign.ts`):

```
ball = 40·(stavkasi to'lganmi)  +  8·(toifa tartibi: oliy 0 … toifasiz 3)
     +  4·(joriy yuklama nisbati)   −  kichik metodik bonuslar
```

Stavka omili (40) toifa omilidan (maks. 24) katta — shuning uchun avval **hamma**
bittadan stavka oladi, faqat keyin yuqori toifalar to'ldiriladi.

### Sinov natijasi (`npm run bench:cat`)

30 sinf = 855 soat, 60 o'qituvchi, 1 stavka = 18 soat:

| Toifa | Soni | O'rtacha soat | 1 stavka to'lgan | O'rtacha stavka |
|---|---|---|---|---|
| Oliy toifa | 15 | 18,3 | 12/15 | **1,01** |
| 1-toifa | 15 | 16,1 | 11/15 | 0,90 |
| 2-toifa | 15 | 16,0 | 10/15 | 0,89 |
| Toifasiz | 15 | 6,6 | 0/15 | 0,37 |

Maktabdagi 855 soat ~47,5 stavkaga teng, o'qituvchilar esa 60 ta — hammaga stavka
yetmaydi. Tizim buni **«Shtat balansi»** ogohlantirishi bilan aniq ko'rsatadi:
nechta o'qituvchiga dars tegmagani va nechtasining yuklamasi minimaldan kamligi.

## Metodik (pedagogik) kunlar

Har bir **metodbirlashma** — ya'ni bir fan yo'nalishidagi o'qituvchilar guruhi — uchun haftada
bitta metodik kun belgilanadi. O'sha kuni shu guruhning **barcha o'qituvchilariga** dars qo'yilmaydi:
ular metodik ish bilan shug'ullanadi.

«Shartlar va izohlar → Metodik kunlar» bo'limida har bir guruhga kun tanlanadi. Standart taqsimot:

| Kun | Metodbirlashmalar |
|---|---|
| Seshanba | Chet tili, Fizika va astronomiya, Musiqa madaniyati |
| Chorshanba | Ona tili va adabiyot, Matematika, Biologiya, Texnologiya |
| Payshanba | Rus tili, Informatika va AT, Geografiya va iqtisodiyot, Jismoniy tarbiya |
| Juma | Tarix va huquq, Kimyo, Tasviriy san'at va chizmachilik |

**Boshlang'ich ta'lim** guruhiga metodik kun berilmaydi: sinf rahbari o'z sinfining darslarining
katta qismini (masalan 1-sinfda 21 soatdan 18 tasini) o'zi o'tadi, kun bo'sh qolsa sinfni
boshqa o'qituvchilar bilan to'ldirib bo'lmaydi.

Bo'limda har kun uchun **qancha soat bo'sh qolishi** ko'rsatiladi. Agar bir kunda o'qituvchilarning
uchdan biridan ko'pi bo'sh bo'lsa, nishon qizil rangga o'tadi — bu jadval tuzishni qiyinlashtiradi.

## Sinf rahbari va Ma'naviyat soati

Har bir sinfga **sinf rahbari** biriktiriladi («Sinflar» bo'limida). Sinf rahbari o'z sinfida
haftada bir soat **Ma'naviyat soati** o'tadi — bu dars avtomatik ravishda unga biriktiriladi va
boshqa o'qituvchiga o'tkazib bo'lmaydi. Sinf rahbari o'zgartirilsa, Ma'naviyat soati ham
yangi rahbarga o'tadi.

Ma'naviyat soati **tayanch o'quv rejadan tashqarida**: rasmiy 316 soat bilan solishtirishda
hisobga olinmaydi va o'quv reja jadvalida alohida bo'limda ko'rsatiladi.

Boshlang'ich sinf o'qituvchilari faqat o'z sinfiga dars beradi (o'qituvchi kartochkasidagi
«Faqat o'z sinfiga dars beradi» bayrog'i). Fan o'qituvchisi sinf rahbari bo'lsa ham boshqa
sinflarga dars beraveradi.

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
avtomatik **qulflanadi**. Qulflangan dars qayta hisoblashda joyidan qo'zg'almaydi. Katakdagi qulf
belgisi bilan istalgan darsni alohida qulflash ham mumkin.

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
4. O'qituvchi band deb belgilagan kunda va metodbirlashmaning metodik kunida dars qo'yilmaydi.
5. **1–4-sinflar 5 kunlik, 5-sinfdan yuqorisi 6 kunlik** o'qish.
6. Haftalik soatlar o'quv rejaga aniq mos keladi.
7. O'qituvchi yuklamasi `minHours`–`maxHours` oralig'ida (standart 4–24 soat).
8. Ma'naviyat soatini faqat o'sha sinfning rahbari o'tadi.

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

Jadval to'rt bosqichda tuziladi:

**1. Kunlarga taqsimlash.** Har bir sinfning haftalik darslari kunlarga teng bo'linadi
(`floor(U/D)` va qoldiq). Fanlar kunlarga shunday tarqatiladi-ki, bir fan bir kunda takrorlanmasin
va bir fanning kunlari orasi uzoq bo'lsin.

Bu bosqichda **band kunlar qattiq filtr** sifatida ishlaydi: dars avval faqat o'qituvchisi bo'sh
bo'lgan kunlarga qo'yiladi va sig'im qolmagandagina boshqa kun tanlanadi. Metodik kun va bo'sh kun
shartlari asosan shu yerda hal bo'ladi — keyingi bosqichlarda darsning kunini o'zgartirish
ancha qimmatga tushadi.

**2. Soatlarga joylash (och ko'z algoritm).** Har bir sinf-kun uchun darslar 1-soatdan boshlab
ketma-ket to'ldiriladi — shu sababli **sinf jadvalida bo'shliq strukturaviy jihatdan mumkin emas**.
Har bir soatga o'qituvchisi bo'sh bo'lgan dars tanlanadi.

**3. Lokal qidiruv (simulated annealing).** Uch turdagi amal qo'llaniladi:

| Amal | Ta'siri |
|---|---|
| Bir kun ichida ikki soatni almashtirish | Kun tarkibi o'zgarmaydi |
| Bir sinfning ikki kunidagi darslarni almashtirish | Kunlar tarkibi o'zgaradi, soni saqlanadi |
| Darsni boshqa kunning istalgan soatiga ko'chirish | **Kundagi dars soni o'zgaradi** |

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

**4. Tuzatish bosqichi (repair).** Tasodifiy qidiruv lokal minimumda qolib ketishi mumkin.
Shuning uchun undan keyin har bir muammoli dars uchun **barcha** mumkin bo'lgan ko'chirishlar
to'liq sanab chiqiladi va eng yaxshisi qo'llaniladi. Bir qadamda yechilmaydigan holatlar
uchun **ikki qadamli zanjir** ham sinaladi — masalan o'qituvchiga dushanba 1-soatni bo'shatish
uchun avval sinfning dushanbadagi bitta darsini boshqa kunga surib joy ochish, keyin boshqa
o'qituvchining darsini o'sha soatga olib kelish kerak bo'ladi. Buzilish qolsa, jadval
"qayta qizdirilib" (reheat) bosqich takrorlanadi.

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
| Qo'lda 2 ta darsni almashtirish + qulflash | 0 | **0 / 855 (0,0%)** |

`npm run bench:seeds` — 8 xil tasodifiy urug'da, ikkitadan ssenariy: **16/16 holatda 0 xato**.
Sinovlar 14 ta metodbirlashmaning metodik kunlari yoqilgan holda o'tkaziladi.

## Loyiha tuzilishi

```
src/
  data/curriculum.ts    — rasmiy tayanch o'quv reja (fan × sinf soatlari)
  data/seed.ts          — 30 sinf va 60 o'qituvchining boshlang'ich bazasi
  lib/derive.ts         — soatlarni hisoblash, dars birliklarini qurish
  lib/rules.ts          — qo'shimcha shartlarni cheklovlarga aylantirish
  lib/theme.ts          — yorug'/qorong'i mavzu
  components/icons.ts   — barcha ikonkalar (react-icons / Lucide)
  components/Select.tsx — maxsus tanlagich (qidiruv, klaviatura, guruhlash)
  lib/excel.ts          — Excel eksport/import (SheetJS, talab bo'lganda yuklanadi)
  lib/view.ts           — jadvalni ko'rsatish uchun indeks
  lib/export.ts         — CSV / JSON eksport
  scheduler/assign.ts   — tarifikatsiya + darslarni o'tkazish
  scheduler/solver.ts   — jadval generatori (noldan va inkremental)
  scheduler/validate.ts — mustaqil tekshiruvchi
  scheduler/worker.ts   — Web Worker
  site/                 — rasmiy saytning ochiq sahifalari
  auth/                 — kirish sahifasi va himoyalangan yo'llar
  cabinet/              — o'qituvchining shaxsiy kabineti
  admin/                — ma'muriyat panelining qobig'i va menyusi
  pages/                — ma'muriyat panelining sahifalari
  components/Photo.tsx  — rasm va o'rin egallagich, rasm yuklash
  lib/image.ts          — rasmni kichraytirish, bosh harflar
  data/site-seed.ts     — sayt kontenti va hisoblarning boshlang'ich holati
  authStore.ts          — kirish va ruxsatlar (zustand + sessionStorage)
  store.ts              — holat (zustand + localStorage)
scripts/
  bench.ts              — noldan tuzishni sinash
  bench-incremental.ts  — o'zgartirish ssenariylarini sinash
  bench-category.ts     — toifa bo'yicha taqsimotni sinash
  bench-excel.ts        — Excel zanjirini sinash
  bench-site.ts         — sayt kontenti, kirish va so'rovlarni sinash
  smoke.tsx             — barcha sahifalarni serverda chizib tekshirish
  bench-seeds.ts        — ko'p urug'li barqarorlik sinovi
```

## Keyingi bosqichlar (startup uchun)

- Backend + baza (ko'p maktab, foydalanuvchilar, o'quv yillari tarixi)
- `erp.maktab.uz` bilan integratsiya (tayanch o'quv reja va tarifikatsiyani import qilish)
- Ikki smenali maktablar
- Xona (kabinet) va laboratoriyalar cheklovi
- Qo'lda tahrirlash: darsni sudrab ko'chirish (drag & drop) va darhol tekshirish
- Excel (.xlsx) eksporti, tayyor blank shakllar
