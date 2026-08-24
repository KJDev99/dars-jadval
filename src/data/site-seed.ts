/**
 * Rasmiy sayt kontenti va kirish tizimi uchun boshlang'ich ma'lumotlar.
 * Barchasi ma'muriyat panelidan tahrirlanadi — bu yerdagi qiymatlar faqat namuna.
 */
import type {
  AdminUser,
  Alumnus,
  NewsItem,
  SchoolProfile,
  SiteContent,
  StaffMember,
  StudentHighlight,
} from '../types'

export const SCHOOL_FOUNDED = 1974

export function defaultProfile(): SchoolProfile {
  return {
    name: "Toshkent shahar Yunusobod tumanidagi 14-son umumiy o'rta ta'lim maktabi",
    shortName: "14-son maktab",
    foundedYear: SCHOOL_FOUNDED,
    motto: "Bilim — kelajak kaliti",
    intro:
      "Yarim asrdan ortiq tarixga ega maktabimiz har bir o'quvchining iqtidorini ochishga, " +
      "mustaqil fikrlaydigan va vatanini sevadigan yosh avlodni tarbiyalashga xizmat qiladi.",
    about:
      "14-son umumiy o'rta ta'lim maktabi 1974-yilda tashkil etilgan. Bugungi kunda maktabda " +
      "1-sinfdan 10-sinfgacha 30 ta sinf faoliyat yuritadi, ularda 700 dan ortiq o'quvchi ta'lim oladi.\n\n" +
      "Maktabda 60 nafar pedagog mehnat qiladi. Ularning aksariyati oliy va birinchi malaka toifasiga ega " +
      "bo'lib, o'quvchilarni tuman, viloyat va respublika bosqichidagi fan olimpiadalariga muntazam tayyorlab keladi.\n\n" +
      "Maktabda zamonaviy jihozlangan fizika, kimyo va biologiya laboratoriyalari, ikkita informatika xonasi, " +
      "boy fondga ega axborot-resurs markazi hamda sport zali mavjud. Darsdan tashqari mashg'ulotlar " +
      "— to'garaklar va sport seksiyalari — o'quvchilarning qiziqishlariga qarab tashkil etilgan.\n\n" +
      "Dars jadvali maxsus dastur yordamida tuziladi: o'quvchilar jadvalida bo'shliq qolmaydi, " +
      "o'qituvchilarning metodik kunlari va yuklamasi to'liq hisobga olinadi.",
    region: "Toshkent shahri",
    district: "Yunusobod tumani",
    address: "Yunusobod tumani, Amir Temur shoh ko'chasi, 108-uy",
    phone: "+998 71 234-56-78",
    email: "info@14maktab.uz",
    website: "www.14maktab.uz",
    telegram: "https://t.me/maktab14",
    instagram: "https://instagram.com/maktab14",
    youtube: "",
    heroPhoto: undefined,
    aboutPhoto: undefined,
    logo: undefined,
    graduatesCount: 4200,
    awardsCount: 128,
  }
}

const staff = (
  order: number,
  fullName: string,
  position: string,
  extra: Partial<StaffMember>,
): StaffMember => ({
  id: `st-${order}`,
  fullName,
  position,
  photo: undefined,
  phone: '',
  email: '',
  receptionHours: '',
  education: '',
  experienceYears: 0,
  startYear: 2010,
  bio: '',
  awards: [],
  order,
  ...extra,
})

