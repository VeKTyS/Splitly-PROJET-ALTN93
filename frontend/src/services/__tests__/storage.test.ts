import { describe, expect, it } from 'vitest'
import { createLocalStore, type KeyValueStorage } from '../storage'

function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('createLocalStore', () => {
  it('retient les groupes, le plus recent en tete, sans doublon, en mettant le nom a jour', () => {
    const store = createLocalStore(fakeStorage())

    store.rememberGroup({ id: 1, name: 'Lyon' })
    store.rememberGroup({ id: 2, name: 'Ski' })
    store.rememberGroup({ id: 1, name: 'Lyon 2026' })

    expect(store.getKnownGroups()).toEqual([
      { id: 1, name: 'Lyon 2026' },
      { id: 2, name: 'Ski' },
    ])
  })

  it('ne stocke que id et nom, pas le code d invitation ni les participants', () => {
    const storage = fakeStorage()
    const store = createLocalStore(storage)

    store.rememberGroup({ id: 1, name: 'Lyon', inviteCode: 'ABC234' } as never)

    expect(storage.data.get('splitly:groups')).toBe('[{"id":1,"name":"Lyon"}]')
  })

  it('ignore une valeur corrompue ou mal formee au lieu de planter', () => {
    expect(createLocalStore(fakeStorage({ 'splitly:groups': '{pas du json' })).getKnownGroups()).toEqual([])
    expect(createLocalStore(fakeStorage({ 'splitly:groups': '{"id":1}' })).getKnownGroups()).toEqual([])
    expect(
      createLocalStore(fakeStorage({ 'splitly:groups': '[{"id":1,"name":"ok"},{"id":"x"},null]' })).getKnownGroups(),
    ).toEqual([{ id: 1, name: 'ok' }])
  })

  it('garde le choix « Je suis » par groupe, et l efface', () => {
    const store = createLocalStore(fakeStorage())

    store.setMe(1, 7)
    store.setMe(2, 9)
    expect(store.getMe(1)).toBe(7)
    expect(store.getMe(2)).toBe(9)

    store.setMe(1, null)
    expect(store.getMe(1)).toBeNull()
  })

  it('oublier un groupe efface aussi le choix « Je suis » associe', () => {
    const store = createLocalStore(fakeStorage())
    store.rememberGroup({ id: 1, name: 'Lyon' })
    store.setMe(1, 7)

    store.forgetGroup(1)

    expect(store.getKnownGroups()).toEqual([])
    expect(store.getMe(1)).toBeNull()
  })

  it('fonctionne sans stockage, ou avec un stockage qui refuse tout (navigation privee)', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }

    for (const store of [createLocalStore(null), createLocalStore(throwing)]) {
      expect(() => store.rememberGroup({ id: 1, name: 'Lyon' })).not.toThrow()
      expect(store.getKnownGroups()).toEqual([])
      expect(store.getMe(1)).toBeNull()
    }
  })
})
