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

/** Ce que le navigateur retient d'un groupe pour l'afficher dans « Mes groupes ». */
export interface KnownGroup {
  id: number
  name: string
}
