import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api'

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) {
      throw response
    }
    return response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api', () => {
  it('cree un groupe en POST sur une URL relative, avec un corps JSON', async () => {
    const fetchMock = mockFetch(json(201, { id: 1, name: 'Lyon' }))

    const group = await api.createGroup('Lyon', 'EUR')

    expect(group).toEqual({ id: 1, name: 'Lyon' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/groups')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Lyon', currency: 'EUR' })
  })

  it('encode le code d invitation dans l URL', async () => {
    const fetchMock = mockFetch(json(200, {}))

    await api.findGroupByInviteCode(' ab/c ')

    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('/api/groups/invite/ab%2Fc')
  })

  it('une suppression qui repond 204 (sans corps) ne plante pas', async () => {
    mockFetch(new Response(null, { status: 204 }))

    await expect(api.removeParticipant(1, 2)).resolves.toBeUndefined()
  })

  it('transforme une reponse 404 en ApiError avec le status', async () => {
    mockFetch(json(404, { status: 404, detail: 'Groupe 9 introuvable' }))

    const err = await api.getGroup(9).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(404)
  })

  it('depenses : liste par groupe, ajout en POST, suppression en DELETE', async () => {
    const fetchMock = mockFetch(json(200, []))
    await api.listExpenses(3)
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('/api/expenses?groupId=3')

    const added = mockFetch(json(201, { id: 1 }))
    const expense = {
      groupId: 3,
      label: 'Pizza',
      amountCents: 1500,
      payerId: 1,
      beneficiaryIds: [1, 2],
      category: 'repas' as const,
      date: '2026-11-24',
    }
    await api.addExpense(expense)
    const [url, init] = added.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/expenses')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(expense)

    const deleted = mockFetch(new Response(null, { status: 204 }))
    await api.deleteExpense(7)
    const [deleteUrl, deleteInit] = deleted.mock.calls[0] as unknown as [string, RequestInit]
    expect(deleteUrl).toBe('/api/expenses/7')
    expect(deleteInit.method).toBe('DELETE')
  })

  it('409 (personne hors du groupe) : message lisible', async () => {
    mockFetch(json(409, { detail: 'Le payeur 99 ne fait pas partie du groupe 1' }))

    const err = (await api.addExpense({} as never).catch((e: unknown) => e)) as ApiError

    expect(err.status).toBe(409)
    expect(err.message).toBe('Une des personnes choisies ne fait plus partie du groupe.')
  })

  it('serveur injoignable ou en erreur : message lisible, sans detail technique', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    await expect(api.getGroup(1)).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('ne répond pas'),
    })

    mockFetch(json(500, { detail: 'stack trace interne' }))
    const err = (await api.getGroup(1).catch((e: unknown) => e)) as ApiError
    expect(err.message).not.toContain('stack')
  })
})
