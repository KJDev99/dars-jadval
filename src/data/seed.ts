import type { SchoolClass, Settings, Teacher } from '../types'
import { makeRng } from '../lib/rng'

/** Sinf harflari — o'zbek alifbosi tartibida */
export const CLASS_LETTERS = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

const FAMILIYA = [
  'Abdullayev', 'Rahimov', 'Karimova', 'Yusupov', 'Tojiyeva', 'Ergashev', 'Sultonova',
  'Xolmatov', 'Nazarova', 'Qodirov', 'Ismoilova', 'Sharipov', 'Umarova', 'Jalilov',
  'Bekmurodova', 'Toshpo‘latov', 'Aliyeva', 'Mirzayev', 'Saidova', 'Norqulov',
  'Rasulova', 'Hakimov', 'Otajonova', 'Yo‘ldoshev', 'Muhammadiyeva', 'Zokirov',
  'Xudoyberdiyeva', 'Alimov', 'Turg‘unova', 'Sobirov', 'Nurmatova', 'Egamberdiyev',
  'Xasanova', 'Po‘latov', 'Ashurova', 'Mahmudov', 'Boltayeva', 'Rustamov',
  'Qosimova', 'Salimov', 'Yodgorova', 'Vohidov', 'Tursunova', 'G‘aniyev',
  'Xolliyeva', 'Ochilov', 'Ergasheva', 'Nematov', 'Sattorova', 'Xolboyev',
  'Ibrohimova', 'Ro‘ziyev', 'Ahmedova', 'Shermatov', 'Yusupova', 'Berdiyev',
  'Kamolova', 'Xayitov', 'Nasriddinova', 'Davronov',
]

const ISM_ERKAK = [
  'Aziz', 'Bekzod', 'Dilshod', 'Elyor', 'Farrux', 'G‘ayrat', 'Husan', 'Ilhom',
  'Jasur', 'Komil', 'Lazizbek', 'Mansur', 'Nodir', 'Otabek', 'Rustam', 'Sanjar',
  'Temur', 'Ulug‘bek', 'Vali', 'Zafar',
]

const ISM_AYOL = [
  'Aziza', 'Barno', 'Dilnoza', 'Elmira', 'Feruza', 'Gulnora', 'Hilola', 'Iroda',
  'Jamila', 'Kamola', 'Lola', 'Malika', 'Nigora', 'Ozoda', 'Rayhona', 'Sevara',
  'Tahmina', 'Umida', 'Vazira', 'Zulfiya',
]

const OTA_ERKAK = ['Alisher', 'Bahodir', 'Doniyor', 'Erkin', 'Farhod', 'Hamid', 'Islom', 'Jahongir', 'Kamol', 'Murod', 'Nosir', 'Odil', 'Qahramon', 'Rashid', 'Shuhrat', 'Tohir', 'Ulmas', 'Yodgor', 'Zohid', 'Sherzod']

/** Mutaxassislik guruhlari — 30 sinflik maktab uchun hisoblangan shtat */
interface SpecSpec {
  speciality: string
  subjectIds: string[]
  count: number
}

export const SPECIALITY_SPEC: SpecSpec[] = [
  { speciality: 'Ona tili va adabiyot', subjectIds: ['ona_tili', 'oqish_savodxonligi', 'adabiyot'], count: 7 },
  { speciality: 'Rus tili', subjectIds: ['rus_tili'], count: 4 },
  { speciality: 'Chet tili (ingliz tili)', subjectIds: ['chet_tili'], count: 6 },
  { speciality: 'Tarix va huquq', subjectIds: ['tarixdan_hikoyalar', 'qadimgi_dunyo_tarixi', 'ozbekiston_tarixi', 'jahon_tarixi', 'davlat_huquq', 'tarbiya'], count: 5 },
  { speciality: 'Matematika', subjectIds: ['matematika', 'algebra', 'geometriya'], count: 6 },
  { speciality: 'Informatika va AT', subjectIds: ['informatika'], count: 2 },
  { speciality: 'Fizika va astronomiya', subjectIds: ['fizika', 'astronomiya', 'tabiiy_fan'], count: 2 },
  { speciality: 'Kimyo', subjectIds: ['kimyo', 'tabiiy_fan'], count: 2 },
  { speciality: 'Biologiya', subjectIds: ['biologiya', 'tabiiy_fan'], count: 2 },
  { speciality: 'Geografiya va iqtisodiyot', subjectIds: ['geografiya', 'iqtisodiy_bilim', 'tadbirkorlik', 'tabiiy_fan'], count: 2 },
  { speciality: 'Musiqa madaniyati', subjectIds: ['musiqa'], count: 2 },
  { speciality: "Tasviriy san'at va chizmachilik", subjectIds: ['tasviriy_sanat', 'chizmachilik'], count: 2 },
  { speciality: 'Texnologiya', subjectIds: ['texnologiya'], count: 2 },
  { speciality: 'Jismoniy tarbiya', subjectIds: ['jismoniy_tarbiya'], count: 3 },
  { speciality: 'CHQBT', subjectIds: ['chqbt', 'tarbiya'], count: 1 },
]

