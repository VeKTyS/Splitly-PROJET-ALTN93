import { describe, expect, it } from 'vitest'
import { formatCents, formatShortDate, parseAmountToCents, todayLocal } from '../money'

describe('parseAmountToCents', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['  0,01 ', 1],
    // Le piege classique : 19.99 * 100 vaut 1998.9999999999998 en JavaScript.
    ['19,99', 1999],
    ['0,29', 29],
    ['1,15', 115],
  ])('"%s" -> %i centimes', (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents)
  })

  it.each([[''], ['abc'], ['0'], ['0,00'], ['-5'], ['12,345'], ['12,'], [',5'], ['1 000'], ['12€']])(
    '"%s" est refuse',
    (input) => {
      expect(parseAmountToCents(input)).toBeNull()
    },
  )

  it('aucun montant a 2 decimales ne perd un centime (0,00 a 99,99)', () => {
    for (let cents = 1; cents < 10_000; cents++) {
      const input = `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
      expect(parseAmountToCents(input)).toBe(cents)
    }
  })
})

describe('affichage', () => {
  it('formate des centimes en euros, au format francais', () => {
    // Intl utilise des espaces insecables : on les normalise pour comparer.
    expect(formatCents(1250, 'EUR').replace(/\s/g, ' ')).toBe('12,50 €')
  })

  it('date du jour en heure locale, et date courte', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(formatShortDate('2026-11-20')).toBe('20 nov.')
  })
})
