import {
  IcoDashboard, IcoClasses, IcoTeachers, IcoCurriculum, IcoTarif, IcoRules, IcoGenerate,
  IcoSchedule, IcoReport, IcoExcel, IcoInbox, IcoGlobe, IcoUserCog,
} from '../components/icons'

export interface AdminNavItem {
  id: string
  /** `/boshqaruv` ostidagi yo'l */
  path: string
  label: string
  Icon: typeof IcoDashboard
  /** Faqat direktorga ko'rinadi */
  directorOnly?: boolean
  /** Bo'limlar guruhi */
  group: "O'quv jarayoni" | "Ma'lumotlar" | 'Boshqaruv'
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: 'dashboard', path: '', label: 'Boshqaruv paneli', Icon: IcoDashboard, group: "O'quv jarayoni" },
  { id: 'classes', path: 'sinflar', label: 'Sinflar', Icon: IcoClasses, group: "Ma'lumotlar" },
  { id: 'teachers', path: 'oqituvchilar', label: "O'qituvchilar", Icon: IcoTeachers, group: "Ma'lumotlar" },
  { id: 'curriculum', path: 'oquv-reja', label: "O'quv reja", Icon: IcoCurriculum, group: "Ma'lumotlar" },
  { id: 'tarif', path: 'tarifikatsiya', label: 'Tarifikatsiya', Icon: IcoTarif, group: "Ma'lumotlar" },
  { id: 'excel', path: 'excel', label: 'Excel', Icon: IcoExcel, group: "Ma'lumotlar" },
  { id: 'rules', path: 'shartlar', label: 'Shartlar va izohlar', Icon: IcoRules, group: "O'quv jarayoni" },
  { id: 'generate', path: 'yaratish', label: 'Jadval yaratish', Icon: IcoGenerate, group: "O'quv jarayoni" },
  { id: 'schedule', path: 'jadval', label: 'Dars jadvali', Icon: IcoSchedule, group: "O'quv jarayoni" },
  { id: 'report', path: 'tekshiruv', label: 'Tekshiruv', Icon: IcoReport, group: "O'quv jarayoni" },
  { id: 'requests', path: 'sorovlar', label: "O'qituvchi so'rovlari", Icon: IcoInbox, group: 'Boshqaruv' },
  { id: 'site', path: 'sayt', label: 'Rasmiy sayt', Icon: IcoGlobe, group: 'Boshqaruv', directorOnly: true },
  { id: 'users', path: 'foydalanuvchilar', label: 'Foydalanuvchilar', Icon: IcoUserCog, group: 'Boshqaruv', directorOnly: true },
]

export type PageId = (typeof ADMIN_NAV)[number]['id']

export const NAV_GROUPS: AdminNavItem['group'][] = ["O'quv jarayoni", "Ma'lumotlar", 'Boshqaruv']

/** Bo'lim identifikatoridan to'liq yo'l */
export function adminPath(id: string): string {
  const item = ADMIN_NAV.find((n) => n.id === id)
  return item ? `/boshqaruv${item.path ? '/' + item.path : ''}` : '/boshqaruv'
}