/** Boshlang'ich sinf o'qituvchisi o'qitadigan fanlar */
export const PRIMARY_SUBJECTS = [
  'ona_tili',
  'oqish_savodxonligi',
  'matematika',
  'tarbiya',
  'texnologiya',
  'tasviriy_sanat',
  'informatika',
  'tabiiy_fan',
]

export function defaultClasses(): SchoolClass[] {
  const out: SchoolClass[] = []
  // 1-sinfdan 10-sinfgacha, har darajada 3 tadan sinf (A, B, D) = 30 sinf
  for (let grade = 1; grade <= 10; grade++) {
    for (const letter of ['A', 'B', 'D']) {
      out.push({
        id: `${grade}${letter}`,
        grade,
        letter,
        studentsCount: 24 + ((grade * 3 + letter.charCodeAt(0)) % 9),
      })
    }
  }
  return out
}

export function defaultTeachers(classes: SchoolClass[]): Teacher[] {
  const rng = makeRng(20262027)
  const used = new Set<string>()
  let famIdx = 0

  const makeName = (): string => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const fam = FAMILIYA[famIdx % FAMILIYA.length]
      famIdx++
      const ayol = fam.endsWith('a') || fam.endsWith('va') || fam.endsWith('yeva')
      const ism = ayol
        ? ISM_AYOL[Math.floor(rng() * ISM_AYOL.length)]
        : ISM_ERKAK[Math.floor(rng() * ISM_ERKAK.length)]
      const ota = OTA_ERKAK[Math.floor(rng() * OTA_ERKAK.length)]
      const suffix = ayol ? 'qizi' : "o'g'li"
      const name = `${fam} ${ism} ${ota} ${suffix}`
      if (!used.has(name)) {
        used.add(name)
        return name
      }
    }
    return `O'qituvchi ${used.size + 1}`
  }

  const teachers: Teacher[] = []

  // 1) Boshlang'ich sinf o'qituvchilari — har bir 1–4 sinfga bittadan
  const primaryClasses = classes.filter((c) => c.grade <= 4)
  for (const c of primaryClasses) {
    teachers.push({
      id: `t-b-${c.id}`,
      fullName: makeName(),
      speciality: "Boshlang'ich ta'lim",
      subjectIds: [...PRIMARY_SUBJECTS],
      minHours: 4,
      maxHours: 24,
      homeroomClassId: c.id,
      unavailableDays: [],
    })
  }

  // 2) Fan o'qituvchilari
  let n = 1
  for (const spec of SPECIALITY_SPEC) {
    for (let i = 0; i < spec.count; i++) {
      teachers.push({
        id: `t-f-${n++}`,
        fullName: makeName(),
        speciality: spec.speciality,
        subjectIds: [...spec.subjectIds],
        minHours: 4,
        maxHours: 24,
        unavailableDays: [],
      })
    }
  }

  return teachers
}

export function defaultSettings(): Settings {
  return {
    schoolName: '1-son umumiy o‘rta ta’lim maktabi',
    maxPerDayByGrade: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6 },
    daysPrimary: 5,
    daysSenior: 6,
    maxTeacherGapPerDay: 1,
    maxTeacherLessonsPerDay: 7,
    doubleLessonTolerance: 15,
    solverIterations: 400000,
    seed: 12345,
    stabilityWeight: 40,
  }
}
