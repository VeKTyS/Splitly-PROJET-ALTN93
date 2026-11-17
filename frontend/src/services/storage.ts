import type { KnownGroup } from '../types'

/** Le sous-ensemble de localStorage dont on a besoin : permet de tester avec un faux stockage. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const GROUPS_KEY = 'splitly:groups'
const meKey = (groupId: number) => `splitly:me:${groupId}`

/**
 * Memoire du navigateur : les groupes connus et le choix « Je suis… » par groupe.
 * Le stockage peut etre absent ou refuser d'ecrire (navigation privee, quota, donnees effacees) :
 * chaque acces est protege, et l'application marche quand meme, elle oublie juste entre deux visites.
 */
export function createLocalStore(storage: KeyValueStorage | null) {
  function read(key: string): string | null {
    try {
      return storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  function write(key: string, value: string | null) {
    try {
      if (value === null) storage?.removeItem(key)
      else storage?.setItem(key, value)
    } catch {
      // Ecriture refusee : on continue sans memoriser.
    }
  }

  function getKnownGroups(): KnownGroup[] {
    try {
      const parsed: unknown = JSON.parse(read(GROUPS_KEY) ?? '[]')
      if (!Array.isArray(parsed)) return []
      // Donnee venant du navigateur : on ne garde que les entrees bien formees.
      return parsed.filter(
        (g): g is KnownGroup => typeof g?.id === 'number' && typeof g?.name === 'string',
      )
    } catch {
      return []
    }
  }

  return {
    getKnownGroups,

    /** Ajoute le groupe en tete de liste, ou le remonte et met son nom a jour s'il y est deja. */
    rememberGroup(group: KnownGroup) {
      const others = getKnownGroups().filter((g) => g.id !== group.id)
      write(GROUPS_KEY, JSON.stringify([{ id: group.id, name: group.name }, ...others]))
    },

    forgetGroup(groupId: number) {
      write(GROUPS_KEY, JSON.stringify(getKnownGroups().filter((g) => g.id !== groupId)))
      write(meKey(groupId), null)
    },

    getMe(groupId: number): number | null {
      const value = Number(read(meKey(groupId)))
      return Number.isInteger(value) && value > 0 ? value : null
    },

    setMe(groupId: number, participantId: number | null) {
      write(meKey(groupId), participantId === null ? null : String(participantId))
    },
  }
}

export type LocalStore = ReturnType<typeof createLocalStore>

function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const localStore = createLocalStore(browserStorage())
