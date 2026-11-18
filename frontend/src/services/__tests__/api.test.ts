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
