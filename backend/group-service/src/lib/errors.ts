export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Levee par le repository quand le code d'invitation est deja pris (equivalent d'une violation de contrainte UNIQUE). */
export class DuplicateInviteCodeError extends Error {
  constructor(code: string) {
    super(`Code d'invitation ${code} deja utilise`);
    this.name = 'DuplicateInviteCodeError';
  }
}
