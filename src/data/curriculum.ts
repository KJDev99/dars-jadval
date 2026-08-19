import type { Subject } from '../types'

/**
 * O'ZBEKISTON RESPUBLIKASI TAYANCH O'QUV REJASI
 *
 * Manba: Maktabgacha va maktab ta'limi vazirining 2026-yil 10-apreldagi 133-son buyrug'i,
 *        1-ILOVA — "Ta'lim o'zbek tilida olib boriladigan umumiy o'rta ta'lim muassasalari
 *        uchun 2026-2027-o'quv yiliga mo'ljallangan tayanch o'quv reja".
 *
 * Haftalik jami: 1-sinf 21, 2–4 24, 5 29, 6 30, 7 35, 8 33, 9 34, 10 31, 11 31 = 316 soat.
 * Barcha ustun va qator yig'indilari rasmiy hujjat bilan solishtirib tekshirilgan.
 *
 * HOURS[subjectId][grade] — grade 1..11 (0-indeks ishlatilmaydi).
 */

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

/** Qulaylik uchun: 11 elementli massiv 1-sinfdan 11-sinfgacha */
const h = (...v: number[]): Record<number, number> => {
  const out: Record<number, number> = {}
  for (let g = 1; g <= 11; g++) out[g] = v[g - 1] ?? 0
  return out
}

