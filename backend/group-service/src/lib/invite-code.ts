import { randomInt } from 'node:crypto';

/** Sans 0/O ni 1/I/L : on les confond quand on lit le code a voix haute ou qu'on le recopie. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

/** Renvoie un entier dans [0, max). Injectable pour rendre les tests deterministes. */
export type RandomIntFn = (max: number) => number;

export type InviteCodeGenerator = () => string;

export function createInviteCodeGenerator(random: RandomIntFn = randomInt): InviteCodeGenerator {
  return () => {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_ALPHABET[random(INVITE_CODE_ALPHABET.length)];
    }
    return code;
  };
}
