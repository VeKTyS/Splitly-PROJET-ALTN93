import type { Expense, Group, NewExpense, Participant } from '../types'

/** Erreur d'appel a l'API, avec un message deja lisible par l'utilisateur. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const SERVER_DOWN = 'Le serveur ne répond pas. Réessaie dans un instant.'

/**
 * URLs toujours relatives (/api/...) : en dev le proxy Vite les redirige,
 * dans Kubernetes la gateway les route. Jamais de http://localhost en dur.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    // fetch ne rejette que si le reseau ou le serveur est injoignable.
    throw new ApiError(0, SERVER_DOWN)
  }

  if (!res.ok) {
    throw new ApiError(res.status, messageFor(res.status))
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

/**
 * On n'affiche pas le detail technique renvoye par le serveur : il est pense pour un developpeur.
 * Les cas metier (code inconnu, groupe disparu) sont geres par chaque ecran grace au status.
 */
function messageFor(status: number): string {
  if (status === 400) {
    return 'Vérifie les informations saisies.'
  }
  if (status === 404) {
    return 'Introuvable.'
  }
  // 409 : expense-service refuse un payeur ou beneficiaire qui n'est plus dans le groupe (RG3).
  if (status === 409) {
    return 'Une des personnes choisies ne fait plus partie du groupe.'
  }
  if (status >= 500) {
    return SERVER_DOWN
  }
  return 'Une erreur est survenue.'
}

export const api = {
  createGroup(name: string, currency: string): Promise<Group> {
    return request('/api/groups', { method: 'POST', body: JSON.stringify({ name, currency }) })
  },

  getGroup(id: number): Promise<Group> {
    return request(`/api/groups/${id}`)
  },

  findGroupByInviteCode(code: string): Promise<Group> {
    return request(`/api/groups/invite/${encodeURIComponent(code.trim())}`)
  },

  addParticipant(groupId: number, name: string): Promise<Participant> {
    return request(`/api/groups/${groupId}/participants`, { method: 'POST', body: JSON.stringify({ name }) })
  },

  removeParticipant(groupId: number, participantId: number): Promise<void> {
    return request(`/api/groups/${groupId}/participants/${participantId}`, { method: 'DELETE' })
  },

  listExpenses(groupId: number): Promise<Expense[]> {
    return request(`/api/expenses?groupId=${groupId}`)
  },

  addExpense(expense: NewExpense): Promise<Expense> {
    return request('/api/expenses', { method: 'POST', body: JSON.stringify(expense) })
  },

  deleteExpense(id: number): Promise<void> {
    return request(`/api/expenses/${id}`, { method: 'DELETE' })
  },
}