export const SUBJECTS: Subject[] = [
  // ───────────── I. Filologiya fanlari ─────────────
  { id: 'ona_tili', name: 'Ona tili', short: 'Ona t.', yonalish: 'Filologiya fanlari', weight: 8, primaryHomeroom: true, color: '#6366f1' },
  { id: 'oqish_savodxonligi', name: "O'qish savodxonligi", short: "O'qish", yonalish: 'Filologiya fanlari', weight: 6, primaryHomeroom: true, color: '#818cf8' },
  { id: 'adabiyot', name: 'Adabiyot', short: 'Adab.', yonalish: 'Filologiya fanlari', weight: 6, primaryHomeroom: false, color: '#a78bfa' },
  { id: 'rus_tili', name: 'Rus tili', short: 'Rus t.', yonalish: 'Filologiya fanlari', weight: 7, primaryHomeroom: false, color: '#c084fc' },
  { id: 'chet_tili', name: 'Chet tili', short: 'Chet t.', yonalish: 'Filologiya fanlari', weight: 8, primaryHomeroom: false, color: '#e879f9' },

  // ───────────── II. Ijtimoiy fanlar ─────────────
  { id: 'tarixdan_hikoyalar', name: 'Tarixdan hikoyalar', short: 'Tar.hik.', yonalish: 'Ijtimoiy fanlar', weight: 5, primaryHomeroom: false, color: '#f472b6' },
  { id: 'qadimgi_dunyo_tarixi', name: 'Qadimgi dunyo tarixi', short: 'Qad.tar.', yonalish: 'Ijtimoiy fanlar', weight: 5, primaryHomeroom: false, color: '#fb7185' },
  { id: 'ozbekiston_tarixi', name: "O'zbekiston tarixi", short: "O'zb.tar.", yonalish: 'Ijtimoiy fanlar', weight: 6, primaryHomeroom: false, color: '#f43f5e' },
  { id: 'jahon_tarixi', name: 'Jahon tarixi', short: 'Jah.tar.', yonalish: 'Ijtimoiy fanlar', weight: 6, primaryHomeroom: false, color: '#ef4444' },
  { id: 'davlat_huquq', name: 'Davlat va huquq asoslari', short: 'Huquq', yonalish: 'Ijtimoiy fanlar', weight: 6, primaryHomeroom: false, color: '#f87171' },
  { id: 'tarbiya', name: 'Tarbiya', short: 'Tarbiya', yonalish: 'Ijtimoiy fanlar', weight: 3, primaryHomeroom: true, color: '#fca5a5' },

  // ───────────── III. Aniq fanlar ─────────────
  { id: 'matematika', name: 'Matematika', short: 'Mat.', yonalish: 'Aniq fanlar', weight: 10, primaryHomeroom: true, color: '#0ea5e9' },
  { id: 'algebra', name: 'Algebra', short: 'Alg.', yonalish: 'Aniq fanlar', weight: 10, primaryHomeroom: false, color: '#0284c7' },
  { id: 'geometriya', name: 'Geometriya', short: 'Geom.', yonalish: 'Aniq fanlar', weight: 9, primaryHomeroom: false, color: '#38bdf8' },
  { id: 'informatika', name: 'Informatika va axborot texnologiyalari', short: 'Inform.', yonalish: 'Aniq fanlar', weight: 6, primaryHomeroom: true, color: '#06b6d4' },

  // ───────────── IV. Tabiiy va iqtisodiy fanlar ─────────────
  { id: 'fizika', name: 'Fizika', short: 'Fizika', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 9, primaryHomeroom: false, color: '#14b8a6' },
  { id: 'astronomiya', name: 'Astronomiya', short: 'Astron.', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 6, primaryHomeroom: false, color: '#2dd4bf' },
  { id: 'kimyo', name: 'Kimyo', short: 'Kimyo', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 9, primaryHomeroom: false, color: '#10b981' },
  { id: 'biologiya', name: 'Biologiya', short: 'Biol.', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 7, primaryHomeroom: false, color: '#22c55e' },
  { id: 'geografiya', name: 'Geografiya', short: 'Geogr.', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 6, primaryHomeroom: false, color: '#84cc16' },
  { id: 'iqtisodiy_bilim', name: 'Iqtisodiy bilim asoslari', short: 'Iqtis.', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 5, primaryHomeroom: false, color: '#a3e635' },
  { id: 'tadbirkorlik', name: 'Tadbirkorlik asoslari', short: 'Tadbir.', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 5, primaryHomeroom: false, color: '#bef264' },
  { id: 'tabiiy_fan', name: 'Tabiiy fan (Science)', short: 'Tab.fan', yonalish: 'Tabiiy va iqtisodiy fanlar', weight: 6, primaryHomeroom: true, color: '#65a30d' },

  // ───────────── V. Amaliy fanlar ─────────────
  { id: 'musiqa', name: 'Musiqa madaniyati', short: 'Musiqa', yonalish: 'Amaliy fanlar', weight: 2, primaryHomeroom: false, color: '#f59e0b' },
  { id: 'tasviriy_sanat', name: "Tasviriy san'at", short: 'Tasv.s.', yonalish: 'Amaliy fanlar', weight: 2, primaryHomeroom: true, color: '#fbbf24' },
  { id: 'chizmachilik', name: 'Chizmachilik', short: 'Chizm.', yonalish: 'Amaliy fanlar', weight: 5, primaryHomeroom: false, color: '#fcd34d' },
  { id: 'texnologiya', name: 'Texnologiya', short: 'Texnol.', yonalish: 'Amaliy fanlar', weight: 3, primaryHomeroom: true, color: '#fb923c' },
  { id: 'jismoniy_tarbiya', name: 'Jismoniy tarbiya', short: 'Jism.t.', yonalish: 'Amaliy fanlar', weight: 1, primaryHomeroom: false, color: '#f97316' },
  { id: 'chqbt', name: "Chaqiruvga qadar boshlang'ich tayyorgarlik", short: 'CHQBT', yonalish: 'Amaliy fanlar', weight: 4, primaryHomeroom: false, color: '#ea580c' },

  // ───────────── Reja tashqarisi ─────────────
  // Har bir sinfda haftada 1 soat, faqat o'sha sinfning rahbari o'tadi.
  { id: 'manaviyat', name: "Ma'naviyat soati", short: "Ma'nav.", yonalish: 'Ijtimoiy fanlar', weight: 2, primaryHomeroom: false, homeroomOnly: true, outsidePlan: true, color: '#0d9488' },
]

