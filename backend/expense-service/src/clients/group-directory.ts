import { GroupServiceUnavailableError } from '../lib/errors';

/**
 * Ce dont expense-service a besoin de group-service : les participants d'un groupe.
 * C'est une interface pour que les tests du service metier n'aient pas besoin d'un vrai group-service.
 */
export interface GroupDirectory {
  /** Ids des participants du groupe, ou null si le groupe n'existe pas. */
  getParticipantIds(groupId: number): Promise<number[] | null>;
}

const TIMEOUT_MS = 2000;

/** Implementation reelle : appel REST a group-service (GET /api/groups/{id}). */
export class HttpGroupDirectory implements GroupDirectory {
  constructor(private readonly baseUrl: string) {}

  async getParticipantIds(groupId: number): Promise<number[] | null> {
    let res: Response;
    try {
      // Timeout : si group-service est bloque, on repond 503 vite au lieu de faire attendre le client.
      res = await fetch(`${this.baseUrl}/api/groups/${groupId}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new GroupServiceUnavailableError();
    }

    if (res.status === 404) return null;
    if (!res.ok) throw new GroupServiceUnavailableError();

    const group = (await res.json()) as { participants: { id: number }[] };
    return group.participants.map((p) => p.id);
  }
}