export function defaultStaff(): StaffMember[] {
  return [
    staff(1, "Karimov Sherzod Anvar o'g'li", 'Maktab direktori', {
      phone: '+998 71 234-56-78',
      email: 'direktor@14maktab.uz',
      receptionHours: 'Dushanba–Juma, 09:00–11:00',
      education: "O'zbekiston Milliy universiteti, tarix fakulteti",
      experienceYears: 27,
      startYear: 2016,
      bio:
        "Pedagogik faoliyatini 1999-yilda tarix fani o'qituvchisi sifatida boshlagan. " +
        "2016-yildan buyon maktabga rahbarlik qiladi. Rahbarligi davrida maktab moddiy-texnik bazasi " +
        "yangilandi, ikkita zamonaviy laboratoriya va axborot-resurs markazi tashkil etildi.",
      awards: [
        "«Xalq ta'limi a'lochisi» ko'krak nishoni",
        "«Eng yaxshi maktab rahbari» tanlovi tuman bosqichi g'olibi",
      ],
    }),
    staff(2, "Yo'ldosheva Nilufar Baxtiyor qizi", "O'quv ishlari bo'yicha direktor o'rinbosari", {
      phone: '+998 71 234-56-79',
      email: 'zavuch@14maktab.uz',
      receptionHours: 'Dushanba–Shanba, 08:30–10:00',
      education: "Nizomiy nomidagi TDPU, matematika fakulteti",
      experienceYears: 21,
      startYear: 2012,
      bio:
        "Matematika fani o'qituvchisi. O'quv jarayonini tashkil etish, dars jadvali va tarifikatsiya " +
        "masalalari uning zimmasida. O'quvchilari har yili viloyat olimpiadalarida sovrinli o'rinlarni egallaydi.",
      awards: ["Viloyat olimpiadasi g'oliblarini tayyorlagan murabbiy", "Metodik qo'llanma hammuallifi"],
    }),
    staff(3, "Rahmonov Doniyor Ulug'bek o'g'li", "Ma'naviy-ma'rifiy ishlar bo'yicha direktor o'rinbosari", {
      phone: '+998 71 234-56-80',
      email: 'manaviyat@14maktab.uz',
      receptionHours: 'Dushanba–Juma, 14:00–16:00',
      education: "Toshkent davlat sharqshunoslik universiteti",
      experienceYears: 14,
      startYear: 2018,
      bio:
        "Maktabdagi tarbiyaviy ishlar, to'garaklar va bayram tadbirlarini muvofiqlashtiradi. " +
        "«Yosh vatanparvar» va «Kitobxon bola» loyihalarining maktabdagi rahbari.",
      awards: ["«Yilning eng faol tashkilotchisi» ko'rigi sovrindori"],
    }),
    staff(4, "Sobirova Zulfiya Rustam qizi", 'Axborot-resurs markazi rahbari', {
      phone: '+998 71 234-56-81',
      email: 'arm@14maktab.uz',
      receptionHours: 'Dushanba–Shanba, 08:00–17:00',
      education: "O'zbekiston davlat jahon tillari universiteti",
      experienceYears: 12,
      startYear: 2019,
      bio:
        "Maktab kutubxonasi va elektron resurslar bazasini boshqaradi. Har oyda o'quvchilar uchun " +
        "kitobxonlik uchrashuvlari va mualliflar bilan suhbatlar tashkil etadi.",
      awards: [],
    }),
    staff(5, "Ergashev Bekzod Farhod o'g'li", 'Metodist', {
      phone: '+998 71 234-56-82',
      email: 'metod@14maktab.uz',
      receptionHours: 'Seshanba, Payshanba, 10:00–12:00',
      education: "Samarqand davlat universiteti, fizika fakulteti",
      experienceYears: 18,
      startYear: 2014,
      bio:
        "Metodbirlashmalar ishini muvofiqlashtiradi, yosh pedagoglarga ustozlik qiladi. " +
        "Ochiq darslar va metodik seminarlar tashkilotchisi.",
      awards: ["Respublika ilmiy-amaliy anjumani ma'ruzachisi"],
    }),
  ]
}

const student = (
  n: number,
  fullName: string,
  classId: string,
  achievement: string,
  level: StudentHighlight['level'],
  year: number,
  subjectId?: string,
): StudentHighlight => ({
  id: `stu-${n}`,
  fullName,
  classId,
  photo: undefined,
  achievement,
  level,
  year,
  subjectId,
})

export function defaultStudents(): StudentHighlight[] {
  return [
    student(1, "Aliyev Jasurbek Sardor o'g'li", '10A', "Matematika fanidan respublika olimpiadasi g'olibi", 'respublika', 2026, 'matematika'),
    student(2, 'Nazarova Malika Otabek qizi', '10B', "Ingliz tili bo'yicha xalqaro IELTS 8.0 natijasi", 'xalqaro', 2026, 'chet_tili'),
    student(3, "Tursunov Amirbek Jamshid o'g'li", '9A', "Fizika fanidan viloyat olimpiadasi 1-o'rin", 'viloyat', 2026, 'fizika'),
    student(4, 'Qodirova Sevinch Bahodir qizi', '9D', "Ona tili va adabiyot bo'yicha viloyat bosqichi g'olibi", 'viloyat', 2025, 'ona_tili'),
    student(5, "Sattorov Islom Ulug'bek o'g'li", '8A', "Informatika bo'yicha respublika hackathon sovrindori", 'respublika', 2026, 'informatika'),
    student(6, 'Rasulova Dilnoza Farrux qizi', '8B', "Kimyo fanidan tuman olimpiadasi 1-o'rin", 'tuman', 2026, 'kimyo'),
    student(7, "Hamidov Sanjar Rustam o'g'li", '7A', "Shaxmat bo'yicha viloyat chempioni", 'viloyat', 2025),
    student(8, 'Yusupova Zilola Anvar qizi', '10D', "Biologiya fanidan respublika olimpiadasi ishtirokchisi", 'respublika', 2026, 'biologiya'),
  ]
}