/** Rasmiy tayanch o'quv reja: fan -> sinf -> haftalik soat */
export const STANDARD_HOURS: Record<string, Record<number, number>> = {
  //                        1  2  3  4  5  6  7  8  9  10 11
  ona_tili: /*          */ h(4, 4, 4, 4, 4, 4, 3, 3, 3, 2, 2),
  oqish_savodxonligi: /**/ h(4, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0),
  adabiyot: /*          */ h(0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2),
  rus_tili: /*          */ h(0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2),
  chet_tili: /*         */ h(1, 2, 2, 2, 4, 4, 4, 3, 3, 2, 2),

  tarixdan_hikoyalar: /**/ h(0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0),
  qadimgi_dunyo_tarixi: /**/ h(0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0),
  ozbekiston_tarixi: /* */ h(0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 1),
  jahon_tarixi: /*      */ h(0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1),
  davlat_huquq: /*      */ h(0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1),
  tarbiya: /*           */ h(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),

  matematika: /*        */ h(5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0),
  algebra: /*           */ h(0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3),
  geometriya: /*        */ h(0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2),
  informatika: /*       */ h(1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2),

  fizika: /*            */ h(0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2),
  astronomiya: /*       */ h(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
  kimyo: /*             */ h(0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2),
  biologiya: /*         */ h(0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2),
  geografiya: /*        */ h(0, 0, 0, 0, 0, 0, 2, 1.5, 1.5, 2, 0),
  iqtisodiy_bilim: /*   */ h(0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0, 0),
  tadbirkorlik: /*      */ h(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
  tabiiy_fan: /*        */ h(1, 1, 1, 1, 2, 3, 0, 0, 0, 0, 0),

  musiqa: /*            */ h(1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0),
  tasviriy_sanat: /*    */ h(1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0),
  chizmachilik: /*      */ h(0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0),
  texnologiya: /*       */ h(1, 1, 1, 1, 2, 2, 2, 1, 1, 0, 0),
  jismoniy_tarbiya: /*  */ h(1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2),
  chqbt: /*             */ h(0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2),

  // Reja tashqarisi — sinf rahbarining haftalik ma'naviyat soati
  manaviyat: /*         */ h(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
}

/** Rasmiy hujjatdagi nazorat qiymatlari — o'quv reja sahifasida solishtirish uchun */
export const OFFICIAL_TOTALS: Record<number, number> = {
  1: 21, 2: 24, 3: 24, 4: 24, 5: 29, 6: 30, 7: 35, 8: 33, 9: 34, 10: 31, 11: 31,
}

export const SUBJECT_BY_ID: Record<string, Subject> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s]),
)

export const YONALISHLAR: Subject['yonalish'][] = [
  'Filologiya fanlari',
  'Ijtimoiy fanlar',
  'Aniq fanlar',
  'Tabiiy va iqtisodiy fanlar',
  'Amaliy fanlar',
]

/** Sinf uchun standart haftalik soatni olish */
export function standardHours(grade: number, subjectId: string): number {
  return STANDARD_HOURS[subjectId]?.[grade] ?? 0
}

/** Sinf darajasi bo'yicha standart haftalik jami soat (reja tashqarisi fanlarsiz) */
export function standardTotal(grade: number): number {
  return SUBJECTS.filter((s) => !s.outsidePlan).reduce((sum, s) => sum + standardHours(grade, s.id), 0)
}

/** Tayanch o'quv rejaga kiruvchi fanlar */
export const PLAN_SUBJECTS = SUBJECTS.filter((s) => !s.outsidePlan)

/** Reja tashqarisidagi fanlar (Ma'naviyat soati kabi) */
export const EXTRA_SUBJECTS = SUBJECTS.filter((s) => s.outsidePlan)
