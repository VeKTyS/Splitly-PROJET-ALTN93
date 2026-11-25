/** 404 : la ressource demandee n'existe pas. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** 409 : la requete est bien formee, mais viole une regle metier (ex. RG3 : payeur hors du groupe). */
export class RuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleViolationError';
  }
}

/** 503 : group-service ne repond pas, on ne peut pas verifier la depense. */
export class GroupServiceUnavailableError extends Error {
  constructor() {
    super('group-service est injoignable');
    this.name = 'GroupServiceUnavailableError';
  }
}