export function defaultAlumni(): Alumnus[] {
  return [
    {
      id: 'al-1',
      fullName: "Abdullayev Rustam Karim o'g'li",
      graduationYear: 1992,
      photo: undefined,
      occupation: 'Fizika-matematika fanlari doktori, professor',
      description:
        "O'zbekiston Milliy universiteti professori. Nazariy fizika sohasida 80 dan ortiq ilmiy maqola muallifi. " +
        "Maktabimizning fizika xonasini jihozlashda homiylik qilgan.",
    },
    {
      id: 'al-2',
      fullName: 'Yusupova Gulnora Alisher qizi',
      graduationYear: 1998,
      photo: undefined,
      occupation: "O'zbekiston xalq artisti",
      description:
        "Teatr va kino aktrisasi. Maktab dramatik to'garagida sahnaga chiqqan. Har yili bitiruvchilar kechasida " +
        "o'quvchilar bilan uchrashuv o'tkazadi.",
    },
    {
      id: 'al-3',
      fullName: "Norqulov Sardor Baxtiyor o'g'li",
      graduationYear: 2005,
      photo: undefined,
      occupation: 'IT-kompaniya asoschisi',
      description:
        "Xalqaro dasturiy ta'minot kompaniyasi asoschisi va rahbari. Maktabda «Yosh dasturchi» to'garagini " +
        "moliyalashtiradi va o'quvchilarga ustozlik qiladi.",
    },
    {
      id: 'al-4',
      fullName: 'Karimova Nodira Shuhrat qizi',
      graduationYear: 2011,
      photo: undefined,
      occupation: 'Olimpiada chempioni, yengil atletika',
      description:
        "Osiyo chempionati sovrindori. Maktab sport zalida yosh sportchilar bilan mashg'ulotlar o'tkazadi.",
    },
  ]
}

export function defaultNews(): NewsItem[] {
  return [
    {
      id: 'nw-1',
      title: "2026–2027 o'quv yili dars jadvali tasdiqlandi",
      date: '2026-08-20',
      summary:
        "Yangi o'quv yili uchun dars jadvali tuzildi. 1–4 sinflar 5 kunlik, 5-sinfdan yuqorisi 6 kunlik ta'lim oladi.",
      body:
        "Dars jadvali maxsus dastur yordamida tuzildi. Jadvalda o'quvchilar uchun bo'shliq (oyna) qoldirilmagan, " +
        "og'ir fanlar kunning birinchi yarmiga joylashtirilgan. O'qituvchilarning metodik kunlari to'liq hisobga olingan.\n\n" +
        "Jadval bilan saytning «Dars jadvali» bo'limida tanishish mumkin.",
      photo: undefined,
    },
    {
      id: 'nw-2',
      title: "Bilimlar kuniga tayyorgarlik boshlandi",
      date: '2026-08-15',
      summary:
        "1-sentabr — Bilimlar kuni va Mustaqillik bayramiga bag'ishlangan tadbirlar rejasi tasdiqlandi.",
      body:
        "Bayram tadbirlari maktab hovlisida o'tkaziladi. Birinchi sinf o'quvchilari uchun «Ilk qo'ng'iroq» " +
        "marosimi, yuqori sinflar uchun esa faxriy bitiruvchilar bilan uchrashuv rejalashtirilgan.",
      photo: undefined,
    },
    {
      id: 'nw-3',
      title: "O'quvchilarimiz respublika olimpiadasida g'olib bo'ldi",
      date: '2026-05-12',
      summary:
        "Matematika fanidan respublika bosqichida 10-A sinf o'quvchisi birinchi o'rinni egalladi.",
      body:
        "Respublika fan olimpiadasining yakuniy bosqichi Toshkent shahrida o'tkazildi. Maktabimizdan " +
        "uch nafar o'quvchi ishtirok etib, bittasi g'olib, ikkitasi sovrindor bo'ldi.",
      photo: undefined,
    },
  ]
}

export function defaultSite(): SiteContent {
  return {
    profile: defaultProfile(),
    staff: defaultStaff(),
    students: defaultStudents(),
    alumni: defaultAlumni(),
    news: defaultNews(),
  }
}

/**
 * Ma'muriyat foydalanuvchilari.
 * Bu bosqichda parollar brauzerda saqlanadi — backendga ulanganda
 * autentifikatsiya serverga ko'chiriladi.
 */
export function defaultUsers(): AdminUser[] {
  return [
    {
      id: 'u-1',
      login: 'direktor',
      password: 'maktab2026',
      fullName: "Karimov Sherzod Anvar o'g'li",
      role: 'director',
      active: true,
      staffId: 'st-1',
      createdAt: 0,
    },
    {
      id: 'u-2',
      login: 'zavuch',
      password: 'zavuch2026',
      fullName: "Yo'ldosheva Nilufar Baxtiyor qizi",
      role: 'zavuch',
      active: true,
      staffId: 'st-2',
      createdAt: 0,
    },
  ]
}
