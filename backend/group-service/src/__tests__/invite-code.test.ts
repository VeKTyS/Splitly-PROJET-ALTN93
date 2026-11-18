import { describe, expect, it } from 'vitest';
import { createInviteCodeGenerator, INVITE_CODE_ALPHABET } from '../lib/invite-code';

describe('createInviteCodeGenerator', () => {
  it('produit 6 caracteres pris dans l alphabet sans caracteres ambigus', () => {
    const next = createInviteCodeGenerator();
    for (let i = 0; i < 200; i++) {
      const code = next();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      expect([...code].every((c) => INVITE_CODE_ALPHABET.includes(c))).toBe(true);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('ne depend que de la source d aleatoire injectee', () => {
    const alwaysFirst = createInviteCodeGenerator(() => 0);
    const alwaysLast = createInviteCodeGenerator((max) => max - 1);

    expect(alwaysFirst()).toBe('AAAAAB');
    expect(alwaysLast()).toBe('999999');
  });
});
