export interface Participant {
  id: number
  name: string
}

export interface Group {
  id: number
  name: string
  currency: string
  inviteCode: string
  createdAt: string
  participants: Participant[]
}

/** Categories acceptees par expense-service, avec leur libelle a l'ecran. */
export const CATEGORIES = {
  repas: 'Repas',
  courses: 'Courses',
  transport: 'Transport',
  logement: 'Logement',
  loisirs: 'Loisirs',
  autre: 'Autre',
} as const

export type Category = keyof typeof CATEGORIES

export interface Expense {
  id: number
  groupId: number
  label: string
  amountCents: number
  payerId: number
  beneficiaryIds: number[]
  category: Category
  date: string // AAAA-MM-JJ
  createdAt: string
}

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>

/** Ce que le navigateur retient d'un groupe pour l'afficher dans « Mes groupes ». */
export interface KnownGroup {
  id: number
  name: string
}
