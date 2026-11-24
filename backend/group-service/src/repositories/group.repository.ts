import type { Pool } from 'pg';
import { DuplicateInviteCodeError } from '../lib/errors';

export interface Participant {
  id: number;
  name: string;
}

export interface Group {
  id: number;
  name: string;
  currency: string;
  inviteCode: string;
  createdAt: string; // ISO 8601
  participants: Participant[];
}

export interface NewGroup {
  name: string;
  currency: string;
  inviteCode: string;
  createdAt: Date;
}

/** Contrat d'acces aux donnees : le service metier ne connait que cette interface, pas le SQL. */
export interface GroupRepository {
  /**
   * Insere le groupe. L'unicite du code d'invitation est garantie par la base (contrainte UNIQUE) :
   * rejette avec DuplicateInviteCodeError si le code est deja pris.
   */
  create(group: NewGroup): Promise<Group>;
  findById(id: number): Promise<Group | null>;
  findByInviteCode(code: string): Promise<Group | null>;
  addParticipant(groupId: number, name: string): Promise<Participant>;
  /** false si le participant n'existe pas dans CE groupe. */
  removeParticipant(groupId: number, participantId: number): Promise<boolean>;
}

/** Code d'erreur PostgreSQL d'une violation de contrainte UNIQUE. */
const UNIQUE_VIOLATION = '23505';

interface GroupRow {
  id: number;
  name: string;
  currency: string;
  invite_code: string;
  created_at: Date;
}

export class SqlGroupRepository implements GroupRepository {
  constructor(private readonly db: Pool) {}

  async create(group: NewGroup): Promise<Group> {
    try {
      const { rows } = await this.db.query<GroupRow>(
        `INSERT INTO split_group (name, currency, invite_code, created_at)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [group.name, group.currency, group.inviteCode, group.createdAt],
      );
      return toGroup(rows[0], []);
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new DuplicateInviteCodeError(group.inviteCode);
      }
      throw err;
    }
  }

  async findById(id: number): Promise<Group | null> {
    const { rows } = await this.db.query<GroupRow>('SELECT * FROM split_group WHERE id = $1', [id]);
    return rows[0] ? this.withParticipants(rows[0]) : null;
  }

  async findByInviteCode(code: string): Promise<Group | null> {
    const { rows } = await this.db.query<GroupRow>('SELECT * FROM split_group WHERE invite_code = $1', [code]);
    return rows[0] ? this.withParticipants(rows[0]) : null;
  }

  async addParticipant(groupId: number, name: string): Promise<Participant> {
    const { rows } = await this.db.query<Participant>(
      'INSERT INTO participant (group_id, name) VALUES ($1, $2) RETURNING id, name',
      [groupId, name],
    );
    return rows[0];
  }

  async removeParticipant(groupId: number, participantId: number): Promise<boolean> {
    // La condition sur group_id empeche de supprimer un participant d'un autre groupe.
    const { rowCount } = await this.db.query('DELETE FROM participant WHERE id = $1 AND group_id = $2', [
      participantId,
      groupId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  private async withParticipants(row: GroupRow): Promise<Group> {
    const { rows } = await this.db.query<Participant>(
      'SELECT id, name FROM participant WHERE group_id = $1 ORDER BY id',
      [row.id],
    );
    return toGroup(row, rows);
  }
}

function toGroup(row: GroupRow, participants: Participant[]): Group {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    inviteCode: row.invite_code,
    createdAt: new Date(row.created_at).toISOString(),
    participants: participants.map((p) => ({ id: p.id, name: p.name })),
  };
}
