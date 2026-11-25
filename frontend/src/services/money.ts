/**
 * Convertit une saisie en euros ("12", "12,5", "12.50") en centimes entiers (RG1).
 * On travaille sur le texte, sans multiplier un nombre a virgule : 19.99 * 100 donne 1998.9999999999998 en JavaScript.
 * Renvoie null si la saisie n'est pas un montant positif avec 2 decimales au plus.
 */
export function parseAmountToCents(input: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(input.trim())
  if (!match) {
    return null
  }
  const euros = Number(match[1])
  const cents = Number((match[2] ?? '').padEnd(2, '0'))
  const total = euros * 100 + cents
  return total > 0 ? total : null
}

/** 1250 centimes -> "12,50 €" (format francais, devise du groupe). */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100)
}

/** Date du jour au format AAAA-MM-JJ, en heure locale (toISOString donnerait la date UTC, fausse apres minuit en hiver). */
export function todayLocal(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "2026-11-20" -> "20 nov." */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d))
}
